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
  | 'fieldOption'
  | 'intakeRequest'
  | 'system';

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

export type PartnerKeySource = 'csv_import' | 'manual';

export type PartnerKeyRegion = 'APAC' | 'EMEA' | 'LATAM' | 'DOMESTIC' | 'GLOBAL';

export interface PartnerKey {
  id: string;
  key: string;
  partnerId: string | null;
  countries: string[];
  regions: PartnerKeyRegion[];
  chipset: string | null;
  oem: string | null;
  kernel: string | null;
  os: string | null;
  isActive: boolean;
  source: PartnerKeySource;
  importBatchId: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
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
  pendingPartnerKey: string | null;
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

// ── Intake Requests (DST-037) ──

export type IntakeRegion = 'APAC' | 'DOMESTIC' | 'EMEA' | 'GLOBAL' | 'LATAM';

export type MatchConfidence = 'exact' | 'fuzzy' | 'unmatched';

export interface IntakeRequest {
  id: string;
  airtableSubject: string;
  requestType: string;
  requestStatus: string;
  requestPhase: string | null;
  countries: string[] | null;
  regions: IntakeRegion[] | null;
  tamNames: string[] | null;
  ieLeadNames: string[] | null;
  targetLaunchDate: string | null;
  releaseTargets: string[] | null;
  importedAt: Timestamp;
  importedBy: string;
  importBatchId: string;
}

export interface IntakeRequestPartner {
  id: string;
  intakeRequestId: string;
  partnerNameRaw: string;
  partnerId: string | null;
  matchConfidence: MatchConfidence;
}

export interface IntakeImportBatch {
  id: string;
  importBatchId: string;
  importedAt: Timestamp;
  importedBy: string;
  fileName: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  newCount?: number;
  overwrittenCount?: number;
  mergedCount?: number;
}

// ── AI Disambiguation (DST-039, DST-042) ──

export type ImportType = 'intake' | 'partner_key';

export type AIFieldType = 'country' | 'region' | 'partner_name' | 'enum' | 'multi_value_delimiter' | 'date';

export type DisambiguationResolutionSource = 'ai_auto' | 'ai_suggested' | 'human' | 'rule_based';

export interface DisambiguationFieldResult {
  rowIndex: number;
  field: string;
  rawValue: string;
  resolvedValue: string | null;
  confidence: number;
  reasoning: string;
  needsHuman: boolean;
  question: string | null;
  resolutionSource: DisambiguationResolutionSource;
  overriddenByAdmin: boolean;
  adminValue?: string | null;
  cached?: boolean;
}

export type ClarificationQuestionType = 'country' | 'region' | 'partner' | 'date' | 'delimiter' | 'other';

export interface ClarificationQuestion {
  id: string;
  rowIndex: number;
  field: string;
  type: ClarificationQuestionType;
  rawValue: string;
  question: string;
  suggestedValue: string | null;
  options: ClarificationOption[] | null;
  allowFreeText: boolean;
  pattern: string;
}

export interface ClarificationOption {
  value: string;
  label: string;
  suggested: boolean;
}

export interface ClarificationAnswer {
  questionId: string;
  value: string;
  applyToAll: boolean;
}

export interface DisambiguationRequest {
  importType: ImportType;
  rows: Record<string, unknown>[];
  existingPartners: { id: string; displayName: string }[];
}

export interface DisambiguationResponse {
  fields: DisambiguationFieldResult[];
  questions: ClarificationQuestion[];
  aiFallback: boolean;
  fallbackReason?: string;
  fieldTypeFallbacks?: string[];
  aiStats?: { totalResolved: number; cachedCount: number };
}

// ── Import Deduplication (DST-041) ──

export type DeduplicationStatus = 'new' | 'duplicate' | 'conflict' | 'duplicate_in_file';

export type ConflictResolution = 'skip' | 'overwrite' | 'merge';

export interface FieldDiff {
  field: string;
  existingValue: string | null;
  incomingValue: string | null;
}

export interface DeduplicationInfo {
  dedupStatus: DeduplicationStatus;
  existingId?: string;
  diffs?: FieldDiff[];
  resolution?: ConflictResolution;
  duplicateOfRow?: number;
}

// ── Config ──

export interface AppConfig {
  retentionDailyDays: number;
  retentionWeeklyYears: number;
}
