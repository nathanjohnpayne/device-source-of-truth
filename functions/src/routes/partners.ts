import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog, logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';
import type { Partner, PartnerWithStats } from '../types/index.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const region = req.query.region as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);

    req.log?.debug('Listing partners', { region, search, page, pageSize });

    let query: admin.firestore.Query = db.collection('partners');
    if (region) {
      query = query.where('regions', 'array-contains', region);
    }

    const snap = await query.get();
    req.log?.debug('Fetched partners from Firestore', { count: snap.size });

    let partners = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partner);

    if (search) {
      const lower = search.toLowerCase();
      partners = partners.filter((p) => p.displayName.toLowerCase().includes(lower));
      req.log?.debug('Filtered partners by search', { searchTerm: search, matchCount: partners.length });
    }

    const total = partners.length;
    const paged = partners.slice((page - 1) * pageSize, page * pageSize);

    const results: PartnerWithStats[] = await Promise.all(
      paged.map(async (p) => {
        const keysSnap = await db.collection('partnerKeys').where('partnerId', '==', p.id).get();
        const keyIds = keysSnap.docs.map((d) => d.id);

        let deviceCount = 0;
        let activeDeviceCount = 0;

        if (keyIds.length > 0) {
          const batchSize = 30;
          for (let i = 0; i < keyIds.length; i += batchSize) {
            const batch = keyIds.slice(i, i + batchSize);
            const devSnap = await db.collection('devices').where('partnerKeyId', 'in', batch).get();
            deviceCount += devSnap.size;
            for (const doc of devSnap.docs) {
              activeDeviceCount += doc.data().activeDeviceCount ?? 0;
            }
          }
        }

        return {
          ...p,
          partnerKeyCount: keyIds.length,
          deviceCount,
          activeDeviceCount,
        };
      }),
    );

    req.log?.info('Partners listed', { total, returned: results.length, page });
    res.json({
      data: results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    req.log?.error('Failed to list partners', formatError(err));
    res.status(500).json({ error: 'Failed to list partners', detail: String(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const partnerId = req.params.id as string;
    req.log?.debug('Getting partner detail', { partnerId });

    const doc = await db.collection('partners').doc(partnerId).get();
    if (!doc.exists) {
      req.log?.warn('Partner not found', { partnerId });
      res.status(404).json({ error: 'Partner not found' });
      return;
    }

    const partner = { id: doc.id, ...doc.data() } as Partner;
    const keysSnap = await db.collection('partnerKeys').where('partnerId', '==', partner.id).get();
    const partnerKeys = keysSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const keyIds = keysSnap.docs.map((d) => d.id);
    let devices: admin.firestore.DocumentData[] = [];
    if (keyIds.length > 0) {
      const batchSize = 30;
      for (let i = 0; i < keyIds.length; i += batchSize) {
        const batch = keyIds.slice(i, i + batchSize);
        const devSnap = await db.collection('devices').where('partnerKeyId', 'in', batch).get();
        devices = devices.concat(devSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    }

    req.log?.info('Partner detail fetched', { partnerId, keyCount: partnerKeys.length, deviceCount: devices.length });
    res.json({ ...partner, partnerKeys, devices });
  } catch (err) {
    req.log?.error('Failed to get partner', formatError(err));
    res.status(500).json({ error: 'Failed to get partner', detail: String(err) });
  }
});

router.post('/', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { displayName, regions, countriesIso2 } = req.body;
    if (!displayName) {
      req.log?.warn('Partner creation failed: missing displayName');
      res.status(400).json({ error: 'displayName is required' });
      return;
    }

    req.log?.info('Creating partner', { displayName, regions, userId: req.user!.uid });

    const now = new Date().toISOString();
    const docRef = await db.collection('partners').add({
      displayName,
      regions: regions ?? [],
      countriesIso2: countriesIso2 ?? [],
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEntry({
      entityType: 'partner',
      entityId: docRef.id,
      field: '*',
      oldValue: null,
      newValue: displayName,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    const created = await docRef.get();
    req.log?.info('Partner created', { partnerId: docRef.id, displayName });
    res.status(201).json({ id: docRef.id, ...created.data() });
  } catch (err) {
    req.log?.error('Failed to create partner', formatError(err));
    res.status(500).json({ error: 'Failed to create partner', detail: String(err) });
  }
});

router.put('/:id', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const partnerId = req.params.id as string;
    req.log?.info('Updating partner', { partnerId, userId: req.user!.uid });

    const docRef = db.collection('partners').doc(partnerId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Partner not found for update', { partnerId });
      res.status(404).json({ error: 'Partner not found' });
      return;
    }

    const oldData = existing.data()!;
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.id;
    delete updates.createdAt;

    await docRef.update(updates);
    await diffAndLog('partner', partnerId, oldData, updates, req.user!.uid, req.user!.email);

    const updated = await docRef.get();
    req.log?.info('Partner updated', { partnerId, updatedFields: Object.keys(req.body) });
    res.json({ id: docRef.id, ...updated.data() });
  } catch (err) {
    req.log?.error('Failed to update partner', formatError(err));
    res.status(500).json({ error: 'Failed to update partner', detail: String(err) });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const partnerId = req.params.id as string;
    req.log?.info('Deleting partner', { partnerId, userId: req.user!.uid });

    const docRef = db.collection('partners').doc(partnerId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Partner not found for deletion', { partnerId });
      res.status(404).json({ error: 'Partner not found' });
      return;
    }

    const displayName = existing.data()!.displayName;
    await docRef.delete();
    await logAuditEntry({
      entityType: 'partner',
      entityId: partnerId,
      field: '*',
      oldValue: displayName,
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Partner deleted', { partnerId, displayName });
    res.json({ success: true });
  } catch (err) {
    req.log?.error('Failed to delete partner', formatError(err));
    res.status(500).json({ error: 'Failed to delete partner', detail: String(err) });
  }
});

export default router;
