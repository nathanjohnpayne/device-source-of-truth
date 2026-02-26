import { Router } from 'express';
import admin from 'firebase-admin';
import type { Device } from '../types/index.js';

const router = Router();

router.get('/dashboard', async (_req, res) => {
  try {
    const db = admin.firestore();
    const [devicesSnap, alertsSnap, keysSnap] = await Promise.all([
      db.collection('devices').get(),
      db.collection('alerts').where('status', '==', 'open').get(),
      db.collection('partnerKeys').get(),
    ]);

    const devices = devicesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Device);

    const totalDevices = devices.length;
    const totalActiveDevices = devices.reduce((sum, d) => sum + (d.activeDeviceCount ?? 0), 0);

    let weightedSpecSum = 0;
    let totalWeight = 0;
    for (const d of devices) {
      const weight = d.activeDeviceCount || 1;
      weightedSpecSum += (d.specCompleteness ?? 0) * weight;
      totalWeight += weight;
    }
    const specCoverage = totalWeight > 0 ? Math.round(weightedSpecSum / totalWeight) : 0;

    const certCounts: Record<string, number> = {};
    for (const d of devices) {
      const status = d.certificationStatus ?? 'Not Submitted';
      certCounts[status] = (certCounts[status] ?? 0) + 1;
    }

    const top20 = [...devices]
      .sort((a, b) => (b.activeDeviceCount ?? 0) - (a.activeDeviceCount ?? 0))
      .slice(0, 20)
      .map((d) => ({ id: d.id, displayName: d.displayName, deviceId: d.deviceId, activeDeviceCount: d.activeDeviceCount }));

    const regionCounts: Record<string, number> = {};
    const keyRegionMap: Record<string, string> = {};
    for (const doc of keysSnap.docs) {
      const region = doc.data().region;
      if (region) keyRegionMap[doc.id] = region;
    }
    for (const d of devices) {
      const region = keyRegionMap[d.partnerKeyId] ?? 'Unknown';
      regionCounts[region] = (regionCounts[region] ?? 0) + 1;
    }

    res.json({
      totalDevices,
      totalActiveDevices,
      specCoverage,
      certificationCounts: certCounts,
      openAlertCount: alertsSnap.size,
      top20Devices: top20,
      regionBreakdown: regionCounts,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate dashboard', detail: String(err) });
  }
});

router.get('/partner/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const partnerDoc = await db.collection('partners').doc((req.params.id as string)).get();
    if (!partnerDoc.exists) {
      res.status(404).json({ error: 'Partner not found' });
      return;
    }

    const keysSnap = await db.collection('partnerKeys').where('partnerId', '==', (req.params.id as string)).get();
    const keyIds = keysSnap.docs.map((d) => d.id);

    let devices: Device[] = [];
    for (let i = 0; i < keyIds.length; i += 30) {
      const batch = keyIds.slice(i, i + 30);
      const devSnap = await db.collection('devices').where('partnerKeyId', 'in', batch).get();
      devices = devices.concat(devSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Device));
    }

    const totalActive = devices.reduce((sum, d) => sum + (d.activeDeviceCount ?? 0), 0);
    const withSpecs = devices.filter((d) => d.specCompleteness > 0).length;
    const specCoverage = devices.length > 0 ? Math.round((withSpecs / devices.length) * 100) : 0;

    const tierCounts: Record<string, number> = {};
    for (const d of devices) {
      const tier = d.tierId ?? 'unassigned';
      tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
    }

    const certCounts: Record<string, number> = {};
    for (const d of devices) {
      const status = d.certificationStatus ?? 'Not Submitted';
      certCounts[status] = (certCounts[status] ?? 0) + 1;
    }

    res.json({
      partner: { id: partnerDoc.id, ...partnerDoc.data() },
      deviceCount: devices.length,
      totalActiveDevices: totalActive,
      specCoverage,
      tierDistribution: tierCounts,
      certificationCounts: certCounts,
      devices: devices.map((d) => ({
        id: d.id,
        displayName: d.displayName,
        deviceId: d.deviceId,
        activeDeviceCount: d.activeDeviceCount,
        specCompleteness: d.specCompleteness,
        certificationStatus: d.certificationStatus,
        tierId: d.tierId,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate partner report', detail: String(err) });
  }
});

router.get('/spec-coverage', async (req, res) => {
  try {
    const db = admin.firestore();
    const sortBy = (req.query.sortBy as string) ?? 'specCompleteness';
    const sortDir = (req.query.sortDir as string) === 'asc' ? 'asc' : 'desc';
    const hasSpecs = req.query.hasSpecs as string | undefined;

    const snap = await db.collection('devices').orderBy(sortBy, sortDir as 'asc' | 'desc').get();
    let devices = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        displayName: data.displayName,
        deviceId: data.deviceId,
        specCompleteness: data.specCompleteness ?? 0,
        questionnaireUrl: data.questionnaireUrl ?? null,
        activeDeviceCount: data.activeDeviceCount ?? 0,
      };
    });

    if (hasSpecs === 'true') {
      devices = devices.filter((d) => d.specCompleteness > 0);
    } else if (hasSpecs === 'false') {
      devices = devices.filter((d) => d.specCompleteness === 0);
    }

    res.json({ data: devices, total: devices.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate spec coverage report', detail: String(err) });
  }
});

export default router;
