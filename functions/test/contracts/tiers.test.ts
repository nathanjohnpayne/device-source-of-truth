import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll, fixtures } from '../helpers/fixtures.js';
import {
  paginatedResponse,
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
