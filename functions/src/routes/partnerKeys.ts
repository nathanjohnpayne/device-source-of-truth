import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog, logAuditEntry } from '../services/audit.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('partnerKeys').get();
    const keys = snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; partnerId: string } & Record<string, unknown>));

    const partnerIds = [...new Set(keys.map((k) => k.partnerId).filter(Boolean))];
    const partnerMap: Record<string, string> = {};
    const batchSize = 30;
    for (let i = 0; i < partnerIds.length; i += batchSize) {
      const batch = partnerIds.slice(i, i + batchSize);
      const pSnap = await db.collection('partners').where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
      for (const doc of pSnap.docs) {
        partnerMap[doc.id] = doc.data().displayName;
      }
    }

    const result = keys.map((k) => ({
      ...k,
      partnerDisplayName: partnerMap[k.partnerId] ?? null,
    }));

    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list partner keys', detail: String(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('partnerKeys').doc((req.params.id as string)).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Partner key not found' });
      return;
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get partner key', detail: String(err) });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { key, partnerId, chipset, oem, region, countries } = req.body;
    if (!key || !partnerId) {
      res.status(400).json({ error: 'key and partnerId are required' });
      return;
    }

    const existing = await db.collection('partnerKeys').where('key', '==', key).limit(1).get();
    if (!existing.empty) {
      res.status(409).json({ error: 'Partner key already exists' });
      return;
    }

    const docRef = await db.collection('partnerKeys').add({
      key,
      partnerId,
      chipset: chipset ?? null,
      oem: oem ?? null,
      region: region ?? null,
      countries: countries ?? [],
    });

    await logAuditEntry({
      entityType: 'partnerKey',
      entityId: docRef.id,
      field: '*',
      oldValue: null,
      newValue: key,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    const created = await docRef.get();
    res.status(201).json({ id: docRef.id, ...created.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create partner key', detail: String(err) });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const docRef = db.collection('partnerKeys').doc((req.params.id as string));
    const existing = await docRef.get();
    if (!existing.exists) {
      res.status(404).json({ error: 'Partner key not found' });
      return;
    }

    const oldData = existing.data()!;
    const updates = { ...req.body };
    delete updates.id;

    await docRef.update(updates);
    await diffAndLog('partnerKey', (req.params.id as string), oldData, updates, req.user!.uid, req.user!.email);

    const updated = await docRef.get();
    res.json({ id: docRef.id, ...updated.data() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update partner key', detail: String(err) });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const docRef = db.collection('partnerKeys').doc((req.params.id as string));
    const existing = await docRef.get();
    if (!existing.exists) {
      res.status(404).json({ error: 'Partner key not found' });
      return;
    }

    await docRef.delete();
    await logAuditEntry({
      entityType: 'partnerKey',
      entityId: (req.params.id as string),
      field: '*',
      oldValue: existing.data()!.key,
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete partner key', detail: String(err) });
  }
});

export default router;
