import admin from 'firebase-admin';
import type { DeviceSpec, HardwareTier } from '../types/index.js';

const CODEC_FIELD_MAP: Record<string, keyof DeviceSpec['codecs']> = {
  avc: 'avcSupport',
  hevc: 'hevcSupport',
  av1: 'av1Support',
  vp9: 'vp9Support',
  eac3: 'eac3Support',
  ac4: 'ac4Support',
  dolbyAtmos: 'dolbyAtmosSupport',
  aac: 'aacSupport',
  opus: 'opusSupport',
};

function deviceMeetsTier(spec: DeviceSpec, tier: HardwareTier): boolean {
  if (tier.ramMin != null && (spec.memory.appAvailableRamMb ?? 0) < tier.ramMin) return false;
  if (tier.gpuMin != null && (spec.gpu.gpuMemoryMb ?? 0) < tier.gpuMin) return false;
  if (tier.cpuSpeedMin != null && (spec.soc.cpuSpeedMhz ?? 0) < tier.cpuSpeedMin) return false;
  if (tier.cpuCoresMin != null && (spec.soc.cpuCores ?? 0) < tier.cpuCoresMin) return false;
  if (tier.require64Bit && !spec.soc.is64Bit) return false;

  for (const codec of tier.requiredCodecs) {
    const fieldName = CODEC_FIELD_MAP[codec.toLowerCase()];
    if (fieldName && !spec.codecs[fieldName]) return false;
  }

  return true;
}

export async function assignTierToDevice(deviceId: string): Promise<string | null> {
  const db = admin.firestore();
  const specSnap = await db.collection('deviceSpecs').where('deviceId', '==', deviceId).limit(1).get();
  if (specSnap.empty) return null;

  const spec = { id: specSnap.docs[0].id, ...specSnap.docs[0].data() } as DeviceSpec;
  const tiersSnap = await db.collection('hardwareTiers').orderBy('tierRank', 'asc').get();
  const tiers = tiersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as HardwareTier);

  let assignedTierId: string | null = null;
  for (const tier of tiers) {
    if (deviceMeetsTier(spec, tier)) {
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

  return assignedTierId;
}

export async function reassignAllDevices(): Promise<number> {
  const db = admin.firestore();
  const specsSnap = await db.collection('deviceSpecs').get();
  let count = 0;

  const tiersSnap = await db.collection('hardwareTiers').orderBy('tierRank', 'asc').get();
  const tiers = tiersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as HardwareTier);

  for (const specDoc of specsSnap.docs) {
    const spec = { id: specDoc.id, ...specDoc.data() } as DeviceSpec;
    let assignedTierId: string | null = null;

    for (const tier of tiers) {
      if (deviceMeetsTier(spec, tier)) {
        assignedTierId = tier.id;
        break;
      }
    }

    const now = new Date().toISOString();
    await db.collection('devices').doc(spec.deviceId).update({
      tierId: assignedTierId,
      tierAssignedAt: now,
      updatedAt: now,
    });

    if (assignedTierId) {
      await db.collection('deviceTierAssignments').add({
        deviceId: spec.deviceId,
        tierId: assignedTierId,
        assignedAt: now,
        trigger: 'tier_definition_update' as const,
      });
    }
    count++;
  }

  return count;
}

export function previewTierAssignment(
  tiers: HardwareTier[],
  specs: DeviceSpec[],
): Record<string, { tierName: string; count: number; devices: string[] }> {
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

  return { eligible, ineligible };
}
