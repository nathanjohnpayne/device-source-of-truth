import { z } from 'zod';

// ── Enums & Literals ──

export type CertificationStatus =
  | 'Certified'
  | 'Pending'
  | 'In Review'
  | 'Not Submitted'
  | 'Deprecated';

export type DeviceType = 'STB' | 'Smart TV' | 'Stick' | 'Console' | 'OTT Box' | 'Other';

export type DeviceStatus = 'active' | 'deprecated' | 'device_id_missing' | 'out_of_scope';

export type DevicePhase = 'phase_1' | 'phase_2';

export type Region = 'NA' | 'EMEA' | 'LATAM' | 'APAC';

export type PartnerKeyRegion = 'APAC' | 'EMEA' | 'LATAM' | 'DOMESTIC' | 'GLOBAL';

export type AlertStatus = 'open' | 'dismissed';

export type AlertDismissReason = 'Test Device' | 'Duplicate Key' | 'Will Register' | 'Internal / Deprecated';

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
  | 'questionnaireIntake'
  | 'system';

export type Timestamp = string;

// ── Enum Schemas ──

export const CertificationStatusSchema = z.enum([
  'Certified', 'Pending', 'In Review', 'Not Submitted', 'Deprecated',
]);

export const DeviceTypeSchema = z.enum([
  'STB', 'Smart TV', 'Stick', 'Console', 'OTT Box', 'Other',
]);

export const DeviceStatusSchema = z.enum([
  'active', 'deprecated', 'device_id_missing', 'out_of_scope',
]);

export const DevicePhaseSchema = z.enum(['phase_1', 'phase_2']);

export const RegionSchema = z.enum(['NA', 'EMEA', 'LATAM', 'APAC']);

export const PartnerKeyRegionSchema = z.enum([
  'APAC', 'EMEA', 'LATAM', 'DOMESTIC', 'GLOBAL',
]);

export const AuditEntityTypeSchema = z.enum([
  'partner', 'partnerKey', 'device', 'deviceSpec', 'deployment',
  'hardwareTier', 'alert', 'user', 'fieldOption', 'intakeRequest',
  'partnerAlias', 'questionnaireIntake', 'system',
]);

const timestamp = z.string();

// ── Core Entity Interfaces ──

export interface Partner {
  id: string;
  displayName: string;
  regions: Region[];
  countriesIso2: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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
  source: 'csv_import' | 'manual';
  importBatchId: string | null;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

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
  lastTelemetryAt: Timestamp | null;
  phase?: DevicePhase;
  importBatchId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const ACTIVE_DEVICES_WINDOW_DAYS = 28;

// ── Questionnaire Intake Types (DST-047 / DST-048) ──

export type QuestionnaireFormat =
  | 'lg_stb_v1'
  | 'gm_2024'
  | 'vodafone_combined'
  | 'android_atv'
  | 'unknown';

export type QuestionnaireIntakeJobStatus =
  | 'uploading'
  | 'parsing'
  | 'parse_failed'
  | 'awaiting_extraction'
  | 'extracting'
  | 'extraction_failed'
  | 'pending_review'
  | 'approved'
  | 'partially_approved'
  | 'rejected';

export type ExtractionStep = 1 | 2 | 3 | 4;

export type PlatformType = 'ncp_linux' | 'android_tv' | 'android_aosp' | 'unknown';

export type PartnerDetectionMethod = 'filename' | 'content' | 'ai' | 'admin';

export type ExtractionMethod = 'ai' | 'rule_based' | 'skipped' | 'admin_override';

export type ConflictStatus =
  | 'new_field'
  | 'matches_existing'
  | 'conflicts_with_existing'
  | 'no_existing_device';

export type FieldResolution = 'pending' | 'use_new' | 'keep_existing' | 'skipped_by_admin';

export type StagedDeviceReviewStatus = 'pending' | 'approved' | 'rejected';

export type DeviceMatchMethod = 'exact_model_number' | 'ai' | 'admin';

export interface QuestionnaireIntakeJob {
  id: string;
  fileName: string;
  fileStoragePath: string;
  fileSizeBytes: number | null;
  uploadedBy: string;
  uploadedByEmail: string;
  uploadedAt: Timestamp;
  partnerId: string | null;
  partnerConfidence: number | null;
  partnerDetectionMethod: PartnerDetectionMethod | null;
  questionnaireFormat: QuestionnaireFormat;
  deviceCountDetected: number | null;
  status: QuestionnaireIntakeJobStatus;
  aiExtractionMode: 'auto' | 'manual' | null;
  aiExtractionStartedAt: Timestamp | null;
  aiExtractionCompletedAt: Timestamp | null;
  extractionError: string | null;
  extractionStep: ExtractionStep | null;
  extractionCurrentDevice: string | null;
  devicesComplete: number;
  devicesFailed: number;
  notes: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface QuestionnaireStagedDevice {
  id: string;
  intakeJobId: string;
  columnIndex: number;
  rawHeaderLabel: string;
  detectedModelName: string | null;
  detectedModelNumber: string | null;
  detectedManufacturer: string | null;
  platformType: PlatformType;
  isOutOfScope: boolean;
  matchedDeviceId: string | null;
  matchConfidence: number | null;
  matchMethod: DeviceMatchMethod | null;
  reviewStatus: StagedDeviceReviewStatus;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  rejectionReason: string | null;
  confirmedDisplayName: string | null;
  confirmedModelNumber: string | null;
  confirmedManufacturer: string | null;
  confirmedDeviceType: DeviceType | null;
  extractionError: string | null;
  createdAt: Timestamp;
}

export interface QuestionnaireStagedField {
  id: string;
  stagedDeviceId: string;
  intakeJobId: string;
  dstFieldKey: string;
  dstFieldCategory: string;
  rawQuestionText: string;
  rawAnswerText: string | null;
  extractedValue: string | null;
  extractionMethod: ExtractionMethod;
  aiConfidence: number | null;
  aiReasoning: string | null;
  conflictStatus: ConflictStatus;
  existingValue: string | null;
  resolution: FieldResolution;
  resolvedBy: string | null;
  resolvedAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface DeviceQuestionnaireSource {
  id: string;
  deviceId: string;
  intakeJobId: string;
  stagedDeviceId: string;
  importedAt: Timestamp;
  importedBy: string;
  importedByEmail: string;
  fieldsImported: number;
  fieldsOverridden: number;
}

export interface QuestionnaireIntakeJobDetail extends QuestionnaireIntakeJob {
  stagedDevices: (QuestionnaireStagedDevice & {
    fieldSummary: {
      totalFields: number;
      extractedFields: number;
      conflictCount: number;
      newFieldCount: number;
    };
  })[];
  partner: Partner | null;
  extractionProgress: {
    totalDevices: number;
    devicesComplete: number;
    devicesFailed: number;
    step: ExtractionStep | null;
    currentDevice: string | null;
  } | null;
}

export interface AppNotification {
  id: string;
  recipientRole: 'admin';
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: Timestamp;
}

// ── Device Spec Section Interfaces (16 sections) ──

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

// ── Other Shared Entities ──

export type DeploymentStatus = 'Active' | 'Deprecated';

export interface DeviceDeployment {
  id: string;
  deviceId: string;
  partnerKeyId: string;
  countryIso2: string;
  deploymentStatus: DeploymentStatus;
  deployedAdkVersion: string | null;
}

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
  importTimeRange?: string;
  errors: string[];
  newCount?: number;
  updatedCount?: number;
  noChangeCount?: number;
  staleOverwrittenCount?: number;
  uploadBatchId?: string;
}

// ── Enriched Read Models ──

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

export interface PartnerKeyListItem extends PartnerKey {
  partnerDisplayName: string | null;
}

export interface TelemetryHistoryItem extends UploadHistory {
  rollbackAvailable: boolean;
}

// ── Request DTOs ──

export const CreateDeviceRequestSchema = z.object({
  displayName: z.string().min(1),
  deviceId: z.string().min(1),
  partnerKeyId: z.string().min(1),
  deviceType: DeviceTypeSchema.optional(),
  liveAdkVersion: z.string().nullable().optional(),
  certificationStatus: CertificationStatusSchema.optional(),
}).strict();

export type CreateDeviceRequest = z.infer<typeof CreateDeviceRequestSchema>;

export const UpdateDeviceRequestSchema = z.object({
  displayName: z.string().min(1).optional(),
  partnerKeyId: z.string().optional(),
  deviceType: DeviceTypeSchema.optional(),
  status: DeviceStatusSchema.optional(),
  liveAdkVersion: z.string().nullable().optional(),
  certificationStatus: CertificationStatusSchema.optional(),
  certificationNotes: z.string().nullable().optional(),
  lastCertifiedDate: z.string().nullable().optional(),
  questionnaireUrl: z.string().nullable().optional(),
  questionnaireFileUrl: z.string().nullable().optional(),
}).strict();

export type UpdateDeviceRequest = z.infer<typeof UpdateDeviceRequestSchema>;

// ── Device Spec Section Schemas ──

const ns = z.string().nullable(); // nullable string shorthand
const nn = z.number().nullable(); // nullable number shorthand

const QuestionnaireGeneralFieldsSchema = z.object({
  modelName: ns, modelNumber: ns, dateDeployed: ns, dateDeliveriesStopped: ns,
  activeDevicesMonthly: ns, totalInstalledBase: ns, forecastedGrowth: ns,
  countriesDeployed: ns, thirdPartyApps: ns, connectionType: ns, connectionTypeOther: ns,
});

const QuestionnaireHardwareFieldsSchema = z.object({
  socVendor: ns, socVendorOther: ns, socModelChipset: ns,
  softwareArchitecture: ns, softwareArchitectureOther: ns,
  socBaseRefVersion: ns, socCustomizations: ns, socCustomizationsDesc: ns,
  socSupportContract: ns, socSupportExpiration: ns,
  cpuClockRateGhz: nn, cpuDmips: ns, cpuCores: ns, cpuCoresOther: ns,
  stbManufacturer: ns, operatingSystem: ns, operatingSystemOther: ns,
  osVersion: ns, osCustomization: ns, osCustomizationDesc: ns,
  middlewareProvider: ns, middlewareProviderOther: ns, middlewareVersion: ns,
  middlewareContract: ns, middlewareContractExpiration: ns, middlewareIntegrationCompany: ns,
  videoDelivery: ns, videoDeliveryOther: ns,
  memoryTotalGb: nn, memoryType: ns, memoryTypeOther: ns,
  ramAvailableGb: nn, linuxMemoryAvailableMb: nn,
  gpuMemoryAvailableMb: nn, gpuTextureMemoryMb: nn,
  gpuMemorySharing: ns, gpuMemorySharingOther: ns, gpuMemoryReservedMb: nn,
  storageTotalGb: nn, storageType: ns, storageTypeOther: ns,
  storageAvailableMb: nn, nonPersistentStorageMb: nn, maxAppBinarySizeMb: nn,
  filesystemType: ns, filesystemTypeOther: ns,
  storageLimitations: ns, storageLimitationsDesc: ns,
  gpuAvailability: ns, gpuAvailableForApp: ns,
  gpuGraphicsLibrary: ns, gpuGraphicsLibraryOther: ns,
  openglEs2Apps: ns, openglEs2AppsNames: ns,
  streamingInterface: ns, streamingInterfaceOther: ns,
  ethernetPort: ns, wifiStandards: ns, wifiBands: ns, mocaPresent: ns,
  maxStreamingThroughputMbps: nn,
  hdmiCapabilitiesRetrieval: ns, hdmiVersion: ns, hdmiVersionOther: ns,
  digitalVideoOutputModes: ns, analogVideoOutputModes: ns,
  uiNativeResolution: ns, uiNativeResolutionOther: ns, ottAppRestrictions: ns,
});

const QuestionnaireFirmwareFieldsSchema = z.object({
  firmwareSupported: ns, firmwareFrequency: ns, firmwareFrequencyOther: ns,
  internalLeadTime: ns, rolloutDuration: ns, emergencyUpdate: ns,
  emergencyUpdateTime: ns, codeSigning: ns, codeSigningDesc: ns,
});

const QuestionnaireMediaCodecFieldsSchema = z.object({
  avcH264: ns, hevcH265: ns, eac3DolbyDigitalPlus: ns, eac3Atmos: ns,
  hdr10: ns, hdr10Plus: ns, av1: ns, dolbyVisionSupported: ns, dolbyVisionVersion: ns,
});

const QuestionnaireFrameRatesFieldsSchema = z.object({
  outputRefreshRates: ns, userRefreshRateSettings: ns,
  frameRateAdjust: ns, frameRateAdjustOther: ns,
  frameRateConvert: ns, frameRateConvertFixed: ns,
  appDetermineRefreshRate: ns, appSetRefreshRate: ns,
});

const QuestionnaireContentProtectionFieldsSchema = z.object({
  drmSystem: ns, encryptionScheme: ns,
  playreadySupported: ns, playreadyVersion: ns, playreadySecurityLevel: ns, playreadyEncryption: ns,
  widevineSupported: ns, widevineSecurityLevel: ns, widevineVersion: ns, widevineEncryption: ns,
  drmHwLevel: ns, cbcsSupport: ns, multiKeyCtr: ns, multiKeyCtrMax: nn,
  digitalVideoOutput: ns, hdcpVersion: ns, hdcpType: ns, otherDrms: ns,
  broadcomSage: ns, secureFirmwareDownload: ns, signedFirmwareSecureBoot: ns,
  hardwareRootOfTrust: ns, tamperResistantCode: ns, tee: ns, secureVideoPath: ns,
  rootedDeviceProtection: ns, appCodeSigning: ns, sideloadingRestricted: ns,
  digitalOutputProtection: ns, encryptedAudio: ns, secureBootJtag: ns,
});

const QuestionnaireNativeFieldsSchema = z.object({
  adkPortPossible: ns, ursrModification: ns, ursrModificationOther: ns,
  nexusVideoApis: ns, sageApiAccess: ns, audioDetectionApi: ns, drmBroadcomRefApi: ns,
});

const QuestionnaireVideoPlaybackFieldsSchema = z.object({
  avcBitrateLimitations: ns, avcFrameRateLimitations: ns,
  hevcBitrateLimitations: ns, hevcFrameRateLimitations: ns,
  eac3BitrateLimitations: ns, playbackEncryption: ns, playbackEncryptionOther: ns,
  eac3MseCmaf: ns, eac3DecodeMode: ns, atmosSupported: ns,
  dolbyVisionProfiles: ns, dolbyVisionIdkSdkVersion: ns,
  playreadyCdmVersion: ns, playreadyCbcsConfirmed: ns,
  widevineCdmVersion: ns, widevineCdmCategory: ns, widevineCbcsConfirmed: ns,
  securitySecureBoot: ns, securityHwRootOfTrust: ns, securitySecureKeyStorage: ns,
  securitySecureDecryption: ns, securitySecureVideoPath: ns, securityHdcp: ns,
  html5CapabilityDetection: ns,
});

const QuestionnaireUhdHdrFieldsSchema = z.object({
  hdrTechnologies: ns, uhdSubscriberPercent: nn, hdrNativeUi: ns,
  displayRangeApi: ns, displayRangeApiDesc: ns,
  hdrTransform: ns, hdrTransformOther: ns, hdrModeSwitch: ns, hdrModeSwitchOther: ns,
  videoRangeRender: ns, videoRangeRenderOther: ns,
  hdrHelpResources: ns, hdrUserSettings: ns,
  colorSpace: ns, colorSpaceOther: ns,
  existingHdrApps: ns, existingHdrAppsNames: ns, publicHdrResources: ns,
  hdrCompositing: ns, graphicsPlaneResolution: ns, graphicsPlaneResolutionOther: ns,
});

const QuestionnaireAVOutputFieldsSchema = z.object({
  displayOutputSettings: ns, videoDecodeSettings: ns, audioDecodeSettings: ns,
  aspectRatioSettings: ns, uiResolutionSettings: ns, alternateAudioPath: ns,
  audioSyncSettings: ns, audioSyncRange: ns,
});

const QuestionnaireOtherFieldsSchema = z.object({
  voltageRange: ns, voltageRangeOther: ns, rcuType: ns,
  bluetoothPresent: ns, bluetoothVersion: ns, bluetoothVersionOther: ns,
  bluetoothProfiles: ns, bluetoothUsedFor: ns,
  otherVideoOutputs: ns, otherAudioOutputs: ns,
  otherVideoOutputProtection: ns, otherVideoOutputDisney: ns,
});

const QuestionnaireAppRuntimeFieldsSchema = z.object({
  webEngine: ns, webEngineVersion: ns, adkVersion: ns,
  mseSupport: ns, mseLimitations: ns, emeSupport: ns, emeLimitations: ns,
  jsEngine: ns, jsEngineVersion: ns, jsEngineLimitations: ns,
  wasmSupport: ns, webglSupport: ns, webCryptoSupport: ns,
});

const QuestionnaireAudioFieldsSchema = z.object({
  pcmChannels: ns, pcmChannelsOther: ns, audioSampleRates: ns, audioBitDepths: ns,
  dolbyAudio: ns, dolbyAudioOther: ns, dtsAudio: ns, dtsAudioOther: ns,
  btAudio: ns, btAudioOther: ns, audioBackgroundBehavior: ns, audioBackgroundOther: ns,
});

const QuestionnaireAccessibilityFieldsSchema = z.object({
  ttsApi: ns, ttsApiDesc: ns, captionFormats: ns, captionRendering: ns,
  adTrackSupport: ns, focusManagementApi: ns,
});

const QuestionnairePlatformFieldsSchema = z.object({
  deepLinkSupport: ns, deepLinkDesc: ns, voiceAssistant: ns,
  homeScreenIntegration: ns, homeScreenDesc: ns,
  continueWatching: ns, continueWatchingDesc: ns,
  universalSearch: ns, universalSearchDesc: ns,
  recommendationsTiles: ns, appAutostart: ns,
});

const QuestionnaireBenchmarksFieldsSchema = z.object({
  coldStartTime: ns, warmStartTime: ns, ttff: ns,
  uiFrameRate: ns, uiFrameRateOther: ns,
  concurrentStreams: ns, concurrentStreamsDesc: ns,
  memoryBackground: ns, benchmarkAvailable: ns,
});

// ── SaveDeviceSpecRequest Schema ──
// Each section: fields are optional (.partial()), unknown fields rejected (.strict())

export const SaveDeviceSpecRequestSchema = z.object({
  general: QuestionnaireGeneralFieldsSchema.partial().strict().optional(),
  hardware: QuestionnaireHardwareFieldsSchema.partial().strict().optional(),
  firmwareUpdates: QuestionnaireFirmwareFieldsSchema.partial().strict().optional(),
  mediaCodec: QuestionnaireMediaCodecFieldsSchema.partial().strict().optional(),
  frameRates: QuestionnaireFrameRatesFieldsSchema.partial().strict().optional(),
  contentProtection: QuestionnaireContentProtectionFieldsSchema.partial().strict().optional(),
  native: QuestionnaireNativeFieldsSchema.partial().strict().optional(),
  videoPlayback: QuestionnaireVideoPlaybackFieldsSchema.partial().strict().optional(),
  uhdHdr: QuestionnaireUhdHdrFieldsSchema.partial().strict().optional(),
  audioVideoOutput: QuestionnaireAVOutputFieldsSchema.partial().strict().optional(),
  other: QuestionnaireOtherFieldsSchema.partial().strict().optional(),
  appRuntime: QuestionnaireAppRuntimeFieldsSchema.partial().strict().optional(),
  audioCapabilities: QuestionnaireAudioFieldsSchema.partial().strict().optional(),
  accessibility: QuestionnaireAccessibilityFieldsSchema.partial().strict().optional(),
  platformIntegration: QuestionnairePlatformFieldsSchema.partial().strict().optional(),
  performanceBenchmarks: QuestionnaireBenchmarksFieldsSchema.partial().strict().optional(),
}).strict();

export type SaveDeviceSpecRequest = z.infer<typeof SaveDeviceSpecRequestSchema>;

// ── Entity Schemas (for response validation) ──

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
  partnerId: z.string().nullable(),
  countries: z.array(z.string()),
  regions: z.array(PartnerKeyRegionSchema),
  chipset: z.string().nullable(),
  oem: z.string().nullable(),
  kernel: z.string().nullable(),
  os: z.string().nullable(),
  isActive: z.boolean(),
  source: z.string(),
  importBatchId: z.string().nullable(),
  createdAt: timestamp,
  createdBy: z.string(),
  updatedAt: timestamp,
  updatedBy: z.string(),
});

export const PartnerKeyListItemSchema = PartnerKeySchema.extend({
  partnerDisplayName: z.string().nullable(),
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
  lastTelemetryAt: timestamp.nullable().optional(),
  phase: DevicePhaseSchema.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const DeviceWithRelationsSchema = DeviceSchema.extend({
  partnerName: z.string().optional(),
  partnerKeyName: z.string().optional(),
  tierName: z.string().optional(),
});

export const DeviceSpecSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  general: QuestionnaireGeneralFieldsSchema.partial().passthrough(),
  hardware: QuestionnaireHardwareFieldsSchema.partial().passthrough(),
  firmwareUpdates: QuestionnaireFirmwareFieldsSchema.partial().passthrough(),
  mediaCodec: QuestionnaireMediaCodecFieldsSchema.partial().passthrough(),
  frameRates: QuestionnaireFrameRatesFieldsSchema.partial().passthrough(),
  contentProtection: QuestionnaireContentProtectionFieldsSchema.partial().passthrough(),
  native: QuestionnaireNativeFieldsSchema.partial().passthrough(),
  videoPlayback: QuestionnaireVideoPlaybackFieldsSchema.partial().passthrough(),
  uhdHdr: QuestionnaireUhdHdrFieldsSchema.partial().passthrough(),
  audioVideoOutput: QuestionnaireAVOutputFieldsSchema.partial().passthrough(),
  other: QuestionnaireOtherFieldsSchema.partial().passthrough(),
  appRuntime: QuestionnaireAppRuntimeFieldsSchema.partial().passthrough(),
  audioCapabilities: QuestionnaireAudioFieldsSchema.partial().passthrough(),
  accessibility: QuestionnaireAccessibilityFieldsSchema.partial().passthrough(),
  platformIntegration: QuestionnairePlatformFieldsSchema.partial().passthrough(),
  performanceBenchmarks: QuestionnaireBenchmarksFieldsSchema.partial().passthrough(),
  updatedAt: timestamp,
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

export const DeploymentSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  partnerKeyId: z.string(),
  countryIso2: z.string(),
  deploymentStatus: z.string(),
  deployedAdkVersion: z.string().nullable(),
});

export const TelemetrySnapshotSchema = z.object({
  id: z.string(),
  partnerKey: z.string(),
  deviceId: z.string(),
  coreVersion: z.string(),
  friendlyVersion: z.string().nullable().optional(),
  uniqueDevices: z.number(),
  eventCount: z.number(),
  snapshotDate: timestamp,
  countUpdatedAt: timestamp.nullable().optional(),
  versionUpdatedAt: timestamp.nullable().optional(),
  uploadedAt: timestamp.nullable().optional(),
  uploadBatchId: z.string().nullable().optional(),
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
  importTimeRange: z.string().optional(),
  errors: z.array(z.string()),
});

export const TelemetryHistoryItemSchema = UploadHistorySchema.extend({
  rollbackAvailable: z.boolean(),
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

export const DeviceDetailSchema = DeviceSchema.extend({
  partner: PartnerSchema.nullable(),
  partnerKey: PartnerKeySchema.passthrough().nullable(),
  spec: DeviceSpecSchema.nullable(),
  tier: HardwareTierSchema.nullable(),
  deployments: z.array(DeploymentSchema),
  telemetrySnapshots: z.array(TelemetrySnapshotSchema),
  auditHistory: z.array(AuditLogEntrySchema),
});

// ── Response DTOs ──

export const DashboardReportResponseSchema = z.object({
  totalDevices: z.number(),
  totalActiveDevices: z.number(),
  lastTelemetryAt: timestamp.nullable().optional(),
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

export type DashboardReportResponse = z.infer<typeof DashboardReportResponseSchema>;

export const PartnerReportResponseSchema = z.object({
  partner: PartnerSchema.passthrough(),
  deviceCount: z.number(),
  totalActiveDevices: z.number(),
  specCoverage: z.number(),
  tierDistribution: z.record(z.string(), z.number()),
  certificationCounts: z.record(z.string(), z.number()),
  devices: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      deviceId: z.string(),
      activeDeviceCount: z.number(),
      specCompleteness: z.number(),
      certificationStatus: z.string(),
      tierId: z.string().nullable(),
    }),
  ),
});

export type PartnerReportResponse = z.infer<typeof PartnerReportResponseSchema>;

export const SpecCoverageReportResponseSchema = z.object({
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
      questionnaireStatus: z.enum(['linked', 'received', 'none']),
      region: z.string(),
    }),
  ),
});

export type SpecCoverageReportResponse = z.infer<typeof SpecCoverageReportResponseSchema>;

// ── Pagination Helper ──

export function paginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  });
}

// ── Search & Simulation Schemas ──

export const SearchResultSchema = z.object({
  devices: z.array(z.object({ id: z.string() }).passthrough()),
  partners: z.array(z.object({ id: z.string() }).passthrough()),
  partnerKeys: z.array(z.object({ id: z.string() }).passthrough()),
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

export const ErrorSchema = z.object({
  error: z.string(),
  detail: z.unknown().optional(),
});
