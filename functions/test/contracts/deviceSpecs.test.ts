import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll } from '../helpers/fixtures.js';
import { DeviceSpecSchema } from './schemas.js';
import { SPEC_CATEGORIES } from '@dst/contracts';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

describe('GET /api/device-specs/:deviceId', () => {
  it('returns a DeviceSpec matching the 16-section schema', async () => {
    const res = await request(app).get('/api/device-specs/d1').expect(200);
    const parsed = DeviceSpecSchema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `DeviceSpec response missing required nested structure:\n` +
          JSON.stringify(parsed.error.issues, null, 2),
      );
    }
  });

  it('spec categories are objects (not flat fields)', async () => {
    const res = await request(app).get('/api/device-specs/d1').expect(200);
    for (const cat of SPEC_CATEGORIES) {
      expect(typeof res.body[cat]).toBe('object');
      expect(res.body[cat]).not.toBeNull();
    }
  });

  it('numeric spec fields are numbers (not strings)', async () => {
    const res = await request(app).get('/api/device-specs/d1').expect(200);
    const numericFields = [
      ['hardware', 'cpuClockRateGhz'],
      ['hardware', 'memoryTotalGb'],
      ['hardware', 'ramAvailableGb'],
      ['hardware', 'gpuMemoryAvailableMb'],
      ['hardware', 'storageTotalGb'],
    ];
    for (const [cat, field] of numericFields) {
      const val = res.body[cat]?.[field];
      if (val !== null && val !== undefined) {
        expect(typeof val).toBe('number');
      }
    }
  });

  it('returns 404 when device has no specs', async () => {
    mockDb.seed('deviceSpecs', []);
    await request(app).get('/api/device-specs/d1').expect(404);
  });
});

describe('PUT /api/device-specs/:deviceId', () => {
  it('returns the saved spec with id and specCompleteness', async () => {
    const res = await request(app)
      .put('/api/device-specs/d1')
      .send({
        general: { modelName: 'Updated Model' },
        hardware: { socVendor: 'Broadcom', socModelChipset: 'BCM7218', cpuClockRateGhz: 1.8 },
      })
      .expect(200);

    expect(res.body.id).toBeDefined();
    expect(typeof res.body.specCompleteness).toBe('number');
    expect(typeof res.body.deviceId).toBe('string');
  });

  it('accepts the 16-section request DTO', async () => {
    const payload: Record<string, Record<string, unknown>> = {};
    for (const cat of SPEC_CATEGORIES) {
      payload[cat] = {};
    }
    payload.general = { modelName: 'Test' };

    const res = await request(app)
      .put('/api/device-specs/d1')
      .send(payload)
      .expect(200);

    expect(res.body.id).toBeDefined();
  });

  it('returns 404 if device does not exist', async () => {
    await request(app)
      .put('/api/device-specs/nonexistent')
      .send({ general: {} })
      .expect(404);
  });

  it('returns 400 for unknown top-level section', async () => {
    await request(app)
      .put('/api/device-specs/d1')
      .send({ unknownSection: { foo: 'bar' } })
      .expect(400);
  });

  it('returns 400 for unknown field within a known section', async () => {
    await request(app)
      .put('/api/device-specs/d1')
      .send({ general: { modelName: 'Test', unknownField: 'bad' } })
      .expect(400);
  });
});
