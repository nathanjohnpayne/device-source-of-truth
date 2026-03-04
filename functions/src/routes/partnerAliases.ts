import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';
import type { PartnerAliasContextRules } from '../types/index.js';

const router = Router();

const SEED_ALIASES: {
  alias: string;
  resolutionType: 'direct' | 'contextual';
  canonicalPartnerName?: string;
  contextRules?: PartnerAliasContextRules;
  notes: string;
}[] = [
  {
    alias: 'Temis',
    resolutionType: 'direct',
    canonicalPartnerName: 'Telefónica',
    notes: 'LATAM middleware platform name used in device manifests and internal tracking sheets',
  },
  {
    alias: 'Titan - Novatek',
    resolutionType: 'direct',
    canonicalPartnerName: 'Philips TVs',
    notes: 'Titan OS + Novatek chipset expressed as a compound name in AllModels device inventory',
  },
  {
    alias: 'Titan - Mediatek',
    resolutionType: 'direct',
    canonicalPartnerName: 'Philips TVs',
    notes: 'Titan OS + MediaTek chipset expressed as a compound name in AllModels device inventory',
  },
  {
    alias: 'Virgin Media O2',
    resolutionType: 'direct',
    canonicalPartnerName: 'Virgin Media',
    notes: 'Current legal entity name post-rebrand; partner key infrastructure retains virginmedia_* keys',
  },
  {
    alias: 'Movistar',
    resolutionType: 'contextual',
    contextRules: {
      signals: ['region', 'country_iso'],
      rules: [
        {
          conditions: { region: ['EMEA'], country_iso: ['ES'] },
          partner_id: '', // resolved at seed time
        },
        {
          conditions: { region: ['LATAM'] },
          partner_id: '', // resolved at seed time
        },
      ],
      fallback: null,
    },
    notes: 'Bare "Movistar" resolves by region/country. EMEA+ES → Movistar Spain; LATAM → Movistar HispAm.',
  },
];

const MOVISTAR_RULE_PARTNERS = ['Movistar Spain', 'Movistar HispAm'];

// ── GET / — List aliases ──

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const { active } = req.query;

    let query: FirebaseFirestore.Query = db.collection('partnerAliases');
    if (active === 'true') {
      query = query.where('isActive', '==', true);
    } else if (active === 'false') {
      query = query.where('isActive', '==', false);
    }

    const snap = await query.get();
    const aliases: Record<string, unknown>[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const partnerIds = new Set<string>();
    for (const a of aliases) {
      if (a.partnerId) partnerIds.add(a.partnerId as string);
      if (a.contextRules) {
        const cr = a.contextRules as PartnerAliasContextRules;
        for (const r of cr.rules) {
          if (r.partner_id) partnerIds.add(r.partner_id);
        }
        if (cr.fallback) partnerIds.add(cr.fallback);
      }
    }

    const partnerNames = new Map<string, string>();
    const idArr = Array.from(partnerIds);
    for (const pid of idArr) {
      const pDoc = await db.collection('partners').doc(pid).get();
      if (pDoc.exists) {
        partnerNames.set(pid, pDoc.data()!.displayName as string);
      }
    }

    const enriched: Record<string, unknown>[] = aliases.map(a => ({
      ...a,
      partnerDisplayName: a.partnerId ? (partnerNames.get(a.partnerId as string) ?? null) : null,
    }));

    enriched.sort((a, b) => String(a['alias'] ?? '').localeCompare(String(b['alias'] ?? '')));

    res.json({ data: enriched });
  } catch (err) {
    req.log?.error('Failed to list partner aliases', formatError(err));
    res.status(500).json({ error: 'Failed to list partner aliases', detail: String(err) });
  }
});

// ── POST / — Create alias ──

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { alias, partnerId, resolutionType, contextRules, notes } = req.body;

    if (!alias?.trim()) {
      res.status(400).json({ error: 'Alias is required' });
      return;
    }

    const normalized = alias.trim().toLowerCase();

    const partnerSnap = await db.collection('partners').get();
    const existingPartnerName = partnerSnap.docs.find(
      d => (d.data().displayName as string).toLowerCase() === normalized,
    );
    if (existingPartnerName) {
      res.status(409).json({
        error: `"${alias.trim()}" matches an existing partner name ("${existingPartnerName.data().displayName}"). Aliases cannot shadow canonical partner names.`,
      });
      return;
    }

    const existingAlias = await db.collection('partnerAliases').get();
    const duplicate = existingAlias.docs.find(
      d => (d.data().alias as string).toLowerCase().trim() === normalized,
    );
    if (duplicate) {
      res.status(409).json({
        error: `An alias "${duplicate.data().alias}" already exists.`,
        existingId: duplicate.id,
      });
      return;
    }

    if (resolutionType === 'direct' && !partnerId) {
      res.status(400).json({ error: 'partnerId is required for direct aliases' });
      return;
    }

    if (resolutionType === 'contextual' && !contextRules) {
      res.status(400).json({ error: 'contextRules is required for contextual aliases' });
      return;
    }

    const now = new Date().toISOString();
    const docRef = db.collection('partnerAliases').doc();
    const data = {
      alias: alias.trim(),
      partnerId: resolutionType === 'direct' ? partnerId : null,
      resolutionType,
      contextRules: resolutionType === 'contextual' ? contextRules : null,
      notes: notes?.trim() || null,
      isActive: true,
      createdAt: now,
      createdBy: req.user!.email,
      updatedAt: now,
      updatedBy: req.user!.email,
    };

    await docRef.set(data);

    await logAuditEntry({
      entityType: 'partnerAlias',
      entityId: docRef.id,
      field: 'partnerAlias.create',
      oldValue: null,
      newValue: JSON.stringify({ alias: data.alias, resolutionType, partnerId: data.partnerId }),
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    res.json({ id: docRef.id, ...data });
  } catch (err) {
    req.log?.error('Failed to create partner alias', formatError(err));
    res.status(500).json({ error: 'Failed to create partner alias', detail: String(err) });
  }
});

// ── PUT /:id — Update alias ──

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const id = String(req.params.id);
    const docRef = db.collection('partnerAliases').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.status(404).json({ error: 'Partner alias not found' });
      return;
    }

    const existing = docSnap.data()!;
    const { alias, partnerId, resolutionType, contextRules, notes, isActive } = req.body;
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: req.user!.email,
    };

    if (alias !== undefined) {
      const normalized = alias.trim().toLowerCase();
      if (normalized !== (existing.alias as string).toLowerCase().trim()) {
        const partnerSnap = await db.collection('partners').get();
        const existingPartnerName = partnerSnap.docs.find(
          d => (d.data().displayName as string).toLowerCase() === normalized,
        );
        if (existingPartnerName) {
          res.status(409).json({
            error: `"${alias.trim()}" matches an existing partner name. Aliases cannot shadow canonical partner names.`,
          });
          return;
        }

        const aliasSnap = await db.collection('partnerAliases').get();
        const dupe = aliasSnap.docs.find(
          d => d.id !== id && (d.data().alias as string).toLowerCase().trim() === normalized,
        );
        if (dupe) {
          res.status(409).json({ error: `An alias "${dupe.data().alias}" already exists.` });
          return;
        }
      }
      updates.alias = alias.trim();
    }

    if (partnerId !== undefined) updates.partnerId = partnerId;
    if (resolutionType !== undefined) updates.resolutionType = resolutionType;
    if (contextRules !== undefined) updates.contextRules = contextRules;
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (isActive !== undefined) updates.isActive = isActive;

    await docRef.update(updates);

    await logAuditEntry({
      entityType: 'partnerAlias',
      entityId: id,
      field: 'partnerAlias.update',
      oldValue: JSON.stringify({ alias: existing.alias, isActive: existing.isActive }),
      newValue: JSON.stringify({ alias: updates.alias ?? existing.alias, isActive: updates.isActive ?? existing.isActive }),
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    const updated = (await docRef.get()).data();
    res.json({ id, ...updated });
  } catch (err) {
    req.log?.error('Failed to update partner alias', formatError(err));
    res.status(500).json({ error: 'Failed to update partner alias', detail: String(err) });
  }
});

// ── PUT /:id/deactivate — Deactivate alias ──

router.put('/:id/deactivate', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const id = String(req.params.id);
    const docRef = db.collection('partnerAliases').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.status(404).json({ error: 'Partner alias not found' });
      return;
    }

    const now = new Date().toISOString();
    await docRef.update({
      isActive: false,
      updatedAt: now,
      updatedBy: req.user!.email,
    });

    await logAuditEntry({
      entityType: 'partnerAlias',
      entityId: id,
      field: 'partnerAlias.deactivate',
      oldValue: 'true',
      newValue: 'false',
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    res.json({ success: true });
  } catch (err) {
    req.log?.error('Failed to deactivate partner alias', formatError(err));
    res.status(500).json({ error: 'Failed to deactivate partner alias', detail: String(err) });
  }
});

// ── POST /seed — Seed default aliases ──

router.post('/seed', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const now = new Date().toISOString();
    let created = 0;
    let skipped = 0;
    const warnings: string[] = [];

    const partnerSnap = await db.collection('partners').get();
    const partnersByName = new Map<string, { id: string; displayName: string }>();
    for (const doc of partnerSnap.docs) {
      const data = doc.data();
      const name = (data.displayName as string).toLowerCase().trim();
      partnersByName.set(name, { id: doc.id, displayName: data.displayName as string });
    }

    const existingAliases = await db.collection('partnerAliases').get();
    const existingNormalized = new Set(
      existingAliases.docs.map(d => (d.data().alias as string).toLowerCase().trim()),
    );

    for (const seed of SEED_ALIASES) {
      const normalized = seed.alias.toLowerCase().trim();
      if (existingNormalized.has(normalized)) {
        skipped++;
        continue;
      }

      let partnerId: string | null = null;
      let contextRules: PartnerAliasContextRules | null = null;

      if (seed.resolutionType === 'direct' && seed.canonicalPartnerName) {
        const partner = partnersByName.get(seed.canonicalPartnerName.toLowerCase().trim());
        if (partner) {
          partnerId = partner.id;
        } else {
          warnings.push(`Partner "${seed.canonicalPartnerName}" not found for alias "${seed.alias}". Created with partnerId=null.`);
        }
      }

      if (seed.resolutionType === 'contextual' && seed.contextRules) {
        contextRules = { ...seed.contextRules, rules: [...seed.contextRules.rules] };
        for (let i = 0; i < contextRules.rules.length; i++) {
          const partnerName = MOVISTAR_RULE_PARTNERS[i];
          if (partnerName) {
            const partner = partnersByName.get(partnerName.toLowerCase().trim());
            if (partner) {
              contextRules.rules[i] = { ...contextRules.rules[i], partner_id: partner.id };
            } else {
              warnings.push(`Partner "${partnerName}" not found for contextual rule in alias "${seed.alias}".`);
            }
          }
        }
      }

      const docRef = db.collection('partnerAliases').doc();
      await docRef.set({
        alias: seed.alias,
        partnerId,
        resolutionType: seed.resolutionType,
        contextRules,
        notes: seed.notes,
        isActive: true,
        createdAt: now,
        createdBy: 'system',
        updatedAt: now,
        updatedBy: 'system',
      });
      created++;
    }

    res.json({ created, skipped, warnings });
  } catch (err) {
    req.log?.error('Failed to seed partner aliases', formatError(err));
    res.status(500).json({ error: 'Failed to seed partner aliases', detail: String(err) });
  }
});

export default router;
