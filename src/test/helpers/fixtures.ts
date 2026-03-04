import type {
  DeviceDetail,
  DeviceWithRelations,
  PartnerWithStats,
  HardwareTier,
  Alert,
  UploadHistory,
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
  pendingPartnerKey: null,
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
  general: { modelName: null, modelNumber: null, dateDeployed: null, dateDeliveriesStopped: null, activeDevicesMonthly: null, totalInstalledBase: null, forecastedGrowth: null, countriesDeployed: null, thirdPartyApps: null, connectionType: null, connectionTypeOther: null },
  hardware: { socVendor: null, socVendorOther: null, socModelChipset: null, softwareArchitecture: null, softwareArchitectureOther: null, socBaseRefVersion: null, socCustomizations: null, socCustomizationsDesc: null, socSupportContract: null, socSupportExpiration: null, cpuClockRateGhz: null, cpuDmips: null, cpuCores: null, cpuCoresOther: null, stbManufacturer: null, operatingSystem: null, operatingSystemOther: null, osVersion: null, osCustomization: null, osCustomizationDesc: null, middlewareProvider: null, middlewareProviderOther: null, middlewareVersion: null, middlewareContract: null, middlewareContractExpiration: null, middlewareIntegrationCompany: null, videoDelivery: null, videoDeliveryOther: null, memoryTotalGb: null, memoryType: null, memoryTypeOther: null, ramAvailableGb: null, linuxMemoryAvailableMb: null, gpuMemoryAvailableMb: null, gpuTextureMemoryMb: null, gpuMemorySharing: null, gpuMemorySharingOther: null, gpuMemoryReservedMb: null, storageTotalGb: null, storageType: null, storageTypeOther: null, storageAvailableMb: null, nonPersistentStorageMb: null, maxAppBinarySizeMb: null, filesystemType: null, filesystemTypeOther: null, storageLimitations: null, storageLimitationsDesc: null, gpuAvailability: null, gpuAvailableForApp: null, gpuGraphicsLibrary: null, gpuGraphicsLibraryOther: null, openglEs2Apps: null, openglEs2AppsNames: null, streamingInterface: null, streamingInterfaceOther: null, ethernetPort: null, wifiStandards: null, wifiBands: null, mocaPresent: null, maxStreamingThroughputMbps: null, hdmiCapabilitiesRetrieval: null, hdmiVersion: null, hdmiVersionOther: null, digitalVideoOutputModes: null, analogVideoOutputModes: null, uiNativeResolution: null, uiNativeResolutionOther: null, ottAppRestrictions: null },
  firmwareUpdates: { firmwareSupported: null, firmwareFrequency: null, firmwareFrequencyOther: null, internalLeadTime: null, rolloutDuration: null, emergencyUpdate: null, emergencyUpdateTime: null, codeSigning: null, codeSigningDesc: null },
  mediaCodec: { avcH264: null, hevcH265: null, eac3DolbyDigitalPlus: null, eac3Atmos: null, hdr10: null, hdr10Plus: null, av1: null, dolbyVisionSupported: null, dolbyVisionVersion: null },
  frameRates: { outputRefreshRates: null, userRefreshRateSettings: null, frameRateAdjust: null, frameRateAdjustOther: null, frameRateConvert: null, frameRateConvertFixed: null, appDetermineRefreshRate: null, appSetRefreshRate: null },
  contentProtection: { drmSystem: null, encryptionScheme: null, playreadySupported: null, playreadyVersion: null, playreadySecurityLevel: null, playreadyEncryption: null, widevineSupported: null, widevineSecurityLevel: null, widevineVersion: null, widevineEncryption: null, drmHwLevel: null, cbcsSupport: null, multiKeyCtr: null, multiKeyCtrMax: null, digitalVideoOutput: null, hdcpVersion: null, hdcpType: null, otherDrms: null, broadcomSage: null, secureFirmwareDownload: null, signedFirmwareSecureBoot: null, hardwareRootOfTrust: null, tamperResistantCode: null, tee: null, secureVideoPath: null, rootedDeviceProtection: null, appCodeSigning: null, sideloadingRestricted: null, digitalOutputProtection: null, encryptedAudio: null, secureBootJtag: null },
  native: { adkPortPossible: null, ursrModification: null, ursrModificationOther: null, nexusVideoApis: null, sageApiAccess: null, audioDetectionApi: null, drmBroadcomRefApi: null },
  videoPlayback: { avcBitrateLimitations: null, avcFrameRateLimitations: null, hevcBitrateLimitations: null, hevcFrameRateLimitations: null, eac3BitrateLimitations: null, playbackEncryption: null, playbackEncryptionOther: null, eac3MseCmaf: null, eac3DecodeMode: null, atmosSupported: null, dolbyVisionProfiles: null, dolbyVisionIdkSdkVersion: null, playreadyCdmVersion: null, playreadyCbcsConfirmed: null, widevineCdmVersion: null, widevineCdmCategory: null, widevineCbcsConfirmed: null, securitySecureBoot: null, securityHwRootOfTrust: null, securitySecureKeyStorage: null, securitySecureDecryption: null, securitySecureVideoPath: null, securityHdcp: null, html5CapabilityDetection: null },
  uhdHdr: { hdrTechnologies: null, uhdSubscriberPercent: null, hdrNativeUi: null, displayRangeApi: null, displayRangeApiDesc: null, hdrTransform: null, hdrTransformOther: null, hdrModeSwitch: null, hdrModeSwitchOther: null, videoRangeRender: null, videoRangeRenderOther: null, hdrHelpResources: null, hdrUserSettings: null, colorSpace: null, colorSpaceOther: null, existingHdrApps: null, existingHdrAppsNames: null, publicHdrResources: null, hdrCompositing: null, graphicsPlaneResolution: null, graphicsPlaneResolutionOther: null },
  audioVideoOutput: { displayOutputSettings: null, videoDecodeSettings: null, audioDecodeSettings: null, aspectRatioSettings: null, uiResolutionSettings: null, alternateAudioPath: null, audioSyncSettings: null, audioSyncRange: null },
  other: { voltageRange: null, voltageRangeOther: null, rcuType: null, bluetoothPresent: null, bluetoothVersion: null, bluetoothVersionOther: null, bluetoothProfiles: null, bluetoothUsedFor: null, otherVideoOutputs: null, otherAudioOutputs: null, otherVideoOutputProtection: null, otherVideoOutputDisney: null },
  appRuntime: { webEngine: null, webEngineVersion: null, adkVersion: null, mseSupport: null, mseLimitations: null, emeSupport: null, emeLimitations: null, jsEngine: null, jsEngineVersion: null, jsEngineLimitations: null, wasmSupport: null, webglSupport: null, webCryptoSupport: null },
  audioCapabilities: { pcmChannels: null, pcmChannelsOther: null, audioSampleRates: null, audioBitDepths: null, dolbyAudio: null, dolbyAudioOther: null, dtsAudio: null, dtsAudioOther: null, btAudio: null, btAudioOther: null, audioBackgroundBehavior: null, audioBackgroundOther: null },
  accessibility: { ttsApi: null, ttsApiDesc: null, captionFormats: null, captionRendering: null, adTrackSupport: null, focusManagementApi: null },
  platformIntegration: { deepLinkSupport: null, deepLinkDesc: null, voiceAssistant: null, homeScreenIntegration: null, homeScreenDesc: null, continueWatching: null, continueWatchingDesc: null, universalSearch: null, universalSearchDesc: null, recommendationsTiles: null, appAutostart: null },
  performanceBenchmarks: { coldStartTime: null, warmStartTime: null, ttff: null, uiFrameRate: null, uiFrameRateOther: null, concurrentStreams: null, concurrentStreamsDesc: null, memoryBackground: null, benchmarkAvailable: null },
  updatedAt: NOW,
};
