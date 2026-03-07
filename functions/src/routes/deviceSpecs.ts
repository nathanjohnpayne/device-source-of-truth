import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog } from '../services/audit.js';
import { buildCanonicalDeviceSpecWrite, loadMergedDeviceSpecForDevice } from '../services/deviceSpecStore.js';
import { calculateSpecCompleteness, repairFlatDottedSpec } from '../services/specCompleteness.js';
import { assignTierToDevice } from '../services/tierEngine.js';
import { formatError } from '../services/logger.js';
import { coerceDeviceSpecDoc } from '../services/coercion.js';
import { SPEC_CATEGORIES, SaveDeviceSpecRequestSchema } from '../types/index.js';

const router = Router();

router.post('/repair', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const allSpecs = await db.collection('deviceSpecs').get();
    let repaired = 0;

    for (const doc of allSpecs.docs) {
      const data = doc.data();
      const { repaired: cleanSpec, hadRepairs } = repairFlatDottedSpec(data as Record<string, unknown>);
      if (hadRepairs) {
        await db.collection('deviceSpecs').doc(doc.id).set(cleanSpec);
        const completeness = calculateSpecCompleteness(cleanSpec);
        const deviceId = (cleanSpec.deviceId ?? cleanSpec.id) as string | undefined;
        if (deviceId) {
          await db.collection('devices').doc(deviceId).update({
            specCompleteness: completeness,
            updatedAt: new Date().toISOString(),
          });
        }
        repaired++;
        req.log?.info('Repaired flat dotted spec', { docId: doc.id, deviceId, completeness });
      }
    }

    req.log?.info('Spec repair complete', { total: allSpecs.size, repaired });
    res.json({ total: allSpecs.size, repaired });
  } catch (err) {
    req.log?.error('Spec repair failed', formatError(err));
    res.status(500).json({ error: 'Spec repair failed', detail: String(err) });
  }
});

router.get('/:deviceId', async (req, res) => {
  try {
    const db = admin.firestore();
    const deviceId = req.params.deviceId as string;
    req.log?.debug('Getting device specs', { deviceId });

    const loadedSpec = await loadMergedDeviceSpecForDevice(db, deviceId);
    if (!loadedSpec) {
      req.log?.warn('No specs found for device', { deviceId });
      res.status(404).json({ error: 'No specs found for this device' });
      return;
    }

    const specData = coerceDeviceSpecDoc({ id: deviceId, ...loadedSpec.mergedSpec });
    req.log?.info('Device specs fetched', {
      deviceId,
      specDocIds: loadedSpec.docs.map((doc) => doc.id),
      lookup: loadedSpec.lookup,
    });
    res.json(specData);
  } catch (err) {
    req.log?.error('Failed to get device specs', formatError(err));
    res.status(500).json({ error: 'Failed to get device specs', detail: String(err) });
  }
});

router.put('/:deviceId', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const deviceId = req.params.deviceId as string;
    req.log?.info('Saving device specs', { deviceId, userId: req.user!.uid });

    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      req.log?.warn('Device not found for spec update', { deviceId });
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const parsed = SaveDeviceSpecRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      req.log?.warn('Device spec validation failed', { issues: parsed.error.issues });
      res.status(400).json({ error: 'Invalid request payload', detail: parsed.error.issues });
      return;
    }

    const specSource: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    for (const key of SPEC_CATEGORIES) {
      specSource[key] = parsed.data[key as keyof typeof parsed.data] ?? {};
    }

    const specData = buildCanonicalDeviceSpecWrite(deviceId, specSource);
    const existingSpec = await loadMergedDeviceSpecForDevice(db, deviceId);

    const specId = deviceId;
    await db.collection('deviceSpecs').doc(specId).set(specData);

    if (!existingSpec) {
      req.log?.info('Device specs created (canonical)', { deviceId, specId });
    } else {
      await diffAndLog('deviceSpec', specId, existingSpec.mergedSpec, specData, req.user!.uid, req.user!.email);

      for (const doc of existingSpec.docs) {
        if (doc.id !== specId) {
          await db.collection('deviceSpecs').doc(doc.id).delete();
        }
      }

      req.log?.info('Device specs updated (canonical)', {
        deviceId,
        specId,
        lookup: existingSpec.lookup,
        mergedDocIds: existingSpec.docs.map((doc) => doc.id),
      });
    }

    const completeness = calculateSpecCompleteness(specData);
    req.log?.debug('Spec completeness calculated', { deviceId, completeness });

    await db.collection('devices').doc(deviceId).update({
      specCompleteness: completeness,
      updatedAt: new Date().toISOString(),
    });

    req.log?.debug('Triggering tier assignment', { deviceId });
    const assignedTierId = await assignTierToDevice(deviceId);
    req.log?.info('Spec save complete', { deviceId, specId, completeness, assignedTierId });

    res.json({ id: specId, ...specData, specCompleteness: completeness });
  } catch (err) {
    req.log?.error('Failed to save device specs', formatError(err));
    res.status(500).json({ error: 'Failed to save device specs', detail: String(err) });
  }
});

export default router;
