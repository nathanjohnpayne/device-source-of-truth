/**
 * Firebase Storage utilities for questionnaire file management.
 */

import admin from 'firebase-admin';
import { log } from './logger.js';

export async function uploadQuestionnaireFile(
  intakeJobId: string,
  fileName: string,
  fileBuffer: Buffer,
): Promise<string> {
  const bucket = admin.storage().bucket();
  const storagePath = `questionnaires/${intakeJobId}/${fileName}`;
  const file = bucket.file(storagePath);

  await file.save(fileBuffer, {
    metadata: {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: { intakeJobId, originalFileName: fileName },
    },
  });

  log.info('Questionnaire file uploaded to storage', { storagePath, size: fileBuffer.length });
  return storagePath;
}

export async function getSignedDownloadUrl(storagePath: string): Promise<string> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  return url;
}
