/**
 * DST-047 + DST-048 + DST-055: Questionnaire Intake, AI Extraction,
 * Multi-Partner Detection, Review & Sign-Off routes.
 */

import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { logAuditEntry } from '../services/audit.js';
import { log, formatError } from '../services/logger.js';
import { parseQuestionnaire } from '../services/questionnaireParser.js';
import { enqueueExtractionTasks } from '../services/questionnaireExtractor.js';
import { uploadQuestionnaireFile, getSignedDownloadUrl } from '../services/storage.js';
import { calculateSpecCompleteness } from '../services/specCompleteness.js';
import { assignTierToDevice } from '../services/tierEngine.js';
import type { ExtractionStatus } from '../types/index.js';

// ── Batch chunking helper (Firestore 500-op limit) ──

const BATCH_CHUNK_SIZE = 450;

interface ChunkedBatchWriter {
  batch: FirebaseFirestore.WriteBatch;
  opCount: number;
}

function createChunkedWriter(db: FirebaseFirestore.Firestore): ChunkedBatchWriter {
  return { batch: db.batch(), opCount: 0 };
}

async function flushIfNeeded(
  db: FirebaseFirestore.Firestore,
  writer: ChunkedBatchWriter,
): Promise<void> {
  if (writer.opCount >= BATCH_CHUNK_SIZE) {
    await writer.batch.commit();
    writer.batch = db.batch();
    writer.opCount = 0;
  }
}

async function finalCommit(writer: ChunkedBatchWriter): Promise<void> {
  if (writer.opCount > 0) {
    await writer.batch.commit();
  }
}

// ── DST-055: Legacy migration helper ──

async function migrateJobToSubmitterModel(
  db: FirebaseFirestore.Firestore,
  jobRef: FirebaseFirestore.DocumentReference,
  job: FirebaseFirestore.DocumentData,
): Promise<void> {
  if (job.submitterPartnerId !== undefined) return;
  if (!job.partnerId) return;

  const now = new Date().toISOString();
  const writer = createChunkedWriter(db);

  writer.batch.update(jobRef, {
    submitterPartnerId: job.partnerId,
    submitterConfidence: job.partnerConfidence ?? 1.0,
    submitterDetectionMethod: job.partnerDetectionMethod ?? 'admin',
    isMultiPartner: false,
    updatedAt: now,
  });
  writer.opCount++;

  const ipId = db.collection('questionnaireIntakePartners').doc().id;
  writer.batch.set(db.collection('questionnaireIntakePartners').doc(ipId), {
    id: ipId,
    intakeJobId: jobRef.id,
    partnerId: job.partnerId,
    rawDetectedName: 'Legacy migration',
    detectionSource: 'admin',
    matchConfidence: 1.0,
    matchMethod: 'admin',
    reviewStatus: 'confirmed',
    deviceCount: 0,
    createdAt: now,
  });
  writer.opCount++;

  const devicesSnap = await db.collection('questionnaireStagedDevices')
    .where('intakeJobId', '==', jobRef.id)
    .get();

  for (const dDoc of devicesSnap.docs) {
    await flushIfNeeded(db, writer);
    const sdpId = db.collection('questionnaireStagedDevicePartners').doc().id;
    writer.batch.set(db.collection('questionnaireStagedDevicePartners').doc(sdpId), {
      id: sdpId,
      stagedDeviceId: dDoc.id,
      intakePartnerId: ipId,
      countries: null,
      certificationStatus: null,
      certificationAdkVersion: null,
      partnerModelName: null,
      detectionSource: 'admin',
      reviewStatus: 'confirmed',
      createdAt: now,
    });
    writer.opCount++;
  }

  try {
    await finalCommit(writer);
    log.info('Legacy job migrated to submitter model', { jobId: jobRef.id });
  } catch (err) {
    log.warn('Legacy migration failed (non-fatal)', { jobId: jobRef.id, error: formatError(err) });
  }
}

function resolveSubmitterId(job: FirebaseFirestore.DocumentData): string | null {
  return (job.submitterPartnerId as string) ?? (job.partnerId as string) ?? null;
}

async function fetchIntakePartners(
  db: FirebaseFirestore.Firestore,
  jobId: string,
): Promise<FirebaseFirestore.DocumentData[]> {
  const snap = await db.collection('questionnaireIntakePartners')
    .where('intakeJobId', '==', jobId)
    .get();
  return snap.docs.map(d => d.data());
}

async function fetchDevicePartnerLinks(
  db: FirebaseFirestore.Firestore,
  stagedDeviceId: string,
): Promise<FirebaseFirestore.DocumentData[]> {
  const snap = await db.collection('questionnaireStagedDevicePartners')
    .where('stagedDeviceId', '==', stagedDeviceId)
    .get();
  return snap.docs.map(d => d.data());
}

async function fetchAllDevicePartnerLinks(
  db: FirebaseFirestore.Firestore,
  stagedDeviceIds: string[],
): Promise<Map<string, FirebaseFirestore.DocumentData[]>> {
  const result = new Map<string, FirebaseFirestore.DocumentData[]>();
  if (stagedDeviceIds.length === 0) return result;

  // Firestore `in` supports up to 30 values; chunk larger lists
  for (let i = 0; i < stagedDeviceIds.length; i += 30) {
    const chunk = stagedDeviceIds.slice(i, i + 30);
    const snap = await db.collection('questionnaireStagedDevicePartners')
      .where('stagedDeviceId', 'in', chunk)
      .get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const id = data.stagedDeviceId as string;
      if (!result.has(id)) result.set(id, []);
      result.get(id)!.push(data);
    }
  }

  for (const id of stagedDeviceIds) {
    if (!result.has(id)) result.set(id, []);
  }
  return result;
}

const router = Router();

// ── DST-047: Upload ──

router.post('/', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { fileData, fileName, aiExtraction, notes } = req.body;
    const submitterPartnerId = req.body.submitterPartnerId || req.body.partnerId || null;

    if (!fileData || !fileName) {
      res.status(400).json({ error: 'fileData and fileName are required' });
      return;
    }

    const fileBuffer = Buffer.from(fileData, 'base64');
    const now = new Date().toISOString();
    const jobId = db.collection('questionnaireIntakeJobs').doc().id;

    const storagePath = await uploadQuestionnaireFile(jobId, fileName, fileBuffer);

    const jobData = {
      id: jobId,
      fileName,
      fileStoragePath: storagePath,
      fileSizeBytes: fileBuffer.length,
      uploadedBy: req.user!.uid,
      uploadedByEmail: req.user!.email,
      uploadedAt: now,
      submitterPartnerId: submitterPartnerId,
      submitterConfidence: submitterPartnerId ? 1.0 : null,
      submitterDetectionMethod: submitterPartnerId ? 'admin' : null,
      isMultiPartner: false,
      questionnaireFormat: 'unknown',
      deviceCountDetected: null,
      status: 'parsing',
      aiExtractionMode: aiExtraction ? 'auto' : null,
      aiExtractionStartedAt: null,
      aiExtractionCompletedAt: null,
      extractionError: null,
      tasksEnqueued: 0,
      devicesComplete: 0,
      devicesFailed: 0,
      extractionStep: null,
      extractionCurrentDevice: null,
      notes: notes || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('questionnaireIntakeJobs').doc(jobId).set(jobData);

    try {
      const parseResult = await parseQuestionnaire(fileBuffer, fileName, db);

      const deviceDocs: { id: string; data: Record<string, unknown>; columnIndex: number }[] = [];
      for (const device of parseResult.devices) {
        const deviceId = db.collection('questionnaireStagedDevices').doc().id;
        const deviceData = {
          id: deviceId,
          intakeJobId: jobId,
          columnIndex: device.columnIndex,
          rawHeaderLabel: device.rawHeaderLabel,
          detectedModelName: null,
          detectedModelNumber: null,
          detectedManufacturer: null,
          platformType: device.platformType,
          isOutOfScope: device.isOutOfScope,
          matchedDeviceId: null,
          matchConfidence: null,
          matchMethod: null,
          reviewStatus: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
          confirmedDisplayName: null,
          confirmedModelNumber: null,
          confirmedManufacturer: null,
          confirmedDeviceType: null,
          extractionStatus: 'pending' as ExtractionStatus,
          extractionError: null,
          createdAt: now,
        };
        deviceDocs.push({ id: deviceId, data: deviceData, columnIndex: device.columnIndex });
      }

      const writer = createChunkedWriter(db);

      for (const doc of deviceDocs) {
        await flushIfNeeded(db, writer);
        writer.batch.set(db.collection('questionnaireStagedDevices').doc(doc.id), doc.data);
        writer.opCount++;
      }

      for (let i = 0; i < parseResult.devices.length; i++) {
        const device = parseResult.devices[i];
        const pairs = parseResult.qaPairsByDevice.get(device.columnIndex) ?? [];
        const stagedDeviceId = deviceDocs[i].id;

        for (const pair of pairs) {
          await flushIfNeeded(db, writer);
          const fieldId = db.collection('questionnaireStagedFields').doc().id;
          writer.batch.set(db.collection('questionnaireStagedFields').doc(fieldId), {
            id: fieldId,
            stagedDeviceId,
            intakeJobId: jobId,
            dstFieldKey: '__unmapped__',
            dstFieldCategory: '',
            rawQuestionText: pair.rawQuestionText,
            rawAnswerText: pair.rawAnswerText,
            extractedValue: null,
            extractionMethod: 'skipped',
            aiConfidence: null,
            aiReasoning: null,
            conflictStatus: 'new_field',
            existingValue: null,
            resolution: 'pending',
            resolvedBy: null,
            resolvedAt: null,
            createdAt: now,
          });
          writer.opCount++;
        }
      }

      const jobUpdate: Record<string, unknown> = {
        questionnaireFormat: parseResult.format,
        deviceCountDetected: parseResult.devices.length,
        isMultiPartner: parseResult.isMultiPartner,
        status: 'awaiting_extraction',
        updatedAt: now,
      };

      if (!submitterPartnerId && parseResult.submitterDetection.partnerId) {
        jobUpdate.submitterPartnerId = parseResult.submitterDetection.partnerId;
        jobUpdate.submitterConfidence = parseResult.submitterDetection.confidence;
        jobUpdate.submitterDetectionMethod = parseResult.submitterDetection.method;
      }

      await flushIfNeeded(db, writer);
      writer.batch.update(db.collection('questionnaireIntakeJobs').doc(jobId), jobUpdate);
      writer.opCount++;
      await finalCommit(writer);

      // DST-055: persist multi-partner detection results
      if (parseResult.isMultiPartner && parseResult.intakePartners.length > 0) {
        const mpWriter = createChunkedWriter(db);
        const intakePartnerIds: string[] = [];

        for (const ip of parseResult.intakePartners) {
          await flushIfNeeded(db, mpWriter);
          const ipId = db.collection('questionnaireIntakePartners').doc().id;
          intakePartnerIds.push(ipId);
          mpWriter.batch.set(db.collection('questionnaireIntakePartners').doc(ipId), {
            id: ipId,
            intakeJobId: jobId,
            partnerId: ip.partnerId,
            rawDetectedName: ip.rawDetectedName,
            detectionSource: ip.detectionSource,
            matchConfidence: ip.matchConfidence,
            matchMethod: ip.matchMethod,
            reviewStatus: ip.partnerId ? 'confirmed' : 'pending',
            deviceCount: 0,
            createdAt: now,
          });
          mpWriter.opCount++;
        }

        for (const link of parseResult.devicePartnerLinks) {
          const stagedDevice = deviceDocs.find(d => d.columnIndex === link.deviceColumnIndex);
          if (!stagedDevice) continue;
          await flushIfNeeded(db, mpWriter);
          const sdpId = db.collection('questionnaireStagedDevicePartners').doc().id;
          mpWriter.batch.set(db.collection('questionnaireStagedDevicePartners').doc(sdpId), {
            id: sdpId,
            stagedDeviceId: stagedDevice.id,
            intakePartnerId: intakePartnerIds[link.intakePartnerIndex],
            countries: link.countries,
            certificationStatus: link.certificationStatus,
            certificationAdkVersion: link.certificationAdkVersion,
            partnerModelName: link.partnerModelName,
            detectionSource: link.detectionSource,
            reviewStatus: 'pending',
            createdAt: now,
          });
          mpWriter.opCount++;
        }

        for (let i = 0; i < intakePartnerIds.length; i++) {
          await flushIfNeeded(db, mpWriter);
          const count = parseResult.devicePartnerLinks
            .filter(l => l.intakePartnerIndex === i)
            .map(l => l.deviceColumnIndex)
            .filter((v, idx, arr) => arr.indexOf(v) === idx).length;
          mpWriter.batch.update(
            db.collection('questionnaireIntakePartners').doc(intakePartnerIds[i]),
            { deviceCount: count },
          );
          mpWriter.opCount++;
        }

        await finalCommit(mpWriter);
      }

      if (aiExtraction) {
        const deviceIds = deviceDocs.map(d => d.id);
        const results = await enqueueExtractionTasks(jobId, deviceIds, db);
        const allEnqueued = results.every(r => r.success);
        const noneEnqueued = results.every(r => !r.success);

        await db.collection('questionnaireIntakeJobs').doc(jobId).update({
          status: noneEnqueued ? 'extraction_failed' : 'extracting',
          aiExtractionStartedAt: noneEnqueued ? null : new Date().toISOString(),
          aiExtractionMode: 'auto',
          extractionError: noneEnqueued
            ? 'Failed to enqueue any extraction tasks'
            : !allEnqueued
              ? `${results.filter(r => !r.success).length} device(s) failed to enqueue`
              : null,
          tasksEnqueued: results.filter(r => r.success).length,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (parseErr) {
      await db.collection('questionnaireIntakeJobs').doc(jobId).update({
        status: 'parse_failed',
        extractionError: formatError(parseErr),
        updatedAt: new Date().toISOString(),
      });
    }

    const savedDoc = await db.collection('questionnaireIntakeJobs').doc(jobId).get();
    res.status(201).json(savedDoc.data());
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload questionnaire', detail: formatError(err) });
  }
});

// ── DST-047: List intake jobs ──

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const { status, partner_id, uploaded_by, search, page = '1', pageSize = '20' } = req.query;

    let query: FirebaseFirestore.Query = db.collection('questionnaireIntakeJobs')
      .orderBy('uploadedAt', 'desc');

    if (status) query = query.where('status', '==', status);
    if (partner_id) query = query.where('submitterPartnerId', '==', partner_id);
    if (uploaded_by) query = query.where('uploadedBy', '==', uploaded_by);

    const snap = await query.get();
    let allJobs = snap.docs.map(d => d.data());

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      allJobs = allJobs.filter((j) =>
        (j.fileName as string)?.toLowerCase().includes(q),
      );
    }

    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize as string, 10) || 20));
    const start = (p - 1) * ps;
    const data = allJobs.slice(start, start + ps);

    res.json({
      data,
      total: allJobs.length,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(allJobs.length / ps),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list intake jobs', detail: formatError(err) });
  }
});

// ── DST-047: Get intake job detail ──

router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const jobSnap = await db.collection('questionnaireIntakeJobs').doc((req.params.id as string)).get();
    if (!jobSnap.exists) {
      res.status(404).json({ error: 'Intake job not found' });
      return;
    }

    let job = jobSnap.data()!;

    // Self-healing: recover devices stuck in 'processing' for > 15 minutes
    if (job.status === 'extracting' && job.aiExtractionStartedAt) {
      const staleThresholdMs = 15 * 60 * 1000;
      const devicesSnap2 = await db.collection('questionnaireStagedDevices')
        .where('intakeJobId', '==', (req.params.id as string))
        .get();

      let recoveredAny = false;
      for (const doc of devicesSnap2.docs) {
        const dData = doc.data();
        if (dData.extractionStatus === 'processing') {
          const processingAt = dData.extractionProcessingAt
            ? new Date(dData.extractionProcessingAt as string).getTime()
            : new Date(job.aiExtractionStartedAt as string).getTime();
          if (Date.now() - processingAt > staleThresholdMs) {
            await doc.ref.update({
              extractionStatus: 'failed' as ExtractionStatus,
              extractionError: 'Task timed out or was interrupted',
            });
            recoveredAny = true;
            log.warn('extraction.stale_recovery', {
              intakeJobId: (req.params.id as string),
              stagedDeviceId: doc.id,
            });
          }
        }
      }

      if (recoveredAny) {
        const freshDevicesSnap = await db.collection('questionnaireStagedDevices')
          .where('intakeJobId', '==', (req.params.id as string))
          .get();

        let complete = 0;
        let failed = 0;
        for (const doc of freshDevicesSnap.docs) {
          const s = doc.data().extractionStatus as ExtractionStatus;
          if (s === 'complete') complete++;
          else if (s === 'failed') failed++;
        }

        const pending = freshDevicesSnap.size - complete - failed;
        if (pending === 0) {
          const finalStatus = complete === 0 ? 'extraction_failed' : 'pending_review';
          const recoveryUpdate: Record<string, unknown> = {
            status: finalStatus,
            devicesComplete: complete,
            devicesFailed: failed,
            extractionStep: complete > 0 ? 4 : null,
            extractionCurrentDevice: null,
            extractionError: `Extraction recovered: ${failed} device(s) timed out. ${complete > 0 ? 'Partial results are available for review.' : 'Please retry extraction.'}`,
            updatedAt: new Date().toISOString(),
          };
          await jobSnap.ref.update(recoveryUpdate);
          job = { ...job, ...recoveryUpdate };
        }
      }
    }

    // Fetch staged devices with field summaries
    const devicesSnap = await db.collection('questionnaireStagedDevices')
      .where('intakeJobId', '==', (req.params.id as string))
      .get();

    const stagedDevices = await Promise.all(
      devicesSnap.docs.map(async (d) => {
        const fieldsSnap = await db.collection('questionnaireStagedFields')
          .where('stagedDeviceId', '==', d.id)
          .get();

        const fields = fieldsSnap.docs.map(f => f.data());
        const extractedFields = fields.filter(f => f.extractionMethod !== 'skipped');
        const conflictCount = fields.filter(f => f.conflictStatus === 'conflicts_with_existing').length;
        const newFieldCount = fields.filter(f =>
          f.conflictStatus === 'new_field' || f.conflictStatus === 'no_existing_device',
        ).length;

        return {
          ...d.data(),
          fieldSummary: {
            totalFields: fields.length,
            extractedFields: extractedFields.length,
            conflictCount,
            newFieldCount,
          },
        };
      }),
    );

    // DST-055: legacy migration
    await migrateJobToSubmitterModel(db, jobSnap.ref, job);
    if (job.partnerId && !job.submitterPartnerId) {
      job = { ...job, submitterPartnerId: job.partnerId };
    }

    const submitterId = resolveSubmitterId(job);
    let submitterPartner = null;
    if (submitterId) {
      const partnerSnap = await db.collection('partners').doc(submitterId).get();
      if (partnerSnap.exists) submitterPartner = partnerSnap.data();
    }

    const intakePartners = await fetchIntakePartners(db, (req.params.id as string));

    let extractionProgress = null;
    if (job.status === 'extracting' || job.status === 'extraction_failed') {
      extractionProgress = {
        totalDevices: stagedDevices.length,
        devicesComplete: (job.devicesComplete as number) || 0,
        devicesFailed: (job.devicesFailed as number) || 0,
        step: (job.extractionStep as 1 | 2 | 3 | 4) || null,
        currentDevice: (job.extractionCurrentDevice as string) || null,
      };
    }

    res.json({
      ...job,
      stagedDevices,
      submitterPartner,
      intakePartners,
      extractionProgress,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get intake job', detail: formatError(err) });
  }
});

// ── DST-047: Trigger extraction manually ──

router.post('/:id/trigger-extraction', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const jobRef = db.collection('questionnaireIntakeJobs').doc((req.params.id as string));
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      res.status(404).json({ error: 'Intake job not found' });
      return;
    }

    const job = jobSnap.data()!;
    if (job.status !== 'awaiting_extraction' && job.status !== 'extraction_failed') {
      res.status(409).json({ error: 'Extraction already run or in progress', currentStatus: job.status });
      return;
    }

    // Reset any previously-failed device statuses back to pending
    const devicesSnap = await db.collection('questionnaireStagedDevices')
      .where('intakeJobId', '==', (req.params.id as string))
      .get();

    const resetBatch = db.batch();
    for (const doc of devicesSnap.docs) {
      const status = doc.data().extractionStatus as ExtractionStatus;
      if (status === 'failed') {
        resetBatch.update(doc.ref, {
          extractionStatus: 'pending' as ExtractionStatus,
          extractionError: null,
        });
      }
    }
    await resetBatch.commit();

    const deviceIds = devicesSnap.docs
      .filter(d => {
        const s = d.data().extractionStatus as ExtractionStatus;
        return s !== 'complete';
      })
      .map(d => d.id);

    if (deviceIds.length === 0) {
      await jobRef.update({
        status: 'pending_review',
        updatedAt: new Date().toISOString(),
      });
      res.json({ status: 'pending_review', message: 'All devices already extracted' });
      return;
    }

    const results = await enqueueExtractionTasks((req.params.id as string), deviceIds, db);
    const allEnqueued = results.every(r => r.success);
    const noneEnqueued = results.length > 0 && results.every(r => !r.success);

    await jobRef.update({
      status: noneEnqueued ? 'extraction_failed' : 'extracting',
      aiExtractionMode: 'manual',
      aiExtractionStartedAt: noneEnqueued ? null : new Date().toISOString(),
      extractionError: noneEnqueued
        ? 'Failed to enqueue any extraction tasks'
        : !allEnqueued
          ? `${results.filter(r => !r.success).length} device(s) failed to enqueue`
          : null,
      tasksEnqueued: results.filter(r => r.success).length,
      notificationSentAt: null,
      updatedAt: new Date().toISOString(),
    });

    res.json({ status: noneEnqueued ? 'extraction_failed' : 'extracting', message: 'Extraction tasks enqueued' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger extraction', detail: formatError(err) });
  }
});

// ── DST-052: Retry extraction for a single failed device ──

router.post('/:id/retry-device/:deviceId', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const jobRef = db.collection('questionnaireIntakeJobs').doc((req.params.id as string));
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      res.status(404).json({ error: 'Intake job not found' });
      return;
    }

    const deviceRef = db.collection('questionnaireStagedDevices').doc((req.params.deviceId as string));
    const deviceSnap = await deviceRef.get();

    if (!deviceSnap.exists) {
      res.status(404).json({ error: 'Staged device not found' });
      return;
    }

    const deviceData = deviceSnap.data()!;
    const deviceExtractionStatus = deviceData.extractionStatus as ExtractionStatus;
    if (deviceExtractionStatus !== 'failed' && !deviceData.extractionError) {
      res.status(409).json({ error: 'Device does not have an extraction error' });
      return;
    }

    // Reset device to pending for re-enqueue
    await deviceRef.update({
      extractionStatus: 'pending' as ExtractionStatus,
      extractionError: null,
    });

    const results = await enqueueExtractionTasks(
      (req.params.id as string),
      [(req.params.deviceId as string)],
      db,
    );

    if (results[0]?.success) {
      await jobRef.update({
        status: 'extracting',
        extractionStep: 2,
        extractionCurrentDevice: deviceData.rawHeaderLabel,
        notificationSentAt: null,
        updatedAt: new Date().toISOString(),
      });
      res.json({ status: 'retrying', message: `Retrying extraction for ${deviceData.rawHeaderLabel}` });
    } else {
      // Enqueue failed — revert device to failed so it doesn't block finalization
      await deviceRef.update({
        extractionStatus: 'failed' as ExtractionStatus,
        extractionError: `Enqueue failed: ${results[0]?.error}`,
      });
      res.status(500).json({ error: 'Failed to enqueue retry task', detail: results[0]?.error });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to retry device extraction', detail: formatError(err) });
  }
});

// ── DST-047: Get staged devices with fields ──

router.get('/:id/staged-devices', async (req, res) => {
  try {
    const db = admin.firestore();
    const devicesSnap = await db.collection('questionnaireStagedDevices')
      .where('intakeJobId', '==', (req.params.id as string))
      .get();

    const devices = await Promise.all(
      devicesSnap.docs.map(async (d) => {
        const [fieldsSnap, partnerDeployments] = await Promise.all([
          db.collection('questionnaireStagedFields')
            .where('stagedDeviceId', '==', d.id)
            .get(),
          fetchDevicePartnerLinks(db, d.id),
        ]);

        return {
          ...d.data(),
          fields: fieldsSnap.docs.map(f => f.data()),
          partnerDeployments,
        };
      }),
    );

    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get staged devices', detail: formatError(err) });
  }
});

// ── DST-047: Download source file ──

router.get('/:id/download', async (req, res) => {
  try {
    const db = admin.firestore();
    const jobSnap = await db.collection('questionnaireIntakeJobs').doc((req.params.id as string)).get();
    if (!jobSnap.exists) {
      res.status(404).json({ error: 'Intake job not found' });
      return;
    }

    const job = jobSnap.data()!;
    const url = await getSignedDownloadUrl(job.fileStoragePath as string);
    res.json({ url, fileName: job.fileName });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate download URL', detail: formatError(err) });
  }
});

// ── DST-048: Get full review state ──

router.get('/:id/review', async (req, res) => {
  try {
    const db = admin.firestore();
    const jobSnap = await db.collection('questionnaireIntakeJobs').doc((req.params.id as string)).get();
    if (!jobSnap.exists) {
      res.status(404).json({ error: 'Intake job not found' });
      return;
    }

    const job = jobSnap.data()!;
    const devicesSnap = await db.collection('questionnaireStagedDevices')
      .where('intakeJobId', '==', (req.params.id as string))
      .get();

    // DST-055: legacy migration
    await migrateJobToSubmitterModel(db, jobSnap.ref, job);

    const devices = await Promise.all(
      devicesSnap.docs.map(async (d) => {
        const [fieldsSnap, partnerDeployments] = await Promise.all([
          db.collection('questionnaireStagedFields')
            .where('stagedDeviceId', '==', d.id)
            .get(),
          fetchDevicePartnerLinks(db, d.id),
        ]);

        return {
          ...d.data(),
          fields: fieldsSnap.docs.map(f => f.data()),
          partnerDeployments,
        };
      }),
    );

    const submitterId = resolveSubmitterId(job);
    let submitterPartner = null;
    if (submitterId) {
      const partnerSnap = await db.collection('partners').doc(submitterId).get();
      if (partnerSnap.exists) submitterPartner = partnerSnap.data();
    }

    const intakePartners = await fetchIntakePartners(db, (req.params.id as string));

    res.json({
      job,
      devices,
      submitterPartner,
      intakePartners,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get review state', detail: formatError(err) });
  }
});

// ── DST-048: Update intake job (partner assignment) ──

router.patch('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const jobRef = db.collection('questionnaireIntakeJobs').doc((req.params.id as string));
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      res.status(404).json({ error: 'Intake job not found' });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    const newPartnerId = req.body.submitterPartnerId ?? req.body.partnerId;
    if (newPartnerId !== undefined) {
      updates.submitterPartnerId = newPartnerId;
      updates.submitterDetectionMethod = 'admin';
      updates.submitterConfidence = 1.0;
    }

    await jobRef.update(updates);
    const updated = await jobRef.get();
    res.json(updated.data());
  } catch (err) {
    res.status(500).json({ error: 'Failed to update intake job', detail: formatError(err) });
  }
});

// ── DST-048: Update staged device (approve/reject/match) ──

router.patch('/:id/staged-devices/:deviceId', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const deviceRef = db.collection('questionnaireStagedDevices').doc((req.params.deviceId as string));
    const deviceSnap = await deviceRef.get();
    if (!deviceSnap.exists) {
      res.status(404).json({ error: 'Staged device not found' });
      return;
    }

    const updates: Record<string, unknown> = {};
    const allowed = [
      'reviewStatus', 'rejectionReason', 'matchedDeviceId', 'matchConfidence', 'matchMethod',
      'confirmedDisplayName', 'confirmedModelNumber', 'confirmedManufacturer', 'confirmedDeviceType',
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.reviewStatus === 'approved' || updates.reviewStatus === 'rejected') {
      updates.reviewedBy = req.user!.uid;
      updates.reviewedAt = new Date().toISOString();
    }

    await deviceRef.update(updates);
    const updated = await deviceRef.get();
    res.json(updated.data());
  } catch (err) {
    res.status(500).json({ error: 'Failed to update staged device', detail: formatError(err) });
  }
});

// ── DST-048: Update single field resolution ──

router.patch('/:id/staged-devices/:deviceId/fields/:fieldId', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const fieldRef = db.collection('questionnaireStagedFields').doc((req.params.fieldId as string));
    const fieldSnap = await fieldRef.get();
    if (!fieldSnap.exists) {
      res.status(404).json({ error: 'Staged field not found' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (req.body.resolution) {
      updates.resolution = req.body.resolution;
      updates.resolvedBy = req.user!.uid;
      updates.resolvedAt = new Date().toISOString();
    }
    if (req.body.extractedValue !== undefined) {
      updates.extractedValue = req.body.extractedValue;
      updates.extractionMethod = 'admin_override';
    }

    await fieldRef.update(updates);
    const updated = await fieldRef.get();
    res.json(updated.data());
  } catch (err) {
    res.status(500).json({ error: 'Failed to update staged field', detail: formatError(err) });
  }
});

// ── DST-048: Bulk resolve all conflicts for a device ──

router.patch('/:id/staged-devices/:deviceId/resolve-all', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const fieldsSnap = await db.collection('questionnaireStagedFields')
      .where('stagedDeviceId', '==', (req.params.deviceId as string))
      .where('conflictStatus', '==', 'conflicts_with_existing')
      .where('resolution', '==', 'pending')
      .get();

    const batch = db.batch();
    const now = new Date().toISOString();

    for (const doc of fieldsSnap.docs) {
      batch.update(doc.ref, {
        resolution: 'use_new',
        resolvedBy: req.user!.uid,
        resolvedAt: now,
      });
    }

    await batch.commit();
    res.json({ resolved: fieldsSnap.docs.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bulk resolve conflicts', detail: formatError(err) });
  }
});

// ── DST-055: Update intake partner (brand resolution) ──

router.patch('/:id/intake-partners/:intakePartnerId', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const ipRef = db.collection('questionnaireIntakePartners').doc((req.params.intakePartnerId as string));
    const ipSnap = await ipRef.get();
    if (!ipSnap.exists) {
      res.status(404).json({ error: 'Intake partner not found' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (req.body.partnerId !== undefined) {
      updates.partnerId = req.body.partnerId;
      updates.matchMethod = 'admin';
      updates.matchConfidence = 1.0;
    }
    if (req.body.reviewStatus !== undefined) {
      updates.reviewStatus = req.body.reviewStatus;
    }

    // Duplicate merge: if mergeInto is specified, re-point staged device partner links
    if (req.body.mergeInto) {
      const targetIpId = req.body.mergeInto as string;
      const sourceIpId = (req.params.intakePartnerId as string);

      const [linksSnap, targetLinksSnap] = await Promise.all([
        db.collection('questionnaireStagedDevicePartners')
          .where('intakePartnerId', '==', sourceIpId)
          .get(),
        db.collection('questionnaireStagedDevicePartners')
          .where('intakePartnerId', '==', targetIpId)
          .get(),
      ]);

      // Index target links by stagedDeviceId for O(1) collision lookups
      const targetLinksByDevice = new Map<string, { ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData }>();
      for (const doc of targetLinksSnap.docs) {
        targetLinksByDevice.set(doc.data().stagedDeviceId as string, { ref: doc.ref, data: doc.data() });
      }

      const mergeBatch = db.batch();
      for (const linkDoc of linksSnap.docs) {
        const linkData = linkDoc.data();
        const existingTarget = targetLinksByDevice.get(linkData.stagedDeviceId as string);

        if (existingTarget) {
          mergeBatch.update(existingTarget.ref, {
            countries: mergeArrays(existingTarget.data.countries, linkData.countries),
            certificationStatus: linkData.certificationStatus ?? existingTarget.data.certificationStatus,
            certificationAdkVersion: linkData.certificationAdkVersion ?? existingTarget.data.certificationAdkVersion,
            partnerModelName: linkData.partnerModelName ?? existingTarget.data.partnerModelName,
          });
          mergeBatch.delete(linkDoc.ref);
        } else {
          mergeBatch.update(linkDoc.ref, { intakePartnerId: targetIpId });
        }
      }

      updates.reviewStatus = 'rejected';
      mergeBatch.update(ipRef, updates);
      await mergeBatch.commit();

      await logAuditEntry({
        entityType: 'questionnaire_intake_partner',
        entityId: (req.params.intakePartnerId as string),
        field: 'merge',
        oldValue: sourceIpId,
        newValue: `Merged into ${targetIpId}`,
        userId: req.user!.uid,
        userEmail: req.user!.email,
      });

      const updatedDoc = await ipRef.get();
      res.json(updatedDoc.data());
      return;
    }

    const oldData = ipSnap.data()!;
    await ipRef.update(updates);

    await logAuditEntry({
      entityType: 'questionnaire_intake_partner',
      entityId: (req.params.intakePartnerId as string),
      field: 'update',
      oldValue: JSON.stringify({ partnerId: oldData.partnerId, reviewStatus: oldData.reviewStatus }),
      newValue: JSON.stringify(updates),
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    const updated = await ipRef.get();
    res.json(updated.data());
  } catch (err) {
    res.status(500).json({ error: 'Failed to update intake partner', detail: formatError(err) });
  }
});

function mergeArrays(a: string[] | null, b: string[] | null): string[] | null {
  if (!a && !b) return null;
  return [...new Set([...(a ?? []), ...(b ?? [])])];
}

// ── DST-055: Replace deployments for a staged device ──

router.put('/:id/staged-devices/:deviceId/deployments', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const jobId = (req.params.id as string);
    const stagedDeviceId = (req.params.deviceId as string);
    const deployments = req.body.deployments as Array<{
      intakePartnerId: string;
      countries?: string[] | null;
      certificationStatus?: string | null;
      certificationAdkVersion?: string | null;
      partnerModelName?: string | null;
    }>;

    if (!Array.isArray(deployments)) {
      res.status(400).json({ error: 'deployments array is required' });
      return;
    }

    // Validate intakePartnerIds belong to this job
    const jobIntakePartners = await fetchIntakePartners(db, jobId);
    const validIpIds = new Set(jobIntakePartners.map(ip => ip.id as string));
    const invalidIds = deployments
      .map(d => d.intakePartnerId)
      .filter(id => !validIpIds.has(id));

    if (invalidIds.length > 0) {
      res.status(400).json({
        error: 'Invalid intakePartnerId(s)',
        detail: `The following intakePartnerIds do not belong to this job: ${invalidIds.join(', ')}`,
      });
      return;
    }

    const existingSnap = await db.collection('questionnaireStagedDevicePartners')
      .where('stagedDeviceId', '==', stagedDeviceId)
      .get();

    const batch = db.batch();
    for (const doc of existingSnap.docs) {
      batch.delete(doc.ref);
    }

    const now = new Date().toISOString();
    for (const dep of deployments) {
      const sdpId = db.collection('questionnaireStagedDevicePartners').doc().id;
      batch.set(db.collection('questionnaireStagedDevicePartners').doc(sdpId), {
        id: sdpId,
        stagedDeviceId,
        intakePartnerId: dep.intakePartnerId,
        countries: dep.countries ?? null,
        certificationStatus: dep.certificationStatus ?? null,
        certificationAdkVersion: dep.certificationAdkVersion ?? null,
        partnerModelName: dep.partnerModelName ?? null,
        detectionSource: 'admin',
        reviewStatus: 'confirmed',
        createdAt: now,
      });
    }

    await batch.commit();

    await logAuditEntry({
      entityType: 'questionnaire_staged_device_partner',
      entityId: stagedDeviceId,
      field: 'deployments_replaced',
      oldValue: `${existingSnap.size} deployment(s)`,
      newValue: `${deployments.length} deployment(s)`,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    const updated = await fetchDevicePartnerLinks(db, stagedDeviceId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update device deployments', detail: formatError(err) });
  }
});

// ── DST-048 + DST-055: Approve / Commit ──

router.post('/:id/approve', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const jobRef = db.collection('questionnaireIntakeJobs').doc((req.params.id as string));
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      res.status(404).json({ error: 'Intake job not found' });
      return;
    }

    const job = jobSnap.data()!;

    // DST-055: legacy migration
    await migrateJobToSubmitterModel(db, jobRef, job);

    // Partner guard
    if (job.isMultiPartner) {
      const intakePartners = await fetchIntakePartners(db, (req.params.id as string));
      const pendingPartners = intakePartners.filter(ip => ip.reviewStatus === 'pending');
      if (pendingPartners.length > 0) {
        res.status(409).json({
          error: `${pendingPartners.length} intake partner(s) still pending review`,
          pendingPartners: pendingPartners.map(ip => ip.rawDetectedName),
        });
        return;
      }
    } else {
      const submitterId = resolveSubmitterId(job);
      if (!submitterId) {
        res.status(422).json({ error: 'Partner must be assigned before approval' });
        return;
      }
    }

    const devicesSnap = await db.collection('questionnaireStagedDevices')
      .where('intakeJobId', '==', (req.params.id as string))
      .get();

    const hasPending = devicesSnap.docs.some(d => d.data().reviewStatus === 'pending');
    if (hasPending) {
      res.status(409).json({ error: 'All devices must be approved or rejected before sign-off' });
      return;
    }

    const approvedDevices = devicesSnap.docs.filter(d => d.data().reviewStatus === 'approved');
    const rejectedDevices = devicesSnap.docs.filter(d => d.data().reviewStatus === 'rejected');

    // Check for unresolved conflicts in approved devices
    for (const deviceDoc of approvedDevices) {
      const unresolvedSnap = await db.collection('questionnaireStagedFields')
        .where('stagedDeviceId', '==', deviceDoc.id)
        .where('conflictStatus', '==', 'conflicts_with_existing')
        .where('resolution', '==', 'pending')
        .get();

      if (!unresolvedSnap.empty) {
        res.status(409).json({
          error: `Device "${deviceDoc.data().rawHeaderLabel}" has ${unresolvedSnap.size} unresolved conflicts`,
        });
        return;
      }
    }

    const now = new Date().toISOString();
    const writer = createChunkedWriter(db);
    const affectedDeviceIds: string[] = [];
    const summary = { created: 0, updated: 0, fieldsWritten: 0, fieldsOverridden: 0 };

    // Hoist intake partners outside the device loop (was N+1)
    const intakePartners = await fetchIntakePartners(db, (req.params.id as string));

    // Batch-fetch all device partner links for approved devices
    const approvedDeviceIds = approvedDevices.map(d => d.id);
    const allDevicePartnerLinks = await fetchAllDevicePartnerLinks(db, approvedDeviceIds);

    for (const deviceDoc of approvedDevices) {
      const deviceData = deviceDoc.data();
      const fieldsSnap = await db.collection('questionnaireStagedFields')
        .where('stagedDeviceId', '==', deviceDoc.id)
        .get();

      let targetDeviceDocId: string;
      const isNewDevice = !deviceData.matchedDeviceId;

      // Per-device field counters (Fix 4)
      let deviceFieldsWritten = 0;
      let deviceFieldsOverridden = 0;

      if (isNewDevice) {
        const newDeviceId = db.collection('devices').doc().id;
        targetDeviceDocId = newDeviceId;

        const newDeviceData: Record<string, unknown> = {
          id: newDeviceId,
          displayName: deviceData.confirmedDisplayName || deviceData.detectedModelName || deviceData.rawHeaderLabel,
          deviceId: deviceData.confirmedModelNumber || deviceData.detectedModelNumber || newDeviceId,
          partnerKeyId: '',
          deviceType: deviceData.confirmedDeviceType || 'STB',
          status: deviceData.isOutOfScope ? 'out_of_scope' : 'active',
          liveAdkVersion: null,
          certificationStatus: 'Not Submitted',
          certificationNotes: null,
          lastCertifiedDate: null,
          questionnaireUrl: null,
          questionnaireFileUrl: null,
          activeDeviceCount: 0,
          specCompleteness: 0,
          pendingPartnerKey: null,
          tierId: null,
          tierAssignedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        if (deviceData.isOutOfScope) {
          newDeviceData.phase = 'phase_2';
        }

        await flushIfNeeded(db, writer);
        writer.batch.set(db.collection('devices').doc(newDeviceId), newDeviceData);
        writer.opCount++;

        const emptySpec: Record<string, unknown> = {
          id: newDeviceId,
          deviceId: newDeviceData.deviceId,
          updatedAt: now,
        };
        await flushIfNeeded(db, writer);
        writer.batch.set(db.collection('deviceSpecs').doc(newDeviceId), emptySpec);
        writer.opCount++;

        summary.created++;

        await logAuditEntry({
          entityType: 'device',
          entityId: newDeviceId,
          field: 'create',
          oldValue: null,
          newValue: `Created from questionnaire intake ${(req.params.id as string)}`,
          userId: req.user!.uid,
          userEmail: req.user!.email,
        });
      } else {
        targetDeviceDocId = deviceData.matchedDeviceId;
        summary.updated++;
      }

      affectedDeviceIds.push(targetDeviceDocId);

      const specUpdates: Record<string, Record<string, unknown>> = {};

      for (const fieldDoc of fieldsSnap.docs) {
        const field = fieldDoc.data();

        if (field.dstFieldKey === '__unmapped__' || !field.dstFieldKey) continue;
        if (field.extractedValue == null) continue;

        const shouldWrite =
          field.conflictStatus === 'new_field' ||
          field.conflictStatus === 'no_existing_device' ||
          field.conflictStatus === 'matches_existing' ||
          (field.conflictStatus === 'conflicts_with_existing' && field.resolution === 'use_new');

        if (!shouldWrite) continue;

        const [section, fieldKey] = field.dstFieldKey.split('.');
        if (!section || !fieldKey) continue;

        if (!specUpdates[section]) specUpdates[section] = {};
        specUpdates[section][fieldKey] = field.extractedValue;

        deviceFieldsWritten++;
        summary.fieldsWritten++;
        if (field.conflictStatus === 'conflicts_with_existing') {
          deviceFieldsOverridden++;
          summary.fieldsOverridden++;
        }

        await logAuditEntry({
          entityType: 'deviceSpec',
          entityId: targetDeviceDocId,
          field: `${section}.${fieldKey}`,
          oldValue: field.existingValue,
          newValue: field.extractedValue,
          userId: req.user!.uid,
          userEmail: req.user!.email,
        });
      }

      if (Object.keys(specUpdates).length > 0) {
        const specRef = db.collection('deviceSpecs').doc(targetDeviceDocId);
        const flatUpdates: Record<string, unknown> = { updatedAt: now };

        for (const [section, fields] of Object.entries(specUpdates)) {
          for (const [key, value] of Object.entries(fields)) {
            flatUpdates[`${section}.${key}`] = value;
          }
        }

        await flushIfNeeded(db, writer);
        writer.batch.set(specRef, flatUpdates, { merge: true });
        writer.opCount++;
      }

      // DST-055: write deployment records and partner-scoped source links
      const devicePartnerLinks = allDevicePartnerLinks.get(deviceDoc.id) ?? [];
      const confirmedLinks = devicePartnerLinks.filter(l => l.reviewStatus !== 'rejected');

      if (confirmedLinks.length > 0) {
        for (const link of confirmedLinks) {
          const ip = intakePartners.find(p => p.id === link.intakePartnerId);
          const deploymentPartnerId = ip?.partnerId;
          if (!deploymentPartnerId) continue;

          const deploymentDocId = `${targetDeviceDocId}_${deploymentPartnerId}`;
          const existingDeploy = await db.collection('devicePartnerDeployments').doc(deploymentDocId).get();

          await flushIfNeeded(db, writer);
          if (existingDeploy.exists) {
            writer.batch.update(db.collection('devicePartnerDeployments').doc(deploymentDocId), {
              countries: link.countries ?? existingDeploy.data()!.countries ?? null,
              partnerModelName: link.partnerModelName ?? existingDeploy.data()!.partnerModelName ?? null,
              certificationStatus: link.certificationStatus ?? existingDeploy.data()!.certificationStatus ?? null,
              certificationAdkVersion: link.certificationAdkVersion ?? existingDeploy.data()!.certificationAdkVersion ?? null,
              sourceIntakeJobId: (req.params.id as string),
              updatedAt: now,
            });
          } else {
            writer.batch.set(db.collection('devicePartnerDeployments').doc(deploymentDocId), {
              id: deploymentDocId,
              deviceId: targetDeviceDocId,
              partnerId: deploymentPartnerId,
              countries: link.countries,
              partnerModelName: link.partnerModelName,
              certificationStatus: link.certificationStatus,
              certificationAdkVersion: link.certificationAdkVersion,
              active: true,
              sourceIntakeJobId: (req.params.id as string),
              createdAt: now,
              updatedAt: now,
            });
          }
          writer.opCount++;

          await logAuditEntry({
            entityType: 'device_partner_deployment',
            entityId: deploymentDocId,
            field: existingDeploy.exists ? 'update' : 'create',
            oldValue: null,
            newValue: `Deployment for device ${targetDeviceDocId} + partner ${deploymentPartnerId}`,
            userId: req.user!.uid,
            userEmail: req.user!.email,
          });

          await flushIfNeeded(db, writer);
          const sourceId = db.collection('deviceQuestionnaireSources').doc().id;
          writer.batch.set(db.collection('deviceQuestionnaireSources').doc(sourceId), {
            id: sourceId,
            deviceId: targetDeviceDocId,
            intakeJobId: (req.params.id as string),
            stagedDeviceId: deviceDoc.id,
            partnerId: deploymentPartnerId,
            importedAt: now,
            importedBy: req.user!.uid,
            importedByEmail: req.user!.email,
            fieldsImported: deviceFieldsWritten,
            fieldsOverridden: deviceFieldsOverridden,
          });
          writer.opCount++;
        }
      } else {
        const submitterId = resolveSubmitterId(job);
        await flushIfNeeded(db, writer);
        const sourceId = db.collection('deviceQuestionnaireSources').doc().id;
        writer.batch.set(db.collection('deviceQuestionnaireSources').doc(sourceId), {
          id: sourceId,
          deviceId: targetDeviceDocId,
          intakeJobId: (req.params.id as string),
          stagedDeviceId: deviceDoc.id,
          partnerId: submitterId,
          importedAt: now,
          importedBy: req.user!.uid,
          importedByEmail: req.user!.email,
          fieldsImported: deviceFieldsWritten,
          fieldsOverridden: deviceFieldsOverridden,
        });
        writer.opCount++;
      }
    }

    const finalStatus = rejectedDevices.length > 0 && approvedDevices.length > 0
      ? 'partially_approved'
      : approvedDevices.length > 0
        ? 'approved'
        : 'rejected';

    await flushIfNeeded(db, writer);
    writer.batch.update(jobRef, { status: finalStatus, updatedAt: now });
    writer.opCount++;
    await finalCommit(writer);

    // Post-commit: recalculate spec completeness and tier assignments
    for (const deviceId of affectedDeviceIds) {
      try {
        const specSnap = await db.collection('deviceSpecs').doc(deviceId).get();
        if (specSnap.exists) {
          const specData = specSnap.data()!;
          const completeness = calculateSpecCompleteness(specData as Record<string, unknown>);
          await db.collection('devices').doc(deviceId).update({
            specCompleteness: completeness,
            updatedAt: now,
          });
        }
        await assignTierToDevice(deviceId);
      } catch (err) {
        req.log?.warn('Post-commit recalculation failed', { deviceId, error: formatError(err) });
      }
    }

    // Create notification for admins
    const notificationId = db.collection('notifications').doc().id;
    await db.collection('notifications').doc(notificationId).set({
      id: notificationId,
      recipientRole: 'admin',
      title: 'Questionnaire import completed',
      body: `${summary.created} new device(s) created, ${summary.updated} updated from ${job.fileName}`,
      link: `/admin/questionnaires/${(req.params.id as string)}`,
      read: false,
      createdAt: now,
    });

    res.json({
      status: finalStatus,
      summary,
      affectedDeviceIds,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve intake job', detail: formatError(err) });
  }
});

// ── DST-048: Reject entire intake job ──

router.post('/:id/reject', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const jobRef = db.collection('questionnaireIntakeJobs').doc((req.params.id as string));
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      res.status(404).json({ error: 'Intake job not found' });
      return;
    }

    const now = new Date().toISOString();
    await jobRef.update({
      status: 'rejected',
      notes: req.body.reason ? `Rejected: ${req.body.reason}` : jobSnap.data()!.notes,
      updatedAt: now,
    });

    // Mark all devices as rejected
    const devicesSnap = await db.collection('questionnaireStagedDevices')
      .where('intakeJobId', '==', (req.params.id as string))
      .get();

    const batch = db.batch();
    for (const doc of devicesSnap.docs) {
      batch.update(doc.ref, {
        reviewStatus: 'rejected',
        reviewedBy: req.user!.uid,
        reviewedAt: now,
        rejectionReason: req.body.reason || null,
      });
    }
    await batch.commit();

    res.json({ status: 'rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject intake job', detail: formatError(err) });
  }
});

// ── Notifications ──

router.get('/notifications/list', async (req, res) => {
  try {
    const db = admin.firestore();
    const limit = Math.min(50, parseInt(req.query.limit as string, 10) || 20);

    let query: FirebaseFirestore.Query = db.collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (req.query.unread === 'true') {
      query = db.collection('notifications')
        .where('read', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }

    const snap = await query.get();
    res.json(snap.docs.map(d => d.data()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to list notifications', detail: formatError(err) });
  }
});

router.patch('/notifications/:notificationId/read', async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection('notifications').doc((req.params.notificationId as string)).update({ read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification read', detail: formatError(err) });
  }
});

// ── Device detail integration: sources for a device ──

router.get('/device-sources/:deviceId', async (req, res) => {
  try {
    const db = admin.firestore();
    const sourcesSnap = await db.collection('deviceQuestionnaireSources')
      .where('deviceId', '==', (req.params.deviceId as string))
      .get();

    const sources = await Promise.all(
      sourcesSnap.docs.map(async (d) => {
        const source = d.data();
        let jobFileName: string | null = null;
        try {
          const jobSnap = await db.collection('questionnaireIntakeJobs').doc(source.intakeJobId).get();
          if (jobSnap.exists) {
            jobFileName = jobSnap.data()!.fileName as string;
          }
        } catch { /* ignore */ }
        return { ...source, jobFileName };
      }),
    );

    res.json(sources);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get device sources', detail: formatError(err) });
  }
});

// ── DST-055: Get device partner deployments ──

router.get('/device-deployments/:deviceId', async (req, res) => {
  try {
    const db = admin.firestore();
    const deploymentsSnap = await db.collection('devicePartnerDeployments')
      .where('deviceId', '==', (req.params.deviceId as string))
      .get();

    const deployments = await Promise.all(
      deploymentsSnap.docs.map(async (d) => {
        const dep = d.data();
        let partnerName: string | null = null;
        let jobFileName: string | null = null;
        try {
          const partnerSnap = await db.collection('partners').doc(dep.partnerId).get();
          if (partnerSnap.exists) partnerName = partnerSnap.data()!.displayName as string;
        } catch { /* ignore */ }
        if (dep.sourceIntakeJobId) {
          try {
            const jobSnap = await db.collection('questionnaireIntakeJobs').doc(dep.sourceIntakeJobId).get();
            if (jobSnap.exists) jobFileName = jobSnap.data()!.fileName as string;
          } catch { /* ignore */ }
        }
        return { ...dep, partnerName, jobFileName };
      }),
    );

    res.json(deployments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get device deployments', detail: formatError(err) });
  }
});

// ── DST-055: Get partner deployments (devices deployed by a partner) ──

router.get('/partner-deployments/:partnerId', async (req, res) => {
  try {
    const db = admin.firestore();
    const { certification_status, active } = req.query;

    let query: FirebaseFirestore.Query = db.collection('devicePartnerDeployments')
      .where('partnerId', '==', (req.params.partnerId as string));

    if (certification_status) {
      query = query.where('certificationStatus', '==', certification_status);
    }

    const deploymentsSnap = await query.get();
    let deployments = deploymentsSnap.docs.map(d => d.data());

    if (active !== undefined) {
      const isActive = active === 'true';
      deployments = deployments.filter(d => d.active === isActive);
    }

    const enriched = await Promise.all(
      deployments.map(async (dep) => {
        let deviceDisplayName: string | null = null;
        try {
          const deviceSnap = await db.collection('devices').doc(dep.deviceId).get();
          if (deviceSnap.exists) deviceDisplayName = deviceSnap.data()!.displayName as string;
        } catch { /* ignore */ }
        return { ...dep, deviceDisplayName };
      }),
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get partner deployments', detail: formatError(err) });
  }
});

export default router;
