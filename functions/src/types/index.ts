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
  | 'partnerAlias'
  | 'system';

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
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
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
  importBatchId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Device Specs (STB Questionnaire — 16 sections, ~170 fields) ──

export interface QuestionnaireGeneral {
  modelName: string | null;
  modelNumber: string | null;
  dateDeployed: string | null;
  dateDeliveriesStopped: string | null;
  activeDevicesMonthly: string | null;
  totalInstalledBase: string | null;
  forecastedGrowth: string | null;
  countriesDeployed: string | null;
  thirdPartyApps: string | null;
  connectionType: string | null;
  connectionTypeOther: string | null;
}

export interface QuestionnaireHardware {
  socVendor: string | null;
  socVendorOther: string | null;
  socModelChipset: string | null;
  softwareArchitecture: string | null;
  softwareArchitectureOther: string | null;
  socBaseRefVersion: string | null;
  socCustomizations: string | null;
  socCustomizationsDesc: string | null;
  socSupportContract: string | null;
  socSupportExpiration: string | null;
  cpuClockRateGhz: number | null;
  cpuDmips: string | null;
  cpuCores: string | null;
  cpuCoresOther: string | null;
  stbManufacturer: string | null;
  operatingSystem: string | null;
  operatingSystemOther: string | null;
  osVersion: string | null;
  osCustomization: string | null;
  osCustomizationDesc: string | null;
  middlewareProvider: string | null;
  middlewareProviderOther: string | null;
  middlewareVersion: string | null;
  middlewareContract: string | null;
  middlewareContractExpiration: string | null;
  middlewareIntegrationCompany: string | null;
  videoDelivery: string | null;
  videoDeliveryOther: string | null;
  memoryTotalGb: number | null;
  memoryType: string | null;
  memoryTypeOther: string | null;
  ramAvailableGb: number | null;
  linuxMemoryAvailableMb: number | null;
  gpuMemoryAvailableMb: number | null;
  gpuTextureMemoryMb: number | null;
  gpuMemorySharing: string | null;
  gpuMemorySharingOther: string | null;
  gpuMemoryReservedMb: number | null;
  storageTotalGb: number | null;
  storageType: string | null;
  storageTypeOther: string | null;
  storageAvailableMb: number | null;
  nonPersistentStorageMb: number | null;
  maxAppBinarySizeMb: number | null;
  filesystemType: string | null;
  filesystemTypeOther: string | null;
  storageLimitations: string | null;
  storageLimitationsDesc: string | null;
  gpuAvailability: string | null;
  gpuAvailableForApp: string | null;
  gpuGraphicsLibrary: string | null;
  gpuGraphicsLibraryOther: string | null;
  openglEs2Apps: string | null;
  openglEs2AppsNames: string | null;
  streamingInterface: string | null;
  streamingInterfaceOther: string | null;
  ethernetPort: string | null;
  wifiStandards: string | null;
  wifiBands: string | null;
  mocaPresent: string | null;
  maxStreamingThroughputMbps: number | null;
  hdmiCapabilitiesRetrieval: string | null;
  hdmiVersion: string | null;
  hdmiVersionOther: string | null;
  digitalVideoOutputModes: string | null;
  analogVideoOutputModes: string | null;
  uiNativeResolution: string | null;
  uiNativeResolutionOther: string | null;
  ottAppRestrictions: string | null;
}

export interface QuestionnaireFirmware {
  firmwareSupported: string | null;
  firmwareFrequency: string | null;
  firmwareFrequencyOther: string | null;
  internalLeadTime: string | null;
  rolloutDuration: string | null;
  emergencyUpdate: string | null;
  emergencyUpdateTime: string | null;
  codeSigning: string | null;
  codeSigningDesc: string | null;
}

export interface QuestionnaireMediaCodec {
  avcH264: string | null;
  hevcH265: string | null;
  eac3DolbyDigitalPlus: string | null;
  eac3Atmos: string | null;
  hdr10: string | null;
  hdr10Plus: string | null;
  av1: string | null;
  dolbyVisionSupported: string | null;
  dolbyVisionVersion: string | null;
}

export interface QuestionnaireFrameRates {
  outputRefreshRates: string | null;
  userRefreshRateSettings: string | null;
  frameRateAdjust: string | null;
  frameRateAdjustOther: string | null;
  frameRateConvert: string | null;
  frameRateConvertFixed: string | null;
  appDetermineRefreshRate: string | null;
  appSetRefreshRate: string | null;
}

export interface QuestionnaireContentProtection {
  drmSystem: string | null;
  encryptionScheme: string | null;
  playreadySupported: string | null;
  playreadyVersion: string | null;
  playreadySecurityLevel: string | null;
  playreadyEncryption: string | null;
  widevineSupported: string | null;
  widevineSecurityLevel: string | null;
  widevineVersion: string | null;
  widevineEncryption: string | null;
  drmHwLevel: string | null;
  cbcsSupport: string | null;
  multiKeyCtr: string | null;
  multiKeyCtrMax: number | null;
  digitalVideoOutput: string | null;
  hdcpVersion: string | null;
  hdcpType: string | null;
  otherDrms: string | null;
  broadcomSage: string | null;
  secureFirmwareDownload: string | null;
  signedFirmwareSecureBoot: string | null;
  hardwareRootOfTrust: string | null;
  tamperResistantCode: string | null;
  tee: string | null;
  secureVideoPath: string | null;
  rootedDeviceProtection: string | null;
  appCodeSigning: string | null;
  sideloadingRestricted: string | null;
  digitalOutputProtection: string | null;
  encryptedAudio: string | null;
  secureBootJtag: string | null;
}

export interface QuestionnaireNative {
  adkPortPossible: string | null;
  ursrModification: string | null;
  ursrModificationOther: string | null;
  nexusVideoApis: string | null;
  sageApiAccess: string | null;
  audioDetectionApi: string | null;
  drmBroadcomRefApi: string | null;
}

export interface QuestionnaireVideoPlayback {
  avcBitrateLimitations: string | null;
  avcFrameRateLimitations: string | null;
  hevcBitrateLimitations: string | null;
  hevcFrameRateLimitations: string | null;
  eac3BitrateLimitations: string | null;
  playbackEncryption: string | null;
  playbackEncryptionOther: string | null;
  eac3MseCmaf: string | null;
  eac3DecodeMode: string | null;
  atmosSupported: string | null;
  dolbyVisionProfiles: string | null;
  dolbyVisionIdkSdkVersion: string | null;
  playreadyCdmVersion: string | null;
  playreadyCbcsConfirmed: string | null;
  widevineCdmVersion: string | null;
  widevineCdmCategory: string | null;
  widevineCbcsConfirmed: string | null;
  securitySecureBoot: string | null;
  securityHwRootOfTrust: string | null;
  securitySecureKeyStorage: string | null;
  securitySecureDecryption: string | null;
  securitySecureVideoPath: string | null;
  securityHdcp: string | null;
  html5CapabilityDetection: string | null;
}

export interface QuestionnaireUhdHdr {
  hdrTechnologies: string | null;
  uhdSubscriberPercent: number | null;
  hdrNativeUi: string | null;
  displayRangeApi: string | null;
  displayRangeApiDesc: string | null;
  hdrTransform: string | null;
  hdrTransformOther: string | null;
  hdrModeSwitch: string | null;
  hdrModeSwitchOther: string | null;
  videoRangeRender: string | null;
  videoRangeRenderOther: string | null;
  hdrHelpResources: string | null;
  hdrUserSettings: string | null;
  colorSpace: string | null;
  colorSpaceOther: string | null;
  existingHdrApps: string | null;
  existingHdrAppsNames: string | null;
  publicHdrResources: string | null;
  hdrCompositing: string | null;
  graphicsPlaneResolution: string | null;
  graphicsPlaneResolutionOther: string | null;
}

export interface QuestionnaireAVOutput {
  displayOutputSettings: string | null;
  videoDecodeSettings: string | null;
  audioDecodeSettings: string | null;
  aspectRatioSettings: string | null;
  uiResolutionSettings: string | null;
  alternateAudioPath: string | null;
  audioSyncSettings: string | null;
  audioSyncRange: string | null;
}

export interface QuestionnaireOther {
  voltageRange: string | null;
  voltageRangeOther: string | null;
  rcuType: string | null;
  bluetoothPresent: string | null;
  bluetoothVersion: string | null;
  bluetoothVersionOther: string | null;
  bluetoothProfiles: string | null;
  bluetoothUsedFor: string | null;
  otherVideoOutputs: string | null;
  otherAudioOutputs: string | null;
  otherVideoOutputProtection: string | null;
  otherVideoOutputDisney: string | null;
}

export interface QuestionnaireAppRuntime {
  webEngine: string | null;
  webEngineVersion: string | null;
  adkVersion: string | null;
  mseSupport: string | null;
  mseLimitations: string | null;
  emeSupport: string | null;
  emeLimitations: string | null;
  jsEngine: string | null;
  jsEngineVersion: string | null;
  jsEngineLimitations: string | null;
  wasmSupport: string | null;
  webglSupport: string | null;
  webCryptoSupport: string | null;
}

export interface QuestionnaireAudio {
  pcmChannels: string | null;
  pcmChannelsOther: string | null;
  audioSampleRates: string | null;
  audioBitDepths: string | null;
  dolbyAudio: string | null;
  dolbyAudioOther: string | null;
  dtsAudio: string | null;
  dtsAudioOther: string | null;
  btAudio: string | null;
  btAudioOther: string | null;
  audioBackgroundBehavior: string | null;
  audioBackgroundOther: string | null;
}

export interface QuestionnaireAccessibility {
  ttsApi: string | null;
  ttsApiDesc: string | null;
  captionFormats: string | null;
  captionRendering: string | null;
  adTrackSupport: string | null;
  focusManagementApi: string | null;
}

export interface QuestionnairePlatform {
  deepLinkSupport: string | null;
  deepLinkDesc: string | null;
  voiceAssistant: string | null;
  homeScreenIntegration: string | null;
  homeScreenDesc: string | null;
  continueWatching: string | null;
  continueWatchingDesc: string | null;
  universalSearch: string | null;
  universalSearchDesc: string | null;
  recommendationsTiles: string | null;
  appAutostart: string | null;
}

export interface QuestionnaireBenchmarks {
  coldStartTime: string | null;
  warmStartTime: string | null;
  ttff: string | null;
  uiFrameRate: string | null;
  uiFrameRateOther: string | null;
  concurrentStreams: string | null;
  concurrentStreamsDesc: string | null;
  memoryBackground: string | null;
  benchmarkAvailable: string | null;
}

export interface DeviceSpec {
  id: string;
  deviceId: string;
  general: QuestionnaireGeneral;
  hardware: QuestionnaireHardware;
  firmwareUpdates: QuestionnaireFirmware;
  mediaCodec: QuestionnaireMediaCodec;
  frameRates: QuestionnaireFrameRates;
  contentProtection: QuestionnaireContentProtection;
  native: QuestionnaireNative;
  videoPlayback: QuestionnaireVideoPlayback;
  uhdHdr: QuestionnaireUhdHdr;
  audioVideoOutput: QuestionnaireAVOutput;
  other: QuestionnaireOther;
  appRuntime: QuestionnaireAppRuntime;
  audioCapabilities: QuestionnaireAudio;
  accessibility: QuestionnaireAccessibility;
  platformIntegration: QuestionnairePlatform;
  performanceBenchmarks: QuestionnaireBenchmarks;
  updatedAt: Timestamp;
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
  friendlyVersion: string | null;
  uniqueDevices: number;
  eventCount: number;
  snapshotDate: Timestamp;
  countUpdatedAt: Timestamp | null;
  versionUpdatedAt: Timestamp | null;
  uploadedAt: Timestamp | null;
  uploadBatchId: string | null;
}

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
  newCount?: number;
  updatedCount?: number;
  noChangeCount?: number;
  staleOverwrittenCount?: number;
  uploadBatchId?: string;
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

export interface PartnerKeyWithDisplay extends PartnerKey {
  partnerDisplayName: string | null;
}

export interface UploadHistoryWithRollback extends UploadHistory {
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

export type MatchConfidence = 'exact' | 'alias_direct' | 'alias_contextual' | 'fuzzy' | 'unmatched';

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

// ── Config ──

export interface AppConfig {
  retentionDailyDays: number;
  retentionWeeklyYears: number;
}
