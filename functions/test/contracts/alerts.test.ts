import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll } from '../helpers/fixtures.js';
import { paginatedResponseSchema, AlertSchema } from './schemas.js';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

describe('GET /api/alerts', () => {
  it('returns PaginatedResponse<Alert>', async () => {
    const res = await request(app).get('/api/alerts').expect(200);
    const schema = paginatedResponseSchema(AlertSchema);
    const parsed = schema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `Alerts list does not match PaginatedResponse<Alert>:\n` +
          JSON.stringify(parsed.error.issues, null, 2),
      );
    }
  });

  it('uniqueDeviceCount is a number', async () => {
    const res = await request(app).get('/api/alerts').expect(200);
    for (const alert of res.body.data) {
      expect(typeof alert.uniqueDeviceCount).toBe('number');
    }
  });

  it('supports status filter', async () => {
    const res = await request(app)
      .get('/api/alerts?status=open')
      .expect(200);
    for (const a of res.body.data) {
      expect(a.status).toBe('open');
    }
  });
});

describe('PUT /api/alerts/:id/dismiss', () => {
  it('returns the dismissed alert with updated fields', async () => {
    const res = await request(app)
      .put('/api/alerts/a1/dismiss')
      .send({ dismissReason: 'Test Device' })
      .expect(200);

    const parsed = AlertSchema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `Dismiss response does not match Alert schema:\n` +
          JSON.stringify(parsed.error.issues, null, 2),
      );
    }
    expect(res.body.status).toBe('dismissed');
    expect(res.body.dismissReason).toBe('Test Device');
    expect(res.body.dismissedAt).toBeDefined();
    expect(res.body.dismissedBy).toBeDefined();
  });

  it('returns 404 for missing alert', async () => {
    await request(app)
      .put('/api/alerts/nonexistent/dismiss')
      .send({ dismissReason: 'Test' })
      .expect(404);
  });
});
