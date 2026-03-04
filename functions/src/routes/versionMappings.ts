import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';
import type { VersionPlatform } from '../types/index.js';

const router = Router();

function detectPlatform(coreVersion: string): VersionPlatform {
  if (/^dev\+/i.test(coreVersion)) return 'DEV';
  if (/^\d{4}\.\d+/.test(coreVersion)) return 'NCP';
  if (/^\d+\.\d+/.test(coreVersion)) return 'ADK';
  return 'UNKNOWN';
}

const SEED_DATA: { coreVersion: string; friendlyVersion: string }[] = [
  { coreVersion: '2025.05+88628f4.4', friendlyVersion: 'NCP 2025.05' },
  { coreVersion: '2025.05.1+bbc7cd5.1', friendlyVersion: 'NCP 2025.05.1' },
  { coreVersion: '2025.08.2+7dca2fb.5', friendlyVersion: 'NCP 2025.08.2' },
  { coreVersion: '2025.09.1+d46f8bd.4', friendlyVersion: 'NCP 2025.09.1' },
  { coreVersion: '2025.09.1+d46f8bd.5', friendlyVersion: 'NCP 2025.09.1' },
  { coreVersion: '2025.09.2+8d2725c.4', friendlyVersion: 'NCP 2025.09.2' },
  { coreVersion: '2025.09.4+f31e80d.4', friendlyVersion: 'NCP 2025.09.4' },
  { coreVersion: '2025.09.5+8dcd8b6.2', friendlyVersion: 'NCP 2025.09.5' },
  { coreVersion: '2025.09.6+883dd41.14', friendlyVersion: 'NCP 2025.09.6' },
  { coreVersion: '2025.09.7+886889c.10', friendlyVersion: 'NCP 2025.09.7' },
  { coreVersion: '2025.09.8+c7d3126.1', friendlyVersion: 'NCP 2025.09.8' },
  { coreVersion: '2025.09.9+d69ec3a.1', friendlyVersion: 'NCP 2025.09.9' },
  { coreVersion: '42.7.1+47d0315.8', friendlyVersion: 'ADK 3.0.1' },
  { coreVersion: '42.15+ad3ca0f.1', friendlyVersion: 'ADK 3.1' },
  { coreVersion: '42.16+17f4b8d.1', friendlyVersion: 'ADK 3.1.1' },
  { coreVersion: '47.4.1+8e3bba6.1', friendlyVersion: 'ADK 3.x (newer)' },
  { coreVersion: 'dev+8dcd8b6.1', friendlyVersion: 'Dev Build' },
];

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const { platform, active } = req.query;

    let query: FirebaseFirestore.Query = db.collection('coreVersionMappings');

    if (platform && platform !== 'all') {
      query = query.where('platform', '==', platform);
    }
    if (active === 'true') {
      query = query.where('isActive', '==', true);
    } else if (active === 'false') {
      query = query.where('isActive', '==', false);
    }

    const snap = await query.get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    data.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const pa = String(a.platform ?? '');
      const pb = String(b.platform ?? '');
      if (pa !== pb) return pa.localeCompare(pb);
      return String(b.coreVersion ?? '').localeCompare(String(a.coreVersion ?? ''));
    });

    res.json({ data });
  } catch (err) {
    req.log?.error('Failed to list version mappings', formatError(err));
    res.status(500).json({ error: 'Failed to list version mappings', detail: String(err) });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { coreVersion, friendlyVersion, notes } = req.body;

    if (!coreVersion?.trim() || !friendlyVersion?.trim()) {
      res.status(400).json({ error: 'coreVersion and friendlyVersion are required' });
      return;
    }

    const cv = coreVersion.trim();
    const fv = friendlyVersion.trim();

    const existing = await db.collection('coreVersionMappings')
      .where('coreVersion', '==', cv)
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0].data();
      res.status(409).json({
        error: `A mapping for "${cv}" already exists (${doc.isActive ? 'active' : 'inactive'}). Edit the existing entry instead.`,
        existingId: existing.docs[0].id,
      });
      return;
    }

    const now = new Date().toISOString();
    const platform = detectPlatform(cv);

    const docRef = db.collection('coreVersionMappings').doc();
    const data = {
      coreVersion: cv,
      friendlyVersion: fv,
      platform,
      notes: notes?.trim() || null,
      isActive: true,
      createdAt: now,
      createdBy: req.user!.email,
      updatedAt: now,
      updatedBy: req.user!.email,
    };

    await docRef.set(data);

    await retroactiveResolve(db, cv, fv);

    await logAuditEntry({
      entityType: 'system',
      entityId: docRef.id,
      field: 'coreVersionMapping.create',
      oldValue: null,
      newValue: JSON.stringify({ coreVersion: cv, friendlyVersion: fv, platform }),
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    res.json({ id: docRef.id, ...data });
  } catch (err) {
    req.log?.error('Failed to create version mapping', formatError(err));
    res.status(500).json({ error: 'Failed to create version mapping', detail: String(err) });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const id = String(req.params.id);
    const docRef = db.collection('coreVersionMappings').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.status(404).json({ error: 'Version mapping not found' });
      return;
    }

    const existing = docSnap.data()!;
    const { friendlyVersion, notes, isActive } = req.body;
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: req.user!.email,
    };

    if (friendlyVersion !== undefined) updates.friendlyVersion = friendlyVersion.trim();
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (isActive !== undefined) updates.isActive = isActive;

    await docRef.update(updates);

    if (friendlyVersion !== undefined && friendlyVersion.trim() !== existing.friendlyVersion) {
      await retroactiveResolve(db, existing.coreVersion, friendlyVersion.trim());
    }

    await logAuditEntry({
      entityType: 'system',
      entityId: id,
      field: 'coreVersionMapping.update',
      oldValue: JSON.stringify({ friendlyVersion: existing.friendlyVersion, isActive: existing.isActive }),
      newValue: JSON.stringify({ friendlyVersion: updates.friendlyVersion ?? existing.friendlyVersion, isActive: updates.isActive ?? existing.isActive }),
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    const updated = (await docRef.get()).data();
    res.json({ id: docRef.id, ...updated });
  } catch (err) {
    req.log?.error('Failed to update version mapping', formatError(err));
    res.status(500).json({ error: 'Failed to update version mapping', detail: String(err) });
  }
});

router.get('/unmapped', async (req, res) => {
  try {
    const db = admin.firestore();

    const activeMappings = await db.collection('coreVersionMappings')
      .where('isActive', '==', true)
      .get();
    const mappedVersions = new Set(activeMappings.docs.map(d => d.data().coreVersion as string));

    const telSnap = await db.collection('telemetrySnapshots').get();

    const unmappedMap = new Map<string, { deviceIds: Set<string>; partnerKeys: Set<string>; firstSeen: string | null }>();

    for (const doc of telSnap.docs) {
      const data = doc.data();
      const cv = data.coreVersion as string;
      if (!cv || mappedVersions.has(cv)) continue;

      if (!unmappedMap.has(cv)) {
        unmappedMap.set(cv, { deviceIds: new Set(), partnerKeys: new Set(), firstSeen: null });
      }
      const entry = unmappedMap.get(cv)!;
      if (data.deviceId) entry.deviceIds.add(data.deviceId);
      if (data.partnerKey) entry.partnerKeys.add(data.partnerKey);
      const snapDate = data.snapshotDate as string | undefined;
      if (snapDate && (!entry.firstSeen || snapDate < entry.firstSeen)) {
        entry.firstSeen = snapDate;
      }
    }

    const unmapped = Array.from(unmappedMap.entries()).map(([cv, info]) => ({
      coreVersion: cv,
      platform: detectPlatform(cv),
      deviceCount: info.deviceIds.size,
      partnerCount: info.partnerKeys.size,
      firstSeen: info.firstSeen,
    }));

    unmapped.sort((a, b) => b.deviceCount - a.deviceCount);

    res.json({ data: unmapped });
  } catch (err) {
    req.log?.error('Failed to list unmapped versions', formatError(err));
    res.status(500).json({ error: 'Failed to list unmapped versions', detail: String(err) });
  }
});

router.get('/friendly-versions', async (_req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('coreVersionMappings').where('isActive', '==', true).get();
    const versions = [...new Set(snap.docs.map(d => d.data().friendlyVersion as string))].sort();
    res.json({ data: versions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list friendly versions', detail: String(err) });
  }
});

router.get('/usage/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const docSnap = await db.collection('coreVersionMappings').doc(req.params.id).get();
    if (!docSnap.exists) {
      res.status(404).json({ error: 'Mapping not found' });
      return;
    }
    const cv = docSnap.data()!.coreVersion as string;
    const telSnap = await db.collection('telemetrySnapshots')
      .where('coreVersion', '==', cv)
      .get();
    res.json({ usageCount: telSnap.size });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get usage count', detail: String(err) });
  }
});

router.post('/seed', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const now = new Date().toISOString();
    let created = 0;
    let skipped = 0;

    for (const item of SEED_DATA) {
      const existing = await db.collection('coreVersionMappings')
        .where('coreVersion', '==', item.coreVersion)
        .limit(1)
        .get();

      if (!existing.empty) {
        skipped++;
        continue;
      }

      const docRef = db.collection('coreVersionMappings').doc();
      await docRef.set({
        coreVersion: item.coreVersion,
        friendlyVersion: item.friendlyVersion,
        platform: detectPlatform(item.coreVersion),
        notes: null,
        isActive: true,
        createdAt: now,
        createdBy: 'system',
        updatedAt: now,
        updatedBy: 'system',
      });
      created++;
    }

    if (created > 0) {
      const mappingsSnap = await db.collection('coreVersionMappings')
        .where('isActive', '==', true)
        .get();
      const mappingLookup = new Map<string, string>();
      for (const d of mappingsSnap.docs) {
        const data = d.data();
        mappingLookup.set(data.coreVersion, data.friendlyVersion);
      }

      const telSnap = await db.collection('telemetrySnapshots').get();
      let updated = 0;
      for (const doc of telSnap.docs) {
        const data = doc.data();
        const fv = mappingLookup.get(data.coreVersion);
        if (fv && data.friendlyVersion !== fv) {
          await doc.ref.update({ friendlyVersion: fv });
          updated++;
        }
      }
      req.log?.info('Seed retroactive resolution', { updated });
    }

    res.json({ created, skipped });
  } catch (err) {
    req.log?.error('Failed to seed version mappings', formatError(err));
    res.status(500).json({ error: 'Failed to seed version mappings', detail: String(err) });
  }
});

async function retroactiveResolve(
  db: FirebaseFirestore.Firestore,
  coreVersion: string,
  friendlyVersion: string,
) {
  const telSnap = await db.collection('telemetrySnapshots')
    .where('coreVersion', '==', coreVersion)
    .get();

  for (let i = 0; i < telSnap.docs.length; i += 450) {
    const chunk = telSnap.docs.slice(i, i + 450);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, { friendlyVersion });
    }
    await batch.commit();
  }
}

export { detectPlatform };
export default router;
