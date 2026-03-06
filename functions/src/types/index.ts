// Re-export shared contracts (audited types moved to @dst/contracts)
export {
  SPEC_CATEGORIES,
  ACTIVE_DEVICES_WINDOW_DAYS,
  CreateDeviceRequestSchema,
  UpdateDeviceRequestSchema,
  SaveDeviceSpecRequestSchema,
} from '@dst/contracts';

export type {
  Timestamp,
  CertificationStatus,
  DeviceType,
  DeviceStatus,
  Region,
  PartnerKeyRegion,
  AuditEntityType,
  AlertStatus,
  AlertDismissReason,
  DeploymentStatus,
  Partner,
  PartnerKey,
  Device,
  QuestionnaireGeneral,
  QuestionnaireHardware,
  QuestionnaireFirmware,
  QuestionnaireMediaCodec,
  QuestionnaireFrameRates,
  QuestionnaireContentProtection,
  QuestionnaireNative,
  QuestionnaireVideoPlayback,
  QuestionnaireUhdHdr,
  QuestionnaireAVOutput,
  QuestionnaireOther,
  QuestionnaireAppRuntime,
  QuestionnaireAudio,
  QuestionnaireAccessibility,
  QuestionnairePlatform,
  QuestionnaireBenchmarks,
  DeviceSpec,
  SpecCategory,
  DeviceDeployment,
  TelemetrySnapshot,
  HardwareTier,
  AuditLogEntry,
  UploadHistory,
  PaginatedResponse,
  DeviceWithRelations,
  DeviceDetail,
  PartnerWithStats,
  PartnerKeyListItem,
  TelemetryHistoryItem,
  CreateDeviceRequest,
  UpdateDeviceRequest,
  SaveDeviceSpecRequest,
  DashboardReportResponse,
  PartnerReportResponse,
  SpecCoverageReportResponse,
  DevicePhase,
  QuestionnaireFormat,
  QuestionnaireIntakeJobStatus,
  PlatformType,
  PartnerDetectionMethod,
  ExtractionMethod,
  ExtractionStep,
  ConflictStatus,
  FieldResolution,
  StagedDeviceReviewStatus,
  DeviceMatchMethod,
  QuestionnaireIntakeJob,
  QuestionnaireStagedDevice,
  QuestionnaireStagedField,
  DeviceQuestionnaireSource,
  QuestionnaireIntakeJobDetail,
  AppNotification,
  IntakePartnerDetectionSource,
  IntakePartnerMatchMethod,
  IntakePartnerReviewStatus,
  StagedDeviceCertificationStatus,
  QuestionnaireIntakePartner,
  QuestionnaireStagedDevicePartner,
  DevicePartnerDeployment,
  ExtractionStatus,
} from '@dst/contracts';

// ── Backend-only types below ──

export type UserRole = 'viewer' | 'editor' | 'admin';

export type SocVendor = 'Broadcom' | 'Novatek' | 'MediaTek' | 'Amlogic' | 'Realtek' | 'Other';

export type AlertType = 'unregistered_device' | 'new_partner_key' | 'inactive_key';

export type TierAssignmentTrigger = 'spec_update' | 'tier_definition_update' | 'manual';

export type PartnerKeySource = 'csv_import' | 'manual';

export type MatchConfidence = 'exact' | 'alias_direct' | 'alias_contextual' | 'fuzzy' | 'new_partner' | 'unmatched';

import type { PartnerKeyRegion, Timestamp } from '@dst/contracts';

// ── Users ──

export interface User {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  photoUrl: string | null;
  lastLogin: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

// ── Partner Key Import ──

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

export interface PartnerKeyImportRow {
  key: string;
  friendlyPartnerName: string;
  countries: string[];
  regions: PartnerKeyRegion[];
  chipset: string | null;
  oem: string | null;
  kernel: string | null;
  os: string | null;
  partnerId: string | null;
  partnerDisplayName: string | null;
  matchConfidence: MatchConfidence;
  warnings: string[];
  errors: string[];
  status: 'ready' | 'warning' | 'error' | 'skipped';
  dedupInfo?: DeduplicationInfo;
}

export interface PartnerKeyImportPreview {
  rows: PartnerKeyImportRow[];
  totalRows: number;
  readyCount: number;
  warningCount: number;
  errorCount: number;
  skippedCount: number;
}

export interface PartnerKeyImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  batchId: string;
}

export interface PartnerKeyImportBatch {
  id: string;
  fileName: string;
  importedCount: number;
  importedAt: Timestamp;
  importedBy: string;
  importedByEmail: string;
  rollbackAvailable: boolean;
}

// ── Telemetry Preview ──

export type TelemetryRowStatus = 'new' | 'update' | 'no_change' | 'stale';

export interface TelemetryPreviewRow {
  rowIndex: number;
  partner: string;
  device: string;
  coreVersion: string;
  friendlyVersion: string | null;
  uniqueDevices: number;
  eventCount: number;
  status: 'ready' | 'warning' | 'error';
  upsertStatus: TelemetryRowStatus;
  existingSnapshotDate: string | null;
  overwriteStale: boolean;
  warnings: string[];
  errors: string[];
}

// ── Core Version Mappings (DST-044) ──

export type VersionPlatform = 'NCP' | 'ADK' | 'DEV' | 'UNKNOWN';

export interface CoreVersionMapping {
  id: string;
  coreVersion: string;
  friendlyVersion: string;
  platform: VersionPlatform;
  notes: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type UnmappedVersionSource = 'Telemetry' | 'Import' | 'Questionnaire';

export interface UnmappedVersion {
  coreVersion: string;
  platform: VersionPlatform;
  deviceCount: number;
  partnerCount: number;
  firstSeen: Timestamp | null;
  sources: UnmappedVersionSource[];
}

// ── Device Tier Assignments ──

export interface DeviceTierAssignment {
  id: string;
  deviceId: string;
  tierId: string;
  assignedAt: Timestamp;
  trigger: TierAssignmentTrigger;
}

// ── Alerts (extended type with AlertType) ──

export interface Alert {
  id: string;
  type: AlertType;
  partnerKey: string;
  deviceId: string | null;
  firstSeen: Timestamp;
  lastSeen: Timestamp;
  uniqueDeviceCount: number;
  status: import('@dst/contracts').AlertStatus;
  dismissedBy: string | null;
  dismissReason: import('@dst/contracts').AlertDismissReason | null;
  dismissedAt: Timestamp | null;
  consecutiveMisses: number;
}

// ── Compatibility aliases ──

export interface PartnerKeyWithDisplay {
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
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  partnerDisplayName: string | null;
}

export interface UploadHistoryWithRollback {
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
  newCount?: number;
  updatedCount?: number;
  noChangeCount?: number;
  staleOverwrittenCount?: number;
  uploadBatchId?: string;
  rollbackAvailable: boolean;
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
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface FieldOptionKeyInfo {
  dropdownKey: string;
  displayLabel: string;
  optionCount: number;
  activeCount: number;
  updatedAt: Timestamp;
}

// ── Intake Requests (DST-037) ──

export type IntakeRegion = 'APAC' | 'DOMESTIC' | 'EMEA' | 'GLOBAL' | 'LATAM';

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

export interface IntakePreviewWarning {
  type: 'sk_ambiguity' | 'unknown_country' | 'unparseable_date' | 'unrecognized_request_type' | 'blank_subject';
  field: string;
  rawValue: string;
  message: string;
}

export interface IntakePreviewPartnerMatch {
  partnerNameRaw: string;
  partnerId: string | null;
  partnerDisplayName: string | null;
  matchConfidence: MatchConfidence;
  similarityScore?: number;
}

export interface IntakePreviewRow {
  rowIndex: number;
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
  partnerMatches: IntakePreviewPartnerMatch[];
  warnings: IntakePreviewWarning[];
  errors: IntakePreviewWarning[];
  status: 'ready' | 'warning' | 'error';
  skipped?: boolean;
  overrides?: Record<string, string>;
  dedupInfo?: DeduplicationInfo;
}

export interface IntakeImportResult {
  success: boolean;
  importBatchId: string;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
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

// ── Migration History ──

export interface MigrationBatch {
  id: string;
  importBatchId: string;
  importedAt: Timestamp;
  importedBy: string;
  importedByEmail: string;
  fileName: string;
  totalRows: number;
  created: number;
  duplicates: number;
  errored: number;
  rollbackAvailable: boolean;
}

// ── Partner Aliases (DST-046) ──

export type PartnerAliasResolutionType = 'direct' | 'contextual';

export type PartnerAliasContextSignal = 'region' | 'country_iso' | 'device_type' | 'vendor';

export interface PartnerAliasContextRule {
  conditions: Record<string, string[]>;
  partner_id: string;
}

export interface PartnerAliasContextRules {
  signals: PartnerAliasContextSignal[];
  rules: PartnerAliasContextRule[];
  fallback: string | null;
}

export interface PartnerAlias {
  id: string;
  alias: string;
  partnerId: string | null;
  partnerDisplayName?: string | null;
  resolutionType: PartnerAliasResolutionType;
  contextRules: PartnerAliasContextRules | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ── Extraction Task Queue ──

export interface ExtractionTaskPayload {
  intakeJobId: string;
  stagedDeviceId: string;
}

// ── Config ──

export interface AppConfig {
  retentionDailyDays: number;
  retentionWeeklyYears: number;
}
