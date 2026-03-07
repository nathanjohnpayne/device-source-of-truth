import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockDb } from '../helpers/setup.js';
import { createTestApp } from '../helpers/testApp.js';
import { seedAll, fixtures } from '../helpers/fixtures.js';

const app = createTestApp();

beforeEach(() => {
  mockDb.reset();
  seedAll(mockDb);
});

describe('Dashboard ADK version normalization', () => {
  function seedVersionMappings(
    mappings: Array<{ id: string; coreVersion: string; friendlyVersion: string }>,
  ) {
    mockDb.seed(
      'coreVersionMappings',
      mappings.map((m) => ({ ...m, isActive: true, platform: 'ncp', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' })),
    );
  }

  function seedDevicesWithVersions(versions: Array<{ id: string; version: string | null; activeCount: number }>) {
    mockDb.seed(
      'devices',
      versions.map((v) => ({
        ...fixtures.devices[0],
        id: v.id,
        deviceId: v.id,
        liveAdkVersion: v.version,
        activeDeviceCount: v.activeCount,
      })),
    );
  }

  it('maps exact core version to friendly name', async () => {
    seedVersionMappings([
      { id: 'vm1', coreVersion: '7.3.1', friendlyVersion: 'ADK 7.3.1' },
    ]);
    seedDevicesWithVersions([
      { id: 'dv1', version: '7.3.1', activeCount: 100 },
    ]);

    const res = await request(app).get('/api/reports/dashboard').expect(200);

    const adk = res.body.adkVersions;
    expect(adk).toHaveLength(1);
    expect(adk[0].version).toBe('ADK 7.3.1');
    expect(adk[0].count).toBe(100);
  });

  it('strips plugin suffix and falls back to normalized mapping', async () => {
    seedVersionMappings([
      { id: 'vm1', coreVersion: '3.0.1+plugin-4.2.21', friendlyVersion: 'ADK 3.0.1' },
    ]);
    seedDevicesWithVersions([
      { id: 'dv1', version: '3.0.1+plugin-4.2.21', activeCount: 50 },
      { id: 'dv2', version: '3.0.1+plugin-5.0.0', activeCount: 30 },
    ]);

    const res = await request(app).get('/api/reports/dashboard').expect(200);
    const adk = res.body.adkVersions;

    expect(adk).toHaveLength(1);
    expect(adk[0].version).toBe('ADK 3.0.1');
    expect(adk[0].count).toBe(80);
  });

  it('exact base version mapping takes precedence over normalized fallback', async () => {
    seedVersionMappings([
      { id: 'vm1', coreVersion: '3.0.1+plugin-4.2.21', friendlyVersion: 'ADK 3.0.1 (with plugin)' },
      { id: 'vm2', coreVersion: '3.0.1', friendlyVersion: 'ADK 3.0.1 Base' },
    ]);
    seedDevicesWithVersions([
      { id: 'dv1', version: '3.0.1', activeCount: 200 },
    ]);

    const res = await request(app).get('/api/reports/dashboard').expect(200);
    const adk = res.body.adkVersions;

    const baseEntry = adk.find((v: { version: string }) => v.version === 'ADK 3.0.1 Base');
    expect(baseEntry).toBeDefined();
    expect(baseEntry.count).toBe(200);

    const pluginEntry = adk.find((v: { version: string }) => v.version === 'ADK 3.0.1 (with plugin)');
    expect(pluginEntry).toBeUndefined();
  });

  it('handles devices with no mapping (passes through raw version)', async () => {
    seedVersionMappings([]);
    seedDevicesWithVersions([
      { id: 'dv1', version: '99.0.0', activeCount: 10 },
    ]);

    const res = await request(app).get('/api/reports/dashboard').expect(200);
    const adk = res.body.adkVersions;

    expect(adk).toHaveLength(1);
    expect(adk[0].version).toBe('99.0.0');
    expect(adk[0].count).toBe(10);
  });

  it('handles null liveAdkVersion as "unknown"', async () => {
    seedVersionMappings([]);
    seedDevicesWithVersions([
      { id: 'dv1', version: null, activeCount: 5 },
    ]);

    const res = await request(app).get('/api/reports/dashboard').expect(200);
    const adk = res.body.adkVersions;

    expect(adk).toHaveLength(1);
    expect(adk[0].version).toBe('unknown');
  });

  it('multiple plugin variants of same base version consolidate correctly', async () => {
    seedVersionMappings([
      { id: 'vm1', coreVersion: '3.1.0+plugin-1.0.0', friendlyVersion: 'ADK 3.1.0' },
      { id: 'vm2', coreVersion: '3.1.0+plugin-2.0.0', friendlyVersion: 'ADK 3.1.0' },
    ]);
    seedDevicesWithVersions([
      { id: 'dv1', version: '3.1.0+plugin-1.0.0', activeCount: 100 },
      { id: 'dv2', version: '3.1.0+plugin-2.0.0', activeCount: 200 },
      { id: 'dv3', version: '3.1.0+plugin-3.0.0', activeCount: 50 },
    ]);

    const res = await request(app).get('/api/reports/dashboard').expect(200);
    const adk = res.body.adkVersions;

    const consolidated = adk.find((v: { version: string }) => v.version === 'ADK 3.1.0');
    expect(consolidated).toBeDefined();
    expect(consolidated.count).toBe(350);
  });

  it('does not overwrite exact mapping when normalized fallback has a different friendly name', async () => {
    seedVersionMappings([
      { id: 'vm1', coreVersion: '3.0.1+plugin-4.2.21', friendlyVersion: 'ADK 3.0.1 Plugin' },
      { id: 'vm2', coreVersion: '3.0.1', friendlyVersion: 'ADK 3.0.1 Standalone' },
    ]);
    seedDevicesWithVersions([
      { id: 'dv1', version: '3.0.1+plugin-4.2.21', activeCount: 100 },
      { id: 'dv2', version: '3.0.1', activeCount: 200 },
    ]);

    const res = await request(app).get('/api/reports/dashboard').expect(200);
    const adk = res.body.adkVersions;

    const plugin = adk.find((v: { version: string }) => v.version === 'ADK 3.0.1 Plugin');
    expect(plugin).toBeDefined();
    expect(plugin.count).toBe(100);

    const standalone = adk.find((v: { version: string }) => v.version === 'ADK 3.0.1 Standalone');
    expect(standalone).toBeDefined();
    expect(standalone.count).toBe(200);
  });

  it('inactive version mappings are excluded', async () => {
    mockDb.seed('coreVersionMappings', [
      { id: 'vm1', coreVersion: '7.3.1', friendlyVersion: 'Old Name', isActive: false, platform: 'ncp', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ]);
    seedDevicesWithVersions([
      { id: 'dv1', version: '7.3.1', activeCount: 100 },
    ]);

    const res = await request(app).get('/api/reports/dashboard').expect(200);
    const adk = res.body.adkVersions;

    expect(adk[0].version).toBe('7.3.1');
  });
});
