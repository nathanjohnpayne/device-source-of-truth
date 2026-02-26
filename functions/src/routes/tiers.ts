import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog, logAuditEntry } from '../services/audit.js';
import { reassignAllDevices, previewTierAssignment, simulateEligibility } from '../services/tierEngine.js';
import { formatError } from '../services/logger.js';
import type { HardwareTier, DeviceSpec } from '../types/index.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    req.log?.debug('Listing tiers');

    const snap = await db.collection('hardwareTiers').orderBy('tierRank', 'asc').get();
    const tiers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    req.log?.info('Tiers listed', { count: tiers.length });
    res.json({ data: tiers });
  } catch (err) {
    req.log?.error('Failed to list tiers', formatError(err));
    res.status(500).json({ error: 'Failed to list tiers', detail: String(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const tierId = req.params.id as string;
    req.log?.debug('Getting tier detail', { tierId });

    const doc = await db.collection('hardwareTiers').doc(tierId).get();
    if (!doc.exists) {
      req.log?.warn('Tier not found', { tierId });
      res.status(404).json({ error: 'Tier not found' });
      return;
    }

    const devicesSnap = await db.collection('devices').where('tierId', '==', tierId).get();

    req.log?.info('Tier detail fetched', { tierId, assignedDeviceCount: devicesSnap.size });
    res.json({
      id: doc.id,
      ...doc.data(),
      assignedDeviceCount: devicesSnap.size,
    });
  } catch (err) {
    req.log?.error('Failed to get tier', formatError(err));
    res.status(500).json({ error: 'Failed to get tier', detail: String(err) });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { tierName, tierRank, ramMin, gpuMin, cpuSpeedMin, cpuCoresMin, requiredCodecs, require64Bit } = req.body;

    if (!tierName || tierRank == null) {
      req.log?.warn('Tier creation failed: missing required fields', { hasTierName: !!tierName, hasTierRank: tierRank != null });
      res.status(400).json({ error: 'tierName and tierRank are required' });
      return;
    }

    req.log?.info('Creating tier', { tierName, tierRank, userId: req.user!.uid });

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
    req.log?.info('Tier created', { tierId: docRef.id, tierName, tierRank });
    res.status(201).json({ id: docRef.id, ...created.data() });
  } catch (err) {
    req.log?.error('Failed to create tier', formatError(err));
    res.status(500).json({ error: 'Failed to create tier', detail: String(err) });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const tierId = req.params.id as string;
    req.log?.info('Updating tier', { tierId, userId: req.user!.uid });

    const docRef = db.collection('hardwareTiers').doc(tierId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Tier not found for update', { tierId });
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
    await diffAndLog('hardwareTier', tierId, oldData, updates, req.user!.uid, req.user!.email);

    req.log?.info('Tier updated, triggering full device reassignment', { tierId, newVersion: updates.version });
    const reassigned = await reassignAllDevices();
    req.log?.info('Device reassignment complete after tier update', { tierId, devicesReassigned: reassigned });

    const updated = await docRef.get();
    res.json({ id: docRef.id, ...updated.data(), devicesReassigned: reassigned });
  } catch (err) {
    req.log?.error('Failed to update tier', formatError(err));
    res.status(500).json({ error: 'Failed to update tier', detail: String(err) });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const tierId = req.params.id as string;
    req.log?.info('Deleting tier', { tierId, userId: req.user!.uid });

    const docRef = db.collection('hardwareTiers').doc(tierId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Tier not found for deletion', { tierId });
      res.status(404).json({ error: 'Tier not found' });
      return;
    }

    const tierName = existing.data()!.tierName;
    await docRef.delete();
    await logAuditEntry({
      entityType: 'hardwareTier',
      entityId: tierId,
      field: '*',
      oldValue: tierName,
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Tier deleted', { tierId, tierName });
    res.json({ success: true });
  } catch (err) {
    req.log?.error('Failed to delete tier', formatError(err));
    res.status(500).json({ error: 'Failed to delete tier', detail: String(err) });
  }
});

router.post('/preview', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const tiers: HardwareTier[] = req.body.tiers;
    if (!tiers || !Array.isArray(tiers)) {
      req.log?.warn('Tier preview failed: invalid tiers array');
      res.status(400).json({ error: 'tiers array is required' });
      return;
    }

    req.log?.info('Previewing tier assignment', { tierCount: tiers.length });

    const specsSnap = await db.collection('deviceSpecs').get();
    const specs = specsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as DeviceSpec);
    req.log?.debug('Loaded specs for preview', { specCount: specs.length });

    const result = previewTierAssignment(tiers, specs);

    req.log?.info('Tier preview complete', {
      tierCount: tiers.length,
      specCount: specs.length,
      tierResults: Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.count])),
    });
    res.json(result);
  } catch (err) {
    req.log?.error('Failed to preview tier assignment', formatError(err));
    res.status(500).json({ error: 'Failed to preview tier assignment', detail: String(err) });
  }
});

router.post('/simulate', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    req.log?.info('Running eligibility simulation', { requirements: req.body });

    const specsSnap = await db.collection('deviceSpecs').get();
    const specs = specsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as DeviceSpec);
    const result = simulateEligibility(req.body, specs);

    req.log?.info('Eligibility simulation complete', {
      specCount: specs.length,
      eligibleCount: result.eligible.length,
      ineligibleCount: result.ineligible.length,
    });

    res.json({
      eligibleCount: result.eligible.length,
      ineligibleCount: result.ineligible.length,
      eligible: result.eligible.map((s) => s.deviceId),
      ineligible: result.ineligible.map((s) => s.deviceId),
    });
  } catch (err) {
    req.log?.error('Failed to simulate eligibility', formatError(err));
    res.status(500).json({ error: 'Failed to simulate eligibility', detail: String(err) });
  }
});

export default router;
