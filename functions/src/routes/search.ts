import { Router } from 'express';
import admin from 'firebase-admin';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const q = (req.query.q as string ?? '').toLowerCase().trim();

    if (!q) {
      res.json({ devices: [], partners: [], partnerKeys: [] });
      return;
    }

    const [devicesSnap, partnersSnap, keysSnap] = await Promise.all([
      db.collection('devices').get(),
      db.collection('partners').get(),
      db.collection('partnerKeys').get(),
    ]);

    const devices = devicesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((d) => {
        const data = d as Record<string, unknown>;
        return (
          (data.displayName as string)?.toLowerCase().includes(q) ||
          (data.deviceId as string)?.toLowerCase().includes(q)
        );
      })
      .slice(0, 10);

    const partners = partnersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((d) => {
        const data = d as Record<string, unknown>;
        return (data.displayName as string)?.toLowerCase().includes(q);
      })
      .slice(0, 10);

    const partnerKeys = keysSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((d) => {
        const data = d as Record<string, unknown>;
        return (data.key as string)?.toLowerCase().includes(q);
      })
      .slice(0, 10);

    res.json({ devices, partners, partnerKeys });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', detail: String(err) });
  }
});

export default router;
