import type { DeviceSpec } from '../types/index.js';
import { SPEC_CATEGORIES } from '../types/index.js';
import { log } from './logger.js';

const KEY_SPEC_FIELDS = [
  'memory.appAvailableRamMb',
  'gpu.gpuMemoryMb',
  'soc.socVendor',
  'soc.cpuCores',
  'codecs.avcSupport',
  'codecs.hevcSupport',
  'drm.widevineLevel',
  'drm.playreadyLevel',
  'videoOutput.hdr10Support',
  'videoOutput.dolbyVisionSupport',
] as const;

export function getKeySpecFields(): string[] {
  return [...KEY_SPEC_FIELDS];
}

export function calculateSpecCompleteness(spec: DeviceSpec): number {
  let filled = 0;
  let total = 0;
  const categoryBreakdown: Record<string, { filled: number; total: number }> = {};

  for (const category of SPEC_CATEGORIES) {
    const section = spec[category] as unknown as Record<string, unknown> | undefined;
    if (!section || typeof section !== 'object') continue;

    let catFilled = 0;
    let catTotal = 0;
    for (const value of Object.values(section)) {
      catTotal++;
      total++;
      if (value !== null && value !== undefined) {
        catFilled++;
        filled++;
      }
    }
    categoryBreakdown[category] = { filled: catFilled, total: catTotal };
  }

  if (total === 0) {
    log.debug('Spec completeness: no fields found', { deviceId: spec.deviceId });
    return 0;
  }

  const completeness = Math.round((filled / total) * 100);
  log.debug('Spec completeness calculated', {
    deviceId: spec.deviceId,
    completeness,
    filled,
    total,
    categoryBreakdown,
  });

  return completeness;
}
