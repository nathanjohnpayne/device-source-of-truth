import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll } from '../helpers/fixtures.js';
import { paginatedResponseSchema, PartnerWithStatsSchema, PartnerSchema } from './schemas.js';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

describe('GET /api/partners', () => {
  it('returns PaginatedResponse<PartnerWithStats>', async () => {
    const res = await request(app).get('/api/partners').expect(200);
    const schema = paginatedResponseSchema(PartnerWithStatsSchema);
    const parsed = schema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `Partners list does not match PaginatedResponse<PartnerWithStats>:\n` +
          JSON.stringify(parsed.error.issues, null, 2),
      );
    }
  });

  it('stat fields are numbers', async () => {
    const res = await request(app).get('/api/partners').expect(200);
    for (const p of res.body.data) {
      expect(typeof p.partnerKeyCount).toBe('number');
      expect(typeof p.deviceCount).toBe('number');
      expect(typeof p.activeDeviceCount).toBe('number');
    }
  });
});

describe('GET /api/partners/:id', () => {
  it('returns partner object with id', async () => {
    const res = await request(app).get('/api/partners/p1').expect(200);
    expect(res.body.id).toBe('p1');
    expect(res.body.displayName).toBeDefined();
  });

  it('returns 404 for missing partner', async () => {
    await request(app).get('/api/partners/nonexistent').expect(404);
  });
});

describe('POST /api/partners', () => {
  it('creates and returns partner with id', async () => {
    const res = await request(app)
      .post('/api/partners')
      .send({ displayName: 'New Partner', regions: ['APAC'] })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.displayName).toBe('New Partner');
  });

  it('rejects missing displayName', async () => {
    await request(app)
      .post('/api/partners')
      .send({ regions: ['NA'] })
      .expect(400);
  });
});

describe('PUT /api/partners/:id', () => {
  it('returns the updated partner', async () => {
    const res = await request(app)
      .put('/api/partners/p1')
      .send({ displayName: 'Acme Updated' })
      .expect(200);

    expect(res.body.id).toBe('p1');
    const parsed = PartnerSchema.passthrough().safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `PUT response does not match Partner shape:\n` +
          JSON.stringify(parsed.error.issues, null, 2),
      );
    }
  });
});
