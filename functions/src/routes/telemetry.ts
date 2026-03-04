import { Router } from 'express';
import admin from 'firebase-admin';
import Papa from 'papaparse';
import { requireRole } from '../middleware/auth.js';
import { logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';
import { stripEmoji } from '../services/intakeParser.js';

const router = Router();

interface TelemetryRow {
  partner: string;
  device: string;
  core_version: string;
  count_unique_device_id: string;
  count: string;
}

router.post('/upload', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { csvData, snapshotDate, fileName } = req.body;

    if (!csvData || !snapshotDate) {
      req.log?.warn('Telemetry upload failed: missing required fields', { hasCsvData: !!csvData, hasSnapshotDate: !!snapshotDate });
      res.status(400).json({ error: 'csvData and snapshotDate are required' });
      return;
    }

    req.log?.info('Starting telemetry upload', {
      snapshotDate,
      fileName: fileName ?? 'telemetry.csv',
      csvLength: csvData.length,
      userId: req.user!.uid,
    });

    const parsed = Papa.parse<TelemetryRow>(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      req.log?.warn('Telemetry CSV parse errors', { errorCount: parsed.errors.length, errors: parsed.errors.slice(0, 5).map((e) => e.message) });
      res.status(400).json({
        error: 'CSV parse errors',
        detail: parsed.errors.map((e) => e.message),
      });
      return;
    }

    const rows = parsed.data;
    req.log?.info('Telemetry CSV parsed', { rowCount: rows.length });

    const uploadBatchId = crypto.randomUUID();
    const now = new Date().toISOString();

    let successCount = 0;
    const errors: string[] = [];
    const deviceCounts: Record<string, number> = {};

    const BATCH_LIMIT = 450;
    for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
      const chunk = rows.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();

      for (const row of chunk) {
        try {
          const partnerKey = stripEmoji((row.partner ?? '').trim());
          const deviceId = stripEmoji((row.device ?? '').trim());
          const uniqueDevices = parseInt(row.count_unique_device_id) || 0;
          const eventCount = parseInt(row.count) || 0;

          const docRef = db.collection('telemetrySnapshots').doc();
          batch.set(docRef, {
            partnerKey,
            deviceId,
            coreVersion: (row.core_version ?? '').trim(),
            uniqueDevices,
            eventCount,
            snapshotDate,
            uploadBatchId,
          });

          if (deviceId) {
            deviceCounts[deviceId] = (deviceCounts[deviceId] ?? 0) + uniqueDevices;
          }

          successCount++;
        } catch (rowErr) {
          errors.push(`Row error: ${String(rowErr)}`);
        }
      }

      await batch.commit();
    }

    req.log?.info('Telemetry batch writes committed', { successCount });

    req.log?.debug('Updating device active counts', { deviceCount: Object.keys(deviceCounts).length });
    for (const [deviceId, count] of Object.entries(deviceCounts)) {
      const devSnap = await db.collection('devices').where('deviceId', '==', deviceId).limit(1).get();
      if (!devSnap.empty) {
        await devSnap.docs[0].ref.update({ activeDeviceCount: count });
      }
    }
    req.log?.info('Device active counts updated', { devicesUpdated: Object.keys(deviceCounts).length });

    const allPartnerKeys = new Set(rows.map((r) => stripEmoji((r.partner ?? '').trim())).filter(Boolean));
    const allDeviceIds = new Set(rows.map((r) => stripEmoji((r.device ?? '').trim())).filter(Boolean));
    const alertBatch = db.batch();
    let newPartnerKeyAlerts = 0;
    let newDeviceAlerts = 0;

    req.log?.debug('Checking for unregistered partner keys', { keyCount: allPartnerKeys.size });
    for (const pk of allPartnerKeys) {
      const pkSnap = await db.collection('partnerKeys').where('key', '==', pk).limit(1).get();
      if (pkSnap.empty) {
        const existingAlert = await db
          .collection('alerts')
          .where('type', '==', 'new_partner_key')
          .where('partnerKey', '==', pk)
          .where('status', '==', 'open')
          .limit(1)
          .get();

        if (existingAlert.empty) {
          const alertRef = db.collection('alerts').doc();
          alertBatch.set(alertRef, {
            type: 'new_partner_key',
            partnerKey: pk,
            deviceId: null,
            firstSeen: now,
            lastSeen: now,
            uniqueDeviceCount: 0,
            status: 'open',
            dismissedBy: null,
            dismissReason: null,
            dismissedAt: null,
            consecutiveMisses: 0,
          });
          newPartnerKeyAlerts++;
        }
      }
    }

    req.log?.debug('Checking for unregistered devices', { deviceCount: allDeviceIds.size });
    for (const devId of allDeviceIds) {
      const devSnap = await db.collection('devices').where('deviceId', '==', devId).limit(1).get();
      if (devSnap.empty) {
        const existingAlert = await db
          .collection('alerts')
          .where('type', '==', 'unregistered_device')
          .where('deviceId', '==', devId)
          .where('status', '==', 'open')
          .limit(1)
          .get();

        if (existingAlert.empty) {
          const alertRef = db.collection('alerts').doc();
          alertBatch.set(alertRef, {
            type: 'unregistered_device',
            partnerKey: rows.find((r) => stripEmoji((r.device ?? '').trim()) === devId)?.partner ?? '',
            deviceId: devId,
            firstSeen: now,
            lastSeen: now,
            uniqueDeviceCount: deviceCounts[devId] ?? 0,
            status: 'open',
            dismissedBy: null,
            dismissReason: null,
            dismissedAt: null,
            consecutiveMisses: 0,
          });
          newDeviceAlerts++;
        }
      }
    }

    req.log?.debug('Committing alert batch', { newPartnerKeyAlerts, newDeviceAlerts });
    await alertBatch.commit();

    await db.collection('uploadHistory').add({
      uploadedBy: req.user!.uid,
      uploadedByEmail: req.user!.email,
      uploadedAt: now,
      fileName: fileName ?? 'telemetry.csv',
      rowCount: rows.length,
      successCount,
      errorCount: errors.length,
      snapshotDate,
      errors,
      uploadBatchId,
    });

    req.log?.info('Telemetry upload complete', {
      uploadBatchId,
      rowCount: rows.length,
      successCount,
      errorCount: errors.length,
      devicesUpdated: Object.keys(deviceCounts).length,
      newPartnerKeyAlerts,
      newDeviceAlerts,
    });

    res.json({
      success: true,
      uploadBatchId,
      rowCount: rows.length,
      successCount,
      errorCount: errors.length,
      errors,
      devicesUpdated: Object.keys(deviceCounts).length,
    });
  } catch (err) {
    req.log?.error('Failed to upload telemetry', formatError(err));
    res.status(500).json({ error: 'Failed to upload telemetry', detail: String(err) });
  }
});

router.get('/history', async (req, res) => {
  try {
    const db = admin.firestore();
    req.log?.debug('Listing upload history');

    const snap = await db.collection('uploadHistory').orderBy('uploadedAt', 'desc').limit(100).get();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const history = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        rollbackAvailable: data.uploadedAt > thirtyDaysAgo && !!data.uploadBatchId,
      };
    });

    req.log?.info('Upload history listed', { count: history.length });
    res.json({
      data: history,
      total: history.length,
      page: 1,
      pageSize: history.length,
      totalPages: 1,
    });
  } catch (err) {
    req.log?.error('Failed to list upload history', formatError(err));
    res.status(500).json({ error: 'Failed to list upload history', detail: String(err) });
  }
});

router.delete('/rollback/:batchId', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const uploadBatchId = String(req.params.batchId);

    req.log?.info('Telemetry rollback requested', { uploadBatchId, userId: req.user!.uid });

    const historySnap = await db.collection('uploadHistory')
      .where('uploadBatchId', '==', uploadBatchId)
      .limit(1)
      .get();

    if (historySnap.empty) {
      res.status(404).json({ error: 'Upload batch not found' });
      return;
    }

    const historyDoc = historySnap.docs[0];
    const historyData = historyDoc.data();

    const uploadDate = new Date(historyData.uploadedAt);
    const daysSince = (Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) {
      res.status(400).json({
        error: 'Rollback window expired',
        detail: `This batch was uploaded ${Math.floor(daysSince)} days ago. Rollback is only available within 30 days.`,
      });
      return;
    }

    const snapshotsSnap = await db.collection('telemetrySnapshots')
      .where('uploadBatchId', '==', uploadBatchId)
      .get();

    let deletedSnapshots = 0;
    for (let i = 0; i < snapshotsSnap.docs.length; i += 450) {
      const chunk = snapshotsSnap.docs.slice(i, i + 450);
      const batch = db.batch();
      for (const doc of chunk) {
        batch.delete(doc.ref);
        deletedSnapshots++;
      }
      await batch.commit();
    }

    await historyDoc.ref.delete();

    await logAuditEntry({
      entityType: 'system',
      entityId: uploadBatchId,
      field: 'telemetryRollback',
      oldValue: JSON.stringify({
        uploadedBy: historyData.uploadedByEmail,
        uploadedAt: historyData.uploadedAt,
        rowCount: historyData.rowCount,
      }),
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Telemetry rollback complete', { uploadBatchId, deletedSnapshots });
    res.json({ success: true, deletedSnapshots });
  } catch (err) {
    req.log?.error('Telemetry rollback failed', formatError(err));
    res.status(500).json({ error: 'Rollback failed', detail: String(err) });
  }
});

export default router;
