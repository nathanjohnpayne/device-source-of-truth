import { describe, it, expect } from 'vitest';
import { safeNumber } from '../src/services/safeNumber.js';

/**
 * Coercion contract tests: verify that Firestore string-typed numbers
 * are normalized before reaching frontend components.
 *
 * Firestore may store numeric fields as strings (e.g., from CSV import).
 * The backend must coerce these to numbers before sending to the frontend.
 */
describe('Device read model coercion', () => {
  const stringyDevice = {
    activeDeviceCount: '150000',
    specCompleteness: '75',
  };

  it('activeDeviceCount string → number', () => {
    expect(safeNumber(stringyDevice.activeDeviceCount)).toBe(150000);
    expect(typeof safeNumber(stringyDevice.activeDeviceCount)).toBe('number');
  });

  it('specCompleteness string → number', () => {
    expect(safeNumber(stringyDevice.specCompleteness)).toBe(75);
    expect(typeof safeNumber(stringyDevice.specCompleteness)).toBe('number');
  });
});

describe('Telemetry row coercion', () => {
  const stringyTelemetry = {
    uniqueDevices: '1200',
    eventCount: '45000',
  };

  it('uniqueDevices string → number', () => {
    expect(safeNumber(stringyTelemetry.uniqueDevices)).toBe(1200);
  });

  it('eventCount string → number', () => {
    expect(safeNumber(stringyTelemetry.eventCount)).toBe(45000);
  });
});

describe('Dashboard report coercion', () => {
  it('handles string device counts from Firestore', () => {
    const counts = ['614K', '1.2M', '150,000', '0', 'n/a'];
    const expected = [614000, 1200000, 150000, 0, 0];

    counts.forEach((input, i) => {
      const result = safeNumber(input);
      expect(result).toBe(expected[i]);
      expect(typeof result).toBe('number');
    });
  });
});

describe('Spec field coercion', () => {
  it('numeric spec fields stored as strings are coerced', () => {
    const specValues: Record<string, unknown> = {
      totalRamMb: '2048',
      appAvailableRamMb: '1536',
      gpuMemoryMb: '512',
      cpuCores: '4',
      cpuSpeedMhz: '1800',
    };

    for (const [field, value] of Object.entries(specValues)) {
      const result = safeNumber(value);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    }
  });

  it('null spec fields remain 0', () => {
    expect(safeNumber(null)).toBe(0);
    expect(safeNumber(undefined)).toBe(0);
  });
});
