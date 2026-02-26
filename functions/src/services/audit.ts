import admin from 'firebase-admin';
import type { AuditEntityType } from '../types/index.js';
import { log } from './logger.js';

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
  log.debug('Writing audit entry', {
    entityType: params.entityType,
    entityId: params.entityId,
    field: params.field,
    userId: params.userId,
  });

  await db.collection('auditLog').add({
    ...params,
    timestamp: new Date().toISOString(),
  });

  log.debug('Audit entry written', {
    entityType: params.entityType,
    entityId: params.entityId,
    field: params.field,
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
  let changedFieldCount = 0;

  for (const key of allKeys) {
    const oldVal = oldDoc[key];
    const newVal = newDoc[key];

    if (typeof oldVal === 'object' || typeof newVal === 'object') {
      const oldStr = JSON.stringify(oldVal ?? null);
      const newStr = JSON.stringify(newVal ?? null);
      if (oldStr !== newStr) {
        changedFieldCount++;
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
        changedFieldCount++;
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

  log.info('Diff audit logging', {
    entityType,
    entityId,
    totalFields: allKeys.size,
    changedFields: changedFieldCount,
    userId,
  });

  await Promise.all(promises);
}
