import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog } from '../services/audit.js';
import { calculateSpecCompleteness } from '../services/specCompleteness.js';
import { assignTierToDevice } from '../services/tierEngine.js';
import type { DeviceSpec } from '../types/index.js';

const router = Router();

router.get('/:deviceId', async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db
      .collection('deviceSpecs')
      .where('deviceId', '==', (req.params.deviceId as string))
      .limit(1)
      .get();

    if (snap.empty) {
      res.status(404).json({ error: 'No specs found for this device' });
      return;
    }

    const doc = snap.docs[0];
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get device specs', detail: String(err) });
  }
});

router.put('/:deviceId', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const deviceId = (req.params.deviceId as string);

    const deviceDoc = await db.collection('devices').doc(deviceId).get();
    if (!deviceDoc.exists) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const specData = {
      deviceId,
      identity: req.body.identity ?? {},
      soc: req.body.soc ?? {},
      os: req.body.os ?? {},
      memory: req.body.memory ?? {},
      gpu: req.body.gpu ?? {},
      streaming: req.body.streaming ?? {},
      videoOutput: req.body.videoOutput ?? {},
      firmware: req.body.firmware ?? {},
      codecs: req.body.codecs ?? {},
      frameRate: req.body.frameRate ?? {},
      drm: req.body.drm ?? {},
      security: req.body.security ?? {},
      updatedAt: new Date().toISOString(),
    };

    const existingSnap = await db
      .collection('deviceSpecs')
      .where('deviceId', '==', deviceId)
      .limit(1)
      .get();

    let specId: string;
    if (existingSnap.empty) {
      const docRef = await db.collection('deviceSpecs').add(specData);
      specId = docRef.id;
    } else {
      const existingDoc = existingSnap.docs[0];
      specId = existingDoc.id;
      const oldData = existingDoc.data();
      await db.collection('deviceSpecs').doc(specId).set(specData);
      await diffAndLog('deviceSpec', specId, oldData, specData, req.user!.uid, req.user!.email);
    }

    const fullSpec = { id: specId, ...specData } as DeviceSpec;
    const completeness = calculateSpecCompleteness(fullSpec);
    await db.collection('devices').doc(deviceId).update({
      specCompleteness: completeness,
      updatedAt: new Date().toISOString(),
    });

    await assignTierToDevice(deviceId);

    res.json({ id: specId, ...specData, specCompleteness: completeness });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save device specs', detail: String(err) });
  }
});

export default router;
