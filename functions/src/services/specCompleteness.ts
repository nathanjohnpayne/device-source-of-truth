import type { DeviceSpec } from '../types/index.js';
import { SPEC_CATEGORIES } from '../types/index.js';

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

  for (const category of SPEC_CATEGORIES) {
    const section = spec[category] as unknown as Record<string, unknown> | undefined;
    if (!section || typeof section !== 'object') continue;

    for (const value of Object.values(section)) {
      total++;
      if (value !== null && value !== undefined) {
        filled++;
      }
    }
  }

  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
}
