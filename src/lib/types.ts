// ── Enums & Literals ──

export type UserRole = 'viewer' | 'editor' | 'admin';

export type CertificationStatus =
  | 'Certified'
  | 'Pending'
  | 'In Review'
  | 'Not Submitted'
  | 'Deprecated';

export type DeviceType = 'STB' | 'Smart TV' | 'Stick' | 'Console' | 'OTT Box' | 'Other';

export type DeviceStatus = 'active' | 'deprecated' | 'device_id_missing';

export type DeploymentStatus = 'Active' | 'Deprecated';

export type SocVendor = 'Broadcom' | 'Novatek' | 'MediaTek' | 'Amlogic' | 'Realtek' | 'Other';

export type AlertType = 'unregistered_device' | 'new_partner_key' | 'inactive_key';

export type AlertStatus = 'open' | 'dismissed';

export type AlertDismissReason = 'Test Device' | 'Duplicate Key' | 'Will Register' | 'Internal / Deprecated';

export type TierAssignmentTrigger = 'spec_update' | 'tier_definition_update' | 'manual';

export type Region = 'NA' | 'EMEA' | 'LATAM' | 'APAC';

export type AuditEntityType =
  | 'partner'
  | 'partnerKey'
  | 'device'
  | 'deviceSpec'
  | 'deployment'
  | 'hardwareTier'
  | 'alert'
  | 'user';

// ── Firestore Timestamp (serialized as ISO string in API responses) ──

export type Timestamp = string;

// ── Users ──

export interface User {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  photoUrl: string | null;
  lastLogin: Timestamp;
}

// ── Partners ──

export interface Partner {
  id: string;
  displayName: string;
  regions: Region[];
  countriesIso2: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Partner Keys ──

export interface PartnerKey {
  id: string;
  key: string;
  partnerId: string;
  chipset: string | null;
  oem: string | null;
  region: Region | null;
  countries: string[];
}

// ── Devices ──

export interface Device {
  id: string;
  displayName: string;
  deviceId: string;
  partnerKeyId: string;
  deviceType: DeviceType;
  status: DeviceStatus;
  liveAdkVersion: string | null;
  certificationStatus: CertificationStatus;
  certificationNotes: string | null;
  lastCertifiedDate: Timestamp | null;
  questionnaireUrl: string | null;
  questionnaireFileUrl: string | null;
  activeDeviceCount: number;
  specCompleteness: number;
  tierId: string | null;
  tierAssignedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Device Specs (90 fields across 12 categories) ──

export interface DeviceSpecIdentity {
  deviceModel: string | null;
  manufacturer: string | null;
  brandName: string | null;
  modelYear: number | null;
  deviceCategory: string | null;
}

export interface DeviceSpecSoc {
  socVendor: SocVendor | null;
  socModel: string | null;
  cpuArchitecture: string | null;
  cpuCores: number | null;
  cpuSpeedMhz: number | null;
  cpuBenchmarkDmips: number | null;
  is64Bit: boolean | null;
}

export interface DeviceSpecOs {
  osName: string | null;
  osVersion: string | null;
  browserEngine: string | null;
  browserVersion: string | null;
  jsEngineVersion: string | null;
}

export interface DeviceSpecMemory {
  totalRamMb: number | null;
  appAvailableRamMb: number | null;
  totalStorageGb: number | null;
  appAvailableStorageMb: number | null;
  swapMemoryMb: number | null;
}

export interface DeviceSpecGpu {
  gpuModel: string | null;
  gpuVendor: string | null;
  gpuMemoryMb: number | null;
  openGlVersion: string | null;
  openGlEsVersion: string | null;
  vulkanSupport: boolean | null;
  gpuBenchmark: number | null;
}

export interface DeviceSpecStreaming {
  adkVersion: string | null;
  adkBuildType: string | null;
  htmlVersion: string | null;
  cssVersion: string | null;
  playerType: string | null;
  mseSupport: boolean | null;
  emeSupport: boolean | null;
}

export interface DeviceSpecVideoOutput {
  maxResolution: string | null;
  hdmiVersion: string | null;
  hdcpVersion: string | null;
  hdrSupport: boolean | null;
  hdr10Support: boolean | null;
  hdr10PlusSupport: boolean | null;
  hlgSupport: boolean | null;
  dolbyVisionSupport: boolean | null;
  dolbyVisionProfiles: string | null;
  displayRefreshRate: number | null;
}

export interface DeviceSpecFirmware {
  firmwareVersion: string | null;
  firmwareUpdateMethod: string | null;
  lastFirmwareDate: Timestamp | null;
  nextPlannedFirmwareDate: Timestamp | null;
  firmwareAutoUpdate: boolean | null;
  eolDate: Timestamp | null;
}

export interface DeviceSpecCodecs {
  avcSupport: boolean | null;
  avcMaxProfile: string | null;
  avcMaxLevel: string | null;
  hevcSupport: boolean | null;
  hevcMaxProfile: string | null;
  hevcMaxLevel: string | null;
  av1Support: boolean | null;
  vp9Support: boolean | null;
  eac3Support: boolean | null;
  ac4Support: boolean | null;
  dolbyAtmosSupport: boolean | null;
  aacSupport: boolean | null;
  opusSupport: boolean | null;
}

export interface DeviceSpecFrameRate {
  maxFrameRate: number | null;
  supports24fps: boolean | null;
  supports30fps: boolean | null;
  supports60fps: boolean | null;
  supportsAdaptiveFps: boolean | null;
  trickPlaySupport: boolean | null;
}

export interface DeviceSpecDrm {
  widevineLevel: string | null;
  widevineVersion: string | null;
  playreadyLevel: string | null;
  playreadyVersion: string | null;
  fairplaySupport: boolean | null;
  hdcpSupport: boolean | null;
  hdcp2xSupport: boolean | null;
  secureMediaPipeline: boolean | null;
  attestationType: string | null;
}

export interface DeviceSpecSecurity {
  secureBootSupport: boolean | null;
  teeType: string | null;
  teeVersion: string | null;
  hardwareRootOfTrust: boolean | null;
  secureStorageSupport: boolean | null;
  tamperDetection: boolean | null;
}

export interface DeviceSpec {
  id: string;
  deviceId: string;
  identity: DeviceSpecIdentity;
  soc: DeviceSpecSoc;
  os: DeviceSpecOs;
  memory: DeviceSpecMemory;
  gpu: DeviceSpecGpu;
  streaming: DeviceSpecStreaming;
  videoOutput: DeviceSpecVideoOutput;
  firmware: DeviceSpecFirmware;
  codecs: DeviceSpecCodecs;
  frameRate: DeviceSpecFrameRate;
  drm: DeviceSpecDrm;
  security: DeviceSpecSecurity;
  updatedAt: Timestamp;
}

export const SPEC_CATEGORIES = [
  'identity',
  'soc',
  'os',
  'memory',
  'gpu',
  'streaming',
  'videoOutput',
  'firmware',
  'codecs',
  'frameRate',
  'drm',
  'security',
] as const;

export type SpecCategory = (typeof SPEC_CATEGORIES)[number];

export const SPEC_CATEGORY_LABELS: Record<SpecCategory, string> = {
  identity: 'Device Identity',
  soc: 'SoC & Hardware',
  os: 'OS & Middleware',
  memory: 'Memory & Storage',
  gpu: 'GPU & Graphics',
  streaming: 'Streaming & Platform',
  videoOutput: 'Video Output & Display',
  firmware: 'Firmware & Update Lifecycle',
  codecs: 'Media Codecs',
  frameRate: 'Frame Rate & Playback',
  drm: 'Content Protection / DRM',
  security: 'Hardware Security',
};

// ── Device Deployments ──

export interface DeviceDeployment {
  id: string;
  deviceId: string;
  partnerKeyId: string;
  countryIso2: string;
  deploymentStatus: DeploymentStatus;
  deployedAdkVersion: string | null;
}

// ── Telemetry Snapshots ──

export interface TelemetrySnapshot {
  id: string;
  partnerKey: string;
  deviceId: string;
  coreVersion: string;
  uniqueDevices: number;
  eventCount: number;
  snapshotDate: Timestamp;
}

// ── Hardware Tiers ──

export interface HardwareTier {
  id: string;
  tierName: string;
  tierRank: number;
  ramMin: number | null;
  gpuMin: number | null;
  cpuSpeedMin: number | null;
  cpuCoresMin: number | null;
  requiredCodecs: string[];
  require64Bit: boolean;
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Device Tier Assignments ──

export interface DeviceTierAssignment {
  id: string;
  deviceId: string;
  tierId: string;
  assignedAt: Timestamp;
  trigger: TierAssignmentTrigger;
}

// ── Audit Log ──

export interface AuditLogEntry {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string;
  userEmail: string;
  timestamp: Timestamp;
}

// ── Alerts ──

export interface Alert {
  id: string;
  type: AlertType;
  partnerKey: string;
  deviceId: string | null;
  firstSeen: Timestamp;
  lastSeen: Timestamp;
  uniqueDeviceCount: number;
  status: AlertStatus;
  dismissedBy: string | null;
  dismissReason: AlertDismissReason | null;
  dismissedAt: Timestamp | null;
  consecutiveMisses: number;
}

// ── Upload History ──

export interface UploadHistory {
  id: string;
  uploadedBy: string;
  uploadedByEmail: string;
  uploadedAt: Timestamp;
  fileName: string;
  rowCount: number;
  successCount: number;
  errorCount: number;
  snapshotDate: Timestamp;
  errors: string[];
}

// ── API Response Types ──

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DeviceWithRelations extends Device {
  partnerName?: string;
  partnerKeyName?: string;
  tierName?: string;
}

export interface DeviceDetail extends Device {
  partner: Partner | null;
  partnerKey: PartnerKey | null;
  spec: DeviceSpec | null;
  tier: HardwareTier | null;
  deployments: DeviceDeployment[];
  telemetrySnapshots: TelemetrySnapshot[];
  auditHistory: AuditLogEntry[];
}

export interface PartnerWithStats extends Partner {
  partnerKeyCount: number;
  deviceCount: number;
  activeDeviceCount: number;
}

// ── Config ──

export interface AppConfig {
  retentionDailyDays: number;
  retentionWeeklyYears: number;
}
