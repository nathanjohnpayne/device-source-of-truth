import { Router } from 'express';
import admin from 'firebase-admin';
import { formatError } from '../services/logger.js';
import { safeNumber } from '../services/safeNumber.js';
import type { Device } from '../types/index.js';

const router = Router();

router.get('/dashboard', async (req, res) => {
  try {
    const db = admin.firestore();
    req.log?.debug('Generating dashboard report');

    const [devicesSnap, alertsSnap, keysSnap, partnersSnap, tiersSnap] = await Promise.all([
      db.collection('devices').get(),
      db.collection('alerts').where('status', '==', 'open').get(),
      db.collection('partnerKeys').get(),
      db.collection('partners').get(),
      db.collection('hardwareTiers').get(),
    ]);

    req.log?.debug('Dashboard data loaded', {
      deviceCount: devicesSnap.size,
      openAlertCount: alertsSnap.size,
      keyCount: keysSnap.size,
    });

    const partnerMap = new Map<string, string>();
    for (const doc of partnersSnap.docs) {
      partnerMap.set(doc.id, (doc.data().displayName as string) ?? doc.id);
    }

    const tierMap = new Map<string, string>();
    for (const doc of tiersSnap.docs) {
      tierMap.set(doc.id, (doc.data().tierName as string) ?? doc.id);
    }

    const keyPartnerMap = new Map<string, string>();
    const keyRegionMap = new Map<string, string>();
    for (const doc of keysSnap.docs) {
      const data = doc.data();
      if (data.partnerId) keyPartnerMap.set(doc.id, data.partnerId as string);
      if (data.region) keyRegionMap.set(doc.id, data.region as string);
    }

    const devices = devicesSnap.docs.map((d) => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        activeDeviceCount: safeNumber(data.activeDeviceCount),
        specCompleteness: safeNumber(data.specCompleteness),
      } as Device;
    });

    const totalDevices = devices.length;
    const totalActiveDevices = devices.reduce((sum, d) => sum + d.activeDeviceCount, 0);

    let weightedSpecSum = 0;
    let totalWeight = 0;
    for (const d of devices) {
      const weight = d.activeDeviceCount || 1;
      weightedSpecSum += d.specCompleteness * weight;
      totalWeight += weight;
    }
    const specCoverageWeighted = totalWeight > 0 ? Math.round(weightedSpecSum / totalWeight) : 0;

    let certifiedCount = 0;
    let pendingCount = 0;
    let uncertifiedCount = 0;
    for (const d of devices) {
      const status = (d.certificationStatus ?? '').toLowerCase();
      if (status === 'certified') certifiedCount++;
      else if (status === 'pending' || status === 'in review') pendingCount++;
      else uncertifiedCount++;
    }

    const top20Devices = [...devices]
      .sort((a, b) => b.activeDeviceCount - a.activeDeviceCount)
      .slice(0, 20)
      .map((d) => {
        const partnerId = keyPartnerMap.get(d.partnerKeyId) ?? '';
        return {
          id: d.id,
          displayName: d.displayName ?? d.deviceId ?? d.id,
          partnerName: partnerMap.get(partnerId) ?? '',
          activeDeviceCount: d.activeDeviceCount,
          tierName: d.tierId ? (tierMap.get(d.tierId) ?? null) : null,
        };
      });

    const adkVersionCounts = new Map<string, number>();
    for (const d of devices) {
      const ver = d.liveAdkVersion ?? 'unknown';
      adkVersionCounts.set(ver, (adkVersionCounts.get(ver) ?? 0) + d.activeDeviceCount);
    }
    const adkVersions = [...adkVersionCounts.entries()]
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const regionAgg = new Map<string, { activeDevices: number; deviceCount: number }>();
    for (const d of devices) {
      const region = keyRegionMap.get(d.partnerKeyId) ?? 'Unknown';
      const entry = regionAgg.get(region) ?? { activeDevices: 0, deviceCount: 0 };
      entry.activeDevices += d.activeDeviceCount;
      entry.deviceCount += 1;
      regionAgg.set(region, entry);
    }
    const regionBreakdown = [...regionAgg.entries()].map(([region, stats]) => ({
      region,
      ...stats,
    }));

    req.log?.info('Dashboard report generated', {
      totalDevices,
      totalActiveDevices,
      specCoverageWeighted,
      openAlerts: alertsSnap.size,
    });

    res.json({
      totalDevices,
      totalActiveDevices,
      specCoverageWeighted,
      certifiedCount,
      pendingCount,
      uncertifiedCount,
      openAlertCount: alertsSnap.size,
      top20Devices,
      adkVersions,
      regionBreakdown,
    });
  } catch (err) {
    req.log?.error('Failed to generate dashboard', formatError(err));
    res.status(500).json({ error: 'Failed to generate dashboard', detail: String(err) });
  }
});

router.get('/partner/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const partnerId = req.params.id as string;
    req.log?.debug('Generating partner report', { partnerId });

    const partnerDoc = await db.collection('partners').doc(partnerId).get();
    if (!partnerDoc.exists) {
      req.log?.warn('Partner not found for report', { partnerId });
      res.status(404).json({ error: 'Partner not found' });
      return;
    }

    const keysSnap = await db.collection('partnerKeys').where('partnerId', '==', partnerId).get();
    const keyIds = keysSnap.docs.map((d) => d.id);

    let devices: Device[] = [];
    for (let i = 0; i < keyIds.length; i += 30) {
      const batch = keyIds.slice(i, i + 30);
      const devSnap = await db.collection('devices').where('partnerKeyId', 'in', batch).get();
      devices = devices.concat(devSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Device));
    }

    const totalActive = devices.reduce((sum, d) => sum + safeNumber(d.activeDeviceCount), 0);
    const withSpecs = devices.filter((d) => safeNumber(d.specCompleteness) > 0).length;
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

    req.log?.info('Partner report generated', {
      partnerId,
      deviceCount: devices.length,
      totalActiveDevices: totalActive,
      specCoverage,
      keyCount: keyIds.length,
    });

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
    req.log?.error('Failed to generate partner report', formatError(err));
    res.status(500).json({ error: 'Failed to generate partner report', detail: String(err) });
  }
});

router.get('/spec-coverage', async (req, res) => {
  try {
    const db = admin.firestore();
    req.log?.debug('Generating spec coverage report');

    const [devicesSnap, keysSnap, partnersSnap] = await Promise.all([
      db.collection('devices').get(),
      db.collection('partnerKeys').get(),
      db.collection('partners').get(),
    ]);

    const partnerMap = new Map<string, string>();
    for (const doc of partnersSnap.docs) {
      partnerMap.set(doc.id, (doc.data().displayName as string) ?? doc.id);
    }

    const keyInfo = new Map<string, { partnerId: string; region: string }>();
    for (const doc of keysSnap.docs) {
      const d = doc.data();
      keyInfo.set(doc.id, { partnerId: d.partnerId ?? '', region: d.region ?? '' });
    }

    const devices = devicesSnap.docs.map((d) => {
      const data = d.data();
      const key = keyInfo.get(data.partnerKeyId ?? '') ?? { partnerId: '', region: '' };
      const completeness = safeNumber(data.specCompleteness);
      const hasUrl = !!data.questionnaireUrl;
      const hasFile = !!data.questionnaireFileUrl;
      return {
        id: d.id,
        displayName: data.displayName ?? data.deviceId ?? d.id,
        partnerName: partnerMap.get(key.partnerId) ?? '',
        activeDeviceCount: safeNumber(data.activeDeviceCount),
        specCompleteness: completeness,
        questionnaireStatus: hasUrl ? 'linked' : hasFile ? 'received' : 'none',
        region: key.region || 'Unknown',
      };
    });

    let fullSpecs = 0;
    let partialSpecs = 0;
    let noSpecs = 0;
    let weightedSum = 0;
    let totalWeight = 0;
    for (const d of devices) {
      if (d.specCompleteness === 100) fullSpecs++;
      else if (d.specCompleteness > 0) partialSpecs++;
      else noSpecs++;
      const w = d.activeDeviceCount || 1;
      weightedSum += d.specCompleteness * w;
      totalWeight += w;
    }

    req.log?.info('Spec coverage report generated', { total: devices.length });
    res.json({
      summary: {
        totalDevices: devices.length,
        fullSpecs,
        partialSpecs,
        noSpecs,
        weightedCoverage: totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0,
      },
      devices,
    });
  } catch (err) {
    req.log?.error('Failed to generate spec coverage report', formatError(err));
    res.status(500).json({ error: 'Failed to generate spec coverage report', detail: String(err) });
  }
});

export default router;
