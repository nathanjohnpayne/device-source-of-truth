/**
 * DST-047 + DST-048: Questionnaire Intake, AI Extraction, Review & Sign-Off routes.
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

const router = Router();

// ── DST-047: Upload ──

router.post('/', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { fileData, fileName, partnerId, aiExtraction, notes } = req.body;

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
      partnerId: partnerId || null,
      partnerConfidence: partnerId ? 1.0 : null,
      partnerDetectionMethod: partnerId ? 'admin' : null,
      questionnaireFormat: 'unknown',
      deviceCountDetected: null,
      status: 'parsing',
      aiExtractionMode: aiExtraction ? 'auto' : null,
      aiExtractionStartedAt: null,
      aiExtractionCompletedAt: null,
      extractionError: null,
      notes: notes || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('questionnaireIntakeJobs').doc(jobId).set(jobData);

    // Parse synchronously for files under 5MB; otherwise return immediately
    try {
      const parseResult = await parseQuestionnaire(fileBuffer, fileName, db);

      const deviceDocs: { id: string; data: Record<string, unknown> }[] = [];
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
        deviceDocs.push({ id: deviceId, data: deviceData });
      }

      const batch = db.batch();
      for (const doc of deviceDocs) {
        batch.set(db.collection('questionnaireStagedDevices').doc(doc.id), doc.data);
      }

      // Create staged field records for each device's Q/A pairs
      for (let i = 0; i < parseResult.devices.length; i++) {
        const device = parseResult.devices[i];
        const pairs = parseResult.qaPairsByDevice.get(device.columnIndex) ?? [];
        const stagedDeviceId = deviceDocs[i].id;

        for (const pair of pairs) {
          const fieldId = db.collection('questionnaireStagedFields').doc().id;
          batch.set(db.collection('questionnaireStagedFields').doc(fieldId), {
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
        }
      }

      // Update job with parse results (don't set 'extracting' yet — wait for enqueue)
      const jobUpdate: Record<string, unknown> = {
        questionnaireFormat: parseResult.format,
        deviceCountDetected: parseResult.devices.length,
        status: 'awaiting_extraction',
        updatedAt: now,
      };

      if (!partnerId && parseResult.partnerDetection.partnerId) {
        jobUpdate.partnerId = parseResult.partnerDetection.partnerId;
        jobUpdate.partnerConfidence = parseResult.partnerDetection.confidence;
        jobUpdate.partnerDetectionMethod = parseResult.partnerDetection.method;
      }

      batch.update(db.collection('questionnaireIntakeJobs').doc(jobId), jobUpdate);
      await batch.commit();

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
    if (partner_id) query = query.where('partnerId', '==', partner_id);
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
          const startedAt = new Date(job.aiExtractionStartedAt as string).getTime();
          if (Date.now() - startedAt > staleThresholdMs) {
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

    // Fetch partner if assigned
    let partner = null;
    if (job.partnerId) {
      const partnerSnap = await db.collection('partners').doc(job.partnerId).get();
      if (partnerSnap.exists) partner = partnerSnap.data();
    }

    // Extraction progress (DST-052: include step and current device)
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
      partner,
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

    // Set job back to extracting
    await jobRef.update({
      status: 'extracting',
      extractionStep: 2,
      extractionCurrentDevice: deviceData.rawHeaderLabel,
      notificationSentAt: null,
      updatedAt: new Date().toISOString(),
    });

    const results = await enqueueExtractionTasks(
      (req.params.id as string),
      [(req.params.deviceId as string)],
      db,
    );

    if (results[0]?.success) {
      res.json({ status: 'retrying', message: `Retrying extraction for ${deviceData.rawHeaderLabel}` });
    } else {
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
        const fieldsSnap = await db.collection('questionnaireStagedFields')
          .where('stagedDeviceId', '==', d.id)
          .get();

        return {
          ...d.data(),
          fields: fieldsSnap.docs.map(f => f.data()),
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

    const devices = await Promise.all(
      devicesSnap.docs.map(async (d) => {
        const fieldsSnap = await db.collection('questionnaireStagedFields')
          .where('stagedDeviceId', '==', d.id)
          .get();

        return {
          ...d.data(),
          fields: fieldsSnap.docs.map(f => f.data()),
        };
      }),
    );

    let partner = null;
    if (job.partnerId) {
      const partnerSnap = await db.collection('partners').doc(job.partnerId).get();
      if (partnerSnap.exists) partner = partnerSnap.data();
    }

    res.json({
      job,
      devices,
      partner,
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
    if (req.body.partnerId !== undefined) {
      updates.partnerId = req.body.partnerId;
      updates.partnerDetectionMethod = 'admin';
      updates.partnerConfidence = 1.0;
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

// ── DST-048: Approve / Commit ──

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
    if (!job.partnerId) {
      res.status(422).json({ error: 'Partner must be assigned before approval' });
      return;
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
    const batch = db.batch();
    const affectedDeviceIds: string[] = [];
    const summary = { created: 0, updated: 0, fieldsWritten: 0, fieldsOverridden: 0 };

    for (const deviceDoc of approvedDevices) {
      const deviceData = deviceDoc.data();
      const fieldsSnap = await db.collection('questionnaireStagedFields')
        .where('stagedDeviceId', '==', deviceDoc.id)
        .get();

      let targetDeviceDocId: string;
      const isNewDevice = !deviceData.matchedDeviceId;

      if (isNewDevice) {
        // Create new device record
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

        batch.set(db.collection('devices').doc(newDeviceId), newDeviceData);

        const emptySpec: Record<string, unknown> = {
          id: newDeviceId,
          deviceId: newDeviceData.deviceId,
          updatedAt: now,
        };
        batch.set(db.collection('deviceSpecs').doc(newDeviceId), emptySpec);

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

      // Write spec fields
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

        summary.fieldsWritten++;
        if (field.conflictStatus === 'conflicts_with_existing') {
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

      // Write spec updates
      if (Object.keys(specUpdates).length > 0) {
        const specRef = db.collection('deviceSpecs').doc(targetDeviceDocId);
        const flatUpdates: Record<string, unknown> = { updatedAt: now };

        for (const [section, fields] of Object.entries(specUpdates)) {
          for (const [key, value] of Object.entries(fields)) {
            flatUpdates[`${section}.${key}`] = value;
          }
        }

        batch.set(specRef, flatUpdates, { merge: true });
      }

      // Create source link
      const sourceId = db.collection('deviceQuestionnaireSources').doc().id;
      batch.set(db.collection('deviceQuestionnaireSources').doc(sourceId), {
        id: sourceId,
        deviceId: targetDeviceDocId,
        intakeJobId: (req.params.id as string),
        stagedDeviceId: deviceDoc.id,
        importedAt: now,
        importedBy: req.user!.uid,
        importedByEmail: req.user!.email,
        fieldsImported: summary.fieldsWritten,
        fieldsOverridden: summary.fieldsOverridden,
      });
    }

    // Update intake job status
    const finalStatus = rejectedDevices.length > 0 && approvedDevices.length > 0
      ? 'partially_approved'
      : approvedDevices.length > 0
        ? 'approved'
        : 'rejected';

    batch.update(jobRef, { status: finalStatus, updatedAt: now });
    await batch.commit();

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

export default router;
