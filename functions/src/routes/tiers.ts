import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog, logAuditEntry } from '../services/audit.js';
import { reassignAllDevices, previewTierAssignment, simulateEligibility } from '../services/tierEngine.js';
import type { HardwareTier, DeviceSpec } from '../types/index.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('hardwareTiers').orderBy('tierRank', 'asc').get();
    const tiers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ data: tiers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list tiers', detail: String(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('hardwareTiers').doc((req.params.id as string)).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Tier not found' });
      return;
    }

    const devicesSnap = await db.collection('devices').where('tierId', '==', (req.params.id as string)).get();

    res.json({
      id: doc.id,
      ...doc.data(),
      assignedDeviceCount: devicesSnap.size,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get tier', detail: String(err) });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { tierName, tierRank, ramMin, gpuMin, cpuSpeedMin, cpuCoresMin, requiredCodecs, require64Bit } = req.body;

    if (!tierName || tierRank == null) {
      res.status(400).json({ error: 'tierName and tierRank are required' });
      return;
    }

    const now = new Date().toISOString();
    const docRef = await db.collection('hardwareTiers').add({
      tierName,
      tierRank,
      ramMin: ramMin ?? null,
      gpuMin: gpuMin ?? null,
      cpuSpeedMin: cpuSpeedMin ?? null,
      cpuCoresMin: cpuCoresMin ?? null,
      requiredCodecs: requiredCodecs ?? [],
      require64Bit: require64Bit ?? false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEntry({
      entityType: 'hardwareTier',
      entityId: docRef.id,
      field: '*',
      oldValue: null,
      newValue: tierName,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    const created = await docRef.get();
    res.status(201).json({ id: docRef.id, ...created.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create tier', detail: String(err) });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const docRef = db.collection('hardwareTiers').doc((req.params.id as string));
    const existing = await docRef.get();
    if (!existing.exists) {
      res.status(404).json({ error: 'Tier not found' });
      return;
    }

    const oldData = existing.data()!;
    const updates = {
      ...req.body,
      version: (oldData.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    delete updates.id;
    delete updates.createdAt;

    await docRef.update(updates);
    await diffAndLog('hardwareTier', (req.params.id as string), oldData, updates, req.user!.uid, req.user!.email);

    const reassigned = await reassignAllDevices();

    const updated = await docRef.get();
    res.json({ id: docRef.id, ...updated.data(), devicesReassigned: reassigned });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tier', detail: String(err) });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const docRef = db.collection('hardwareTiers').doc((req.params.id as string));
    const existing = await docRef.get();
    if (!existing.exists) {
      res.status(404).json({ error: 'Tier not found' });
      return;
    }

    await docRef.delete();
    await logAuditEntry({
      entityType: 'hardwareTier',
      entityId: (req.params.id as string),
      field: '*',
      oldValue: existing.data()!.tierName,
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete tier', detail: String(err) });
  }
});

router.post('/preview', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const tiers: HardwareTier[] = req.body.tiers;
    if (!tiers || !Array.isArray(tiers)) {
      res.status(400).json({ error: 'tiers array is required' });
      return;
    }

    const specsSnap = await db.collection('deviceSpecs').get();
    const specs = specsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as DeviceSpec);
    const result = previewTierAssignment(tiers, specs);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to preview tier assignment', detail: String(err) });
  }
});

router.post('/simulate', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const specsSnap = await db.collection('deviceSpecs').get();
    const specs = specsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as DeviceSpec);
    const result = simulateEligibility(req.body, specs);

    res.json({
      eligibleCount: result.eligible.length,
      ineligibleCount: result.ineligible.length,
      eligible: result.eligible.map((s) => s.deviceId),
      ineligible: result.ineligible.map((s) => s.deviceId),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to simulate eligibility', detail: String(err) });
  }
});

export default router;
