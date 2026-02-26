import type {
  DeviceDetail,
  DeviceWithRelations,
  PartnerWithStats,
  HardwareTier,
  Alert,
  UploadHistory,
  AuditLogEntry,
  DeviceSpec,
  PaginatedResponse,
} from '../../lib/types';

const NOW = '2026-02-25T00:00:00.000Z';

export const emptyPaginated = <T>(): PaginatedResponse<T> => ({
  data: [],
  total: 0,
  page: 1,
  pageSize: 50,
  totalPages: 0,
});

export const minimalDevice: DeviceWithRelations = {
  id: 'd1',
  displayName: 'Test Device',
  deviceId: 'test-001',
  partnerKeyId: 'pk1',
  deviceType: 'STB',
  status: 'active',
  liveAdkVersion: null,
  certificationStatus: 'Not Submitted',
  certificationNotes: null,
  lastCertifiedDate: null,
  questionnaireUrl: null,
  questionnaireFileUrl: null,
  activeDeviceCount: 0,
  specCompleteness: 0,
  tierId: null,
  tierAssignedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

export const minimalDeviceDetail: DeviceDetail = {
  ...minimalDevice,
  partner: null,
  partnerKey: null,
  spec: null,
  tier: null,
  deployments: [],
  telemetrySnapshots: [],
  auditHistory: [],
};

export const minimalPartner: PartnerWithStats = {
  id: 'p1',
  displayName: 'Test Partner',
  regions: [],
  countriesIso2: [],
  createdAt: NOW,
  updatedAt: NOW,
  partnerKeyCount: 0,
  deviceCount: 0,
  activeDeviceCount: 0,
};

export const minimalTier: HardwareTier = {
  id: 't1',
  tierName: 'Tier 1',
  tierRank: 1,
  ramMin: null,
  gpuMin: null,
  cpuSpeedMin: null,
  cpuCoresMin: null,
  requiredCodecs: [],
  require64Bit: false,
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

export const minimalAlert: Alert = {
  id: 'a1',
  type: 'unregistered_device',
  partnerKey: 'test-key',
  deviceId: 'unknown-001',
  firstSeen: NOW,
  lastSeen: NOW,
  uniqueDeviceCount: 0,
  status: 'open',
  dismissedBy: null,
  dismissReason: null,
  dismissedAt: null,
  consecutiveMisses: 0,
};

export const minimalUploadHistory: UploadHistory = {
  id: 'uh1',
  uploadedBy: 'test-uid',
  uploadedByEmail: 'test@disney.com',
  uploadedAt: NOW,
  fileName: 'test.csv',
  rowCount: 0,
  successCount: 0,
  errorCount: 0,
  snapshotDate: NOW,
  errors: [],
};

export const minimalDashboard = {
  totalActiveDevices: 0,
  totalDevices: 0,
  specCoverageWeighted: 0,
  certifiedCount: 0,
  pendingCount: 0,
  uncertifiedCount: 0,
  openAlertCount: 0,
  top20Devices: [],
  adkVersions: [],
  regionBreakdown: [],
};

export const minimalSpec: DeviceSpec = {
  id: 'ds1',
  deviceId: 'd1',
  identity: { deviceModel: null, manufacturer: null, brandName: null, modelYear: null, deviceCategory: null },
  soc: { socVendor: null, socModel: null, cpuArchitecture: null, cpuCores: null, cpuSpeedMhz: null, cpuBenchmarkDmips: null, is64Bit: null },
  os: { osName: null, osVersion: null, browserEngine: null, browserVersion: null, jsEngineVersion: null },
  memory: { totalRamMb: null, appAvailableRamMb: null, totalStorageGb: null, appAvailableStorageMb: null, swapMemoryMb: null },
  gpu: { gpuModel: null, gpuVendor: null, gpuMemoryMb: null, openGlVersion: null, openGlEsVersion: null, vulkanSupport: null, gpuBenchmark: null },
  streaming: { adkVersion: null, adkBuildType: null, htmlVersion: null, cssVersion: null, playerType: null, mseSupport: null, emeSupport: null },
  videoOutput: { maxResolution: null, hdmiVersion: null, hdcpVersion: null, hdrSupport: null, hdr10Support: null, hdr10PlusSupport: null, hlgSupport: null, dolbyVisionSupport: null, dolbyVisionProfiles: null, displayRefreshRate: null },
  firmware: { firmwareVersion: null, firmwareUpdateMethod: null, lastFirmwareDate: null, nextPlannedFirmwareDate: null, firmwareAutoUpdate: null, eolDate: null },
  codecs: { avcSupport: null, avcMaxProfile: null, avcMaxLevel: null, hevcSupport: null, hevcMaxProfile: null, hevcMaxLevel: null, av1Support: null, vp9Support: null, eac3Support: null, ac4Support: null, dolbyAtmosSupport: null, aacSupport: null, opusSupport: null },
  frameRate: { maxFrameRate: null, supports24fps: null, supports30fps: null, supports60fps: null, supportsAdaptiveFps: null, trickPlaySupport: null },
  drm: { widevineLevel: null, widevineVersion: null, playreadyLevel: null, playreadyVersion: null, fairplaySupport: null, hdcpSupport: null, hdcp2xSupport: null, secureMediaPipeline: null, attestationType: null },
  security: { secureBootSupport: null, teeType: null, teeVersion: null, hardwareRootOfTrust: null, secureStorageSupport: null, tamperDetection: null },
  updatedAt: NOW,
};
