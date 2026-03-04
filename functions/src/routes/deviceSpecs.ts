import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog } from '../services/audit.js';
import { calculateSpecCompleteness } from '../services/specCompleteness.js';
import { assignTierToDevice } from '../services/tierEngine.js';
import { formatError } from '../services/logger.js';
import { coerceDeviceSpecDoc } from '../services/coercion.js';
import { SPEC_CATEGORIES, SaveDeviceSpecRequestSchema } from '../types/index.js';

const router = Router();

router.get('/:deviceId', async (req, res) => {
  try {
    const db = admin.firestore();
    const deviceId = req.params.deviceId as string;
    req.log?.debug('Getting device specs', { deviceId });

    const snap = await db
      .collection('deviceSpecs')
      .where('deviceId', '==', deviceId)
      .limit(1)
      .get();

    if (snap.empty) {
      req.log?.warn('No specs found for device', { deviceId });
      res.status(404).json({ error: 'No specs found for this device' });
      return;
    }

    const doc = snap.docs[0];
    const specData = coerceDeviceSpecDoc({ id: doc.id, ...doc.data() });
    req.log?.info('Device specs fetched', { deviceId, specDocId: doc.id });
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

    const specData: Record<string, unknown> = {
      deviceId,
      updatedAt: new Date().toISOString(),
    };

    for (const key of SPEC_CATEGORIES) {
      specData[key] = parsed.data[key as keyof typeof parsed.data] ?? {};
    }

    const existingSnap = await db
      .collection('deviceSpecs')
      .where('deviceId', '==', deviceId)
      .limit(1)
      .get();

    let specId: string;
    if (existingSnap.empty) {
      const docRef = await db.collection('deviceSpecs').add(specData);
      specId = docRef.id;
      req.log?.info('Device specs created (new)', { deviceId, specId });
    } else {
      const existingDoc = existingSnap.docs[0];
      specId = existingDoc.id;
      const oldData = existingDoc.data();
      await db.collection('deviceSpecs').doc(specId).set(specData);
      await diffAndLog('deviceSpec', specId, oldData, specData, req.user!.uid, req.user!.email);
      req.log?.info('Device specs updated (existing)', { deviceId, specId });
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
