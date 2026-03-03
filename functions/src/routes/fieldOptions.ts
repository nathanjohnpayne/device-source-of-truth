import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { logAuditEntry } from '../services/audit.js';
import { seedFieldOptions } from '../services/seedFieldOptions.js';
import { formatError } from '../services/logger.js';
import type { FieldOption } from '../types/index.js';

const router = Router();
const COLLECTION = 'fieldOptions';

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    req.log?.debug('Listing all dropdown keys');

    const snap = await db.collection(COLLECTION).orderBy('dropdownKey').orderBy('sortOrder').get();
    const allOptions = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as FieldOption[];

    const keyMap = new Map<string, { displayLabel: string; options: FieldOption[] }>();
    for (const opt of allOptions) {
      if (!keyMap.has(opt.dropdownKey)) {
        keyMap.set(opt.dropdownKey, { displayLabel: opt.displayLabel, options: [] });
      }
      keyMap.get(opt.dropdownKey)!.options.push(opt);
    }

    const keys = Array.from(keyMap.entries()).map(([dropdownKey, info]) => ({
      dropdownKey,
      displayLabel: info.displayLabel,
      optionCount: info.options.length,
      activeCount: info.options.filter((o) => o.isActive).length,
      updatedAt: info.options.reduce((latest, o) => (o.updatedAt > latest ? o.updatedAt : latest), ''),
    }));

    req.log?.info('Dropdown keys listed', { count: keys.length });
    res.json({ data: keys });
  } catch (err) {
    req.log?.error('Failed to list dropdown keys', formatError(err));
    res.status(500).json({ error: 'Failed to list dropdown keys', detail: String(err) });
  }
});

router.get('/all', async (req, res) => {
  try {
    const db = admin.firestore();
    req.log?.debug('Fetching all field options (bulk)');

    const snap = await db.collection(COLLECTION).orderBy('dropdownKey').orderBy('sortOrder').get();
    const allOptions = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as FieldOption[];

    const grouped: Record<string, FieldOption[]> = {};
    for (const opt of allOptions) {
      if (!grouped[opt.dropdownKey]) grouped[opt.dropdownKey] = [];
      grouped[opt.dropdownKey].push(opt);
    }

    req.log?.info('All field options fetched', { keyCount: Object.keys(grouped).length });
    res.json({ data: grouped });
  } catch (err) {
    req.log?.error('Failed to fetch all field options', formatError(err));
    res.status(500).json({ error: 'Failed to fetch all field options', detail: String(err) });
  }
});

router.get('/key/:dropdownKey', async (req, res) => {
  try {
    const db = admin.firestore();
    const { dropdownKey } = req.params;
    req.log?.debug('Getting options for dropdown key', { dropdownKey });

    const snap = await db
      .collection(COLLECTION)
      .where('dropdownKey', '==', dropdownKey)
      .orderBy('sortOrder')
      .get();

    const options = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as FieldOption[];
    req.log?.info('Options fetched', { dropdownKey, count: options.length });
    res.json({ data: options });
  } catch (err) {
    req.log?.error('Failed to get options', formatError(err));
    res.status(500).json({ error: 'Failed to get options', detail: String(err) });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { dropdownKey, displayLabel, displayValue, isOtherTrigger } = req.body;
    req.log?.info('Creating field option', { dropdownKey, displayValue });

    if (!dropdownKey || !displayValue) {
      res.status(400).json({ error: 'dropdownKey and displayValue are required' });
      return;
    }

    const existingSnap = await db
      .collection(COLLECTION)
      .where('dropdownKey', '==', dropdownKey)
      .orderBy('sortOrder', 'desc')
      .limit(1)
      .get();

    const maxSortOrder = existingSnap.empty ? 0 : (existingSnap.docs[0].data().sortOrder ?? 0);

    const now = new Date().toISOString();
    const optionData = {
      dropdownKey,
      displayLabel: displayLabel || dropdownKey,
      displayValue,
      sortOrder: maxSortOrder + 1,
      isActive: true,
      isOtherTrigger: isOtherTrigger ?? false,
      createdAt: now,
      createdBy: req.user!.email,
      updatedAt: now,
      updatedBy: req.user!.email,
    };

    const docRef = await db.collection(COLLECTION).add(optionData);

    await logAuditEntry({
      entityType: 'fieldOption',
      entityId: docRef.id,
      field: 'create',
      oldValue: null,
      newValue: JSON.stringify({ dropdownKey, displayValue }),
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Field option created', { id: docRef.id, dropdownKey });
    res.status(201).json({ id: docRef.id, ...optionData });
  } catch (err) {
    req.log?.error('Failed to create field option', formatError(err));
    res.status(500).json({ error: 'Failed to create field option', detail: String(err) });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { id } = req.params;
    req.log?.info('Updating field option', { id });

    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Field option not found' });
      return;
    }

    const oldData = doc.data() as FieldOption;
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      updatedBy: req.user!.email,
    };

    if (req.body.displayValue !== undefined) updates.displayValue = req.body.displayValue;
    if (req.body.displayLabel !== undefined) updates.displayLabel = req.body.displayLabel;
    if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
    if (req.body.isOtherTrigger !== undefined) updates.isOtherTrigger = req.body.isOtherTrigger;

    await docRef.update(updates);

    for (const [field, newVal] of Object.entries(updates)) {
      if (field === 'updatedAt' || field === 'updatedBy') continue;
      const oldVal = (oldData as Record<string, unknown>)[field];
      if (String(oldVal) !== String(newVal)) {
        await logAuditEntry({
          entityType: 'fieldOption',
          entityId: id,
          field,
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
          userId: req.user!.uid,
          userEmail: req.user!.email,
        });
      }
    }

    req.log?.info('Field option updated', { id });
    res.json({ id, ...oldData, ...updates });
  } catch (err) {
    req.log?.error('Failed to update field option', formatError(err));
    res.status(500).json({ error: 'Failed to update field option', detail: String(err) });
  }
});

router.put('/reorder/:dropdownKey', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { dropdownKey } = req.params;
    const { orderedIds } = req.body as { orderedIds: string[] };
    req.log?.info('Reordering options', { dropdownKey, count: orderedIds?.length });

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      res.status(400).json({ error: 'orderedIds array is required' });
      return;
    }

    const batch = db.batch();
    const now = new Date().toISOString();
    orderedIds.forEach((id, index) => {
      batch.update(db.collection(COLLECTION).doc(id), {
        sortOrder: index + 1,
        updatedAt: now,
        updatedBy: req.user!.email,
      });
    });

    await batch.commit();

    await logAuditEntry({
      entityType: 'fieldOption',
      entityId: dropdownKey,
      field: 'reorder',
      oldValue: null,
      newValue: JSON.stringify(orderedIds),
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Options reordered', { dropdownKey });
    res.json({ success: true });
  } catch (err) {
    req.log?.error('Failed to reorder options', formatError(err));
    res.status(500).json({ error: 'Failed to reorder options', detail: String(err) });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { id } = req.params;
    req.log?.info('Soft-deleting field option', { id });

    const docRef = db.collection(COLLECTION).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Field option not found' });
      return;
    }

    const now = new Date().toISOString();
    await docRef.update({
      isActive: false,
      updatedAt: now,
      updatedBy: req.user!.email,
    });

    const data = doc.data() as FieldOption;
    await logAuditEntry({
      entityType: 'fieldOption',
      entityId: id,
      field: 'isActive',
      oldValue: 'true',
      newValue: 'false',
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Field option soft-deleted', { id, dropdownKey: data.dropdownKey });
    res.json({ success: true });
  } catch (err) {
    req.log?.error('Failed to delete field option', formatError(err));
    res.status(500).json({ error: 'Failed to delete field option', detail: String(err) });
  }
});

router.get('/:id/usage', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { id } = req.params;
    req.log?.debug('Getting usage count for field option', { id });

    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Field option not found' });
      return;
    }

    const option = doc.data() as FieldOption;
    const specsSnap = await db.collection('deviceSpecs').get();

    let usageCount = 0;
    for (const specDoc of specsSnap.docs) {
      const specData = specDoc.data();
      const found = Object.values(specData).some((section) => {
        if (typeof section === 'object' && section !== null) {
          return Object.values(section as Record<string, unknown>).some(
            (val) => val === option.displayValue,
          );
        }
        return false;
      });
      if (found) usageCount++;
    }

    req.log?.info('Usage count retrieved', { id, usageCount });
    res.json({ usageCount, displayValue: option.displayValue, dropdownKey: option.dropdownKey });
  } catch (err) {
    req.log?.error('Failed to get usage count', formatError(err));
    res.status(500).json({ error: 'Failed to get usage count', detail: String(err) });
  }
});

router.post('/seed', requireRole('admin'), async (req, res) => {
  try {
    req.log?.info('Seeding field options');
    const result = await seedFieldOptions(req.user!.email);
    req.log?.info('Seed complete', result);
    res.json(result);
  } catch (err) {
    req.log?.error('Failed to seed field options', formatError(err));
    res.status(500).json({ error: 'Failed to seed field options', detail: String(err) });
  }
});

export default router;
