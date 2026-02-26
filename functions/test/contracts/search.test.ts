import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll } from '../helpers/fixtures.js';
import { SearchResultSchema } from './schemas.js';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

describe('GET /api/search', () => {
  it('returns { devices[], partners[], partnerKeys[] }', async () => {
    const res = await request(app).get('/api/search?q=acme').expect(200);
    const parsed = SearchResultSchema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `Search response shape mismatch:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
      );
    }
  });

  it('all result arrays are present (even if empty)', async () => {
    const res = await request(app).get('/api/search?q=acme').expect(200);
    expect(Array.isArray(res.body.devices)).toBe(true);
    expect(Array.isArray(res.body.partners)).toBe(true);
    expect(Array.isArray(res.body.partnerKeys)).toBe(true);
  });

  it('returns empty results for empty query', async () => {
    const res = await request(app).get('/api/search?q=').expect(200);
    expect(res.body.devices).toEqual([]);
    expect(res.body.partners).toEqual([]);
  });
});
