import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll, fixtures } from '../helpers/fixtures.js';
import {
  paginatedResponseSchema,
  HardwareTierSchema,
  TierPreviewSchema,
  SimulateResultSchema,
} from './schemas.js';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

describe('GET /api/tiers', () => {
  it('response has data array', async () => {
    const res = await request(app).get('/api/tiers').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('response has total field (required by PaginatedResponse contract)', async () => {
    const res = await request(app).get('/api/tiers').expect(200);
    expect(res.body).toHaveProperty('total');
    expect(typeof res.body.total).toBe('number');
  });

  it('response has page field (required by PaginatedResponse contract)', async () => {
    const res = await request(app).get('/api/tiers').expect(200);
    expect(res.body).toHaveProperty('page');
    expect(typeof res.body.page).toBe('number');
  });

  it('response has pageSize field (required by PaginatedResponse contract)', async () => {
    const res = await request(app).get('/api/tiers').expect(200);
    expect(res.body).toHaveProperty('pageSize');
    expect(typeof res.body.pageSize).toBe('number');
  });

  it('response has totalPages field (required by PaginatedResponse contract)', async () => {
    const res = await request(app).get('/api/tiers').expect(200);
    expect(res.body).toHaveProperty('totalPages');
    expect(typeof res.body.totalPages).toBe('number');
  });

  it('data array contains tier objects with required fields', async () => {
    const res = await request(app).get('/api/tiers').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    for (const tier of res.body.data) {
      const parsed = HardwareTierSchema.safeParse(tier);
      if (!parsed.success) {
        expect.fail(
          `Tier object missing required fields:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
        );
      }
    }
  });
});

describe('POST /api/tiers/preview', () => {
  it('returns Record<tierId, { tierName, count, devices[] }>', async () => {
    const tiers = fixtures.hardwareTiers.map(({ id, ...rest }) => ({
      id,
      ...rest,
    }));

    const res = await request(app)
      .post('/api/tiers/preview')
      .send({ tiers })
      .expect(200);

    const parsed = TierPreviewSchema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `Preview response shape mismatch:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
      );
    }
  });

  it('rejects missing tiers array', async () => {
    await request(app)
      .post('/api/tiers/preview')
      .send({})
      .expect(400);
  });
});

describe('POST /api/tiers/simulate', () => {
  it('returns { eligibleCount, ineligibleCount, eligible[], ineligible[] }', async () => {
    const res = await request(app)
      .post('/api/tiers/simulate')
      .send({ ramMin: 1024, requiredCodecs: ['avc'] })
      .expect(200);

    const parsed = SimulateResultSchema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `Simulate response shape mismatch:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
      );
    }

    expect(typeof res.body.eligibleCount).toBe('number');
    expect(typeof res.body.ineligibleCount).toBe('number');
    expect(Array.isArray(res.body.eligible)).toBe(true);
    expect(Array.isArray(res.body.ineligible)).toBe(true);
  });

  it('eligible + ineligible counts match total', async () => {
    const res = await request(app)
      .post('/api/tiers/simulate')
      .send({ ramMin: 0 })
      .expect(200);

    expect(res.body.eligibleCount + res.body.ineligibleCount)
      .toBe(res.body.eligible.length + res.body.ineligible.length);
  });

  it('returns canonical device document ids for matched specs', async () => {
    const res = await request(app)
      .post('/api/tiers/simulate')
      .send({ ramMin: 0 })
      .expect(200);

    expect(res.body.eligible).toContain('d1');
    expect(res.body.eligible).not.toContain('acme-4k-001');
  });
});

describe('PUT /api/tiers/:id', () => {
  it('returns the updated tier with id', async () => {
    const res = await request(app)
      .put('/api/tiers/t1')
      .send({ tierName: 'Tier 1 Updated', ramMin: 2048 })
      .expect(200);

    expect(res.body.id).toBe('t1');
    expect(res.body.tierName).toBeDefined();
  });

  it('reassigns devices even when a legacy questionnaire spec stores the model number in deviceId', async () => {
    await mockDb.collection('deviceSpecs').doc('d2').set({
      deviceId: 'claro-brazil-hd-legacy',
      hardware: {
        ramAvailableGb: 2,
        gpuMemoryAvailableMb: 512,
        cpuClockRateGhz: 1.8,
        cpuCores: '4',
        softwareArchitecture: 'arm64',
      },
      mediaCodec: {
        avcH264: 'Yes',
        hevcH265: 'Yes',
      },
      updatedAt: '2026-02-25T00:00:00.000Z',
    });

    await request(app)
      .put('/api/tiers/t1')
      .send({ tierName: 'Tier 1 Updated', ramMin: 2048 })
      .expect(200);

    const updatedDevice = await mockDb.collection('devices').doc('d2').get();
    expect(updatedDevice.data()?.tierId).toBe('t1');
  });

  it('does not rewrite canonical spec docs during tier reassignment', async () => {
    await mockDb.collection('deviceSpecs').doc('d2').set({
      deviceId: 'd2',
      hardware: {
        ramAvailableGb: 2,
        gpuMemoryAvailableMb: 512,
        cpuClockRateGhz: 1.8,
        cpuCores: '4',
        softwareArchitecture: 'arm64',
      },
      mediaCodec: {
        avcH264: 'Yes',
        hevcH265: 'Yes',
      },
      updatedAt: '2026-02-20T00:00:00.000Z',
    });

    await request(app)
      .put('/api/tiers/t1')
      .send({ tierName: 'Tier 1 Updated', ramMin: 2048 })
      .expect(200);

    const updatedSpec = await mockDb.collection('deviceSpecs').doc('d2').get();
    expect(updatedSpec.data()?.updatedAt).toBe('2026-02-20T00:00:00.000Z');
  });

  it('returns 404 for missing tier', async () => {
    await request(app)
      .put('/api/tiers/nonexistent')
      .send({ tierName: 'X' })
      .expect(404);
  });
});

describe('POST /api/tiers', () => {
  it('creates a tier and returns it with id', async () => {
    const res = await request(app)
      .post('/api/tiers')
      .send({
        tierName: 'Tier 3',
        tierRank: 3,
        ramMin: 256,
        requiredCodecs: [],
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.tierName).toBe('Tier 3');
  });

  it('rejects missing required fields', async () => {
    await request(app)
      .post('/api/tiers')
      .send({ tierName: 'No rank' })
      .expect(400);
  });
});
