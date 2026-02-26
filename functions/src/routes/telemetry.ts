import { Router } from 'express';
import admin from 'firebase-admin';
import Papa from 'papaparse';
import { requireRole } from '../middleware/auth.js';
import { formatError } from '../services/logger.js';

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

    let successCount = 0;
    const errors: string[] = [];
    const deviceCounts: Record<string, number> = {};

    const batch = db.batch();
    for (const row of rows) {
      try {
        const uniqueDevices = parseInt(row.count_unique_device_id) || 0;
        const eventCount = parseInt(row.count) || 0;

        const docRef = db.collection('telemetrySnapshots').doc();
        batch.set(docRef, {
          partnerKey: row.partner ?? '',
          deviceId: row.device ?? '',
          coreVersion: row.core_version ?? '',
          uniqueDevices,
          eventCount,
          snapshotDate,
        });

        const deviceKey = row.device ?? '';
        if (deviceKey) {
          deviceCounts[deviceKey] = (deviceCounts[deviceKey] ?? 0) + uniqueDevices;
        }

        successCount++;
      } catch (rowErr) {
        errors.push(`Row error: ${String(rowErr)}`);
      }
    }

    req.log?.debug('Committing telemetry batch write', { successCount, errorCount: errors.length });
    await batch.commit();
    req.log?.info('Telemetry batch write committed', { successCount });

    req.log?.debug('Updating device active counts', { deviceCount: Object.keys(deviceCounts).length });
    for (const [deviceId, count] of Object.entries(deviceCounts)) {
      const devSnap = await db.collection('devices').where('deviceId', '==', deviceId).limit(1).get();
      if (!devSnap.empty) {
        await devSnap.docs[0].ref.update({ activeDeviceCount: count });
      }
    }
    req.log?.info('Device active counts updated', { devicesUpdated: Object.keys(deviceCounts).length });

    const allPartnerKeys = new Set(rows.map((r) => r.partner).filter(Boolean));
    const allDeviceIds = new Set(rows.map((r) => r.device).filter(Boolean));
    const alertBatch = db.batch();
    const now = new Date().toISOString();
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
            partnerKey: rows.find((r) => r.device === devId)?.partner ?? '',
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
    });

    req.log?.info('Telemetry upload complete', {
      rowCount: rows.length,
      successCount,
      errorCount: errors.length,
      devicesUpdated: Object.keys(deviceCounts).length,
      newPartnerKeyAlerts,
      newDeviceAlerts,
    });

    res.json({
      success: true,
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
    const history = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    req.log?.info('Upload history listed', { count: history.length });
    res.json({ data: history });
  } catch (err) {
    req.log?.error('Failed to list upload history', formatError(err));
    res.status(500).json({ error: 'Failed to list upload history', detail: String(err) });
  }
});

export default router;
