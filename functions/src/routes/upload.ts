import { Router } from 'express';
import admin from 'firebase-admin';
import Papa from 'papaparse';
import { requireRole } from '../middleware/auth.js';
import { logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';
import { safeNumber } from '../services/safeNumber.js';
import { stripEmoji } from '../services/intakeParser.js';
import { loadPartnerResolutionContext, resolvePartnerName } from '../services/partnerResolver.js';

const router = Router();

const COLUMN_ALIASES: Record<string, string> = {
  'Device': 'displayName',
  'Device ID': 'deviceId',
  'device_id': 'deviceId',
  'Vendor': 'vendor',
  'Region': 'region',
  'Country': 'country',
  'Device Type': 'deviceType',
  'device_type': 'deviceType',
  'Live ADK Version': 'liveAdkVersion',
  'adk_version': 'liveAdkVersion',
  '64 bit': 'is64Bit',
  'DRM': 'drm',
  'Tech Questionnaire': 'questionnaireUrl',
  'questionnaire_url': 'questionnaireUrl',
  'Partner': 'partnerName',
  'partner_key': 'vendor',
  'display_name': 'displayName',
  'displayName': 'displayName',
  'deviceId': 'deviceId',
  'certification_status': 'certificationStatus',
  'certification_notes': 'certificationNotes',
  'active_device_count': 'activeDeviceCount',
};


function normalizeRow(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [csvCol, value] of Object.entries(raw)) {
    const trimmedCol = csvCol.trim();
    const mapped = COLUMN_ALIASES[trimmedCol] ?? trimmedCol;
    if (!out[mapped]) out[mapped] = stripEmoji((value ?? '').trim());
  }
  return out;
}


router.post('/migration', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { csvData } = req.body;

    if (!csvData) {
      req.log?.warn('Migration upload failed: missing csvData');
      res.status(400).json({ error: 'csvData is required' });
      return;
    }

    req.log?.info('Starting device migration', { csvLength: csvData.length, userId: req.user!.uid });

    const parsed = Papa.parse<Record<string, string>>(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      req.log?.warn('Migration CSV parse errors', { errorCount: parsed.errors.length, errors: parsed.errors.slice(0, 5).map((e) => e.message) });
      res.status(400).json({
        error: 'CSV parse errors',
        detail: parsed.errors.map((e) => e.message),
      });
      return;
    }

    req.log?.info('Migration CSV parsed', { rowCount: parsed.data.length });

    const importBatchId = crypto.randomUUID();
    const now = new Date().toISOString();
    let created = 0;
    let duplicates = 0;
    let errored = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    const partnerCtx = await loadPartnerResolutionContext(db);
    req.log?.info('Partner resolution context loaded', {
      partnerCount: partnerCtx.partners.length,
      aliasCount: partnerCtx.aliases.length,
    });

    const partnerToKeyCache: Record<string, string> = {};
    async function lookupPartnerKeyByPartnerId(partnerId: string): Promise<string> {
      if (!partnerId) return '';
      if (partnerToKeyCache[partnerId]) return partnerToKeyCache[partnerId];
      const snap = await db.collection('partnerKeys').where('partnerId', '==', partnerId).limit(1).get();
      if (!snap.empty) {
        partnerToKeyCache[partnerId] = snap.docs[0].id;
        return snap.docs[0].id;
      }
      return '';
    }

    const partnerKeyCache: Record<string, string> = {};
    async function lookupPartnerKeyBySlug(vendor: string): Promise<string> {
      if (!vendor) return '';
      if (partnerKeyCache[vendor]) return partnerKeyCache[vendor];
      const snap = await db.collection('partnerKeys').where('key', '==', vendor).limit(1).get();
      if (!snap.empty) {
        partnerKeyCache[vendor] = snap.docs[0].id;
        return snap.docs[0].id;
      }
      return '';
    }

    let partnerMatched = 0;
    let partnerUnmatched = 0;
    const matchBreakdown: Record<string, number> = { exact: 0, alias_direct: 0, alias_contextual: 0, fuzzy: 0, unmatched: 0, vendor_key: 0 };

    for (const rawRow of parsed.data) {
      try {
        const row = normalizeRow(rawRow);
        const deviceId = row['deviceId'] || '';
        if (!deviceId) {
          errored++;
          errors.push(`Row missing Device ID: "${row['displayName'] || '(unnamed)'}" skipped`);
          continue;
        }

        const partnerName = row['partnerName'] || '';
        const vendorSlug = row['vendor'] || '';
        const region = row['region'] || '';
        const country = row['country'] || '';

        let partnerKeyId = '';
        let pendingPartnerKey: string | null = null;

        const resolution = resolvePartnerName(partnerName, partnerCtx, {
          region,
          country_iso: country,
        });

        if (resolution.partnerId) {
          partnerKeyId = await lookupPartnerKeyByPartnerId(resolution.partnerId);
          partnerMatched++;
          matchBreakdown[resolution.matchConfidence] = (matchBreakdown[resolution.matchConfidence] || 0) + 1;
          if (resolution.warning) {
            warnings.push(`Row "${deviceId}": ${resolution.warning}`);
          }
        } else if (vendorSlug) {
          partnerKeyId = await lookupPartnerKeyBySlug(vendorSlug);
          if (partnerKeyId) {
            partnerMatched++;
            matchBreakdown['vendor_key']++;
          } else {
            pendingPartnerKey = vendorSlug;
            partnerUnmatched++;
            matchBreakdown['unmatched']++;
            warnings.push(`Row "${deviceId}": Partner "${partnerName || vendorSlug}" unmatched — requires manual assignment`);
          }
        } else {
          partnerUnmatched++;
          matchBreakdown['unmatched']++;
          if (partnerName) {
            warnings.push(`Row "${deviceId}": Partner "${partnerName}" unmatched — requires manual assignment`);
          }
        }

        const existing = await db.collection('devices').where('deviceId', '==', deviceId).limit(1).get();
        if (!existing.empty) {
          duplicates++;
          continue;
        }

        await db.collection('devices').add({
          displayName: row['displayName'] || deviceId,
          deviceId,
          partnerKeyId,
          pendingPartnerKey,
          deviceType: row['deviceType'] === 'ADK' ? 'STB' : (row['deviceType'] || 'Other'),
          status: 'active',
          liveAdkVersion: row['liveAdkVersion'] || null,
          certificationStatus: row['certificationStatus'] || 'Not Submitted',
          certificationNotes: row['certificationNotes'] || null,
          lastCertifiedDate: null,
          questionnaireUrl: row['questionnaireUrl'] || null,
          questionnaireFileUrl: null,
          activeDeviceCount: safeNumber(row['activeDeviceCount']),
          specCompleteness: 0,
          tierId: null,
          tierAssignedAt: null,
          importBatchId,
          createdAt: now,
          updatedAt: now,
        });
        created++;
      } catch (rowErr) {
        errored++;
        errors.push(`Error on device: ${String(rowErr)}`);
        req.log?.warn('Migration row error', { error: String(rowErr) });
      }
    }

    await db.collection('migrationHistory').add({
      importBatchId,
      importedAt: now,
      importedBy: req.user!.uid,
      importedByEmail: req.user!.email,
      fileName: req.body.fileName ?? 'AllModels.csv',
      totalRows: parsed.data.length,
      created,
      duplicates,
      errored,
    });

    await logAuditEntry({
      entityType: 'device',
      entityId: importBatchId,
      field: 'migration',
      oldValue: null,
      newValue: JSON.stringify({ created, duplicates, errored }),
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Device migration complete', {
      importBatchId,
      totalRows: parsed.data.length,
      created,
      duplicates,
      errored,
      partnerMatched,
      partnerUnmatched,
      matchBreakdown,
      errorSample: errors.slice(0, 5),
    });

    res.json({
      success: true,
      importBatchId,
      totalRows: parsed.data.length,
      created,
      duplicates,
      errored,
      partnerMatched,
      partnerUnmatched,
      matchBreakdown,
      errors: errors.slice(0, 100),
      warnings: warnings.slice(0, 200),
    });
  } catch (err) {
    req.log?.error('Migration failed', formatError(err));
    res.status(500).json({ error: 'Migration failed', detail: String(err) });
  }
});

router.get('/migration/history', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('migrationHistory').orderBy('importedAt', 'desc').get();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const data = snap.docs.map((d) => {
      const docData = d.data();
      return {
        id: d.id,
        ...docData,
        rollbackAvailable: docData.importedAt > thirtyDaysAgo,
      };
    });

    res.json({ data });
  } catch (err) {
    req.log?.error('Failed to list migration history', formatError(err));
    res.status(500).json({ error: 'Failed to list migration history', detail: String(err) });
  }
});

router.delete('/migration/rollback/:batchId', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const importBatchId = String(req.params.batchId);

    req.log?.info('Migration rollback requested', { importBatchId, userId: req.user!.uid });

    const historySnap = await db.collection('migrationHistory')
      .where('importBatchId', '==', importBatchId)
      .limit(1)
      .get();

    if (historySnap.empty) {
      res.status(404).json({ error: 'Migration batch not found' });
      return;
    }

    const historyDoc = historySnap.docs[0];
    const historyData = historyDoc.data();

    const importDate = new Date(historyData.importedAt);
    const daysSince = (Date.now() - importDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) {
      res.status(400).json({
        error: 'Rollback window expired',
        detail: `This batch was imported ${Math.floor(daysSince)} days ago. Rollback is only available within 30 days.`,
      });
      return;
    }

    const devicesSnap = await db.collection('devices')
      .where('importBatchId', '==', importBatchId)
      .get();

    let deletedDevices = 0;
    let deletedSpecs = 0;

    for (let i = 0; i < devicesSnap.docs.length; i += 450) {
      const chunk = devicesSnap.docs.slice(i, i + 450);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.delete(doc.ref);
        deletedDevices++;
      }
      await batch.commit();
    }

    const deviceDocIds = devicesSnap.docs.map(d => d.id);
    for (const docId of deviceDocIds) {
      const specsSnap = await db.collection('deviceSpecs').where('deviceId', '==', docId).get();
      for (const specDoc of specsSnap.docs) {
        await specDoc.ref.delete();
        deletedSpecs++;
      }
    }

    await historyDoc.ref.delete();

    await logAuditEntry({
      entityType: 'device',
      entityId: importBatchId,
      field: 'migrationRollback',
      oldValue: JSON.stringify({
        importedBy: historyData.importedByEmail,
        importedAt: historyData.importedAt,
        created: historyData.created,
      }),
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Migration rollback complete', { importBatchId, deletedDevices, deletedSpecs });
    res.json({ success: true, deletedDevices, deletedSpecs });
  } catch (err) {
    req.log?.error('Migration rollback failed', formatError(err));
    res.status(500).json({ error: 'Rollback failed', detail: String(err) });
  }
});

router.post('/bulk-specs', requireRole('editor', 'admin'), async (_req, res) => {
  res.status(501).json({
    error: 'Bulk spec import is temporarily disabled',
    detail: 'The import schema is being updated to match the current 16-section questionnaire format. Use the spec editor UI to enter specifications.',
  });
});

router.get('/migration/template', (req, res) => {
  req.log?.debug('Serving migration template');
  const headers = [
    'device_id',
    'display_name',
    'partner_key',
    'device_type',
    'adk_version',
    'certification_status',
    'certification_notes',
    'questionnaire_url',
    'active_device_count',
  ];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="migration_template.csv"');
  res.send(headers.join(',') + '\n');
});

router.get('/bulk-specs/template', (_req, res) => {
  res.status(501).json({
    error: 'Bulk spec template is temporarily unavailable',
    detail: 'The import schema is being updated to match the current 16-section questionnaire format.',
  });
});

const WIPEABLE_COLLECTIONS = [
  'devices', 'deviceSpecs', 'deviceDeployments', 'deviceTierAssignments',
  'partners', 'partnerKeys',
  'telemetrySnapshots', 'alerts', 'uploadHistory', 'auditLog',
];

router.delete('/clear-all', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { confirm } = req.body;
    if (confirm !== 'DELETE_ALL_DATA') {
      res.status(400).json({ error: 'Send { "confirm": "DELETE_ALL_DATA" } to proceed' });
      return;
    }

    req.log?.warn('Clearing all data collections', { userId: req.user!.uid });
    const counts: Record<string, number> = {};

    for (const col of WIPEABLE_COLLECTIONS) {
      let deleted = 0;
      let batch = await db.collection(col).limit(500).get();
      while (!batch.empty) {
        const writeBatch = db.batch();
        batch.docs.forEach((doc) => writeBatch.delete(doc.ref));
        await writeBatch.commit();
        deleted += batch.size;
        batch = await db.collection(col).limit(500).get();
      }
      counts[col] = deleted;
      req.log?.info('Cleared collection', { collection: col, deleted });
    }

    await logAuditEntry({
      entityType: 'system',
      entityId: 'clear-all',
      field: '*',
      oldValue: JSON.stringify(counts),
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    res.json({ success: true, deleted: counts });
  } catch (err) {
    req.log?.error('Failed to clear data', formatError(err));
    res.status(500).json({ error: 'Failed to clear data', detail: String(err) });
  }
});

export default router;
