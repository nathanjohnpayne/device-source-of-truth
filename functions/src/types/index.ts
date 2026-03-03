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
  | 'user'
  | 'fieldOption';

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

// ── Device Specs (STB Questionnaire — 16 sections, ~170 fields) ──

export interface DeviceSpec {
  id: string;
  deviceId: string;
  general: Record<string, unknown>;
  hardware: Record<string, unknown>;
  firmwareUpdates: Record<string, unknown>;
  mediaCodec: Record<string, unknown>;
  frameRates: Record<string, unknown>;
  contentProtection: Record<string, unknown>;
  native: Record<string, unknown>;
  videoPlayback: Record<string, unknown>;
  uhdHdr: Record<string, unknown>;
  audioVideoOutput: Record<string, unknown>;
  other: Record<string, unknown>;
  appRuntime: Record<string, unknown>;
  audioCapabilities: Record<string, unknown>;
  accessibility: Record<string, unknown>;
  platformIntegration: Record<string, unknown>;
  performanceBenchmarks: Record<string, unknown>;
  updatedAt: string;
}

export const SPEC_CATEGORIES = [
  'general',
  'hardware',
  'firmwareUpdates',
  'mediaCodec',
  'frameRates',
  'contentProtection',
  'native',
  'videoPlayback',
  'uhdHdr',
  'audioVideoOutput',
  'other',
  'appRuntime',
  'audioCapabilities',
  'accessibility',
  'platformIntegration',
  'performanceBenchmarks',
] as const;

export type SpecCategory = (typeof SPEC_CATEGORIES)[number];

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

// ── Field Options (DST-036) ──

export interface FieldOption {
  id: string;
  dropdownKey: string;
  displayLabel: string;
  displayValue: string;
  sortOrder: number;
  isActive: boolean;
  isOtherTrigger: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FieldOptionKeyInfo {
  dropdownKey: string;
  displayLabel: string;
  optionCount: number;
  activeCount: number;
  updatedAt: string;
}

// ── Config ──

export interface AppConfig {
  retentionDailyDays: number;
  retentionWeeklyYears: number;
}
