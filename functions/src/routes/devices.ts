import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog, logAuditEntry } from '../services/audit.js';
import { loadMergedDeviceSpecForDevice } from '../services/deviceSpecStore.js';
import { formatError } from '../services/logger.js';
import { coerceDeviceDoc, coerceTelemetrySnapshotDoc, coerceDeviceSpecDoc } from '../services/coercion.js';
import { CreateDeviceRequestSchema, UpdateDeviceRequestSchema } from '../types/index.js';
import type { Device, DeviceWithRelations } from '../types/index.js';

const router = Router();

async function getTelemetrySnapshotsForDevice(
  db: FirebaseFirestore.Firestore,
  device: Device,
): Promise<Array<Record<string, unknown>>> {
  const lookupIds = [...new Set([device.deviceId, device.id].filter(Boolean))];
  const snapshots = await Promise.all(
    lookupIds.map((lookupId) =>
      db.collection('telemetrySnapshots')
        .where('deviceId', '==', lookupId)
        .orderBy('snapshotDate', 'desc')
        .limit(20)
        .get(),
    ),
  );

  const docs = new Map<string, Record<string, unknown>>();
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      docs.set(doc.id, { id: doc.id, ...doc.data() });
    }
  }

  return [...docs.values()]
    .sort((a, b) => String(b.snapshotDate ?? '').localeCompare(String(a.snapshotDate ?? '')))
    .slice(0, 20);
}

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);
    const partnerId = req.query.partnerId as string | undefined;
    const partnerKeyId = req.query.partnerKeyId as string | undefined;
    const region = req.query.region as string | undefined;
    const deviceType = req.query.deviceType as string | undefined;
    const certificationStatus = req.query.certificationStatus as string | undefined;
    const tierId = req.query.tierId as string | undefined;
    const specCompleteness = req.query.specCompleteness as string | undefined;
    const search = req.query.search as string | undefined;

    req.log?.debug('Listing devices', {
      page, pageSize, partnerId, partnerKeyId, region,
      deviceType, certificationStatus, tierId, specCompleteness, search,
    });

    let query: admin.firestore.Query = db.collection('devices').orderBy('activeDeviceCount', 'desc');

    if (partnerKeyId) query = query.where('partnerKeyId', '==', partnerKeyId);
    if (deviceType) query = query.where('deviceType', '==', deviceType);
    if (certificationStatus) query = query.where('certificationStatus', '==', certificationStatus);
    if (tierId) query = query.where('tierId', '==', tierId);

    const snap = await query.get();
    let devices = snap.docs.map((d) => coerceDeviceDoc({ ...d.data(), id: d.id }) as Device);
    req.log?.debug('Firestore device query returned', { rawCount: devices.length });

    if (partnerId) {
      const keysSnap = await db.collection('partnerKeys').where('partnerId', '==', partnerId).get();
      const keyIds = new Set(keysSnap.docs.map((d) => d.id));
      devices = devices.filter((d) => keyIds.has(d.partnerKeyId));
      req.log?.debug('Filtered by partnerId', { partnerId, keyCount: keyIds.size, remaining: devices.length });
    }

    if (region) {
      const REGION_TO_PK: Record<string, string> = { NA: 'DOMESTIC', WORLDWIDE: 'GLOBAL' };
      const pkRegion = REGION_TO_PK[region] ?? region;
      const keysSnap = await db.collection('partnerKeys').where('regions', 'array-contains', pkRegion).get();
      const keyIds = new Set(keysSnap.docs.map((d) => d.id));
      devices = devices.filter((d) => keyIds.has(d.partnerKeyId));
      req.log?.debug('Filtered by region', { region, remaining: devices.length });
    }

    if (specCompleteness === 'has_specs') {
      devices = devices.filter((d) => d.specCompleteness > 0);
    } else if (specCompleteness === 'missing_specs') {
      devices = devices.filter((d) => d.specCompleteness === 0);
    }

    if (search) {
      const lower = search.toLowerCase();
      devices = devices.filter(
        (d) =>
          d.displayName.toLowerCase().includes(lower) ||
          d.deviceId.toLowerCase().includes(lower),
      );
      req.log?.debug('Filtered by search', { searchTerm: search, remaining: devices.length });
    }

    const total = devices.length;
    const paged = devices.slice((page - 1) * pageSize, page * pageSize);

    const keyIds = [...new Set(paged.map((d) => d.partnerKeyId).filter(Boolean))];
    const keyMap: Record<string, { partnerId: string; key: string }> = {};
    for (let i = 0; i < keyIds.length; i += 30) {
      const batch = keyIds.slice(i, i + 30);
      const kSnap = await db.collection('partnerKeys').where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
      for (const doc of kSnap.docs) {
        const data = doc.data();
        keyMap[doc.id] = { partnerId: data.partnerId, key: data.key };
      }
    }

    const partnerIds = [...new Set(Object.values(keyMap).map((k) => k.partnerId).filter(Boolean))];
    const partnerMap: Record<string, string> = {};
    for (let i = 0; i < partnerIds.length; i += 30) {
      const batch = partnerIds.slice(i, i + 30);
      const pSnap = await db.collection('partners').where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
      for (const doc of pSnap.docs) {
        partnerMap[doc.id] = doc.data().displayName;
      }
    }

    const tierIds = [...new Set(paged.map((d) => d.tierId).filter(Boolean))] as string[];
    const tierMap: Record<string, string> = {};
    for (let i = 0; i < tierIds.length; i += 30) {
      const batch = tierIds.slice(i, i + 30);
      const tSnap = await db.collection('hardwareTiers').where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
      for (const doc of tSnap.docs) {
        tierMap[doc.id] = doc.data().tierName;
      }
    }

    const results: DeviceWithRelations[] = paged.map((d) => ({
      ...d,
      partnerName: keyMap[d.partnerKeyId] ? partnerMap[keyMap[d.partnerKeyId].partnerId] : undefined,
      partnerKeyName: keyMap[d.partnerKeyId]?.key,
      tierName: d.tierId ? tierMap[d.tierId] : undefined,
    }));

    req.log?.info('Devices listed', { total, returned: results.length, page });
    res.json({
      data: results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    req.log?.error('Failed to list devices', formatError(err));
    res.status(500).json({ error: 'Failed to list devices', detail: String(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const idParam = req.params.id as string;
    req.log?.debug('Getting device detail', { idParam });

    let doc = await db.collection('devices').doc(idParam).get();
    if (!doc.exists) {
      const byDeviceId = await db.collection('devices').where('deviceId', '==', idParam).limit(1).get();
      if (byDeviceId.empty) {
        req.log?.warn('Device not found', { idParam });
        res.status(404).json({ error: 'Device not found' });
        return;
      }
      doc = byDeviceId.docs[0];
      req.log?.debug('Resolved device via deviceId fallback', { firestoreId: doc.id, deviceId: idParam });
    }

    const device = coerceDeviceDoc({ ...doc.data()!, id: doc.id }) as Device;
    req.log?.debug('Fetching device relations', { deviceId: device.deviceId, partnerKeyId: device.partnerKeyId, tierId: device.tierId });

    const [pkResult, specResult, tierResult, deployResult, telResult, auditResult] = await Promise.allSettled([
      device.partnerKeyId ? db.collection('partnerKeys').doc(device.partnerKeyId).get() : Promise.resolve(null),
      loadMergedDeviceSpecForDevice(db, device.id),
      device.tierId ? db.collection('hardwareTiers').doc(device.tierId).get() : Promise.resolve(null),
      db.collection('deviceDeployments').where('deviceId', '==', device.id).get(),
      getTelemetrySnapshotsForDevice(db, device),
      db.collection('auditLog').where('entityType', '==', 'device').where('entityId', '==', device.id).orderBy('timestamp', 'desc').limit(50).get(),
    ]);

    const pkSnap = pkResult.status === 'fulfilled' ? pkResult.value : null;
    const mergedSpec = specResult.status === 'fulfilled' ? specResult.value : null;
    const tierSnap = tierResult.status === 'fulfilled' ? tierResult.value : null;
    const deploySnap = deployResult.status === 'fulfilled' ? deployResult.value : null;
    const telSnap = telResult.status === 'fulfilled' ? telResult.value : null;
    const auditSnap = auditResult.status === 'fulfilled' ? auditResult.value : null;

    for (const [label, result] of [['telemetry', telResult], ['audit', auditResult], ['deployments', deployResult], ['spec', specResult]] as const) {
      if (result.status === 'rejected') {
        req.log?.warn(`Failed to fetch ${label} for device`, { idParam, error: String(result.reason) });
      }
    }

    let partner = null;
    if (pkSnap && pkSnap.exists) {
      const pkData = pkSnap.data()!;
      if (pkData.partnerId) {
        const partnerDoc = await db.collection('partners').doc(pkData.partnerId).get();
        partner = partnerDoc.exists ? { id: partnerDoc.id, ...partnerDoc.data() } : null;
      }
    }

    req.log?.info('Device detail fetched', {
      idParam,
      hasSpec: !!mergedSpec,
      specLookup: mergedSpec?.lookup ?? 'none',
      hasTier: !!(tierSnap && tierSnap.exists),
      deploymentCount: deploySnap?.size ?? 0,
      telemetrySnapshotCount: telSnap?.length ?? 0,
      auditEntryCount: auditSnap?.size ?? 0,
    });

    res.json({
      ...device,
      partner,
      partnerKey: pkSnap && pkSnap.exists ? { id: pkSnap.id, ...pkSnap.data() } : null,
      spec: mergedSpec ? coerceDeviceSpecDoc({ id: device.id, ...mergedSpec.mergedSpec }) : null,
      tier: tierSnap && tierSnap.exists ? { id: tierSnap.id, ...tierSnap.data() } : null,
      deployments: deploySnap ? deploySnap.docs.map((d) => ({ id: d.id, ...d.data() })) : [],
      telemetrySnapshots: telSnap ? telSnap.map((snapshot) => coerceTelemetrySnapshotDoc(snapshot)) : [],
      auditHistory: auditSnap ? auditSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : [],
    });
  } catch (err) {
    req.log?.error('Failed to get device', formatError(err));
    res.status(500).json({ error: 'Failed to get device', detail: String(err) });
  }
});

router.post('/', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const parsed = CreateDeviceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      req.log?.warn('Device creation failed: invalid payload', { issues: parsed.error.issues });
      res.status(400).json({ error: 'Invalid request payload', detail: parsed.error.issues });
      return;
    }

    const db = admin.firestore();
    const { displayName, deviceId, partnerKeyId, deviceType, liveAdkVersion, certificationStatus } = parsed.data;

    req.log?.info('Creating device', { displayName, deviceId, partnerKeyId, userId: req.user!.uid });

    const existing = await db.collection('devices').where('deviceId', '==', deviceId).limit(1).get();
    if (!existing.empty) {
      req.log?.warn('Device creation failed: duplicate deviceId', { deviceId });
      res.status(409).json({ error: 'Device with this deviceId already exists' });
      return;
    }

    const now = new Date().toISOString();
    const docRef = await db.collection('devices').add({
      displayName,
      deviceId,
      partnerKeyId,
      deviceType: deviceType ?? 'Other',
      status: 'active',
      liveAdkVersion: liveAdkVersion ?? null,
      certificationStatus: certificationStatus ?? 'Not Submitted',
      certificationNotes: null,
      lastCertifiedDate: null,
      questionnaireUrl: null,
      questionnaireFileUrl: null,
      activeDeviceCount: 0,
      specCompleteness: 0,
      tierId: null,
      tierAssignedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEntry({
      entityType: 'device',
      entityId: docRef.id,
      field: '*',
      oldValue: null,
      newValue: displayName,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    const created = await docRef.get();
    req.log?.info('Device created', { docId: docRef.id, deviceId, displayName });
    res.status(201).json({ id: docRef.id, ...created.data() });
  } catch (err) {
    req.log?.error('Failed to create device', formatError(err));
    res.status(500).json({ error: 'Failed to create device', detail: String(err) });
  }
});

router.put('/:id', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const parsed = UpdateDeviceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      req.log?.warn('Device update failed: invalid payload', { issues: parsed.error.issues });
      res.status(400).json({ error: 'Invalid request payload', detail: parsed.error.issues });
      return;
    }

    const db = admin.firestore();
    const deviceDocId = req.params.id as string;
    req.log?.info('Updating device', { deviceDocId, userId: req.user!.uid });

    const docRef = db.collection('devices').doc(deviceDocId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Device not found for update', { deviceDocId });
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const oldData = existing.data()!;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [key, value] of Object.entries(parsed.data)) {
      updates[key] = value;
    }

    await docRef.update(updates);
    await diffAndLog('device', deviceDocId, oldData, updates, req.user!.uid, req.user!.email);

    const updated = await docRef.get();
    req.log?.info('Device updated', { deviceDocId, updatedFields: Object.keys(parsed.data) });
    res.json({ id: docRef.id, ...updated.data() });
  } catch (err) {
    req.log?.error('Failed to update device', formatError(err));
    res.status(500).json({ error: 'Failed to update device', detail: String(err) });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const deviceDocId = req.params.id as string;
    req.log?.info('Deleting device', { deviceDocId, userId: req.user!.uid });

    const docRef = db.collection('devices').doc(deviceDocId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Device not found for deletion', { deviceDocId });
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const displayName = existing.data()!.displayName;
    await docRef.delete();
    await logAuditEntry({
      entityType: 'device',
      entityId: deviceDocId,
      field: '*',
      oldValue: displayName,
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Device deleted', { deviceDocId, displayName });
    res.json({ success: true });
  } catch (err) {
    req.log?.error('Failed to delete device', formatError(err));
    res.status(500).json({ error: 'Failed to delete device', detail: String(err) });
  }
});

export default router;
