import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog, logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';
import { stripEmoji } from '../services/intakeParser.js';
import type { PartnerKeyRegion, DeduplicationInfo, FieldDiff, MatchConfidence } from '../types/index.js';
import { loadActiveAliases, resolvePartnerAlias } from '../services/partnerAliasResolver.js';

const router = Router();

// ── Normalization helpers ──

const REGION_MAP: Record<string, PartnerKeyRegion> = {
  APAC: 'APAC',
  EMEA: 'EMEA',
  LATAM: 'LATAM',
  NA: 'DOMESTIC',
  WORLDWIDE: 'GLOBAL',
};

const COUNTRY_OVERRIDES: Record<string, string> = {
  UK: 'GB',
  WORLDWIDE: 'XW',
  GLOBAL: 'XW',
  WW: 'XW',
};

function normalizeCountries(raw: string | undefined): { countries: string[]; warnings: string[] } {
  if (!raw || !raw.trim()) return { countries: [], warnings: [] };
  const warnings: string[] = [];
  const stripped = stripEmoji(raw);
  const countries = stripped
    .split(';')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .map((c) => {
      if (COUNTRY_OVERRIDES[c]) return COUNTRY_OVERRIDES[c];
      if (/^[A-Z]{2}$/.test(c)) return c;
      warnings.push(`Unrecognized country token: "${c}"`);
      return c;
    });
  return { countries, warnings };
}

function normalizeRegion(raw: string | undefined): { regions: PartnerKeyRegion[]; warnings: string[] } {
  if (!raw || !raw.trim()) return { regions: [], warnings: [] };
  const warnings: string[] = [];
  const trimmed = raw.trim().toUpperCase();
  const mapped = REGION_MAP[trimmed];
  if (mapped) {
    if (trimmed === 'NA') {
      warnings.push('NA region mapped to DOMESTIC — confirm this is North America, not N/A');
    }
    return { regions: [mapped], warnings };
  }
  warnings.push(`Unrecognized region: "${raw.trim()}"`);
  return { regions: [], warnings };
}

function fixEncoding(name: string): string {
  return name.replace(/Telefnica/g, 'Telefónica').replace(/\x97/g, 'ó');
}

function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const matchWindow = Math.max(Math.floor(maxLen / 2) - 1, 0);
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function parseCSV(csvData: string): Record<string, string>[] {
  const lines = csvData.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

// ── GET / — List all partner keys ──

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const partnerId = req.query.partnerId as string | undefined;
    const search = req.query.search as string | undefined;
    const activeOnly = req.query.activeOnly === 'true';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 500);

    req.log?.debug('Listing partner keys', { partnerId, search, page, pageSize });

    let query: admin.firestore.Query = db.collection('partnerKeys');
    if (partnerId) {
      query = query.where('partnerId', '==', partnerId);
    }

    const snap = await query.get();
    let keys = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string; partnerId: string; key: string; isActive?: boolean }));
    req.log?.debug('Fetched partner keys', { count: keys.length });

    if (activeOnly) {
      keys = keys.filter((k) => k.isActive !== false);
    }

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

// ── GET /import-batches — List import batches ──

router.get('/import-batches', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('partnerKeyImportBatches').orderBy('importedAt', 'desc').get();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const batches = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        rollbackAvailable: data.importedAt > thirtyDaysAgo,
      };
    });

    res.json({ data: batches });
  } catch (err) {
    req.log?.error('Failed to list import batches', formatError(err));
    res.status(500).json({ error: 'Failed to list import batches', detail: String(err) });
  }
});

// ── POST /import-batches/:id/rollback — Rollback import batch ──

router.post('/import-batches/:id/rollback', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const batchId = req.params.id as string;

    const batchDoc = await db.collection('partnerKeyImportBatches').doc(batchId).get();
    if (!batchDoc.exists) {
      res.status(404).json({ error: 'Import batch not found' });
      return;
    }

    const batchData = batchDoc.data()!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    if (batchData.importedAt < thirtyDaysAgo) {
      res.status(400).json({ error: 'Rollback window has expired (30 days)' });
      return;
    }

    // Restore overwritten/merged records from pre-import snapshots
    let restoredCount = 0;
    if (batchData.preImportSnapshots) {
      const snapshots: Array<{ existingId: string; oldData: Record<string, unknown>; operation: string }> =
        JSON.parse(batchData.preImportSnapshots as string);

      for (let si = 0; si < snapshots.length; si += 450) {
        const chunk = snapshots.slice(si, si + 450);
        const restoreBatch = db.batch();
        for (const snap of chunk) {
          restoreBatch.set(db.collection('partnerKeys').doc(snap.existingId), snap.oldData);
          restoredCount++;
        }
        await restoreBatch.commit();
      }
    }

    // Delete newly created keys (those with importBatchId matching and createdAt set)
    const keysSnap = await db.collection('partnerKeys').where('importBatchId', '==', batchId).get();
    const newKeyDocs = keysSnap.docs.filter(d => {
      const data = d.data();
      return data.createdAt === data.updatedAt;
    });

    const batch = db.batch();
    let deletedCount = 0;
    for (const doc of newKeyDocs) {
      batch.delete(doc.ref);
      deletedCount++;
    }
    batch.delete(batchDoc.ref);
    await batch.commit();

    await logAuditEntry({
      entityType: 'partnerKey',
      entityId: batchId,
      field: 'importBatch',
      oldValue: `${deletedCount} keys deleted, ${restoredCount} restored`,
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Import batch rolled back', { batchId, deletedCount, restoredCount });
    res.json({ success: true, deleted: deletedCount, restored: restoredCount });
  } catch (err) {
    req.log?.error('Failed to rollback import batch', formatError(err));
    res.status(500).json({ error: 'Failed to rollback', detail: String(err) });
  }
});

// ── GET /:id — Get single partner key ──

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

// ── POST / — Create partner key (manual) ──

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { key, partnerId, chipset, oem, kernel, os, countries, regions } = req.body;
    if (!key) {
      req.log?.warn('Partner key creation failed: missing key');
      res.status(400).json({ error: 'key is required' });
      return;
    }

    req.log?.info('Creating partner key', { key, partnerId, userId: req.user!.uid });

    const existing = await db.collection('partnerKeys').where('key', '==', key).limit(1).get();
    if (!existing.empty) {
      req.log?.warn('Partner key creation failed: duplicate key', { key });
      res.status(409).json({ error: 'Partner key already exists' });
      return;
    }

    const now = new Date().toISOString();
    const docRef = await db.collection('partnerKeys').add({
      key,
      partnerId: partnerId ?? null,
      chipset: chipset ?? null,
      oem: oem ?? null,
      kernel: kernel ?? null,
      os: os ?? null,
      countries: countries ?? [],
      regions: regions ?? [],
      isActive: true,
      source: 'manual',
      importBatchId: null,
      createdAt: now,
      createdBy: req.user!.email,
      updatedAt: now,
      updatedBy: req.user!.email,
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

    // Auto-link devices that were imported with this vendor slug before the key existed
    const pendingSnap = await db
      .collection('devices')
      .where('pendingPartnerKey', '==', key)
      .get();
    let linkedCount = 0;
    if (!pendingSnap.empty) {
      const batch = db.batch();
      for (const deviceDoc of pendingSnap.docs) {
        batch.update(deviceDoc.ref, {
          partnerKeyId: docRef.id,
          pendingPartnerKey: null,
          updatedAt: new Date().toISOString(),
        });
        linkedCount++;
      }
      await batch.commit();
      req.log?.info('Auto-linked pending devices to new partner key', { key, linkedCount });
    }

    const created = await docRef.get();
    req.log?.info('Partner key created', { partnerKeyId: docRef.id, key, partnerId, linkedDevices: linkedCount });
    res.status(201).json({ id: docRef.id, ...created.data(), linkedDevices: linkedCount });
  } catch (err) {
    req.log?.error('Failed to create partner key', formatError(err));
    res.status(500).json({ error: 'Failed to create partner key', detail: String(err) });
  }
});

// ── PUT /:id — Update partner key ──

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
    delete updates.createdAt;
    delete updates.createdBy;
    delete updates.source;
    delete updates.importBatchId;
    updates.updatedAt = new Date().toISOString();
    updates.updatedBy = req.user!.email;

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

// ── DELETE /:id — Delete partner key ──

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

// ── POST /import/preview — Parse CSV and return preview ──

router.post('/import/preview', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { csvData } = req.body;
    if (!csvData) {
      res.status(400).json({ error: 'csvData is required' });
      return;
    }

    const fixed = fixEncoding(csvData);
    const rawRows = parseCSV(fixed);

    const expectedColumns = ['partner_key', 'friendly_partner_name', 'countries_operate_iso2', 'regions_operate', 'chipset', 'oem', 'kernel', 'os'];
    if (rawRows.length > 0) {
      const headers = Object.keys(rawRows[0]).map((h) => h.toLowerCase().trim());
      const missing = expectedColumns.filter((col) => {
        if (col === 'kernel') return !headers.includes('kernel') && !headers.includes('kernal');
        return !headers.includes(col);
      });
      if (missing.length > 0) {
        res.status(400).json({ error: `Missing required columns: ${missing.join(', ')}` });
        return;
      }
    }

    const partnersSnap = await db.collection('partners').get();
    const partners = partnersSnap.docs.map((d) => ({
      id: d.id,
      displayName: d.data().displayName as string,
    }));

    const aliases = await loadActiveAliases(db);
    const partnerLookup = new Map<string, string>();
    for (const p of partners) partnerLookup.set(p.id, p.displayName);

    const existingKeysSnap = await db.collection('partnerKeys').get();
    const existingKeyMap = new Map<string, { id: string; data: Record<string, unknown> }>();
    for (const doc of existingKeysSnap.docs) {
      const data = doc.data();
      existingKeyMap.set(data.key as string, { id: doc.id, data: data as Record<string, unknown> });
    }

    const PK_COMPARE_FIELDS = ['countries', 'regions', 'chipset', 'oem', 'kernel', 'os', 'partnerId'] as const;

    // Track within-file duplicates
    const seenInFile = new Map<string, number>();

    const rows = rawRows.map((raw, rowIdx) => {
      const key = stripEmoji((raw['partner_key'] ?? '').trim());
      const friendlyName = stripEmoji(fixEncoding((raw['friendly_partner_name'] ?? '').trim()));
      const { countries, warnings: countryWarnings } = normalizeCountries(raw['countries_operate_iso2']);
      const { regions, warnings: regionWarnings } = normalizeRegion(raw['regions_operate']);
      const chipset = (raw['chipset'] ?? '').trim() || null;
      const oem = (raw['oem'] ?? '').trim() || null;
      const kernel = (raw['kernel'] ?? raw['kernal'] ?? '').trim() || null;
      const os = (raw['os'] ?? '').trim() || null;

      const warnings: string[] = [...countryWarnings, ...regionWarnings];
      const errors: string[] = [];

      if (!key) {
        errors.push('Missing partner_key');
      }

      let partnerId: string | null = null;
      let partnerDisplayName: string | null = null;
      let matchConfidence: MatchConfidence = 'unmatched';

      if (friendlyName) {
        const lowerName = friendlyName.toLowerCase();
        const exactMatch = partners.find((p) => p.displayName.toLowerCase() === lowerName);
        if (exactMatch) {
          partnerId = exactMatch.id;
          partnerDisplayName = exactMatch.displayName;
          matchConfidence = 'exact';
        } else {
          const aliasContext = { region: regions[0], country_iso: countries[0] };
          const aliasResult = resolvePartnerAlias(friendlyName, aliases, partnerLookup, aliasContext);
          if (aliasResult) {
            partnerId = aliasResult.partnerId;
            partnerDisplayName = aliasResult.partnerDisplayName;
            matchConfidence = aliasResult.matchConfidence;
            warnings.push(`Resolved via alias: "${friendlyName}" → "${aliasResult.partnerDisplayName}"`);
          } else {
            let bestScore = 0;
            let bestMatch: typeof partners[0] | null = null;
            for (const p of partners) {
              const score = jaroWinkler(lowerName, p.displayName.toLowerCase());
              if (score > bestScore) {
                bestScore = score;
                bestMatch = p;
              }
            }
            if (bestMatch && bestScore >= 0.90) {
              partnerId = bestMatch.id;
              partnerDisplayName = bestMatch.displayName;
              matchConfidence = 'fuzzy';
              warnings.push(`Fuzzy match: "${friendlyName}" → "${bestMatch.displayName}" (score: ${bestScore.toFixed(2)})`);
            }
          }
        }
      }

      // Deduplication check
      let dedupInfo: DeduplicationInfo | undefined;

      if (key) {
        // Within-file dedup
        if (seenInFile.has(key)) {
          dedupInfo = {
            dedupStatus: 'duplicate_in_file',
            duplicateOfRow: seenInFile.get(key)!,
          };
        } else {
          seenInFile.set(key, rowIdx + 1);

          // Check against existing DST records
          const existing = existingKeyMap.get(key);
          if (existing) {
            const incoming = { countries, regions, chipset, oem, kernel, os, partnerId };
            const diffs: FieldDiff[] = [];

            for (const field of PK_COMPARE_FIELDS) {
              const ev = JSON.stringify(existing.data[field] ?? null);
              const iv = JSON.stringify(incoming[field] ?? null);
              if (ev !== iv) {
                diffs.push({
                  field,
                  existingValue: typeof existing.data[field] === 'object' ? ev : String(existing.data[field] ?? ''),
                  incomingValue: typeof incoming[field] === 'object' ? iv : String(incoming[field] ?? ''),
                });
              }
            }

            if (diffs.length === 0) {
              dedupInfo = { dedupStatus: 'duplicate', existingId: existing.id, resolution: 'skip' };
            } else {
              dedupInfo = { dedupStatus: 'conflict', existingId: existing.id, diffs };
            }
          }
        }
      }

      let status: 'ready' | 'warning' | 'error' | 'skipped' = 'ready';
      if (errors.length > 0) status = 'error';
      else if (warnings.length > 0 || matchConfidence === 'unmatched') status = 'warning';

      return {
        key,
        friendlyPartnerName: friendlyName,
        countries,
        regions,
        chipset,
        oem,
        kernel,
        os,
        partnerId,
        partnerDisplayName,
        matchConfidence,
        warnings,
        errors,
        status,
        dedupInfo,
      };
    });

    const readyCount = rows.filter((r) => r.status === 'ready').length;
    const warningCount = rows.filter((r) => r.status === 'warning').length;
    const errorCount = rows.filter((r) => r.status === 'error').length;
    const newCount = rows.filter((r) => !r.dedupInfo).length;
    const duplicateCount = rows.filter((r) => r.dedupInfo?.dedupStatus === 'duplicate').length;
    const conflictCount = rows.filter((r) => r.dedupInfo?.dedupStatus === 'conflict').length;
    const inFileDuplicateCount = rows.filter((r) => r.dedupInfo?.dedupStatus === 'duplicate_in_file').length;

    res.json({
      rows,
      totalRows: rows.length,
      readyCount,
      warningCount,
      errorCount,
      skippedCount: errorCount,
      newCount,
      duplicateCount,
      conflictCount,
      inFileDuplicateCount,
    });
  } catch (err) {
    req.log?.error('Failed to preview partner key import', formatError(err));
    res.status(500).json({ error: 'Failed to preview import', detail: String(err) });
  }
});

// ── POST /import/confirm — Confirm and execute import ──

router.post('/import/confirm', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { rows, fileName } = req.body as {
      rows: Array<{
        key: string;
        countries: string[];
        regions: PartnerKeyRegion[];
        chipset: string | null;
        oem: string | null;
        kernel: string | null;
        os: string | null;
        partnerId: string | null;
        status: string;
        dedupInfo?: DeduplicationInfo;
      }>;
      fileName: string;
    };

    if (!rows || !Array.isArray(rows)) {
      res.status(400).json({ error: 'rows array is required' });
      return;
    }

    // Filter out rows that should be skipped
    const importable = rows.filter((r) => {
      if (r.status === 'error' || r.status === 'skipped' || !r.key) return false;
      if (r.dedupInfo?.dedupStatus === 'duplicate_in_file') return false;
      if (r.dedupInfo?.dedupStatus === 'duplicate' && r.dedupInfo.resolution !== 'overwrite') return false;
      if (r.dedupInfo?.dedupStatus === 'conflict' && r.dedupInfo.resolution === 'skip') return false;
      return true;
    });
    if (importable.length === 0) {
      res.status(400).json({ error: 'No valid rows to import' });
      return;
    }

    const now = new Date().toISOString();
    const batchRef = db.collection('partnerKeyImportBatches').doc();
    const batchId = batchRef.id;

    await batchRef.set({
      fileName: fileName ?? 'partner_key_import.csv',
      importedCount: importable.length,
      importedAt: now,
      importedBy: req.user!.uid,
      importedByEmail: req.user!.email,
    });

    const FIRESTORE_BATCH_LIMIT = 450;
    let newCount = 0;
    let overwrittenCount = 0;
    let mergedCount = 0;
    let skipped = 0;
    const newKeys: Array<{ key: string; docId: string }> = [];
    const preImportSnapshots: Array<{ existingId: string; oldData: Record<string, unknown>; operation: string }> = [];

    for (let i = 0; i < importable.length; i += FIRESTORE_BATCH_LIMIT) {
      const chunk = importable.slice(i, i + FIRESTORE_BATCH_LIMIT);
      const writeBatch = db.batch();

      for (const row of chunk) {
        const resolution = row.dedupInfo?.resolution;
        const existingId = row.dedupInfo?.existingId;

        if (existingId && (resolution === 'overwrite' || resolution === 'merge')) {
          const existingDoc = await db.collection('partnerKeys').doc(existingId).get();
          if (existingDoc.exists) {
            preImportSnapshots.push({
              existingId,
              oldData: existingDoc.data() as Record<string, unknown>,
              operation: resolution,
            });
          }

          const incomingFields: Record<string, unknown> = {
            countries: row.countries ?? [],
            regions: row.regions ?? [],
            chipset: row.chipset ?? null,
            oem: row.oem ?? null,
            kernel: row.kernel ?? null,
            os: row.os ?? null,
            partnerId: row.partnerId ?? null,
          };

          const updateData: Record<string, unknown> = {
            updatedAt: now,
            updatedBy: req.user!.email,
            importBatchId: batchId,
          };

          if (resolution === 'overwrite') {
            Object.assign(updateData, incomingFields);
            overwrittenCount++;
          } else {
            for (const [key, value] of Object.entries(incomingFields)) {
              if (value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
                updateData[key] = value;
              }
            }
            mergedCount++;
          }

          writeBatch.update(db.collection('partnerKeys').doc(existingId), updateData);
        } else {
          // Check one more time for safety (in case of race condition)
          const existingSnap = await db.collection('partnerKeys').where('key', '==', row.key).limit(1).get();
          if (!existingSnap.empty) {
            skipped++;
            continue;
          }

          const docRef = db.collection('partnerKeys').doc();
          writeBatch.set(docRef, {
            key: row.key,
            partnerId: row.partnerId ?? null,
            countries: row.countries ?? [],
            regions: row.regions ?? [],
            chipset: row.chipset ?? null,
            oem: row.oem ?? null,
            kernel: row.kernel ?? null,
            os: row.os ?? null,
            isActive: true,
            source: 'csv_import',
            importBatchId: batchId,
            createdAt: now,
            createdBy: req.user!.email,
            updatedAt: now,
            updatedBy: req.user!.email,
          });
          newKeys.push({ key: row.key, docId: docRef.id });
          newCount++;
        }
      }

      await writeBatch.commit();
    }

    // Auto-link devices with pendingPartnerKey matching any newly created keys
    let linkedDevices = 0;
    for (const { key, docId } of newKeys) {
      const pendingSnap = await db
        .collection('devices')
        .where('pendingPartnerKey', '==', key)
        .get();
      if (!pendingSnap.empty) {
        const linkBatch = db.batch();
        for (const deviceDoc of pendingSnap.docs) {
          linkBatch.update(deviceDoc.ref, {
            partnerKeyId: docId,
            pendingPartnerKey: null,
            updatedAt: now,
          });
          linkedDevices++;
        }
        await linkBatch.commit();
      }
    }
    if (linkedDevices > 0) {
      req.log?.info('Auto-linked pending devices during bulk import', { linkedDevices });
    }

    const imported = newCount + overwrittenCount + mergedCount;
    await batchRef.update({
      importedCount: imported,
      newCount,
      overwrittenCount,
      mergedCount,
      preImportSnapshots: preImportSnapshots.length > 0
        ? JSON.stringify(preImportSnapshots)
        : null,
    });

    await logAuditEntry({
      entityType: 'partnerKey',
      entityId: batchId,
      field: 'csvImport',
      oldValue: null,
      newValue: `${imported} keys imported from ${fileName ?? 'CSV'} (${newCount} new, ${overwrittenCount} overwritten, ${mergedCount} merged)`,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Partner key import completed', { batchId, imported, newCount, overwrittenCount, mergedCount, skipped, linkedDevices });
    res.json({ success: true, imported, skipped, batchId, linkedDevices, newCount, overwrittenCount, mergedCount });
  } catch (err) {
    req.log?.error('Failed to import partner keys', formatError(err));
    res.status(500).json({ error: 'Failed to import partner keys', detail: String(err) });
  }
});

export default router;
