import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { logAuditEntry } from '../services/audit.js';
import type { UserRole } from '../types/index.js';

const router = Router();
const VALID_ROLES: UserRole[] = ['viewer', 'editor', 'admin'];

router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('users').orderBy('displayName', 'asc').get();

    const users = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ users });
  } catch (err) {
    req.log?.error('Failed to list users', { error: String(err) });
    res.status(500).json({ error: 'Failed to list users', detail: String(err) });
  }
});

router.patch('/:id/role', requireRole('admin'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }

    if (req.user!.uid === id) {
      res.status(403).json({ error: 'Cannot change your own role' });
      return;
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = userDoc.data()!;
    const oldRole = userData.role as UserRole;

    if (oldRole === role) {
      res.json({ user: { id, ...userData } });
      return;
    }

    // Demoting an admin requires a transactional check to prevent racing
    // two concurrent demotions past the "at least one admin" invariant.
    if (oldRole === 'admin') {
      const now = new Date().toISOString();
      try {
        const adminsQuery = db.collection('users').where('role', '==', 'admin');
        await db.runTransaction(async (txn) => {
          const [freshDoc, adminsSnap] = await Promise.all([
            txn.get(userRef),
            txn.get(adminsQuery),
          ]);
          if (!freshDoc.exists || freshDoc.data()!.role !== 'admin') {
            throw new Error('ROLE_CHANGED');
          }
          if (adminsSnap.size <= 1) {
            throw new Error('LAST_ADMIN');
          }
          txn.update(userRef, { role, updatedAt: now, updatedBy: req.user!.email });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'LAST_ADMIN') {
          res.status(409).json({ error: 'Cannot remove the last admin' });
          return;
        }
        if (msg === 'ROLE_CHANGED') {
          res.status(409).json({ error: 'User role was modified concurrently. Please refresh and retry.' });
          return;
        }
        throw err;
      }
    } else {
      const now = new Date().toISOString();
      await userRef.update({
        role,
        updatedAt: now,
        updatedBy: req.user!.email,
      });
    }

    await logAuditEntry({
      entityType: 'user',
      entityId: id,
      field: 'role',
      oldValue: oldRole,
      newValue: role,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    const updated = await userRef.get();
    res.json({ user: { id, ...updated.data() } });
  } catch (err) {
    req.log?.error('Failed to update user role', { error: String(err) });
    res.status(500).json({ error: 'Failed to update user role', detail: String(err) });
  }
});

export default router;
