import { Router } from 'express';
import admin from 'firebase-admin';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 200);

    let query: admin.firestore.Query = db.collection('auditLog').orderBy('timestamp', 'desc');
    if (entityType) query = query.where('entityType', '==', entityType);
    if (entityId) query = query.where('entityId', '==', entityId);
    if (userId) query = query.where('userId', '==', userId);
    if (startDate) query = query.where('timestamp', '>=', startDate);
    if (endDate) query = query.where('timestamp', '<=', endDate);

    const snap = await query.limit(pageSize * page).get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const total = all.length;
    const paged = all.slice((page - 1) * pageSize, page * pageSize);

    res.json({
      data: paged,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list audit log', detail: String(err) });
  }
});

export default router;
