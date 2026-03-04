import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';
import {
  isValidRequestType,
  jaroWinklerSimilarity,
} from '../services/intakeParser.js';
import type { IntakeRegion, MatchConfidence, FieldDiff, DeduplicationInfo } from '../types/index.js';

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
  dedupInfo?: DeduplicationInfo;
}

// ── Natural key helpers ──

function computeIntakeNaturalKey(subject: string, partnerName: string, launchDate: string | null): string {
  return [
    (subject || '').toLowerCase().trim(),
    (partnerName || '').toLowerCase().trim(),
    (launchDate || ''),
  ].join('|');
}

const INTAKE_COMPARE_FIELDS = [
  'requestType', 'requestStatus', 'requestPhase',
] as const;

function diffIntakeRow(
  existing: Record<string, unknown>,
  incoming: ParsedRow,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const field of INTAKE_COMPARE_FIELDS) {
    const ev = String(existing[field] ?? '');
    const iv = String(incoming[field] ?? '');
    if (ev !== iv) {
      diffs.push({ field, existingValue: ev || null, incomingValue: iv || null });
    }
  }
  const existingCountries = JSON.stringify((existing.countries as string[]) ?? []);
  const incomingCountries = JSON.stringify(incoming.countries ?? []);
  if (existingCountries !== incomingCountries) {
    diffs.push({ field: 'countries', existingValue: existingCountries, incomingValue: incomingCountries });
  }
  const existingRegions = JSON.stringify((existing.regions as string[]) ?? []);
  const incomingRegions = JSON.stringify(incoming.regions ?? []);
  if (existingRegions !== incomingRegions) {
    diffs.push({ field: 'regions', existingValue: existingRegions, incomingValue: incomingRegions });
  }
  return diffs;
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

    // Load all existing intake requests for dedup comparison
    const existingSnap = await db.collection('intakeRequests').get();
    const existingByKey = new Map<string, { id: string; data: Record<string, unknown> }>();
    for (const doc of existingSnap.docs) {
      const d = doc.data();
      const partnerLinks = await db.collection('intakeRequestPartners')
        .where('intakeRequestId', '==', doc.id)
        .limit(1)
        .get();
      const partnerNameRaw = partnerLinks.empty ? '' : partnerLinks.docs[0].data().partnerNameRaw ?? '';
      const key = computeIntakeNaturalKey(
        d.airtableSubject as string,
        partnerNameRaw,
        d.targetLaunchDate as string | null,
      );
      existingByKey.set(key, { id: doc.id, data: d as Record<string, unknown> });
    }

    // Track within-file natural keys for intra-file dedup
    const seenInFile = new Map<string, number>();

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

      // Deduplication check
      let dedupInfo: DeduplicationInfo | undefined;
      const primaryPartner = row.rawPartnerNames[0] ?? '';
      const naturalKey = computeIntakeNaturalKey(row.airtableSubject, primaryPartner, row.targetLaunchDate);

      // Within-file dedup
      if (seenInFile.has(naturalKey)) {
        dedupInfo = {
          dedupStatus: 'duplicate_in_file',
          duplicateOfRow: seenInFile.get(naturalKey)!,
        };
      } else {
        seenInFile.set(naturalKey, row.rowIndex);

        // Check against existing DST records
        const existing = existingByKey.get(naturalKey);
        if (existing) {
          const diffs = diffIntakeRow(existing.data, row);
          if (diffs.length === 0) {
            dedupInfo = { dedupStatus: 'duplicate', existingId: existing.id, resolution: 'skip' };
          } else {
            dedupInfo = { dedupStatus: 'conflict', existingId: existing.id, diffs };
          }
        }
      }

      let status: 'ready' | 'warning' | 'error' = 'ready';
      if (errors.length > 0) status = 'error';
      else if (warnings.length > 0) status = 'warning';

      return { ...row, partnerMatches, warnings, errors, status, dedupInfo };
    });

    const readyCount = previewRows.filter(r => r.status === 'ready' || r.status === 'warning').length;
    const warningCount = previewRows.filter(r => r.status === 'warning').length;
    const errorCount = previewRows.filter(r => r.status === 'error').length;
    const newCount = previewRows.filter(r => !r.dedupInfo || r.dedupInfo.dedupStatus === 'new').length;
    const duplicateCount = previewRows.filter(r => r.dedupInfo?.dedupStatus === 'duplicate').length;
    const conflictCount = previewRows.filter(r => r.dedupInfo?.dedupStatus === 'conflict').length;
    const inFileDuplicateCount = previewRows.filter(r => r.dedupInfo?.dedupStatus === 'duplicate_in_file').length;

    req.log?.info('Intake preview complete', {
      readyCount, warningCount, errorCount,
      newCount, duplicateCount, conflictCount, inFileDuplicateCount,
    });

    res.json({
      rows: previewRows,
      summary: {
        total: previewRows.length,
        ready: readyCount,
        warnings: warningCount,
        errors: errorCount,
        newCount,
        duplicateCount,
        conflictCount,
        inFileDuplicateCount,
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

    // Filter rows: skip errors, explicitly skipped, within-file dupes, and dedup rows resolved as 'skip'
    const importableRows = rows.filter(r => {
      if (r.skipped || r.errors.length > 0) return false;
      if (r.dedupInfo?.dedupStatus === 'duplicate_in_file') return false;
      if (r.dedupInfo?.dedupStatus === 'duplicate' && r.dedupInfo.resolution !== 'overwrite') return false;
      if (r.dedupInfo?.dedupStatus === 'conflict' && r.dedupInfo.resolution === 'skip') return false;
      return true;
    });
    const skippedCount = rows.length - importableRows.length;

    const MAX_BATCH_OPS = 450;
    let newCount = 0;
    let overwrittenCount = 0;
    let mergedCount = 0;
    const allErrors: string[] = [];
    const preImportSnapshots: Array<{ existingId: string; oldData: Record<string, unknown>; operation: 'overwrite' | 'merge' }> = [];

    for (let i = 0; i < importableRows.length; i += MAX_BATCH_OPS) {
      const chunk = importableRows.slice(i, i + MAX_BATCH_OPS);
      const batch = db.batch();

      for (const row of chunk) {
        try {
          const countries = row.overrides
            ? applyCountryOverrides(row.countries, row.overrides)
            : row.countries;

          const incomingData: Record<string, unknown> = {
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
          };

          const resolution = row.dedupInfo?.resolution;
          const existingId = row.dedupInfo?.existingId;

          if (existingId && (resolution === 'overwrite' || resolution === 'merge')) {
            // Capture pre-import state for rollback
            const existingDoc = await db.collection('intakeRequests').doc(existingId).get();
            if (existingDoc.exists) {
              preImportSnapshots.push({
                existingId,
                oldData: existingDoc.data() as Record<string, unknown>,
                operation: resolution,
              });
            }

            const updateData: Record<string, unknown> = {
              updatedAt: now,
              updatedBy: importedBy,
              importBatchId,
            };

            if (resolution === 'overwrite') {
              Object.assign(updateData, incomingData);
              overwrittenCount++;
            } else {
              // Merge: only apply non-blank incoming values
              for (const [key, value] of Object.entries(incomingData)) {
                if (value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
                  updateData[key] = value;
                }
              }
              mergedCount++;
            }

            batch.update(db.collection('intakeRequests').doc(existingId), updateData);
          } else {
            // New record
            const requestRef = db.collection('intakeRequests').doc();
            batch.set(requestRef, {
              ...incomingData,
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
            newCount++;
          }
        } catch (rowErr) {
          allErrors.push(`Row ${row.rowIndex}: ${String(rowErr)}`);
        }
      }

      await batch.commit();
    }

    const totalImported = newCount + overwrittenCount + mergedCount;

    const batchRef = db.collection('intakeImportHistory').doc();
    await batchRef.set({
      importBatchId,
      importedAt: now,
      importedBy,
      fileName: fileName || 'IntakeRequests.csv',
      totalRows: rows.length,
      importedCount: totalImported,
      skippedCount,
      newCount,
      overwrittenCount,
      mergedCount,
      preImportSnapshots: preImportSnapshots.length > 0
        ? JSON.stringify(preImportSnapshots)
        : null,
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
        new: newCount,
        overwritten: overwrittenCount,
        merged: mergedCount,
      }),
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Intake import complete', {
      importBatchId, totalImported, skippedCount,
      newCount, overwrittenCount, mergedCount,
    });

    res.json({
      success: true,
      importBatchId,
      importedCount: totalImported,
      skippedCount,
      newCount,
      overwrittenCount,
      mergedCount,
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

    // Restore overwritten/merged records from pre-import snapshots
    let restoredCount = 0;
    if (historyData.preImportSnapshots) {
      const snapshots: Array<{ existingId: string; oldData: Record<string, unknown>; operation: string }> =
        JSON.parse(historyData.preImportSnapshots);

      for (let i = 0; i < snapshots.length; i += 450) {
        const chunk = snapshots.slice(i, i + 450);
        const batch = db.batch();
        for (const snap of chunk) {
          const docRef = db.collection('intakeRequests').doc(snap.existingId);
          // Remove the fields we added during import and restore original data
          const restoreData = { ...snap.oldData };
          delete restoreData.updatedAt;
          delete restoreData.updatedBy;
          batch.set(docRef, restoreData);
          restoredCount++;
        }
        await batch.commit();
      }
    }

    // Delete new records added in this batch (those that have importBatchId matching and weren't updates)
    const requestsSnap = await db.collection('intakeRequests')
      .where('importBatchId', '==', batchId)
      .get();

    // Only delete records that were newly created (have importedAt, not updatedAt as primary timestamp)
    const newRecordDocs = requestsSnap.docs.filter(d => {
      const data = d.data();
      return data.importedAt && !data.updatedAt;
    });

    const requestIds = newRecordDocs.map(d => d.id);

    let deletedRequests = 0;
    let deletedPartners = 0;

    for (let i = 0; i < newRecordDocs.length; i += 450) {
      const chunk = newRecordDocs.slice(i, i + 450);
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

    req.log?.info('Intake rollback complete', { batchId, deletedRequests, deletedPartners, restoredCount });

    res.json({
      success: true,
      deletedRequests,
      deletedPartners,
      restoredCount,
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
