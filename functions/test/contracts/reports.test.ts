import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll } from '../helpers/fixtures.js';
import { DashboardReportResponseSchema, SpecCoverageReportResponseSchema } from './schemas.js';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

describe('GET /api/reports/dashboard', () => {
  it('returns all required dashboard fields with correct types', async () => {
    const res = await request(app).get('/api/reports/dashboard').expect(200);
    const parsed = DashboardReportResponseSchema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `Dashboard response missing required fields:\n` +
          JSON.stringify(parsed.error.issues, null, 2),
      );
    }
  });

  it('numeric KPIs are numbers (not strings)', async () => {
    const res = await request(app).get('/api/reports/dashboard').expect(200);
    expect(typeof res.body.totalDevices).toBe('number');
    expect(typeof res.body.totalActiveDevices).toBe('number');
    expect(typeof res.body.specCoverageWeighted).toBe('number');
    expect(typeof res.body.certifiedCount).toBe('number');
    expect(typeof res.body.openAlertCount).toBe('number');
  });

  it('top20Devices items have required fields', async () => {
    const res = await request(app).get('/api/reports/dashboard').expect(200);
    for (const d of res.body.top20Devices) {
      expect(d.id).toBeDefined();
      expect(d.displayName).toBeDefined();
      expect(typeof d.activeDeviceCount).toBe('number');
    }
  });

  it('adkVersions items have version and count', async () => {
    const res = await request(app).get('/api/reports/dashboard').expect(200);
    for (const v of res.body.adkVersions) {
      expect(typeof v.version).toBe('string');
      expect(typeof v.count).toBe('number');
    }
  });

  it('regionBreakdown items use regions[] model', async () => {
    const res = await request(app).get('/api/reports/dashboard').expect(200);
    for (const r of res.body.regionBreakdown) {
      expect(typeof r.region).toBe('string');
      expect(typeof r.activeDevices).toBe('number');
      expect(typeof r.deviceCount).toBe('number');
    }
  });
});

describe('GET /api/reports/partner/:id', () => {
  it('returns partner report with device list', async () => {
    const res = await request(app).get('/api/reports/partner/p1').expect(200);
    expect(res.body.partner).toBeDefined();
    expect(typeof res.body.deviceCount).toBe('number');
    expect(typeof res.body.totalActiveDevices).toBe('number');
    expect(typeof res.body.specCoverage).toBe('number');
    expect(Array.isArray(res.body.devices)).toBe(true);
  });

  it('partner report device list numeric fields are numbers', async () => {
    const res = await request(app).get('/api/reports/partner/p1').expect(200);
    for (const d of res.body.devices) {
      expect(typeof d.activeDeviceCount).toBe('number');
      expect(typeof d.specCompleteness).toBe('number');
    }
  });

  it('returns 404 for missing partner', async () => {
    await request(app).get('/api/reports/partner/nonexistent').expect(404);
  });
});

describe('GET /api/reports/spec-coverage', () => {
  it('returns summary + devices array', async () => {
    const res = await request(app).get('/api/reports/spec-coverage').expect(200);
    const parsed = SpecCoverageReportResponseSchema.safeParse(res.body);
    if (!parsed.success) {
      expect.fail(
        `Spec coverage response shape mismatch:\n` +
          JSON.stringify(parsed.error.issues, null, 2),
      );
    }
  });

  it('summary numeric fields are numbers', async () => {
    const res = await request(app).get('/api/reports/spec-coverage').expect(200);
    const s = res.body.summary;
    expect(typeof s.totalDevices).toBe('number');
    expect(typeof s.fullSpecs).toBe('number');
    expect(typeof s.partialSpecs).toBe('number');
    expect(typeof s.noSpecs).toBe('number');
    expect(typeof s.weightedCoverage).toBe('number');
  });

  it('spec coverage row region is derived from array-based partner key model', async () => {
    const res = await request(app).get('/api/reports/spec-coverage').expect(200);
    for (const d of res.body.devices) {
      expect(typeof d.region).toBe('string');
    }
  });
});
