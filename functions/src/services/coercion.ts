import { safeNumber } from './safeNumber.js';

/**
 * Coerce a value to a number, returning 0 for invalid input.
 * Alias for safeNumber, used for counts and percentages.
 */
export const coerceNumberOrZero = safeNumber;

/**
 * Coerce a value to a number, returning null for invalid input.
 */
export function coerceNumberOrNull(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const s = String(val).replace(/,/g, '').trim();
  if (!s || s.toLowerCase() === 'n/a') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Normalize numeric fields on a device document before returning from API.
 */
export function coerceDeviceDoc<T extends Record<string, unknown>>(doc: T): T {
  return {
    ...doc,
    activeDeviceCount: coerceNumberOrZero(doc.activeDeviceCount),
    specCompleteness: coerceNumberOrZero(doc.specCompleteness),
  };
}

/**
 * Normalize numeric fields on a telemetry snapshot before returning from API.
 */
export function coerceTelemetrySnapshotDoc<T extends Record<string, unknown>>(doc: T): T {
  return {
    ...doc,
    uniqueDevices: coerceNumberOrZero(doc.uniqueDevices),
    eventCount: coerceNumberOrZero(doc.eventCount),
  };
}

const NUMERIC_SPEC_FIELDS: Record<string, Set<string>> = {
  hardware: new Set([
    'cpuClockRateGhz', 'memoryTotalGb', 'ramAvailableGb',
    'linuxMemoryAvailableMb', 'gpuMemoryAvailableMb', 'gpuTextureMemoryMb',
    'gpuMemoryReservedMb', 'storageTotalGb', 'storageAvailableMb',
    'nonPersistentStorageMb', 'maxAppBinarySizeMb', 'maxStreamingThroughputMbps',
  ]),
  contentProtection: new Set(['multiKeyCtrMax']),
  uhdHdr: new Set(['uhdSubscriberPercent']),
};

/**
 * Normalize numeric leaf fields inside a device spec document.
 * Only touches fields known to be numeric per the schema.
 */
export function coerceDeviceSpecDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const result = { ...doc };
  for (const [section, fields] of Object.entries(NUMERIC_SPEC_FIELDS)) {
    const sectionData = result[section];
    if (sectionData && typeof sectionData === 'object' && !Array.isArray(sectionData)) {
      const coerced = { ...sectionData as Record<string, unknown> };
      for (const field of fields) {
        if (field in coerced) {
          coerced[field] = coerceNumberOrNull(coerced[field]);
        }
      }
      result[section] = coerced;
    }
  }
  return result;
}
