import { Router } from 'express';
import admin from 'firebase-admin';
import { formatError } from '../services/logger.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const q = (req.query.q as string ?? '').toLowerCase().trim();

    if (!q) {
      req.log?.debug('Empty search query, returning empty results');
      res.json({ devices: [], partners: [], partnerKeys: [] });
      return;
    }

    req.log?.info('Global search', { query: q });

    const [devicesSnap, partnersSnap, keysSnap] = await Promise.all([
      db.collection('devices').get(),
      db.collection('partners').get(),
      db.collection('partnerKeys').get(),
    ]);

    req.log?.debug('Search collections loaded', {
      deviceDocs: devicesSnap.size,
      partnerDocs: partnersSnap.size,
      keyDocs: keysSnap.size,
    });

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

    req.log?.info('Search complete', {
      query: q,
      deviceMatches: devices.length,
      partnerMatches: partners.length,
      keyMatches: partnerKeys.length,
    });

    res.json({ devices, partners, partnerKeys });
  } catch (err) {
    req.log?.error('Search failed', formatError(err));
    res.status(500).json({ error: 'Search failed', detail: String(err) });
  }
});

export default router;
