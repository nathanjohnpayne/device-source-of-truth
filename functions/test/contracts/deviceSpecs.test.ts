import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll } from '../helpers/fixtures.js';
import { DeviceSpecSchema } from './schemas.js';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

describe('GET /api/device-specs/:deviceId', () => {
  it('returns a DeviceSpec with nested category objects', async () => {
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
    const categories = [
      'identity', 'soc', 'os', 'memory', 'gpu', 'streaming',
      'videoOutput', 'firmware', 'codecs', 'frameRate', 'drm', 'security',
    ];
    for (const cat of categories) {
      expect(typeof res.body[cat]).toBe('object');
      expect(res.body[cat]).not.toBeNull();
    }
  });

  it('numeric spec fields are numbers (not strings)', async () => {
    const res = await request(app).get('/api/device-specs/d1').expect(200);
    const numericFields = [
      ['memory', 'totalRamMb'],
      ['memory', 'appAvailableRamMb'],
      ['gpu', 'gpuMemoryMb'],
      ['soc', 'cpuCores'],
      ['soc', 'cpuSpeedMhz'],
    ];
    for (const [cat, field] of numericFields) {
      const val = res.body[cat]?.[field];
      if (val !== null) {
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
        identity: { deviceModel: 'Updated Model', manufacturer: 'Acme', brandName: 'Acme', modelYear: 2026, deviceCategory: 'STB' },
        soc: { socVendor: 'Broadcom', socModel: 'BCM7218', cpuArchitecture: 'ARM', cpuCores: 4, cpuSpeedMhz: 1800, cpuBenchmarkDmips: 12000, is64Bit: true },
        os: {},
        memory: { totalRamMb: 2048, appAvailableRamMb: 1536, totalStorageGb: 8, appAvailableStorageMb: 4096, swapMemoryMb: 512 },
        gpu: { gpuModel: 'Mali-G52', gpuVendor: 'ARM', gpuMemoryMb: 512, openGlVersion: '3.2', openGlEsVersion: '3.2', vulkanSupport: false, gpuBenchmark: 3200 },
        streaming: {},
        videoOutput: {},
        firmware: {},
        codecs: { avcSupport: true, hevcSupport: true },
        frameRate: {},
        drm: {},
        security: {},
      })
      .expect(200);

    expect(res.body.id).toBeDefined();
    expect(typeof res.body.specCompleteness).toBe('number');
    expect(typeof res.body.deviceId).toBe('string');
  });

  it('returns 404 if device does not exist', async () => {
    await request(app)
      .put('/api/device-specs/nonexistent')
      .send({ identity: {} })
      .expect(404);
  });
});
