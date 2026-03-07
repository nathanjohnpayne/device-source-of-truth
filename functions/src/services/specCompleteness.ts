import { SPEC_CATEGORIES } from '../types/index.js';
import { log } from './logger.js';

/**
 * Detects and repairs flat dotted keys (e.g. `"hardware.socVendor"`) that should
 * be nested objects (`{ hardware: { socVendor } }`). This can happen when
 * `batch.set()` is used with dot-notation keys — `set()` treats them as literal
 * field names while `update()` treats them as field paths.
 */
export function repairFlatDottedSpec(
  spec: Record<string, unknown>,
): { repaired: Record<string, unknown>; hadRepairs: boolean } {
  const cleanSpec: Record<string, unknown> = {};
  let hadRepairs = false;

  for (const [key, value] of Object.entries(spec)) {
    if (!key.includes('.')) {
      cleanSpec[key] = value;
    }
  }

  for (const [key, value] of Object.entries(spec)) {
    if (key.includes('.')) {
      hadRepairs = true;
      const [section, fieldKey] = key.split('.');
      if (section && fieldKey) {
        if (!cleanSpec[section] || typeof cleanSpec[section] !== 'object') {
          cleanSpec[section] = {};
        }
        (cleanSpec[section] as Record<string, unknown>)[fieldKey] = value;
      }
    }
  }

  return { repaired: cleanSpec, hadRepairs };
}

const KEY_SPEC_FIELDS = [
  'hardware.socVendor',
  'hardware.cpuCores',
  'hardware.memoryTotalGb',
  'hardware.gpuMemoryAvailableMb',
  'mediaCodec.avcH264',
  'mediaCodec.hevcH265',
  'contentProtection.playreadySecurityLevel',
  'contentProtection.widevineSecurityLevel',
  'contentProtection.drmSystem',
  'appRuntime.webEngine',
] as const;

export function getKeySpecFields(): string[] {
  return [...KEY_SPEC_FIELDS];
}

export function calculateSpecCompleteness(spec: Record<string, unknown>): number {
  let filled = 0;
  let total = 0;
  const categoryBreakdown: Record<string, { filled: number; total: number }> = {};

  for (const category of SPEC_CATEGORIES) {
    const section = spec[category] as Record<string, unknown> | undefined;
    if (!section || typeof section !== 'object') continue;

    let catFilled = 0;
    let catTotal = 0;
    for (const [, value] of Object.entries(section)) {
      catTotal++;
      total++;
      if (value !== null && value !== undefined && value !== '') {
        catFilled++;
        filled++;
      }
    }
    categoryBreakdown[category] = { filled: catFilled, total: catTotal };
  }

  if (total === 0) {
    const deviceId = spec.deviceId as string | undefined;
    log.debug('Spec completeness: no fields found', { deviceId });
    return 0;
  }

  const completeness = Math.round((filled / total) * 100);
  log.debug('Spec completeness calculated', {
    deviceId: spec.deviceId as string | undefined,
    completeness,
    filled,
    total,
    categoryBreakdown,
  });

  return completeness;
}
