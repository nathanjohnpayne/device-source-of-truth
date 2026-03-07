import { beforeEach, describe, expect, it } from 'vitest';
import { seedAll } from './helpers/fixtures.js';
import { mockDb } from './helpers/setup.js';
import {
  loadMergedDeviceSpecForDevice,
  mergeDeviceSpecDocs,
  resolveDeviceDocIdForSpecDocument,
} from '../src/services/deviceSpecStore.js';

describe('deviceSpecStore', () => {
  beforeEach(() => {
    mockDb.reset();
    seedAll(mockDb);
  });

  it('merges duplicate spec docs so canonical reads preserve older fields', async () => {
    await mockDb.collection('deviceSpecs').doc('d1').set({
      deviceId: 'd1',
      hardware: {
        socVendor: 'Broadcom',
      },
      updatedAt: '2026-02-26T00:00:00.000Z',
    });

    const merged = await loadMergedDeviceSpecForDevice(mockDb, 'd1');
    expect(merged).not.toBeNull();
    expect(merged?.lookup).toBe('merged');
    expect(merged?.mergedSpec.deviceId).toBe('d1');
    expect(merged?.mergedSpec.general).toMatchObject({ modelName: 'Streamer 4K' });
    expect(merged?.mergedSpec.hardware).toMatchObject({
      socVendor: 'Broadcom',
      socModelChipset: 'BCM7218',
    });
  });

  it('resolves legacy questionnaire specs by canonical document id before business id fallback', () => {
    const deviceDocId = resolveDeviceDocIdForSpecDocument(
      'd2',
      { deviceId: 'claro-brazil-hd-legacy' },
      new Set(['d1', 'd2']),
      new Map([
        ['acme-4k-001', 'd1'],
        ['claro-brazil-hd-legacy', 'd2'],
      ]),
    );

    expect(deviceDocId).toBe('d2');
  });

  it('preserves explicit clears from the canonical doc when legacy docs still have values', () => {
    const merged = mergeDeviceSpecDocs('d1', [
      {
        id: 'legacy-spec',
        data: {
          deviceId: 'd1',
          hardware: {
            socVendor: 'Broadcom',
          },
          updatedAt: '2026-02-25T00:00:00.000Z',
        },
      },
      {
        id: 'd1',
        data: {
          deviceId: 'd1',
          hardware: {
            socVendor: null,
          },
          updatedAt: '2026-02-26T00:00:00.000Z',
        },
      },
    ]);

    expect((merged.hardware as Record<string, unknown>).socVendor).toBeNull();
  });
});
