/**
 * Zod schemas defining the API response contracts expected by the frontend.
 * Derived from src/lib/types.ts and src/lib/api.ts.
 */
import { z } from 'zod';

const timestamp = z.string();

export function paginatedResponse<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  });
}

export const PartnerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  regions: z.array(z.string()),
  countriesIso2: z.array(z.string()),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const PartnerWithStatsSchema = PartnerSchema.extend({
  partnerKeyCount: z.number(),
  deviceCount: z.number(),
  activeDeviceCount: z.number(),
});

export const PartnerKeySchema = z.object({
  id: z.string(),
  key: z.string(),
  partnerId: z.string(),
  chipset: z.string().nullable(),
  oem: z.string().nullable(),
  region: z.string().nullable(),
  countries: z.array(z.string()),
});

export const DeviceSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  deviceId: z.string(),
  partnerKeyId: z.string(),
  deviceType: z.string(),
  status: z.string(),
  liveAdkVersion: z.string().nullable(),
  certificationStatus: z.string(),
  certificationNotes: z.string().nullable(),
  lastCertifiedDate: timestamp.nullable(),
  questionnaireUrl: z.string().nullable(),
  questionnaireFileUrl: z.string().nullable(),
  activeDeviceCount: z.number(),
  specCompleteness: z.number(),
  tierId: z.string().nullable(),
  tierAssignedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const DeviceWithRelationsSchema = DeviceSchema.extend({
  partnerName: z.string().optional(),
  partnerKeyName: z.string().optional(),
  tierName: z.string().optional(),
});

const SpecIdentitySchema = z.object({
  deviceModel: z.string().nullable(),
  manufacturer: z.string().nullable(),
  brandName: z.string().nullable(),
  modelYear: z.number().nullable(),
  deviceCategory: z.string().nullable(),
});

const SpecSocSchema = z.object({
  socVendor: z.string().nullable(),
  socModel: z.string().nullable(),
  cpuArchitecture: z.string().nullable(),
  cpuCores: z.number().nullable(),
  cpuSpeedMhz: z.number().nullable(),
  cpuBenchmarkDmips: z.number().nullable(),
  is64Bit: z.boolean().nullable(),
});

const SpecOsSchema = z.object({
  osName: z.string().nullable(),
  osVersion: z.string().nullable(),
  browserEngine: z.string().nullable(),
  browserVersion: z.string().nullable(),
  jsEngineVersion: z.string().nullable(),
});

const SpecMemorySchema = z.object({
  totalRamMb: z.number().nullable(),
  appAvailableRamMb: z.number().nullable(),
  totalStorageGb: z.number().nullable(),
  appAvailableStorageMb: z.number().nullable(),
  swapMemoryMb: z.number().nullable(),
});

const SpecGpuSchema = z.object({
  gpuModel: z.string().nullable(),
  gpuVendor: z.string().nullable(),
  gpuMemoryMb: z.number().nullable(),
  openGlVersion: z.string().nullable(),
  openGlEsVersion: z.string().nullable(),
  vulkanSupport: z.boolean().nullable(),
  gpuBenchmark: z.number().nullable(),
});

const SpecStreamingSchema = z.object({
  adkVersion: z.string().nullable(),
  adkBuildType: z.string().nullable(),
  htmlVersion: z.string().nullable(),
  cssVersion: z.string().nullable(),
  playerType: z.string().nullable(),
  mseSupport: z.boolean().nullable(),
  emeSupport: z.boolean().nullable(),
});

const SpecVideoOutputSchema = z.object({
  maxResolution: z.string().nullable(),
  hdmiVersion: z.string().nullable(),
  hdcpVersion: z.string().nullable(),
  hdrSupport: z.boolean().nullable(),
  hdr10Support: z.boolean().nullable(),
  hdr10PlusSupport: z.boolean().nullable(),
  hlgSupport: z.boolean().nullable(),
  dolbyVisionSupport: z.boolean().nullable(),
  dolbyVisionProfiles: z.string().nullable(),
  displayRefreshRate: z.number().nullable(),
});

const SpecFirmwareSchema = z.object({
  firmwareVersion: z.string().nullable(),
  firmwareUpdateMethod: z.string().nullable(),
  lastFirmwareDate: timestamp.nullable(),
  nextPlannedFirmwareDate: timestamp.nullable(),
  firmwareAutoUpdate: z.boolean().nullable(),
  eolDate: timestamp.nullable(),
});

const SpecCodecsSchema = z.object({
  avcSupport: z.boolean().nullable(),
  avcMaxProfile: z.string().nullable(),
  avcMaxLevel: z.string().nullable(),
  hevcSupport: z.boolean().nullable(),
  hevcMaxProfile: z.string().nullable(),
  hevcMaxLevel: z.string().nullable(),
  av1Support: z.boolean().nullable(),
  vp9Support: z.boolean().nullable(),
  eac3Support: z.boolean().nullable(),
  ac4Support: z.boolean().nullable(),
  dolbyAtmosSupport: z.boolean().nullable(),
  aacSupport: z.boolean().nullable(),
  opusSupport: z.boolean().nullable(),
});

const SpecFrameRateSchema = z.object({
  maxFrameRate: z.number().nullable(),
  supports24fps: z.boolean().nullable(),
  supports30fps: z.boolean().nullable(),
  supports60fps: z.boolean().nullable(),
  supportsAdaptiveFps: z.boolean().nullable(),
  trickPlaySupport: z.boolean().nullable(),
});

const SpecDrmSchema = z.object({
  widevineLevel: z.string().nullable(),
  widevineVersion: z.string().nullable(),
  playreadyLevel: z.string().nullable(),
  playreadyVersion: z.string().nullable(),
  fairplaySupport: z.boolean().nullable(),
  hdcpSupport: z.boolean().nullable(),
  hdcp2xSupport: z.boolean().nullable(),
  secureMediaPipeline: z.boolean().nullable(),
  attestationType: z.string().nullable(),
});

const SpecSecuritySchema = z.object({
  secureBootSupport: z.boolean().nullable(),
  teeType: z.string().nullable(),
  teeVersion: z.string().nullable(),
  hardwareRootOfTrust: z.boolean().nullable(),
  secureStorageSupport: z.boolean().nullable(),
  tamperDetection: z.boolean().nullable(),
});

export const DeviceSpecSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  identity: SpecIdentitySchema,
  soc: SpecSocSchema,
  os: SpecOsSchema,
  memory: SpecMemorySchema,
  gpu: SpecGpuSchema,
  streaming: SpecStreamingSchema,
  videoOutput: SpecVideoOutputSchema,
  firmware: SpecFirmwareSchema,
  codecs: SpecCodecsSchema,
  frameRate: SpecFrameRateSchema,
  drm: SpecDrmSchema,
  security: SpecSecuritySchema,
  updatedAt: timestamp,
});

export const PartnerKeyWithDisplaySchema = PartnerKeySchema.extend({
  partnerDisplayName: z.string().nullable(),
});

export const HardwareTierSchema = z.object({
  id: z.string(),
  tierName: z.string(),
  tierRank: z.number(),
  ramMin: z.number().nullable(),
  gpuMin: z.number().nullable(),
  cpuSpeedMin: z.number().nullable(),
  cpuCoresMin: z.number().nullable(),
  requiredCodecs: z.array(z.string()),
  require64Bit: z.boolean(),
  version: z.number(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const AlertSchema = z.object({
  id: z.string(),
  type: z.string(),
  partnerKey: z.string(),
  deviceId: z.string().nullable(),
  firstSeen: timestamp,
  lastSeen: timestamp,
  uniqueDeviceCount: z.number(),
  status: z.string(),
  dismissedBy: z.string().nullable(),
  dismissReason: z.string().nullable(),
  dismissedAt: timestamp.nullable(),
  consecutiveMisses: z.number(),
});

export const AuditLogEntrySchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  field: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  userId: z.string(),
  userEmail: z.string(),
  timestamp: timestamp,
});

export const TelemetrySnapshotSchema = z.object({
  id: z.string(),
  partnerKey: z.string(),
  deviceId: z.string(),
  coreVersion: z.string(),
  uniqueDevices: z.number(),
  eventCount: z.number(),
  snapshotDate: timestamp,
});

export const UploadHistorySchema = z.object({
  id: z.string(),
  uploadedBy: z.string(),
  uploadedByEmail: z.string(),
  uploadedAt: timestamp,
  fileName: z.string(),
  rowCount: z.number(),
  successCount: z.number(),
  errorCount: z.number(),
  snapshotDate: timestamp,
  errors: z.array(z.string()),
});

export const DeploymentSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  partnerKeyId: z.string(),
  countryIso2: z.string(),
  deploymentStatus: z.string(),
  deployedAdkVersion: z.string().nullable(),
});

export const DeviceDetailSchema = DeviceSchema.extend({
  partner: PartnerSchema.nullable(),
  partnerKey: PartnerKeySchema.nullable(),
  spec: DeviceSpecSchema.nullable(),
  tier: HardwareTierSchema.nullable(),
  deployments: z.array(DeploymentSchema),
  telemetrySnapshots: z.array(TelemetrySnapshotSchema),
  auditHistory: z.array(AuditLogEntrySchema),
});

export const TierPreviewSchema = z.record(
  z.string(),
  z.object({
    tierName: z.string(),
    count: z.number(),
    devices: z.array(z.string()),
  }),
);

export const SimulateResultSchema = z.object({
  eligibleCount: z.number(),
  ineligibleCount: z.number(),
  eligible: z.array(z.string()),
  ineligible: z.array(z.string()),
});

export const SearchResultSchema = z.object({
  devices: z.array(z.object({ id: z.string() }).passthrough()),
  partners: z.array(z.object({ id: z.string() }).passthrough()),
  partnerKeys: z.array(z.object({ id: z.string() }).passthrough()),
});

export const DashboardSchema = z.object({
  totalDevices: z.number(),
  totalActiveDevices: z.number(),
  specCoverageWeighted: z.number(),
  certifiedCount: z.number(),
  pendingCount: z.number(),
  uncertifiedCount: z.number(),
  openAlertCount: z.number(),
  top20Devices: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      partnerName: z.string(),
      activeDeviceCount: z.number(),
      tierName: z.string().nullable(),
    }),
  ),
  adkVersions: z.array(
    z.object({ version: z.string(), count: z.number() }),
  ),
  regionBreakdown: z.array(
    z.object({
      region: z.string(),
      activeDevices: z.number(),
      deviceCount: z.number(),
    }),
  ),
});

export const SpecCoverageSchema = z.object({
  summary: z.object({
    totalDevices: z.number(),
    fullSpecs: z.number(),
    partialSpecs: z.number(),
    noSpecs: z.number(),
    weightedCoverage: z.number(),
  }),
  devices: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      partnerName: z.string(),
      activeDeviceCount: z.number(),
      specCompleteness: z.number(),
      questionnaireStatus: z.string(),
      region: z.string(),
    }),
  ),
});

export const ErrorSchema = z.object({
  error: z.string(),
  detail: z.unknown().optional(),
});
