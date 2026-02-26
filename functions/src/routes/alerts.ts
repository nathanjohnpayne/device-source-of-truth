import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { formatError } from '../services/logger.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);

    req.log?.debug('Listing alerts', { type, status, page, pageSize });

    let query: admin.firestore.Query = db.collection('alerts');
    if (type) query = query.where('type', '==', type);
    if (status) query = query.where('status', '==', status);

    const snap = await query.get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const total = all.length;
    const paged = all.slice((page - 1) * pageSize, page * pageSize);

    req.log?.info('Alerts listed', { total, returned: paged.length, page });
    res.json({
      data: paged,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    req.log?.error('Failed to list alerts', formatError(err));
    res.status(500).json({ error: 'Failed to list alerts', detail: String(err) });
  }
});

router.put('/:id/dismiss', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const alertId = req.params.id as string;
    req.log?.info('Dismissing alert', { alertId, userId: req.user!.uid });

    const docRef = db.collection('alerts').doc(alertId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Alert not found for dismissal', { alertId });
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const { dismissReason } = req.body;
    const now = new Date().toISOString();
    const alertData = existing.data()!;

    req.log?.debug('Alert details before dismissal', {
      alertId,
      type: alertData.type,
      partnerKey: alertData.partnerKey,
      deviceId: alertData.deviceId,
      dismissReason: dismissReason ?? 'none',
    });

    await docRef.update({
      status: 'dismissed',
      dismissedBy: req.user!.email,
      dismissReason: dismissReason ?? null,
      dismissedAt: now,
    });

    const updated = await docRef.get();
    req.log?.info('Alert dismissed', { alertId, type: alertData.type, dismissReason: dismissReason ?? 'none' });
    res.json({ id: docRef.id, ...updated.data() });
  } catch (err) {
    req.log?.error('Failed to dismiss alert', formatError(err));
    res.status(500).json({ error: 'Failed to dismiss alert', detail: String(err) });
  }
});

export default router;
