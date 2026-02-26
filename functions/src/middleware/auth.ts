import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import type { UserRole } from '../types/index.js';
import { formatError } from '../services/logger.js';

export interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const ALLOWED_DOMAINS = ['@disney.com', '@disneystreaming.com', '@nathanpayne.com'];

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const rlog = req.log;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      rlog?.warn('Auth failed: missing or invalid Authorization header');
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    rlog?.debug('Verifying Firebase ID token');
    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const email = decoded.email;

    if (!email) {
      rlog?.warn('Auth failed: token contains no email', { uid: decoded.uid });
      res.status(401).json({ error: 'Token does not contain an email' });
      return;
    }

    const domainAllowed = ALLOWED_DOMAINS.some((d) => email.endsWith(d));
    if (!domainAllowed) {
      rlog?.warn('Auth failed: email domain not authorized', { email });
      res.status(403).json({ error: `Email domain not authorized: ${email}` });
      return;
    }

    rlog?.debug('Looking up user record', { email });
    const db = admin.firestore();
    const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();

    let role: UserRole = 'viewer';
    let displayName = email;
    let uid = decoded.uid;

    if (!usersSnap.empty) {
      const userDoc = usersSnap.docs[0];
      const userData = userDoc.data();
      uid = userDoc.id;
      role = userData.role as UserRole;
      displayName = userData.displayName ?? email;
      rlog?.info('Auth success: existing user', { uid, email, role });
    } else {
      const now = new Date().toISOString();
      const newUserRef = await db.collection('users').add({
        email,
        role: 'admin',
        displayName: decoded.name ?? email,
        photoUrl: decoded.picture ?? null,
        lastLogin: now,
      });
      uid = newUserRef.id;
      role = 'admin';
      displayName = decoded.name ?? email;
      rlog?.info('Auth success: new user auto-provisioned', { uid, email, role });
    }

    req.user = { uid, email, role, displayName };
    next();
  } catch (err) {
    rlog?.error('Auth error: token verification failed', formatError(err));
    res.status(401).json({ error: 'Invalid or expired token', detail: String(err) });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      req.log?.warn('Role check failed: not authenticated');
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      req.log?.warn('Role check failed: insufficient permissions', {
        userRole: req.user.role,
        requiredRoles: roles,
        email: req.user.email,
      });
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    req.log?.debug('Role check passed', { role: req.user.role, requiredRoles: roles });
    next();
  };
}
