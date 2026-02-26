import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog, logAuditEntry } from '../services/audit.js';
import type { Device, DeviceWithRelations } from '../types/index.js';

const router = Router();

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

    let query: admin.firestore.Query = db.collection('devices').orderBy('activeDeviceCount', 'desc');

    if (partnerKeyId) query = query.where('partnerKeyId', '==', partnerKeyId);
    if (deviceType) query = query.where('deviceType', '==', deviceType);
    if (certificationStatus) query = query.where('certificationStatus', '==', certificationStatus);
    if (tierId) query = query.where('tierId', '==', tierId);

    const snap = await query.get();
    let devices = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Device);

    if (partnerId) {
      const keysSnap = await db.collection('partnerKeys').where('partnerId', '==', partnerId).get();
      const keyIds = new Set(keysSnap.docs.map((d) => d.id));
      devices = devices.filter((d) => keyIds.has(d.partnerKeyId));
    }

    if (region) {
      const keysSnap = await db.collection('partnerKeys').where('region', '==', region).get();
      const keyIds = new Set(keysSnap.docs.map((d) => d.id));
      devices = devices.filter((d) => keyIds.has(d.partnerKeyId));
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

    res.json({
      data: results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list devices', detail: String(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('devices').doc((req.params.id as string)).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const device = { id: doc.id, ...doc.data() } as Device;

    const [pkSnap, specSnap, tierSnap, deploySnap, telSnap, auditSnap] = await Promise.all([
      db.collection('partnerKeys').doc(device.partnerKeyId).get(),
      db.collection('deviceSpecs').where('deviceId', '==', device.id).limit(1).get(),
      device.tierId ? db.collection('hardwareTiers').doc(device.tierId).get() : Promise.resolve(null),
      db.collection('deployments').where('deviceId', '==', device.id).get(),
      db.collection('telemetrySnapshots').where('deviceId', '==', device.id).orderBy('snapshotDate', 'desc').limit(20).get(),
      db.collection('auditLog').where('entityType', '==', 'device').where('entityId', '==', device.id).orderBy('timestamp', 'desc').limit(50).get(),
    ]);

    let partner = null;
    if (pkSnap.exists) {
      const pkData = pkSnap.data()!;
      const partnerDoc = await db.collection('partners').doc(pkData.partnerId).get();
      partner = partnerDoc.exists ? { id: partnerDoc.id, ...partnerDoc.data() } : null;
    }

    res.json({
      ...device,
      partner,
      partnerKey: pkSnap.exists ? { id: pkSnap.id, ...pkSnap.data() } : null,
      spec: specSnap.empty ? null : { id: specSnap.docs[0].id, ...specSnap.docs[0].data() },
      tier: tierSnap && tierSnap.exists ? { id: tierSnap.id, ...tierSnap.data() } : null,
      deployments: deploySnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      telemetrySnapshots: telSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      auditHistory: auditSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get device', detail: String(err) });
  }
});

router.post('/', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { displayName, deviceId, partnerKeyId, deviceType, certificationStatus } = req.body;

    if (!displayName || !deviceId || !partnerKeyId) {
      res.status(400).json({ error: 'displayName, deviceId, and partnerKeyId are required' });
      return;
    }

    const existing = await db.collection('devices').where('deviceId', '==', deviceId).limit(1).get();
    if (!existing.empty) {
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
      liveAdkVersion: null,
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
    res.status(201).json({ id: docRef.id, ...created.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create device', detail: String(err) });
  }
});

router.put('/:id', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const docRef = db.collection('devices').doc((req.params.id as string));
    const existing = await docRef.get();
    if (!existing.exists) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const oldData = existing.data()!;
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.id;
    delete updates.createdAt;

    await docRef.update(updates);
    await diffAndLog('device', (req.params.id as string), oldData, updates, req.user!.uid, req.user!.email);

    const updated = await docRef.get();
    res.json({ id: docRef.id, ...updated.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update device', detail: String(err) });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const docRef = db.collection('devices').doc((req.params.id as string));
    const existing = await docRef.get();
    if (!existing.exists) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    await docRef.delete();
    await logAuditEntry({
      entityType: 'device',
      entityId: (req.params.id as string),
      field: '*',
      oldValue: existing.data()!.displayName,
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete device', detail: String(err) });
  }
});

export default router;
