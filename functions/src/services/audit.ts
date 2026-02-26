import admin from 'firebase-admin';
import type { AuditEntityType } from '../types/index.js';

interface AuditParams {
  entityType: AuditEntityType;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string;
  userEmail: string;
}

export async function logAuditEntry(params: AuditParams) {
  const db = admin.firestore();
  await db.collection('auditLog').add({
    ...params,
    timestamp: new Date().toISOString(),
  });
}

export async function diffAndLog(
  entityType: AuditEntityType,
  entityId: string,
  oldDoc: Record<string, unknown>,
  newDoc: Record<string, unknown>,
  userId: string,
  userEmail: string,
) {
  const allKeys = new Set([...Object.keys(oldDoc), ...Object.keys(newDoc)]);
  const promises: Promise<void>[] = [];

  for (const key of allKeys) {
    const oldVal = oldDoc[key];
    const newVal = newDoc[key];

    if (typeof oldVal === 'object' || typeof newVal === 'object') {
      const oldStr = JSON.stringify(oldVal ?? null);
      const newStr = JSON.stringify(newVal ?? null);
      if (oldStr !== newStr) {
        promises.push(
          logAuditEntry({
            entityType,
            entityId,
            field: key,
            oldValue: oldStr,
            newValue: newStr,
            userId,
            userEmail,
          }),
        );
      }
    } else {
      const oldStr = oldVal != null ? String(oldVal) : null;
      const newStr = newVal != null ? String(newVal) : null;
      if (oldStr !== newStr) {
        promises.push(
          logAuditEntry({
            entityType,
            entityId,
            field: key,
            oldValue: oldStr,
            newValue: newStr,
            userId,
            userEmail,
          }),
        );
      }
    }
  }

  await Promise.all(promises);
}
