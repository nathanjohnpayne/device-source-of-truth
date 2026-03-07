import admin from 'firebase-admin';
import type { DeviceSpec, HardwareTier } from '../types/index.js';
import {
  loadMergedDeviceSpecForDevice,
  loadMergedDeviceSpecsForTiering,
} from './deviceSpecStore.js';
import { log } from './logger.js';

const CODEC_FIELD_MAP: Record<string, string> = {
  avc: 'avcH264',
  hevc: 'hevcH265',
  av1: 'av1',
  eac3: 'eac3DolbyDigitalPlus',
  dolbyatmos: 'eac3Atmos',
  hdr10: 'hdr10',
  'hdr10+': 'hdr10Plus',
  dolbyvision: 'dolbyVisionSupported',
};

function getHw(spec: DeviceSpec, field: string): unknown {
  return (spec.hardware as unknown as Record<string, unknown>)?.[field];
}

function deviceMeetsTier(spec: DeviceSpec, tier: HardwareTier): boolean {
  if (tier.ramMin != null) {
    const ramGb = Number(getHw(spec, 'ramAvailableGb')) || 0;
    if (ramGb * 1024 < tier.ramMin) return false;
  }
  if (tier.gpuMin != null) {
    const gpuMb = Number(getHw(spec, 'gpuMemoryAvailableMb')) || 0;
    if (gpuMb < tier.gpuMin) return false;
  }
  if (tier.cpuSpeedMin != null) {
    const ghz = Number(getHw(spec, 'cpuClockRateGhz')) || 0;
    if (ghz * 1000 < tier.cpuSpeedMin) return false;
  }
  if (tier.cpuCoresMin != null) {
    const cores = parseInt(String(getHw(spec, 'cpuCores') ?? '0'), 10) || 0;
    if (cores < tier.cpuCoresMin) return false;
  }
  if (tier.require64Bit) {
    const arch = String(getHw(spec, 'softwareArchitecture') ?? '').toLowerCase();
    if (!arch.includes('64')) return false;
  }

  const mc = (spec.mediaCodec as unknown as Record<string, unknown>) ?? {};
  for (const codec of tier.requiredCodecs) {
    const fieldName = CODEC_FIELD_MAP[codec.toLowerCase()];
    if (fieldName && !mc[fieldName]) return false;
  }

  return true;
}

export async function assignTierToDevice(deviceId: string): Promise<string | null> {
  log.info('Assigning tier to device', { deviceId });

  const db = admin.firestore();
  const loadedSpec = await loadMergedDeviceSpecForDevice(db, deviceId);
  if (!loadedSpec) {
    log.warn('No specs found for tier assignment, skipping', { deviceId });
    return null;
  }

  const spec = { id: deviceId, ...loadedSpec.mergedSpec } as DeviceSpec;
  const tiersSnap = await db.collection('hardwareTiers').orderBy('tierRank', 'asc').get();
  const tiers = tiersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as HardwareTier);

  log.debug('Evaluating device against tiers', { deviceId, tierCount: tiers.length });

  let assignedTierId: string | null = null;
  for (const tier of tiers) {
    const meets = deviceMeetsTier(spec, tier);
    log.debug('Tier evaluation', {
      deviceId,
      tierId: tier.id,
      tierName: tier.tierName,
      tierRank: tier.tierRank,
      meets,
    });
    if (meets) {
      assignedTierId = tier.id;
      break;
    }
  }

  const now = new Date().toISOString();
  await db.collection('devices').doc(deviceId).update({
    tierId: assignedTierId,
    tierAssignedAt: now,
    updatedAt: now,
  });

  if (assignedTierId) {
    await db.collection('deviceTierAssignments').add({
      deviceId,
      tierId: assignedTierId,
      assignedAt: now,
      trigger: 'spec_update' as const,
    });
  }

  log.info('Tier assignment complete', {
    deviceId,
    assignedTierId,
    tierName: assignedTierId ? tiers.find((t) => t.id === assignedTierId)?.tierName : 'none',
  });

  return assignedTierId;
}

export async function reassignAllDevices(): Promise<number> {
  log.info('Starting full device tier reassignment');

  const db = admin.firestore();
  let count = 0;

  const tiersSnap = await db.collection('hardwareTiers').orderBy('tierRank', 'asc').get();
  const tiers = tiersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as HardwareTier);
  const specs = await loadMergedDeviceSpecsForTiering(db);

  log.info('Reassignment context', { specCount: specs.length, tierCount: tiers.length });

  const tierAssignmentCounts: Record<string, number> = { unassigned: 0 };
  for (const tier of tiers) {
    tierAssignmentCounts[tier.tierName] = 0;
  }

  for (const specEntry of specs) {
    const spec = { id: specEntry.deviceDocId, ...specEntry.mergedSpec } as DeviceSpec;
    let assignedTierId: string | null = null;

    for (const tier of tiers) {
      if (deviceMeetsTier(spec, tier)) {
        assignedTierId = tier.id;
        break;
      }
    }

    const now = new Date().toISOString();
    await db.collection('devices').doc(specEntry.deviceDocId).update({
      tierId: assignedTierId,
      tierAssignedAt: now,
      updatedAt: now,
    });

    if (assignedTierId) {
      await db.collection('deviceTierAssignments').add({
        deviceId: specEntry.deviceDocId,
        tierId: assignedTierId,
        assignedAt: now,
        trigger: 'tier_definition_update' as const,
      });
      const tierName = tiers.find((t) => t.id === assignedTierId)?.tierName ?? 'unknown';
      tierAssignmentCounts[tierName] = (tierAssignmentCounts[tierName] ?? 0) + 1;
    } else {
      tierAssignmentCounts['unassigned']++;
    }
    count++;
  }

  log.info('Full device tier reassignment complete', {
    totalDevicesProcessed: count,
    distribution: tierAssignmentCounts,
  });

  return count;
}

export function previewTierAssignment(
  tiers: HardwareTier[],
  specs: DeviceSpec[],
): Record<string, { tierName: string; count: number; devices: string[] }> {
  log.debug('Previewing tier assignment', { tierCount: tiers.length, specCount: specs.length });

  const sorted = [...tiers].sort((a, b) => a.tierRank - b.tierRank);
  const result: Record<string, { tierName: string; count: number; devices: string[] }> = {};

  for (const tier of sorted) {
    result[tier.id] = { tierName: tier.tierName, count: 0, devices: [] };
  }
  result['unassigned'] = { tierName: 'Unassigned', count: 0, devices: [] };

  for (const spec of specs) {
    let assigned = false;
    for (const tier of sorted) {
      if (deviceMeetsTier(spec, tier)) {
        result[tier.id].count++;
        result[tier.id].devices.push(spec.deviceId);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      result['unassigned'].count++;
      result['unassigned'].devices.push(spec.deviceId);
    }
  }

  log.debug('Tier preview result', {
    distribution: Object.fromEntries(Object.entries(result).map(([_k, v]) => [v.tierName, v.count])),
  });

  return result;
}

export function simulateEligibility(
  requirements: {
    ramMin?: number;
    gpuMin?: number;
    cpuSpeedMin?: number;
    cpuCoresMin?: number;
    require64Bit?: boolean;
    requiredCodecs?: string[];
  },
  specs: DeviceSpec[],
): { eligible: DeviceSpec[]; ineligible: DeviceSpec[] } {
  log.debug('Simulating eligibility', { requirements, specCount: specs.length });

  const pseudoTier: HardwareTier = {
    id: 'sim',
    tierName: 'Simulation',
    tierRank: 0,
    ramMin: requirements.ramMin ?? null,
    gpuMin: requirements.gpuMin ?? null,
    cpuSpeedMin: requirements.cpuSpeedMin ?? null,
    cpuCoresMin: requirements.cpuCoresMin ?? null,
    requiredCodecs: requirements.requiredCodecs ?? [],
    require64Bit: requirements.require64Bit ?? false,
    version: 0,
    createdAt: '',
    updatedAt: '',
  };

  const eligible: DeviceSpec[] = [];
  const ineligible: DeviceSpec[] = [];

  for (const spec of specs) {
    if (deviceMeetsTier(spec, pseudoTier)) {
      eligible.push(spec);
    } else {
      ineligible.push(spec);
    }
  }

  log.info('Eligibility simulation result', {
    eligible: eligible.length,
    ineligible: ineligible.length,
    total: specs.length,
  });

  return { eligible, ineligible };
}
