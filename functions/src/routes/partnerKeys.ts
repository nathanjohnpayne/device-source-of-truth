import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog, logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const partnerId = req.query.partnerId as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 500);

    req.log?.debug('Listing partner keys', { partnerId, search, page, pageSize });

    let query: admin.firestore.Query = db.collection('partnerKeys');
    if (partnerId) {
      query = query.where('partnerId', '==', partnerId);
    }

    const snap = await query.get();
    let keys = snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; partnerId: string; key: string } & Record<string, unknown>));
    req.log?.debug('Fetched partner keys', { count: keys.length });

    if (search) {
      const lower = search.toLowerCase();
      keys = keys.filter((k) => k.key?.toLowerCase().includes(lower));
    }

    const total = keys.length;
    const paged = keys.slice((page - 1) * pageSize, page * pageSize);

    const partnerIds = [...new Set(paged.map((k) => k.partnerId).filter(Boolean))];
    const partnerMap: Record<string, string> = {};
    const batchSize = 30;
    for (let i = 0; i < partnerIds.length; i += batchSize) {
      const batch = partnerIds.slice(i, i + batchSize);
      const pSnap = await db.collection('partners').where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
      for (const doc of pSnap.docs) {
        partnerMap[doc.id] = doc.data().displayName;
      }
    }

    const result = paged.map((k) => ({
      ...k,
      partnerDisplayName: partnerMap[k.partnerId] ?? null,
    }));

    req.log?.info('Partner keys listed', { total, returned: result.length, page });
    res.json({
      data: result,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    req.log?.error('Failed to list partner keys', formatError(err));
    res.status(500).json({ error: 'Failed to list partner keys', detail: String(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const keyId = req.params.id as string;
    req.log?.debug('Getting partner key', { keyId });

    const doc = await db.collection('partnerKeys').doc(keyId).get();
    if (!doc.exists) {
      req.log?.warn('Partner key not found', { keyId });
      res.status(404).json({ error: 'Partner key not found' });
      return;
    }

    req.log?.info('Partner key fetched', { keyId });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    req.log?.error('Failed to get partner key', formatError(err));
    res.status(500).json({ error: 'Failed to get partner key', detail: String(err) });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { key, partnerId, chipset, oem, region, countries } = req.body;
    if (!key || !partnerId) {
      req.log?.warn('Partner key creation failed: missing required fields', { hasKey: !!key, hasPartnerId: !!partnerId });
      res.status(400).json({ error: 'key and partnerId are required' });
      return;
    }

    req.log?.info('Creating partner key', { key, partnerId, userId: req.user!.uid });

    const existing = await db.collection('partnerKeys').where('key', '==', key).limit(1).get();
    if (!existing.empty) {
      req.log?.warn('Partner key creation failed: duplicate key', { key });
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
    req.log?.info('Partner key created', { partnerKeyId: docRef.id, key, partnerId });
    res.status(201).json({ id: docRef.id, ...created.data() });
  } catch (err) {
    req.log?.error('Failed to create partner key', formatError(err));
    res.status(500).json({ error: 'Failed to create partner key', detail: String(err) });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const keyId = req.params.id as string;
    req.log?.info('Updating partner key', { keyId, userId: req.user!.uid });

    const docRef = db.collection('partnerKeys').doc(keyId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Partner key not found for update', { keyId });
      res.status(404).json({ error: 'Partner key not found' });
      return;
    }

    const oldData = existing.data()!;
    const updates = { ...req.body };
    delete updates.id;

    await docRef.update(updates);
    await diffAndLog('partnerKey', keyId, oldData, updates, req.user!.uid, req.user!.email);

    const updated = await docRef.get();
    req.log?.info('Partner key updated', { keyId, updatedFields: Object.keys(req.body) });
    res.json({ id: docRef.id, ...updated.data() });
  } catch (err) {
    req.log?.error('Failed to update partner key', formatError(err));
    res.status(500).json({ error: 'Failed to update partner key', detail: String(err) });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const keyId = req.params.id as string;
    req.log?.info('Deleting partner key', { keyId, userId: req.user!.uid });

    const docRef = db.collection('partnerKeys').doc(keyId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Partner key not found for deletion', { keyId });
      res.status(404).json({ error: 'Partner key not found' });
      return;
    }

    const keyValue = existing.data()!.key;
    await docRef.delete();
    await logAuditEntry({
      entityType: 'partnerKey',
      entityId: keyId,
      field: '*',
      oldValue: keyValue,
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Partner key deleted', { keyId, key: keyValue });
    res.json({ success: true });
  } catch (err) {
    req.log?.error('Failed to delete partner key', formatError(err));
    res.status(500).json({ error: 'Failed to delete partner key', detail: String(err) });
  }
});

export default router;
