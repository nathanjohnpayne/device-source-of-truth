/**
 * DST-039 / DST-042: AI-Assisted Import Disambiguation Route
 *
 * STATUS: PRE-PRODUCTION / TESTING ONLY
 *
 * POST /api/import/disambiguate — Runs AI disambiguation on parsed import rows
 *   (DST-042: field-type batching, parallel dispatch, within-session cache)
 * POST /api/import/disambiguate/resolve — Applies admin answers to clarification questions
 */

import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import {
  disambiguateWithFieldTypeBatching,
  getRegisteredFlowIds,
} from '../services/aiImportFramework.js';
import { logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';
import type { ClarificationAnswer, DisambiguationFieldResult } from '../types/index.js';

const router = Router();

// ── POST /disambiguate — Run AI disambiguation on import rows ──

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { importType, rows } = req.body as {
      importType: string;
      rows: Record<string, unknown>[];
    };

    const validFlowIds = getRegisteredFlowIds();
    if (!importType || !validFlowIds.includes(importType)) {
      res.status(400).json({
        error: `importType must be one of: ${validFlowIds.join(', ')}`,
      });
      return;
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows array is required and must not be empty' });
      return;
    }

    req.log?.info('AI disambiguation requested (DST-042 field-type batching)', {
      importType,
      rowCount: rows.length,
      userId: req.user!.uid,
    });

    const db = admin.firestore();
    const partnersSnap = await db.collection('partners').get();
    const partners = partnersSnap.docs.map(doc => ({
      id: doc.id,
      displayName: doc.data().displayName as string,
    }));

    let fieldOptions: Record<string, string[]> | undefined;
    try {
      const foSnap = await db.collection('fieldOptions').where('isActive', '==', true).get();
      const grouped: Record<string, string[]> = {};
      for (const doc of foSnap.docs) {
        const data = doc.data();
        const key = data.dropdownKey as string;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(data.displayValue as string);
      }
      fieldOptions = grouped;
    } catch {
      // Field options are optional context
    }

    const result = await disambiguateWithFieldTypeBatching(
      importType, rows, partners, fieldOptions,
    );

    if (result.aiFallback) {
      req.log?.warn('AI disambiguation fell back to rule-based', {
        reason: result.fallbackReason,
        fieldTypeFallbacks: result.fieldTypeFallbacks,
      });
    }

    const autoResolved = result.fields.filter(f => !f.needsHuman).length;
    const questionsCount = result.questions.length;

    req.log?.info('AI disambiguation complete', {
      totalFields: result.fields.length,
      autoResolved,
      cached: result.aiStats?.cachedCount ?? 0,
      questionsGenerated: questionsCount,
      aiFallback: result.aiFallback,
    });

    if (autoResolved > 0) {
      const aiResolutions = result.fields
        .filter(f => !f.needsHuman)
        .map(f => ({
          row: f.rowIndex,
          field: f.field,
          rawValue: f.rawValue,
          resolvedValue: f.resolvedValue,
          confidence: f.confidence,
          reasoning: f.reasoning,
          resolutionSource: f.resolutionSource,
          cached: f.cached,
        }));

      await logAuditEntry({
        entityType: 'system',
        entityId: `ai-disambiguate-${Date.now()}`,
        field: 'ai_disambiguation',
        oldValue: JSON.stringify({ importType, rowCount: rows.length }),
        newValue: JSON.stringify({
          autoResolved,
          cached: result.aiStats?.cachedCount ?? 0,
          questionsGenerated: questionsCount,
          resolutions: aiResolutions.slice(0, 50),
        }),
        userId: req.user!.uid,
        userEmail: req.user!.email,
      });
    }

    res.json(result);
  } catch (err) {
    req.log?.error('AI disambiguation failed', formatError(err));
    res.status(500).json({ error: 'Disambiguation failed', detail: String(err) });
  }
});

// ── POST /disambiguate/resolve — Apply admin answers to clarification questions ──

router.post('/resolve', requireRole('admin'), async (req, res) => {
  try {
    const { importType, answers, originalFields, rows } = req.body as {
      importType: string;
      answers: ClarificationAnswer[];
      originalFields: DisambiguationFieldResult[];
      rows: Record<string, unknown>[];
    };

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: 'answers array is required' });
      return;
    }

    req.log?.info('Disambiguation resolve requested', {
      answerCount: answers.length,
      userId: req.user!.uid,
    });

    const updatedFields: DisambiguationFieldResult[] = [...originalFields];
    const answerMap = new Map(answers.map(a => [a.questionId, a]));

    for (let i = 0; i < updatedFields.length; i++) {
      const field = updatedFields[i];
      if (!field.needsHuman) continue;

      for (const answer of answers) {
        const directMatch = answer.questionId.includes(`${field.rowIndex}-${field.field}`);
        const patternMatch = answer.applyToAll && answer.questionId.includes(field.field) &&
          originalFields.some(of =>
            of.field === field.field &&
            of.rawValue === field.rawValue &&
            answerMap.has(answer.questionId),
          );

        if (directMatch || patternMatch) {
          updatedFields[i] = {
            ...field,
            resolvedValue: answer.value,
            confidence: 1.0,
            needsHuman: false,
            resolutionSource: 'human',
            overriddenByAdmin: true,
            adminValue: answer.value,
          };
          break;
        }
      }
    }

    const stillUnresolved = updatedFields.filter(f => f.needsHuman);
    if (stillUnresolved.length > 0 && rows && rows.length > 0) {
      const db = admin.firestore();
      const partnersSnap = await db.collection('partners').get();
      const partners = partnersSnap.docs.map(doc => ({
        id: doc.id,
        displayName: doc.data().displayName as string,
      }));

      const unresolvedRowIndices = new Set(stillUnresolved.map(f => f.rowIndex));
      const affectedRows = rows.filter((_, i) => unresolvedRowIndices.has(i));

      if (affectedRows.length > 0) {
        const reResult = await disambiguateWithFieldTypeBatching(
          importType, affectedRows, partners,
        );
        for (const newField of reResult.fields) {
          const idx = updatedFields.findIndex(
            f => f.rowIndex === newField.rowIndex && f.field === newField.field,
          );
          if (idx >= 0 && updatedFields[idx].needsHuman) {
            updatedFields[idx] = newField;
          }
        }
      }
    }

    const adminResolutions = updatedFields.filter(f => f.overriddenByAdmin);
    if (adminResolutions.length > 0) {
      await logAuditEntry({
        entityType: 'system',
        entityId: `disambiguation-${Date.now()}`,
        field: 'ai_disambiguation_resolve',
        oldValue: JSON.stringify(adminResolutions.map(f => ({
          row: f.rowIndex,
          field: f.field,
          rawValue: f.rawValue,
        }))),
        newValue: JSON.stringify(adminResolutions.map(f => ({
          row: f.rowIndex,
          field: f.field,
          resolvedValue: f.resolvedValue,
          adminValue: f.adminValue,
        }))),
        userId: req.user!.uid,
        userEmail: req.user!.email,
      });
    }

    const remaining = updatedFields.filter(f => f.needsHuman).length;

    req.log?.info('Disambiguation resolve complete', {
      resolved: answers.length,
      remainingQuestions: remaining,
    });

    res.json({
      fields: updatedFields,
      questions: [],
      remainingCount: remaining,
    });
  } catch (err) {
    req.log?.error('Disambiguation resolve failed', formatError(err));
    res.status(500).json({ error: 'Resolve failed', detail: String(err) });
  }
});

export default router;
