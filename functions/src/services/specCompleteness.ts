import { SPEC_CATEGORIES } from '../types/index.js';
import { log } from './logger.js';

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
