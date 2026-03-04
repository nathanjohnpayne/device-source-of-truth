import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';
import {
  isValidRequestType,
  jaroWinklerSimilarity,
} from '../services/intakeParser.js';
import type { IntakeRegion, MatchConfidence } from '../types/index.js';

const router = Router();

const FUZZY_THRESHOLD = 0.90;

interface PartnerDoc {
  id: string;
  displayName: string;
  displayNameLower: string;
}

interface PreviewPartnerMatch {
  partnerNameRaw: string;
  partnerId: string | null;
  partnerDisplayName: string | null;
  matchConfidence: MatchConfidence;
  similarityScore?: number;
}

interface PreviewWarning {
  type: string;
  field: string;
  rawValue: string;
  message: string;
}

interface ParsedRow {
  rowIndex: number;
  airtableSubject: string;
  requestType: string;
  requestStatus: string;
  requestPhase: string | null;
  countries: string[] | null;
  regions: IntakeRegion[] | null;
  tamNames: string[] | null;
  ieLeadNames: string[] | null;
  targetLaunchDate: string | null;
  releaseTargets: string[] | null;
  rawPartnerNames: string[];
  overrides?: Record<string, string>;
}

interface PreviewRow extends ParsedRow {
  partnerMatches: PreviewPartnerMatch[];
  warnings: PreviewWarning[];
  errors: PreviewWarning[];
  status: 'ready' | 'warning' | 'error';
  skipped?: boolean;
}

// ── POST /preview — Partner matching + enriched preview ──

router.post('/preview', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { rows } = req.body as { rows: ParsedRow[] };

    if (!rows || !Array.isArray(rows)) {
      res.status(400).json({ error: 'rows array is required' });
      return;
    }

    req.log?.info('Intake preview requested', { rowCount: rows.length, userId: req.user!.uid });

    const partnersSnap = await db.collection('partners').get();
    const partners: PartnerDoc[] = partnersSnap.docs.map(doc => ({
      id: doc.id,
      displayName: doc.data().displayName || '',
      displayNameLower: (doc.data().displayName || '').toLowerCase().trim(),
    }));

    const previewRows: PreviewRow[] = rows.map(row => {
      const warnings: PreviewWarning[] = [];
      const errors: PreviewWarning[] = [];

      if (!row.airtableSubject?.trim()) {
        errors.push({
          type: 'blank_subject',
          field: 'Request Subject',
          rawValue: '',
          message: 'Request Subject is blank — row will be skipped.',
        });
      }

      if (row.requestType && !isValidRequestType(row.requestType)) {
        errors.push({
          type: 'unrecognized_request_type',
          field: 'RequestType',
          rawValue: row.requestType,
          message: `Unrecognized request type: "${row.requestType}"`,
        });
      }

      const partnerMatches: PreviewPartnerMatch[] = row.rawPartnerNames.map(rawName => {
        const trimmed = rawName.trim();
        if (!trimmed) return { partnerNameRaw: rawName, partnerId: null, partnerDisplayName: null, matchConfidence: 'unmatched' as MatchConfidence };

        const lower = trimmed.toLowerCase();

        const exact = partners.find(p => p.displayNameLower === lower);
        if (exact) {
          return {
            partnerNameRaw: trimmed,
            partnerId: exact.id,
            partnerDisplayName: exact.displayName,
            matchConfidence: 'exact' as MatchConfidence,
          };
        }

        let bestMatch: PartnerDoc | null = null;
        let bestScore = 0;
        for (const p of partners) {
          const score = jaroWinklerSimilarity(lower, p.displayNameLower);
          if (score >= FUZZY_THRESHOLD && score > bestScore) {
            bestScore = score;
            bestMatch = p;
          }
        }

        if (bestMatch) {
          return {
            partnerNameRaw: trimmed,
            partnerId: bestMatch.id,
            partnerDisplayName: bestMatch.displayName,
            matchConfidence: 'fuzzy' as MatchConfidence,
            similarityScore: Math.round(bestScore * 100) / 100,
          };
        }

        return {
          partnerNameRaw: trimmed,
          partnerId: null,
          partnerDisplayName: null,
          matchConfidence: 'unmatched' as MatchConfidence,
        };
      });

      const hasUnmatched = partnerMatches.some(m => m.matchConfidence === 'unmatched');
      if (hasUnmatched) {
        const unmatchedNames = partnerMatches.filter(m => m.matchConfidence === 'unmatched').map(m => m.partnerNameRaw);
        warnings.push({
          type: 'unmatched_partner',
          field: 'Partner',
          rawValue: unmatchedNames.join(', '),
          message: `No matching partner found for: ${unmatchedNames.join(', ')}`,
        });
      }

      // Pass through any warnings from client-side normalization
      if (row.overrides) {
        // Warnings are already embedded in the row from client-side parsing
      }

      let status: 'ready' | 'warning' | 'error' = 'ready';
      if (errors.length > 0) status = 'error';
      else if (warnings.length > 0) status = 'warning';

      return { ...row, partnerMatches, warnings, errors, status };
    });

    const readyCount = previewRows.filter(r => r.status === 'ready').length;
    const warningCount = previewRows.filter(r => r.status === 'warning').length;
    const errorCount = previewRows.filter(r => r.status === 'error').length;

    req.log?.info('Intake preview complete', { readyCount, warningCount, errorCount });

    res.json({
      rows: previewRows,
      summary: {
        total: previewRows.length,
        ready: readyCount,
        warnings: warningCount,
        errors: errorCount,
      },
    });
  } catch (err) {
    req.log?.error('Intake preview failed', formatError(err));
    res.status(500).json({ error: 'Preview failed', detail: String(err) });
  }
});

// ── POST /import — Transactional write ──

router.post('/import', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { rows, fileName } = req.body as { rows: PreviewRow[]; fileName: string };

    if (!rows || !Array.isArray(rows)) {
      res.status(400).json({ error: 'rows array is required' });
      return;
    }

    req.log?.info('Intake import started', { rowCount: rows.length, fileName, userId: req.user!.uid });

    const importBatchId = crypto.randomUUID();
    const now = new Date().toISOString();
    const importedBy = req.user!.email;

    const importableRows = rows.filter(r => !r.skipped && r.errors.length === 0);
    const skippedCount = rows.length - importableRows.length;

    const MAX_BATCH_OPS = 450;
    let totalImported = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < importableRows.length; i += MAX_BATCH_OPS) {
      const chunk = importableRows.slice(i, i + MAX_BATCH_OPS);
      const batch = db.batch();

      for (const row of chunk) {
        try {
          const requestRef = db.collection('intakeRequests').doc();

          const countries = row.overrides
            ? applyCountryOverrides(row.countries, row.overrides)
            : row.countries;

          batch.set(requestRef, {
            airtableSubject: row.airtableSubject,
            requestType: row.requestType,
            requestStatus: row.requestStatus || 'Approved & Provisioned',
            requestPhase: row.requestPhase || null,
            countries: countries || null,
            regions: row.regions || null,
            tamNames: row.tamNames || null,
            ieLeadNames: row.ieLeadNames || null,
            targetLaunchDate: row.targetLaunchDate || null,
            releaseTargets: row.releaseTargets || null,
            importedAt: now,
            importedBy,
            importBatchId,
          });

          for (const pm of row.partnerMatches) {
            const partnerRef = db.collection('intakeRequestPartners').doc();
            batch.set(partnerRef, {
              intakeRequestId: requestRef.id,
              partnerNameRaw: pm.partnerNameRaw,
              partnerId: pm.partnerId || null,
              matchConfidence: pm.matchConfidence,
            });
          }

          totalImported++;
        } catch (rowErr) {
          allErrors.push(`Row ${row.rowIndex}: ${String(rowErr)}`);
        }
      }

      await batch.commit();
    }

    const batchRef = db.collection('intakeImportHistory').doc();
    await batchRef.set({
      importBatchId,
      importedAt: now,
      importedBy,
      fileName: fileName || 'IntakeRequests.csv',
      totalRows: rows.length,
      importedCount: totalImported,
      skippedCount,
    });

    await logAuditEntry({
      entityType: 'intakeRequest',
      entityId: importBatchId,
      field: 'import',
      oldValue: null,
      newValue: JSON.stringify({
        fileName,
        totalRows: rows.length,
        imported: totalImported,
        skipped: skippedCount,
      }),
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Intake import complete', { importBatchId, totalImported, skippedCount });

    res.json({
      success: true,
      importBatchId,
      importedCount: totalImported,
      skippedCount,
      errorCount: allErrors.length,
      errors: allErrors.slice(0, 100),
    });
  } catch (err) {
    req.log?.error('Intake import failed', formatError(err));
    res.status(500).json({ error: 'Import failed', detail: String(err) });
  }
});

// ── GET / — List intake requests (paginated) ──

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    const totalSnap = await db.collection('intakeRequests').count().get();
    const total = totalSnap.data().count;

    const snap = await db.collection('intakeRequests')
      .orderBy('importedAt', 'desc')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    req.log?.error('Failed to list intake requests', formatError(err));
    res.status(500).json({ error: 'Failed to list intake requests', detail: String(err) });
  }
});

// ── GET /history — Import batch history ──

router.get('/history', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('intakeImportHistory')
      .orderBy('importedAt', 'desc')
      .get();

    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ data });
  } catch (err) {
    req.log?.error('Failed to list import history', formatError(err));
    res.status(500).json({ error: 'Failed to list import history', detail: String(err) });
  }
});

// ── GET /:id — Intake request detail with linked partners ──

router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const id = String(req.params.id);
    const doc = await db.collection('intakeRequests').doc(id).get();

    if (!doc.exists) {
      res.status(404).json({ error: 'Intake request not found' });
      return;
    }

    const partnersSnap = await db.collection('intakeRequestPartners')
      .where('intakeRequestId', '==', doc.id)
      .get();

    const partners = partnersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    res.json({ id: doc.id, ...doc.data(), partners });
  } catch (err) {
    req.log?.error('Failed to get intake request', formatError(err));
    res.status(500).json({ error: 'Failed to get intake request', detail: String(err) });
  }
});

// ── DELETE /rollback/:batchId — Rollback an import batch ──

router.delete('/rollback/:batchId', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const batchId = String(req.params.batchId);

    req.log?.info('Intake rollback requested', { batchId, userId: req.user!.uid });

    const historySnap = await db.collection('intakeImportHistory')
      .where('importBatchId', '==', batchId)
      .limit(1)
      .get();

    if (historySnap.empty) {
      res.status(404).json({ error: 'Import batch not found' });
      return;
    }

    const historyDoc = historySnap.docs[0];
    const historyData = historyDoc.data();

    const importDate = new Date(historyData.importedAt);
    const now = new Date();
    const daysSinceImport = (now.getTime() - importDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceImport > 30) {
      res.status(400).json({
        error: 'Rollback window expired',
        detail: `This batch was imported ${Math.floor(daysSinceImport)} days ago. Rollback is only available within 30 days.`,
      });
      return;
    }

    const requestsSnap = await db.collection('intakeRequests')
      .where('importBatchId', '==', batchId)
      .get();

    const requestIds = requestsSnap.docs.map(d => d.id);

    let deletedRequests = 0;
    let deletedPartners = 0;

    for (let i = 0; i < requestsSnap.docs.length; i += 450) {
      const chunk = requestsSnap.docs.slice(i, i + 450);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.delete(doc.ref);
        deletedRequests++;
      }
      await batch.commit();
    }

    for (const requestId of requestIds) {
      const partnersSnap = await db.collection('intakeRequestPartners')
        .where('intakeRequestId', '==', requestId)
        .get();

      for (let i = 0; i < partnersSnap.docs.length; i += 450) {
        const chunk = partnersSnap.docs.slice(i, i + 450);
        const batch = db.batch();
        for (const doc of chunk) {
          batch.delete(doc.ref);
          deletedPartners++;
        }
        await batch.commit();
      }
    }

    const historyBatch = db.batch();
    historyBatch.delete(historyDoc.ref);
    await historyBatch.commit();

    await logAuditEntry({
      entityType: 'intakeRequest',
      entityId: batchId,
      field: 'rollback',
      oldValue: JSON.stringify({
        importedBy: historyData.importedBy,
        importedAt: historyData.importedAt,
        importedCount: historyData.importedCount,
      }),
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Intake rollback complete', { batchId, deletedRequests, deletedPartners });

    res.json({
      success: true,
      deletedRequests,
      deletedPartners,
    });
  } catch (err) {
    req.log?.error('Intake rollback failed', formatError(err));
    res.status(500).json({ error: 'Rollback failed', detail: String(err) });
  }
});

function applyCountryOverrides(
  countries: string[] | null,
  overrides: Record<string, string>,
): string[] | null {
  if (!countries) return null;
  return countries.map(code => {
    if (code === 'SK' && overrides['SK']) return overrides['SK'];
    if (code.startsWith('UNKNOWN:') && overrides[code]) return overrides[code];
    return code;
  }).filter(c => c !== 'SKIP');
}

export default router;
