import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import type { UserRole } from '../types/index.js';

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

const ALLOWED_DOMAINS = ['@disney.com', '@disneystreaming.com'];

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const email = decoded.email;

    if (!email) {
      res.status(401).json({ error: 'Token does not contain an email' });
      return;
    }

    const domainAllowed = ALLOWED_DOMAINS.some((d) => email.endsWith(d));
    if (!domainAllowed) {
      res.status(403).json({ error: 'Email domain not authorized' });
      return;
    }

    const db = admin.firestore();
    const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();

    if (usersSnap.empty) {
      res.status(401).json({ error: 'User not found in system' });
      return;
    }

    const userDoc = usersSnap.docs[0];
    const userData = userDoc.data();

    req.user = {
      uid: userDoc.id,
      email: userData.email,
      role: userData.role as UserRole,
      displayName: userData.displayName ?? email,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
