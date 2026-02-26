import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll } from '../helpers/fixtures.js';
import { paginatedResponse, PartnerKeyWithDisplaySchema } from './schemas.js';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

describe('GET /api/partner-keys', () => {
  it('response has data array', async () => {
    const res = await request(app).get('/api/partner-keys').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('response has total field (required by PaginatedResponse contract)', async () => {
    const res = await request(app).get('/api/partner-keys').expect(200);
    expect(res.body).toHaveProperty('total');
    expect(typeof res.body.total).toBe('number');
  });

  it('response has page/pageSize/totalPages fields', async () => {
    const res = await request(app).get('/api/partner-keys').expect(200);
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('pageSize');
    expect(res.body).toHaveProperty('totalPages');
  });

  it('each key has partnerDisplayName field', async () => {
    const res = await request(app).get('/api/partner-keys').expect(200);
    for (const key of res.body.data) {
      expect('partnerDisplayName' in key).toBe(true);
    }
  });
});
