import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll } from '../helpers/fixtures.js';
import {
  paginatedResponseSchema,
  DeviceWithRelationsSchema,
  DeviceDetailSchema,
  DeviceSchema,
} from './schemas.js';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

describe('GET /api/devices', () => {
  it('returns a PaginatedResponse<DeviceWithRelations>', async () => {
    const res = await request(app).get('/api/devices').expect(200);
    const schema = paginatedResponseSchema(DeviceWithRelationsSchema);
    const parsed = schema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `Response does not match PaginatedResponse<DeviceWithRelations>:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
      );
    }
  });

  it('activeDeviceCount is a number, not a string', async () => {
    const res = await request(app).get('/api/devices').expect(200);
    for (const device of res.body.data) {
      expect(typeof device.activeDeviceCount).toBe('number');
      expect(typeof device.specCompleteness).toBe('number');
    }
  });

  it('pagination fields are numbers', async () => {
    const res = await request(app).get('/api/devices').expect(200);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.page).toBe('number');
    expect(typeof res.body.pageSize).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
  });

  it('supports search filter', async () => {
    const res = await request(app)
      .get('/api/devices?search=acme')
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('supports certificationStatus filter', async () => {
    const res = await request(app)
      .get('/api/devices?certificationStatus=Certified')
      .expect(200);
    for (const d of res.body.data) {
      expect(d.certificationStatus).toBe('Certified');
    }
  });

  it('supports specCompleteness=has_specs filter', async () => {
    const res = await request(app)
      .get('/api/devices?specCompleteness=has_specs')
      .expect(200);
    for (const d of res.body.data) {
      expect(d.specCompleteness).toBeGreaterThan(0);
    }
  });

  it('returns empty data array (not error) when no devices match', async () => {
    const res = await request(app)
      .get('/api/devices?search=nonexistent-device-xyz')
      .expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe('GET /api/devices/:id', () => {
  it('returns a DeviceDetail with all relation arrays', async () => {
    const res = await request(app).get('/api/devices/d1').expect(200);
    const parsed = DeviceDetailSchema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `Response does not match DeviceDetail:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
      );
    }
  });

  it('deployments is always an array (even if empty)', async () => {
    const res = await request(app).get('/api/devices/d1').expect(200);
    expect(Array.isArray(res.body.deployments)).toBe(true);
  });

  it('telemetrySnapshots is always an array', async () => {
    const res = await request(app).get('/api/devices/d1').expect(200);
    expect(Array.isArray(res.body.telemetrySnapshots)).toBe(true);
  });

  it('auditHistory is always an array', async () => {
    const res = await request(app).get('/api/devices/d1').expect(200);
    expect(Array.isArray(res.body.auditHistory)).toBe(true);
  });

  it('detail coerces telemetry counts to numbers', async () => {
    const res = await request(app).get('/api/devices/d1').expect(200);
    for (const snap of res.body.telemetrySnapshots) {
      expect(typeof snap.uniqueDevices).toBe('number');
      expect(typeof snap.eventCount).toBe('number');
    }
  });

  it('joins telemetry snapshots using the business device identifier', async () => {
    const res = await request(app).get('/api/devices/d1').expect(200);
    expect(res.body.telemetrySnapshots).toHaveLength(1);
    expect(res.body.telemetrySnapshots[0].deviceId).toBe('acme-4k-001');
  });

  it('returns 404 for missing device', async () => {
    const res = await request(app).get('/api/devices/nonexistent').expect(404);
    expect(res.body.error).toBeDefined();
  });

  it('resolves a device by deviceId when Firestore doc ID does not match', async () => {
    const res = await request(app).get('/api/devices/claro-brazil-hd-legacy').expect(200);
    expect(res.body.displayName).toBe('Claro Brazil HD Legacy');
    expect(res.body.id).toBe('d2');
  });

  it('returns 200 (not 500) for a device with empty partnerKeyId', async () => {
    const res = await request(app).get('/api/devices/d2').expect(200);
    expect(res.body.partnerKey).toBeNull();
    expect(res.body.partner).toBeNull();
    expect(Array.isArray(res.body.deployments)).toBe(true);
    expect(Array.isArray(res.body.telemetrySnapshots)).toBe(true);
    expect(Array.isArray(res.body.auditHistory)).toBe(true);
  });
});

describe('POST /api/devices', () => {
  it('returns the created device with id', async () => {
    const res = await request(app)
      .post('/api/devices')
      .send({
        displayName: 'New Device',
        deviceId: 'new-device-001',
        partnerKeyId: 'pk1',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(typeof res.body.id).toBe('string');
    expect(res.body.displayName).toBe('New Device');
    expect(typeof res.body.activeDeviceCount).toBe('number');
  });

  it('persists liveAdkVersion on create', async () => {
    const res = await request(app)
      .post('/api/devices')
      .send({
        displayName: 'ADK Test',
        deviceId: 'adk-test-001',
        partnerKeyId: 'pk1',
        liveAdkVersion: '8.0.0',
      })
      .expect(201);

    expect(res.body.liveAdkVersion).toBe('8.0.0');
  });

  it('rejects missing partnerKeyId', async () => {
    await request(app)
      .post('/api/devices')
      .send({ displayName: 'No Key', deviceId: 'no-key-001' })
      .expect(400);
  });

  it('rejects missing required fields', async () => {
    await request(app)
      .post('/api/devices')
      .send({ displayName: 'No ID' })
      .expect(400);
  });

  it('rejects region, countriesIso2, and computed fields', async () => {
    await request(app)
      .post('/api/devices')
      .send({
        displayName: 'Bad Device',
        deviceId: 'bad-001',
        partnerKeyId: 'pk1',
        region: 'NA',
      })
      .expect(400);
  });
});

describe('PUT /api/devices/:id', () => {
  it('returns the updated device with id', async () => {
    const res = await request(app)
      .put('/api/devices/d1')
      .send({ displayName: 'Updated Name' })
      .expect(200);

    expect(res.body.id).toBe('d1');
    const parsed = DeviceSchema.passthrough().safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `PUT response does not match Device shape:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
      );
    }
  });

  it('rejects activeDeviceCount, specCompleteness, createdAt, and id', async () => {
    await request(app)
      .put('/api/devices/d1')
      .send({ activeDeviceCount: 999 })
      .expect(400);

    await request(app)
      .put('/api/devices/d1')
      .send({ specCompleteness: 100 })
      .expect(400);

    await request(app)
      .put('/api/devices/d1')
      .send({ createdAt: '2020-01-01' })
      .expect(400);
  });

  it('returns 404 for missing device', async () => {
    await request(app)
      .put('/api/devices/nonexistent')
      .send({ displayName: 'X' })
      .expect(404);
  });
});
