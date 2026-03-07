import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll } from '../helpers/fixtures.js';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

// ── Upload ──

describe('POST /api/questionnaire-intake', () => {
  const validPayload = {
    fileData: Buffer.from('fake xlsx content').toString('base64'),
    fileName: 'Partner_Questionnaire.xlsx',
  };

  it('returns 201 with job data on successful upload', async () => {
    const res = await request(app)
      .post('/api/questionnaire-intake')
      .send(validPayload)
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(typeof res.body.id).toBe('string');
    expect(res.body.fileName).toBe('Partner_Questionnaire.xlsx');
    expect(res.body.uploadedBy).toBe('test-uid');
    expect(res.body.uploadedByEmail).toBe('test@disney.com');
    expect(res.body.status).toBeDefined();
  });

  it('persists partnerId when provided', async () => {
    const res = await request(app)
      .post('/api/questionnaire-intake')
      .send({ ...validPayload, partnerId: 'p1' })
      .expect(201);

    expect(res.body.submitterPartnerId).toBe('p1');
    expect(res.body.submitterDetectionMethod).toBe('admin');
    expect(res.body.submitterConfidence).toBe(1.0);
  });

  it('returns 400 when fileData is missing', async () => {
    const res = await request(app)
      .post('/api/questionnaire-intake')
      .send({ fileName: 'test.xlsx' })
      .expect(400);

    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when fileName is missing', async () => {
    const res = await request(app)
      .post('/api/questionnaire-intake')
      .send({ fileData: validPayload.fileData })
      .expect(400);

    expect(res.body.error).toBeDefined();
  });
});

// ── List ──

describe('GET /api/questionnaire-intake', () => {
  it('returns a paginated list of jobs', async () => {
    const res = await request(app)
      .get('/api/questionnaire-intake')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.page).toBe('number');
    expect(typeof res.body.pageSize).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
  });

  it('returns seeded jobs', async () => {
    const res = await request(app)
      .get('/api/questionnaire-intake')
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by status', async () => {
    const res = await request(app)
      .get('/api/questionnaire-intake?status=pending_review')
      .expect(200);

    for (const job of res.body.data) {
      expect(job.status).toBe('pending_review');
    }
  });

  it('returns empty data (not error) when no jobs match search', async () => {
    const res = await request(app)
      .get('/api/questionnaire-intake?search=nonexistent-file-xyz')
      .expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

// ── Detail ──

describe('GET /api/questionnaire-intake/:id', () => {
  it('returns job detail with stagedDevices array', async () => {
    const res = await request(app)
      .get('/api/questionnaire-intake/qj1')
      .expect(200);

    expect(res.body.id).toBe('qj1');
    expect(res.body.fileName).toBe('Acme_STB_Questionnaire.xlsx');
    expect(Array.isArray(res.body.stagedDevices)).toBe(true);
  });

  it('stagedDevices include fieldSummary with numeric counts', async () => {
    const res = await request(app)
      .get('/api/questionnaire-intake/qj1')
      .expect(200);

    for (const device of res.body.stagedDevices) {
      expect(device.fieldSummary).toBeDefined();
      expect(typeof device.fieldSummary.totalFields).toBe('number');
      expect(typeof device.fieldSummary.extractedFields).toBe('number');
      expect(typeof device.fieldSummary.conflictCount).toBe('number');
      expect(typeof device.fieldSummary.newFieldCount).toBe('number');
    }
  });

  it('includes submitterPartner when partnerId is set', async () => {
    const res = await request(app)
      .get('/api/questionnaire-intake/qj1')
      .expect(200);

    expect(res.body.submitterPartner).toBeDefined();
    expect(res.body.submitterPartner.displayName).toBe('Acme Devices');
  });

  it('submitterPartner is null when partnerId is not set', async () => {
    const res = await request(app)
      .get('/api/questionnaire-intake/qj2')
      .expect(200);

    expect(res.body.submitterPartner).toBeNull();
  });

  it('returns 404 for nonexistent job', async () => {
    const res = await request(app)
      .get('/api/questionnaire-intake/nonexistent')
      .expect(404);

    expect(res.body.error).toBeDefined();
  });
});

// ── Trigger Extraction ──

describe('POST /api/questionnaire-intake/:id/trigger-extraction', () => {
  it('returns 409 when job is not in awaiting_extraction or extraction_failed', async () => {
    const res = await request(app)
      .post('/api/questionnaire-intake/qj1/trigger-extraction')
      .expect(409);

    expect(res.body.error).toBeDefined();
    expect(res.body.currentStatus).toBe('pending_review');
  });

  it('accepts trigger when job is awaiting_extraction', async () => {
    const res = await request(app)
      .post('/api/questionnaire-intake/qj2/trigger-extraction')
      .expect(200);

    expect(res.body.status).toBe('extracting');
  });

  it('returns 404 for nonexistent job', async () => {
    await request(app)
      .post('/api/questionnaire-intake/nonexistent/trigger-extraction')
      .expect(404);
  });
});

// ── Approve / Status Transitions ──

describe('POST /api/questionnaire-intake/:id/approve', () => {
  it('returns 422 when partner is not assigned', async () => {
    const res = await request(app)
      .post('/api/questionnaire-intake/qj2/approve')
      .expect(422);

    expect(res.body.error).toMatch(/partner/i);
  });

  it('returns 409 when devices are still pending', async () => {
    const res = await request(app)
      .post('/api/questionnaire-intake/qj1/approve')
      .expect(409);

    expect(res.body.error).toMatch(/approved or rejected/i);
  });

  it('approves job when all devices are approved and partner assigned', async () => {
    // Mark the staged device as approved
    await mockDb.collection('questionnaireStagedDevices').doc('qsd1').update({
      reviewStatus: 'approved',
      confirmedDisplayName: 'Test STB',
      confirmedModelNumber: 'TST-001',
    });

    const res = await request(app)
      .post('/api/questionnaire-intake/qj1/approve')
      .expect(200);

    expect(['approved', 'partially_approved']).toContain(res.body.status);
    expect(res.body.summary).toBeDefined();
    expect(Array.isArray(res.body.affectedDeviceIds)).toBe(true);
  });

  it('returns 404 for nonexistent job', async () => {
    await request(app)
      .post('/api/questionnaire-intake/nonexistent/approve')
      .expect(404);
  });
});

// ── Reject ──

describe('POST /api/questionnaire-intake/:id/reject', () => {
  it('rejects the job and marks all devices as rejected', async () => {
    const res = await request(app)
      .post('/api/questionnaire-intake/qj1/reject')
      .send({ reason: 'Bad data' })
      .expect(200);

    expect(res.body.status).toBe('rejected');

    // Verify device was rejected
    const deviceSnap = await mockDb.collection('questionnaireStagedDevices').doc('qsd1').get();
    expect(deviceSnap.data()?.reviewStatus).toBe('rejected');
  });

  it('returns 404 for nonexistent job', async () => {
    await request(app)
      .post('/api/questionnaire-intake/nonexistent/reject')
      .expect(404);
  });
});

// ── Partner assignment (PATCH) ──

describe('PATCH /api/questionnaire-intake/:id', () => {
  it('updates partnerId', async () => {
    const res = await request(app)
      .patch('/api/questionnaire-intake/qj2')
      .send({ partnerId: 'p1' })
      .expect(200);

    expect(res.body.submitterPartnerId).toBe('p1');
    expect(res.body.submitterDetectionMethod).toBe('admin');
  });

  it('returns 404 for nonexistent job', async () => {
    await request(app)
      .patch('/api/questionnaire-intake/nonexistent')
      .send({ partnerId: 'p1' })
      .expect(404);
  });
});

// ── Staged device update ──

describe('PATCH /api/questionnaire-intake/:id/staged-devices/:deviceId', () => {
  it('updates reviewStatus', async () => {
    const res = await request(app)
      .patch('/api/questionnaire-intake/qj1/staged-devices/qsd1')
      .send({ reviewStatus: 'approved' })
      .expect(200);

    expect(res.body.reviewStatus).toBe('approved');
    expect(res.body.reviewedBy).toBe('test-uid');
  });

  it('returns 404 for nonexistent device', async () => {
    await request(app)
      .patch('/api/questionnaire-intake/qj1/staged-devices/nonexistent')
      .send({ reviewStatus: 'approved' })
      .expect(404);
  });
});

// ── Approve flow: missing spec doc regression (merge:true upsert) ──

describe('POST /api/questionnaire-intake/:id/approve — spec doc upsert', () => {
  it('creates spec doc via set+merge when no existing spec doc exists', async () => {
    // Set up: approved device matched to d1, but remove the deviceSpecs doc
    await mockDb.collection('questionnaireStagedDevices').doc('qsd1').update({
      reviewStatus: 'approved',
      matchedDeviceId: 'd1',
    });

    // Mark the staged field as writable
    await mockDb.collection('questionnaireStagedFields').doc('qsf1').update({
      conflictStatus: 'new_field',
      resolution: 'pending',
    });

    // Remove existing spec doc for d1 to test upsert path
    await mockDb.collection('deviceSpecs').doc('d1').delete();

    const res = await request(app)
      .post('/api/questionnaire-intake/qj1/approve')
      .expect(200);

    expect(res.body.status).toBeDefined();

    // Verify the spec doc was created via merge
    const specSnap = await mockDb.collection('deviceSpecs').doc('d1').get();
    expect(specSnap.exists).toBe(true);
    const specData = specSnap.data()!;
    expect((specData.hardware as Record<string, unknown>)?.socVendor).toBe('Broadcom');
    expect(specData.updatedAt).toBeDefined();
  });

  it('preserves existing spec fields when merging new fields', async () => {
    // Pre-populate spec with an existing nested field
    await mockDb.collection('deviceSpecs').doc('d1').set({
      id: 'd1',
      deviceId: 'acme-4k-001',
      updatedAt: '2026-01-01T00:00:00.000Z',
      hardware: { cpuCores: '4' },
    });

    await mockDb.collection('questionnaireStagedDevices').doc('qsd1').update({
      reviewStatus: 'approved',
      matchedDeviceId: 'd1',
    });

    await request(app)
      .post('/api/questionnaire-intake/qj1/approve')
      .expect(200);

    const specSnap = await mockDb.collection('deviceSpecs').doc('d1').get();
    const specData = specSnap.data()!;
    const hw = specData.hardware as Record<string, unknown>;
    expect(hw?.socVendor).toBe('Broadcom');
    expect(hw?.cpuCores).toBe('4');
  });
});
