import { Router } from 'express';
import admin from 'firebase-admin';
import Papa from 'papaparse';
import { requireRole } from '../middleware/auth.js';

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
      res.status(400).json({ error: 'csvData and snapshotDate are required' });
      return;
    }

    const parsed = Papa.parse<TelemetryRow>(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      res.status(400).json({
        error: 'CSV parse errors',
        detail: parsed.errors.map((e) => e.message),
      });
      return;
    }

    const rows = parsed.data;
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

    await batch.commit();

    for (const [deviceId, count] of Object.entries(deviceCounts)) {
      const devSnap = await db.collection('devices').where('deviceId', '==', deviceId).limit(1).get();
      if (!devSnap.empty) {
        await devSnap.docs[0].ref.update({ activeDeviceCount: count });
      }
    }

    const allPartnerKeys = new Set(rows.map((r) => r.partner).filter(Boolean));
    const allDeviceIds = new Set(rows.map((r) => r.device).filter(Boolean));
    const alertBatch = db.batch();
    const now = new Date().toISOString();

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
        }
      }
    }

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
        }
      }
    }

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

    res.json({
      success: true,
      rowCount: rows.length,
      successCount,
      errorCount: errors.length,
      errors,
      devicesUpdated: Object.keys(deviceCounts).length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload telemetry', detail: String(err) });
  }
});

router.get('/history', async (_req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('uploadHistory').orderBy('uploadedAt', 'desc').limit(100).get();
    const history = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ data: history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list upload history', detail: String(err) });
  }
});

export default router;
