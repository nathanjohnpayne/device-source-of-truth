import type { SpecCategory } from './types';

export type QuestionnaireFieldType = 'text' | 'dropdown' | 'number' | 'date' | 'dateOrText';

export interface QuestionnaireFieldDef {
  key: string;
  fieldId: string;
  label: string;
  type: QuestionnaireFieldType;
  dropdownKey?: string;
  unit?: string;
  parentField?: string;
  conditionalOn?: {
    field: string;
    section: SpecCategory;
    operator: 'notEquals' | 'equals';
    value: string;
  };
  compactGrid?: boolean;
}

export interface QuestionnaireSectionDef {
  key: SpecCategory;
  number: number;
  title: string;
  fields: QuestionnaireFieldDef[];
}

export const QUESTIONNAIRE_SECTIONS: QuestionnaireSectionDef[] = [
  {
    key: 'general',
    number: 1,
    title: 'General',
    fields: [
      { key: 'modelName', fieldId: '1.1', label: 'Model Name (customer-facing)', type: 'text' },
      { key: 'modelNumber', fieldId: '1.2', label: 'Model Number', type: 'text' },
      { key: 'dateDeployed', fieldId: '1.3', label: 'Date STB Initially Deployed to Market', type: 'date' },
      { key: 'dateDeliveriesStopped', fieldId: '1.4', label: 'Date STB Deliveries Stopped', type: 'dateOrText' },
      { key: 'activeDevicesMonthly', fieldId: '1.5', label: 'Active Devices in Use — Monthly Average', type: 'text' },
      { key: 'totalInstalledBase', fieldId: '1.6', label: 'Total Installed Base (subscribers)', type: 'text' },
      { key: 'forecastedGrowth', fieldId: '1.7', label: 'Forecasted Growth/Decline — Next 3 Years', type: 'text' },
      { key: 'countriesDeployed', fieldId: '1.8', label: 'Countries Where Device Is Deployed', type: 'text' },
      { key: 'thirdPartyApps', fieldId: '1.9', label: '3rd Party Apps Deployed & Dev Method', type: 'text' },
      { key: 'connectionType', fieldId: '1.10', label: 'Type of Connection', type: 'dropdown', dropdownKey: 'connection_type' },
      { key: 'connectionTypeOther', fieldId: '1.10a', label: 'Type of Connection — Other (specify)', type: 'text', parentField: 'connectionType' },
    ],
  },
  {
    key: 'hardware',
    number: 2,
    title: 'Hardware',
    fields: [
      { key: 'socVendor', fieldId: '2.1', label: 'SoC Vendor', type: 'dropdown', dropdownKey: 'soc_vendor' },
      { key: 'socVendorOther', fieldId: '2.1a', label: 'SoC Vendor — Other (specify)', type: 'text', parentField: 'socVendor' },
      { key: 'socModelChipset', fieldId: '2.2', label: 'SoC Model & Chipset Revision', type: 'text' },
      { key: 'softwareArchitecture', fieldId: '2.3', label: 'Software Architecture', type: 'dropdown', dropdownKey: 'software_architecture' },
      { key: 'softwareArchitectureOther', fieldId: '2.3a', label: 'Software Architecture — Other (specify)', type: 'text', parentField: 'softwareArchitecture' },
      { key: 'socBaseRefVersion', fieldId: '2.4', label: 'SoC Base Reference Software Version', type: 'text' },
      { key: 'socCustomizations', fieldId: '2.5', label: 'Customizations to SoC Base Reference Software?', type: 'dropdown', dropdownKey: 'yes_no' },
      { key: 'socCustomizationsDesc', fieldId: '2.5a', label: 'SoC Customizations — If Yes, describe', type: 'text', parentField: 'socCustomizations' },
      { key: 'socSupportContract', fieldId: '2.6', label: 'Active SoC Support Contract?', type: 'dropdown', dropdownKey: 'support_contract_status' },
      { key: 'socSupportExpiration', fieldId: '2.6a', label: 'SoC Support Contract Expiration Date', type: 'dateOrText' },
      { key: 'cpuClockRateGhz', fieldId: '2.7a', label: 'CPU Clock Rate', type: 'number', unit: 'GHz' },
      { key: 'cpuDmips', fieldId: '2.7b', label: 'CPU DMIPS Rating', type: 'text' },
      { key: 'cpuCores', fieldId: '2.8', label: 'Number of CPU Cores', type: 'dropdown', dropdownKey: 'cpu_cores' },
      { key: 'cpuCoresOther', fieldId: '2.8a', label: 'CPU Cores — Other (specify)', type: 'text', parentField: 'cpuCores' },
      { key: 'stbManufacturer', fieldId: '2.9', label: 'STB Manufacturer', type: 'text' },
      { key: 'operatingSystem', fieldId: '2.10', label: 'Operating System', type: 'dropdown', dropdownKey: 'operating_system' },
      { key: 'operatingSystemOther', fieldId: '2.10a', label: 'Operating System — Other (specify)', type: 'text', parentField: 'operatingSystem' },
      { key: 'osVersion', fieldId: '2.11', label: 'OS Version', type: 'text' },
      { key: 'osCustomization', fieldId: '2.12', label: 'Customizations to Base OS / Different Kernel?', type: 'dropdown', dropdownKey: 'os_customization' },
      { key: 'osCustomizationDesc', fieldId: '2.12a', label: 'OS Customization — If Yes, describe', type: 'text', parentField: 'osCustomization' },
      { key: 'middlewareProvider', fieldId: '2.13', label: 'Middleware Provider', type: 'dropdown', dropdownKey: 'middleware_provider' },
      { key: 'middlewareProviderOther', fieldId: '2.13a', label: 'Middleware Provider — Other (specify)', type: 'text', parentField: 'middlewareProvider' },
      { key: 'middlewareVersion', fieldId: '2.14', label: 'Middleware Version', type: 'text' },
      { key: 'middlewareContract', fieldId: '2.15', label: 'Middleware Support Contract Active?', type: 'dropdown', dropdownKey: 'middleware_contract' },
      { key: 'middlewareContractExpiration', fieldId: '2.15a', label: 'Middleware Contract Expiration Date', type: 'dateOrText' },
      { key: 'middlewareIntegrationCompany', fieldId: '2.16', label: 'Middleware Integration Company & Support Origin', type: 'text' },
      { key: 'videoDelivery', fieldId: '2.17', label: 'Video Delivery Support', type: 'dropdown', dropdownKey: 'video_delivery' },
      { key: 'videoDeliveryOther', fieldId: '2.17a', label: 'Video Delivery — Other (specify)', type: 'text', parentField: 'videoDelivery' },
      { key: 'memoryTotalGb', fieldId: '2.18a', label: 'Device Memory Total Size', type: 'number', unit: 'GB' },
      { key: 'memoryType', fieldId: '2.18b', label: 'Device Memory Type', type: 'dropdown', dropdownKey: 'memory_type' },
      { key: 'memoryTypeOther', fieldId: '2.18b_o', label: 'Memory Type — Other (specify)', type: 'text', parentField: 'memoryType' },
      { key: 'ramAvailableGb', fieldId: '2.19', label: 'RAM Available to Disney+ App', type: 'number', unit: 'GB' },
      { key: 'linuxMemoryAvailableMb', fieldId: '2.20', label: 'Linux System Memory Available to Disney+ App', type: 'number', unit: 'MB' },
      { key: 'gpuMemoryAvailableMb', fieldId: '2.21', label: 'GPU Memory Available to Disney+ App', type: 'number', unit: 'MB' },
      { key: 'gpuTextureMemoryMb', fieldId: '2.22', label: 'GPU Texture/Graphics Memory Allocated', type: 'number', unit: 'MB' },
      { key: 'gpuMemorySharing', fieldId: '2.23', label: 'GPU Memory: Shared or Dedicated?', type: 'dropdown', dropdownKey: 'gpu_memory_sharing' },
      { key: 'gpuMemorySharingOther', fieldId: '2.23a', label: 'GPU Memory Sharing — Other (specify)', type: 'text', parentField: 'gpuMemorySharing' },
      { key: 'gpuMemoryReservedMb', fieldId: '2.24', label: 'GPU Memory Reserved for Disney', type: 'number', unit: 'MB' },
      { key: 'storageTotalGb', fieldId: '2.25a', label: 'Total Persistent Storage Size', type: 'number', unit: 'GB' },
      { key: 'storageType', fieldId: '2.25b', label: 'Persistent Storage Type', type: 'dropdown', dropdownKey: 'storage_type' },
      { key: 'storageTypeOther', fieldId: '2.25b_o', label: 'Storage Type — Other (specify)', type: 'text', parentField: 'storageType' },
      { key: 'storageAvailableMb', fieldId: '2.26', label: 'Persistent Storage Available to Disney+ App', type: 'number', unit: 'MB' },
      { key: 'nonPersistentStorageMb', fieldId: '2.27', label: 'Non-Persistent Storage Available to Disney+ App', type: 'number', unit: 'MB' },
      { key: 'maxAppBinarySizeMb', fieldId: '2.28', label: 'Maximum Application Binary Size Supported', type: 'number', unit: 'MB' },
      { key: 'filesystemType', fieldId: '2.29', label: 'Persistent Storage Filesystem Type', type: 'dropdown', dropdownKey: 'filesystem_type' },
      { key: 'filesystemTypeOther', fieldId: '2.29a', label: 'Filesystem Type — Other (specify)', type: 'text', parentField: 'filesystemType' },
      { key: 'storageLimitations', fieldId: '2.30', label: 'Persistent Storage Usage Limitations?', type: 'dropdown', dropdownKey: 'yes_no' },
      { key: 'storageLimitationsDesc', fieldId: '2.30a', label: 'Storage Limitations — If Yes, describe', type: 'text', parentField: 'storageLimitations' },
      { key: 'gpuAvailability', fieldId: '2.31a', label: 'GPU Availability Level', type: 'dropdown', dropdownKey: 'gpu_availability' },
      { key: 'gpuAvailableForApp', fieldId: '2.31b', label: 'GPU Available for App Use?', type: 'dropdown', dropdownKey: 'yes_no_unknown' },
      { key: 'gpuGraphicsLibrary', fieldId: '2.32', label: 'GPU Graphics Library Supported', type: 'dropdown', dropdownKey: 'gpu_graphics_library' },
      { key: 'gpuGraphicsLibraryOther', fieldId: '2.32a', label: 'GPU Graphics Library — Other (specify)', type: 'text', parentField: 'gpuGraphicsLibrary' },
      { key: 'openglEs2Apps', fieldId: '2.33', label: 'OTT Apps Confirmed Using OpenGL ES 2.0?', type: 'dropdown', dropdownKey: 'yes_no_unknown' },
      { key: 'openglEs2AppsNames', fieldId: '2.33a', label: 'OpenGL ES 2.0 Apps — If Yes, name apps', type: 'text', parentField: 'openglEs2Apps' },
      { key: 'streamingInterface', fieldId: '2.34', label: 'OTT Streaming Interface', type: 'dropdown', dropdownKey: 'streaming_interface' },
      { key: 'streamingInterfaceOther', fieldId: '2.34a_o', label: 'OTT Streaming Interface — Other (specify)', type: 'text', parentField: 'streamingInterface' },
      { key: 'ethernetPort', fieldId: '2.34a', label: 'Ethernet Port Present?', type: 'dropdown', dropdownKey: 'ethernet_type' },
      { key: 'wifiStandards', fieldId: '2.34b', label: 'Wi-Fi Standards Supported (list all)', type: 'text' },
      { key: 'wifiBands', fieldId: '2.34c', label: 'Wi-Fi Bands Supported (list all)', type: 'text' },
      { key: 'mocaPresent', fieldId: '2.34d', label: 'MoCA Present?', type: 'dropdown', dropdownKey: 'moca_version' },
      { key: 'maxStreamingThroughputMbps', fieldId: '2.35', label: 'Maximum Sustainable Streaming Throughput', type: 'number', unit: 'Mbps' },
      { key: 'hdmiCapabilitiesRetrieval', fieldId: '2.36', label: 'Device Supports Retrieval of HDMI Capabilities?', type: 'dropdown', dropdownKey: 'yes_no_partial_unknown' },
      { key: 'hdmiVersion', fieldId: '2.37', label: 'HDMI Version Supported', type: 'dropdown', dropdownKey: 'hdmi_version' },
      { key: 'hdmiVersionOther', fieldId: '2.37a', label: 'HDMI Version — Other (specify)', type: 'text', parentField: 'hdmiVersion' },
      { key: 'digitalVideoOutputModes', fieldId: '2.38', label: 'Digital Video Output Modes Supported (list all)', type: 'text' },
      { key: 'analogVideoOutputModes', fieldId: '2.39', label: 'Analog Video Output Modes Supported (list all)', type: 'text' },
      { key: 'uiNativeResolution', fieldId: '2.40', label: 'STB UI Native Render Resolution', type: 'dropdown', dropdownKey: 'ui_resolution' },
      { key: 'uiNativeResolutionOther', fieldId: '2.40a', label: 'UI Resolution — Other (specify)', type: 'text', parentField: 'uiNativeResolution' },
      { key: 'ottAppRestrictions', fieldId: '2.41', label: 'OTT App Restrictions on STB Device', type: 'text' },
    ],
  },
  {
    key: 'firmwareUpdates',
    number: 3,
    title: 'Firmware Updates',
    fields: [
      { key: 'firmwareSupported', fieldId: '3.1', label: 'STB Still Supported via Firmware Updates?', type: 'dropdown', dropdownKey: 'firmware_support' },
      { key: 'firmwareFrequency', fieldId: '3.2', label: 'Frequency of Firmware Updates', type: 'dropdown', dropdownKey: 'firmware_frequency' },
      { key: 'firmwareFrequencyOther', fieldId: '3.2a', label: 'Firmware Frequency — Other (specify)', type: 'text', parentField: 'firmwareFrequency' },
      { key: 'internalLeadTime', fieldId: '3.3a', label: 'Time to Release — Internal Lead Time', type: 'text' },
      { key: 'rolloutDuration', fieldId: '3.3b', label: 'Time to Release — Rollout Duration to Homes', type: 'text' },
      { key: 'emergencyUpdate', fieldId: '3.4', label: 'Emergency Firmware Update Capability?', type: 'dropdown', dropdownKey: 'firmware_emergency' },
      { key: 'emergencyUpdateTime', fieldId: '3.4a', label: 'Emergency Update — Time to deploy', type: 'text' },
      { key: 'codeSigning', fieldId: '3.5', label: 'Security Audits / Code Signing Required?', type: 'dropdown', dropdownKey: 'yes_no' },
      { key: 'codeSigningDesc', fieldId: '3.5a', label: 'Code Signing — If Yes, describe process and timeline', type: 'text', parentField: 'codeSigning' },
    ],
  },
  {
    key: 'mediaCodec',
    number: 4,
    title: 'Media Codec Support',
    fields: [
      { key: 'avcH264', fieldId: '4.1', label: 'AVC / H.264 (video)', type: 'dropdown', dropdownKey: 'codec_support', compactGrid: true },
      { key: 'hevcH265', fieldId: '4.2', label: 'HEVC / H.265 (video)', type: 'dropdown', dropdownKey: 'codec_support', compactGrid: true },
      { key: 'eac3DolbyDigitalPlus', fieldId: '4.3', label: 'E-AC-3 / Dolby Digital Plus (audio)', type: 'dropdown', dropdownKey: 'codec_support', compactGrid: true },
      { key: 'eac3Atmos', fieldId: '4.4', label: 'E-AC-3 with Atmos (audio) — Optional', type: 'dropdown', dropdownKey: 'codec_support', compactGrid: true },
      { key: 'hdr10', fieldId: '4.5', label: 'HDR10', type: 'dropdown', dropdownKey: 'codec_support', compactGrid: true },
      { key: 'hdr10Plus', fieldId: '4.6', label: 'HDR10+', type: 'dropdown', dropdownKey: 'codec_support', compactGrid: true },
      { key: 'av1', fieldId: '4.7', label: 'AV1', type: 'dropdown', dropdownKey: 'codec_support', compactGrid: true },
      { key: 'dolbyVisionSupported', fieldId: '4.8', label: 'Dolby Vision Supported?', type: 'dropdown', dropdownKey: 'yes_no_partial_unknown' },
      { key: 'dolbyVisionVersion', fieldId: '4.8a', label: 'Dolby Vision Version (e.g. 8.1)', type: 'text' },
    ],
  },
  {
    key: 'frameRates',
    number: 5,
    title: 'Supported Output Frame Rates',
    fields: [
      { key: 'outputRefreshRates', fieldId: '5.1', label: 'Video Output Refresh Rates Supported (list all)', type: 'text' },
      { key: 'userRefreshRateSettings', fieldId: '5.2', label: 'User Settings for Output Refresh Rate (list all)', type: 'text' },
      { key: 'frameRateAdjust', fieldId: '5.3', label: 'Device Adjusts Output Rate to Match Content?', type: 'dropdown', dropdownKey: 'frame_rate_adjust' },
      { key: 'frameRateAdjustOther', fieldId: '5.3a', label: 'Frame Rate Adjustment — Other (specify)', type: 'text', parentField: 'frameRateAdjust' },
      { key: 'frameRateConvert', fieldId: '5.4', label: 'Device Converts Content Frame Rate to Fixed Output?', type: 'dropdown', dropdownKey: 'frame_rate_convert' },
      { key: 'frameRateConvertFixed', fieldId: '5.4a', label: 'Fixed Output Rate — If Yes, which fixed rate?', type: 'text', parentField: 'frameRateConvert' },
      { key: 'appDetermineRefreshRate', fieldId: '5.5', label: 'Apps Can Programmatically Determine Output Refresh Rate?', type: 'dropdown', dropdownKey: 'yes_no_partial_unknown' },
      { key: 'appSetRefreshRate', fieldId: '5.6', label: 'Apps Can Programmatically Set Output Refresh Rate?', type: 'dropdown', dropdownKey: 'yes_no_partial_unknown' },
    ],
  },
  {
    key: 'contentProtection',
    number: 6,
    title: 'Content Protection & Security',
    fields: [
      { key: 'drmSystem', fieldId: '6.1', label: 'DRM to Be Used for Disney+', type: 'dropdown', dropdownKey: 'drm_system' },
      { key: 'encryptionScheme', fieldId: '6.1a', label: 'DRM Encryption Scheme (CTR / CBCS / Both)', type: 'dropdown', dropdownKey: 'encryption_scheme' },
      { key: 'playreadySupported', fieldId: '6.2a', label: 'PlayReady Supported?', type: 'dropdown', dropdownKey: 'yes_no' },
      { key: 'playreadyVersion', fieldId: '6.2b', label: 'PlayReady Version', type: 'dropdown', dropdownKey: 'playready_version' },
      { key: 'playreadySecurityLevel', fieldId: '6.2c', label: 'PlayReady Security Level', type: 'dropdown', dropdownKey: 'playready_security_level' },
      { key: 'playreadyEncryption', fieldId: '6.2d', label: 'PlayReady Encryption Scheme', type: 'dropdown', dropdownKey: 'encryption_scheme' },
      { key: 'widevineSupported', fieldId: '6.3a', label: 'Widevine Supported?', type: 'dropdown', dropdownKey: 'yes_no' },
      { key: 'widevineSecurityLevel', fieldId: '6.3b', label: 'Widevine Security Level', type: 'dropdown', dropdownKey: 'widevine_security_level' },
      { key: 'widevineVersion', fieldId: '6.3c', label: 'Widevine Version', type: 'text' },
      { key: 'widevineEncryption', fieldId: '6.3d', label: 'Widevine Encryption Scheme', type: 'dropdown', dropdownKey: 'encryption_scheme' },
      { key: 'drmHwLevel', fieldId: '6.4', label: 'PlayReady SL3000 and/or Widevine L1 Supported?', type: 'dropdown', dropdownKey: 'drm_hw_level' },
      { key: 'cbcsSupport', fieldId: '6.5', label: 'PlayReady 4.0+ / Widevine 3.1+ with CBCS?', type: 'dropdown', dropdownKey: 'cbcs_support' },
      { key: 'multiKeyCtr', fieldId: '6.6', label: 'Multi-Key CTR Supported?', type: 'dropdown', dropdownKey: 'yes_no_unknown' },
      { key: 'multiKeyCtrMax', fieldId: '6.6a', label: 'Multi-Key CTR — Max keys simultaneously bound', type: 'number' },
      { key: 'digitalVideoOutput', fieldId: '6.7', label: 'Digital Video Output?', type: 'dropdown', dropdownKey: 'yes_no' },
      { key: 'hdcpVersion', fieldId: '6.8', label: 'Digital Video Output Copy Protection Protocol', type: 'dropdown', dropdownKey: 'hdcp_version' },
      { key: 'hdcpType', fieldId: '6.8a', label: 'HDCP Type (if applicable)', type: 'text' },
      { key: 'otherDrms', fieldId: '6.9', label: 'Other DRMs Supported (version and type)', type: 'text' },
      { key: 'broadcomSage', fieldId: '6.10', label: 'Broadcom SAGE Security Coprocessor', type: 'dropdown', dropdownKey: 'yes_no_unknown_na' },
      { key: 'secureFirmwareDownload', fieldId: '6.11', label: 'Secure Firmware Download', type: 'dropdown', dropdownKey: 'yes_no_unknown' },
      { key: 'signedFirmwareSecureBoot', fieldId: '6.12', label: 'Signed Firmware / Secure Boot', type: 'dropdown', dropdownKey: 'yes_no_unknown' },
      { key: 'hardwareRootOfTrust', fieldId: '6.13', label: 'Hardware Root of Trust for DRM Certificate Chain', type: 'dropdown', dropdownKey: 'yes_no_unknown' },
      { key: 'tamperResistantCode', fieldId: '6.14', label: 'Tamper Resistant Code', type: 'dropdown', dropdownKey: 'yes_no_unknown' },
      { key: 'tee', fieldId: '6.15', label: 'Trusted Execution Environment (TEE)', type: 'dropdown', dropdownKey: 'yes_no_unknown', compactGrid: true },
      { key: 'secureVideoPath', fieldId: '6.16', label: 'Secure Video Path', type: 'dropdown', dropdownKey: 'yes_no_unknown', compactGrid: true },
      { key: 'rootedDeviceProtection', fieldId: '6.17', label: 'Rooted Device Protection', type: 'dropdown', dropdownKey: 'yes_no_unknown', compactGrid: true },
      { key: 'appCodeSigning', fieldId: '6.18', label: 'App Code Signing', type: 'dropdown', dropdownKey: 'yes_no_unknown', compactGrid: true },
      { key: 'sideloadingRestricted', fieldId: '6.19', label: 'Installation Restrictions / Sideloading Restricted', type: 'dropdown', dropdownKey: 'yes_no_unknown', compactGrid: true },
      { key: 'digitalOutputProtection', fieldId: '6.20', label: 'Digital Output Protection Enforcement', type: 'dropdown', dropdownKey: 'yes_no_unknown', compactGrid: true },
      { key: 'encryptedAudio', fieldId: '6.21', label: 'Encrypted Audio', type: 'dropdown', dropdownKey: 'yes_no_unknown', compactGrid: true },
      { key: 'secureBootJtag', fieldId: '6.22', label: 'Secure Boot / JTAG Disabled / DRAM Scrambling', type: 'dropdown', dropdownKey: 'secure_boot_jtag' },
    ],
  },
  {
    key: 'native',
    number: 7,
    title: 'Native (ADK / Broadcom-Specific)',
    fields: [
      { key: 'adkPortPossible', fieldId: '7.1', label: 'SoC Toolchain & Ref Software ADK Port Possible?', type: 'dropdown', dropdownKey: 'yes_no_partial_unknown' },
      { key: 'ursrModification', fieldId: '7.2', label: 'URSR, Kernel or Toolchain Modified?', type: 'dropdown', dropdownKey: 'ursr_modification' },
      { key: 'ursrModificationOther', fieldId: '7.2a', label: 'Toolchain Modification — Other (specify)', type: 'text', parentField: 'ursrModification' },
      { key: 'nexusVideoApis', fieldId: '7.3', label: 'Direct Access to Broadcom Nexus Video APIs?', type: 'dropdown', dropdownKey: 'yes_no_partial_na' },
      { key: 'sageApiAccess', fieldId: '7.4', label: 'Sage API Access Offered?', type: 'dropdown', dropdownKey: 'yes_no_unknown_na' },
      { key: 'audioDetectionApi', fieldId: '7.5', label: 'Audio Detection API (Stereo, 5.1, Atmos)?', type: 'dropdown', dropdownKey: 'audio_detection_api' },
      { key: 'drmBroadcomRefApi', fieldId: '7.6', label: 'DRM Implementation Uses Broadcom Reference API?', type: 'dropdown', dropdownKey: 'yes_no_partial_na' },
    ],
  },
  {
    key: 'videoPlayback',
    number: 8,
    title: 'Video Playback',
    fields: [
      { key: 'avcBitrateLimitations', fieldId: '8.1', label: 'AVC Bitrate Limitations', type: 'text' },
      { key: 'avcFrameRateLimitations', fieldId: '8.2', label: 'AVC Frame Rate / Resolution Limitations', type: 'text' },
      { key: 'hevcBitrateLimitations', fieldId: '8.3', label: 'HEVC Bitrate Limitations', type: 'text' },
      { key: 'hevcFrameRateLimitations', fieldId: '8.4', label: 'HEVC Frame Rate / Resolution Limitations', type: 'text' },
      { key: 'eac3BitrateLimitations', fieldId: '8.5', label: 'E-AC-3 Bitrate Limitations', type: 'text' },
      { key: 'playbackEncryption', fieldId: '8.6', label: 'Playback Encryption Type', type: 'dropdown', dropdownKey: 'playback_encryption' },
      { key: 'playbackEncryptionOther', fieldId: '8.6a', label: 'Playback Encryption — Other (specify)', type: 'text', parentField: 'playbackEncryption' },
      { key: 'eac3MseCmaf', fieldId: '8.7', label: 'E-AC-3 via MSE: Native and CMAF Supported?', type: 'dropdown', dropdownKey: 'mse_cmaf_support' },
      { key: 'eac3DecodeMode', fieldId: '8.8', label: 'E-AC-3: On-Device Decode, Bitstream, or Both?', type: 'dropdown', dropdownKey: 'eac3_decode_mode' },
      { key: 'atmosSupported', fieldId: '8.9', label: 'Dolby Atmos Supported?', type: 'dropdown', dropdownKey: 'atmos_support' },
      { key: 'dolbyVisionProfiles', fieldId: '8.10', label: 'Dolby Vision Profiles Supported (list all)', type: 'text' },
      { key: 'dolbyVisionIdkSdkVersion', fieldId: '8.10a', label: 'Dolby Vision IDK/SDK Version', type: 'text' },
      { key: 'playreadyCdmVersion', fieldId: '8.11', label: 'PlayReady CDM Version (if below 4.0)', type: 'dropdown', dropdownKey: 'playready_cdm_version' },
      { key: 'playreadyCbcsConfirmed', fieldId: '8.12', label: 'PlayReady 4.0+ CDM: CBCS Confirmed?', type: 'dropdown', dropdownKey: 'cbcs_confirmed' },
      { key: 'widevineCdmVersion', fieldId: '8.13a', label: 'Widevine CDM Version (if below 3.1)', type: 'text' },
      { key: 'widevineCdmCategory', fieldId: '8.13b', label: 'Widevine CDM Category', type: 'dropdown', dropdownKey: 'widevine_cdm_category' },
      { key: 'widevineCbcsConfirmed', fieldId: '8.14', label: 'Widevine 3.1 CDM: CBCS Confirmed?', type: 'dropdown', dropdownKey: 'cbcs_confirmed' },
      { key: 'securitySecureBoot', fieldId: '8.15a', label: 'Security: Secure Boot (if PlayReady not SL3000)', type: 'dropdown', dropdownKey: 'yes_no_na', conditionalOn: { field: 'playreadySecurityLevel', section: 'contentProtection', operator: 'notEquals', value: 'SL3000' } },
      { key: 'securityHwRootOfTrust', fieldId: '8.15b', label: 'Security: Hardware Root of Trust', type: 'dropdown', dropdownKey: 'yes_no_na', conditionalOn: { field: 'playreadySecurityLevel', section: 'contentProtection', operator: 'notEquals', value: 'SL3000' } },
      { key: 'securitySecureKeyStorage', fieldId: '8.15c', label: 'Security: Secure Key Storage', type: 'dropdown', dropdownKey: 'yes_no_na', conditionalOn: { field: 'playreadySecurityLevel', section: 'contentProtection', operator: 'notEquals', value: 'SL3000' } },
      { key: 'securitySecureDecryption', fieldId: '8.15d', label: 'Security: Secure Decryption (TEE)', type: 'dropdown', dropdownKey: 'yes_no_na', conditionalOn: { field: 'playreadySecurityLevel', section: 'contentProtection', operator: 'notEquals', value: 'SL3000' } },
      { key: 'securitySecureVideoPath', fieldId: '8.15e', label: 'Security: Secure Video Path', type: 'dropdown', dropdownKey: 'yes_no_na', conditionalOn: { field: 'playreadySecurityLevel', section: 'contentProtection', operator: 'notEquals', value: 'SL3000' } },
      { key: 'securityHdcp', fieldId: '8.15f', label: 'Security: HDCP (if digital output)', type: 'dropdown', dropdownKey: 'yes_no_na', conditionalOn: { field: 'playreadySecurityLevel', section: 'contentProtection', operator: 'notEquals', value: 'SL3000' } },
      { key: 'html5CapabilityDetection', fieldId: '8.16', label: 'HTML5/Platform API for Capability Detection', type: 'text' },
    ],
  },
  {
    key: 'uhdHdr',
    number: 9,
    title: 'UHD HDR',
    fields: [
      { key: 'hdrTechnologies', fieldId: '9.1', label: 'HDR Technologies Supported (list all)', type: 'text' },
      { key: 'uhdSubscriberPercent', fieldId: '9.2', label: '% UHD Subscribers with UHD-Capable Displays', type: 'number', unit: '%' },
      { key: 'hdrNativeUi', fieldId: '9.3', label: 'Device Supports HDR-Native UI?', type: 'dropdown', dropdownKey: 'yes_no_partial_unknown' },
      { key: 'displayRangeApi', fieldId: '9.4', label: 'API for Display Video Range Capabilities?', type: 'dropdown', dropdownKey: 'yes_no_partial_unknown' },
      { key: 'displayRangeApiDesc', fieldId: '9.4a', label: 'Display Range API — If Yes, describe', type: 'text', parentField: 'displayRangeApi' },
      { key: 'hdrTransform', fieldId: '9.5', label: 'SDR-HDR Upmap / Downmap / Format Transform?', type: 'dropdown', dropdownKey: 'hdr_transform' },
      { key: 'hdrTransformOther', fieldId: '9.5a', label: 'HDR Transform — Other (specify)', type: 'text', parentField: 'hdrTransform' },
      { key: 'hdrModeSwitch', fieldId: '9.6', label: 'HDR Mode-Switch Behavior', type: 'dropdown', dropdownKey: 'hdr_mode_switch' },
      { key: 'hdrModeSwitchOther', fieldId: '9.6a', label: 'HDR Mode-Switch — Other (specify)', type: 'text', parentField: 'hdrModeSwitch' },
      { key: 'videoRangeRender', fieldId: '9.7', label: 'Device Rendering Behavior for Video Range', type: 'dropdown', dropdownKey: 'video_range_render' },
      { key: 'videoRangeRenderOther', fieldId: '9.7a', label: 'Video Range Render — Other (specify)', type: 'text', parentField: 'videoRangeRender' },
      { key: 'hdrHelpResources', fieldId: '9.8', label: 'Operator Help Resources for HDR Setup', type: 'text' },
      { key: 'hdrUserSettings', fieldId: '9.9', label: 'HDR-Related User Settings at Device Level', type: 'text' },
      { key: 'colorSpace', fieldId: '9.10', label: 'Color Space Used to Render the UI', type: 'dropdown', dropdownKey: 'color_space' },
      { key: 'colorSpaceOther', fieldId: '9.10a', label: 'Color Space — Other (specify)', type: 'text', parentField: 'colorSpace' },
      { key: 'existingHdrApps', fieldId: '9.11', label: 'Existing Apps That Support HDR on Device?', type: 'dropdown', dropdownKey: 'yes_no_unknown' },
      { key: 'existingHdrAppsNames', fieldId: '9.11a', label: 'HDR Apps — If Yes, list apps', type: 'text', parentField: 'existingHdrApps' },
      { key: 'publicHdrResources', fieldId: '9.12', label: 'Public HDR Support Resource Links', type: 'text' },
      { key: 'hdrCompositing', fieldId: '9.13', label: 'SDR/HDR Graphics Composited with HDR Video?', type: 'dropdown', dropdownKey: 'hdr_compositing' },
      { key: 'graphicsPlaneResolution', fieldId: '9.14', label: 'App Graphics Plane Resolution During Playback', type: 'dropdown', dropdownKey: 'graphics_plane_resolution' },
      { key: 'graphicsPlaneResolutionOther', fieldId: '9.14a', label: 'Graphics Plane Resolution — Other (specify)', type: 'text', parentField: 'graphicsPlaneResolution' },
    ],
  },
  {
    key: 'audioVideoOutput',
    number: 10,
    title: 'Global Device Audio/Video Output Control',
    fields: [
      { key: 'displayOutputSettings', fieldId: '10.1', label: 'Display Output Resolution/Mode Settings (list all)', type: 'text' },
      { key: 'videoDecodeSettings', fieldId: '10.2', label: 'Video Decode Feature Settings (list all)', type: 'text' },
      { key: 'audioDecodeSettings', fieldId: '10.3', label: 'Audio Decode Feature Settings (list all)', type: 'text' },
      { key: 'aspectRatioSettings', fieldId: '10.4', label: 'Video Output Aspect Ratio Settings (list all)', type: 'text' },
      { key: 'uiResolutionSettings', fieldId: '10.5', label: 'UI Resolution Settings (list all)', type: 'text' },
      { key: 'alternateAudioPath', fieldId: '10.6', label: 'Alternate Audio Path / Output Settings (list all)', type: 'text' },
      { key: 'audioSyncSettings', fieldId: '10.7', label: 'Audio Output Synchronization Settings', type: 'dropdown', dropdownKey: 'audio_sync_settings' },
      { key: 'audioSyncRange', fieldId: '10.7a', label: 'Audio Sync — If adjustable, range and step values', type: 'text', parentField: 'audioSyncSettings' },
    ],
  },
  {
    key: 'other',
    number: 11,
    title: 'Other',
    fields: [
      { key: 'voltageRange', fieldId: '11.1', label: 'Voltage Range', type: 'dropdown', dropdownKey: 'voltage_range' },
      { key: 'voltageRangeOther', fieldId: '11.1a', label: 'Voltage Range — Other (specify)', type: 'text', parentField: 'voltageRange' },
      { key: 'rcuType', fieldId: '11.2', label: 'Remote Control Unit (RCU) Type (list all)', type: 'text' },
      { key: 'bluetoothPresent', fieldId: '11.2a', label: 'Bluetooth Present on Device?', type: 'dropdown', dropdownKey: 'yes_no' },
      { key: 'bluetoothVersion', fieldId: '11.2b', label: 'Bluetooth Version', type: 'dropdown', dropdownKey: 'bluetooth_version' },
      { key: 'bluetoothVersionOther', fieldId: '11.2b_o', label: 'Bluetooth Version — Other (specify)', type: 'text', parentField: 'bluetoothVersion' },
      { key: 'bluetoothProfiles', fieldId: '11.2c', label: 'Bluetooth Profiles Supported (list all)', type: 'text' },
      { key: 'bluetoothUsedFor', fieldId: '11.2d', label: 'Bluetooth Used For (list all)', type: 'text' },
      { key: 'otherVideoOutputs', fieldId: '11.3', label: 'Other Video Outputs Supported (list all)', type: 'text' },
      { key: 'otherAudioOutputs', fieldId: '11.4', label: 'Other Audio Outputs Supported (list all)', type: 'text' },
      { key: 'otherVideoOutputProtection', fieldId: '11.5', label: 'Other Video Output Interface Protection', type: 'text' },
      { key: 'otherVideoOutputDisney', fieldId: '11.6', label: 'Other Video Outputs Where Disney+ Expected', type: 'text' },
    ],
  },
  {
    key: 'appRuntime',
    number: 12,
    title: 'App Runtime / Web Engine',
    fields: [
      { key: 'webEngine', fieldId: '12.1', label: 'HTML5 Browser / Web Engine Used', type: 'dropdown', dropdownKey: 'web_engine' },
      { key: 'webEngineVersion', fieldId: '12.1a', label: 'Web Engine Version', type: 'text' },
      { key: 'adkVersion', fieldId: '12.2', label: 'ADK Version Supported', type: 'text' },
      { key: 'mseSupport', fieldId: '12.3', label: 'MSE (Media Source Extensions) Supported?', type: 'dropdown', dropdownKey: 'mse_support' },
      { key: 'mseLimitations', fieldId: '12.3a', label: 'MSE — If Partial, describe limitations', type: 'text', parentField: 'mseSupport' },
      { key: 'emeSupport', fieldId: '12.4', label: 'EME (Encrypted Media Extensions) Supported?', type: 'dropdown', dropdownKey: 'yes_no_partial_unknown' },
      { key: 'emeLimitations', fieldId: '12.4a', label: 'EME — If Partial, describe limitations', type: 'text', parentField: 'emeSupport' },
      { key: 'jsEngine', fieldId: '12.5', label: 'JavaScript Engine', type: 'dropdown', dropdownKey: 'js_engine' },
      { key: 'jsEngineVersion', fieldId: '12.5a', label: 'JavaScript Engine Version', type: 'text' },
      { key: 'jsEngineLimitations', fieldId: '12.6', label: 'Known JavaScript Engine Limitations', type: 'text' },
      { key: 'wasmSupport', fieldId: '12.7', label: 'WebAssembly (WASM) Supported?', type: 'dropdown', dropdownKey: 'yes_no_partial_unknown' },
      { key: 'webglSupport', fieldId: '12.8', label: 'WebGL Supported?', type: 'dropdown', dropdownKey: 'webgl_support' },
      { key: 'webCryptoSupport', fieldId: '12.9', label: 'Web Crypto API Supported?', type: 'dropdown', dropdownKey: 'yes_no_partial_unknown' },
    ],
  },
  {
    key: 'audioCapabilities',
    number: 13,
    title: 'Audio Capabilities',
    fields: [
      { key: 'pcmChannels', fieldId: '13.1', label: 'PCM Output Maximum Channel Count', type: 'dropdown', dropdownKey: 'pcm_channels' },
      { key: 'pcmChannelsOther', fieldId: '13.1a', label: 'PCM Channels — Other (specify)', type: 'text', parentField: 'pcmChannels' },
      { key: 'audioSampleRates', fieldId: '13.2', label: 'Supported Audio Sample Rates (list all)', type: 'text' },
      { key: 'audioBitDepths', fieldId: '13.3', label: 'Supported Audio Bit Depths (list all)', type: 'text' },
      { key: 'dolbyAudio', fieldId: '13.4', label: 'Dolby Audio Supported?', type: 'dropdown', dropdownKey: 'dolby_audio_support' },
      { key: 'dolbyAudioOther', fieldId: '13.4a', label: 'Dolby Audio — Other (specify)', type: 'text', parentField: 'dolbyAudio' },
      { key: 'dtsAudio', fieldId: '13.5', label: 'DTS Audio Supported?', type: 'dropdown', dropdownKey: 'dts_audio_support' },
      { key: 'dtsAudioOther', fieldId: '13.5a', label: 'DTS Audio — Other (specify)', type: 'text', parentField: 'dtsAudio' },
      { key: 'btAudio', fieldId: '13.6', label: 'Bluetooth Audio Output Supported?', type: 'dropdown', dropdownKey: 'bt_audio_support' },
      { key: 'btAudioOther', fieldId: '13.6a', label: 'Bluetooth Audio — Other (specify)', type: 'text', parentField: 'btAudio' },
      { key: 'audioBackgroundBehavior', fieldId: '13.7', label: 'Audio Behavior When Disney+ App Backgrounded', type: 'dropdown', dropdownKey: 'audio_background_behavior' },
      { key: 'audioBackgroundOther', fieldId: '13.7a', label: 'Audio Background — Other (specify)', type: 'text', parentField: 'audioBackgroundBehavior' },
    ],
  },
  {
    key: 'accessibility',
    number: 14,
    title: 'Accessibility',
    fields: [
      { key: 'ttsApi', fieldId: '14.1', label: 'Text-to-Speech (TTS) API Available?', type: 'dropdown', dropdownKey: 'tts_api' },
      { key: 'ttsApiDesc', fieldId: '14.1a', label: 'TTS API — If Yes, describe API or engine', type: 'text', parentField: 'ttsApi' },
      { key: 'captionFormats', fieldId: '14.2', label: 'Closed Caption / Subtitle Formats (list all)', type: 'text' },
      { key: 'captionRendering', fieldId: '14.3', label: 'Caption Rendering: On-Device or App-Rendered?', type: 'dropdown', dropdownKey: 'caption_rendering' },
      { key: 'adTrackSupport', fieldId: '14.4', label: 'Audio Description (AD) Track Support?', type: 'dropdown', dropdownKey: 'ad_track_support' },
      { key: 'focusManagementApi', fieldId: '14.6', label: 'Focus Management / D-Pad Navigation API?', type: 'dropdown', dropdownKey: 'focus_management_api' },
    ],
  },
  {
    key: 'platformIntegration',
    number: 15,
    title: 'Platform & Home Screen Integration',
    fields: [
      { key: 'deepLinkSupport', fieldId: '15.1', label: 'Deep Link Support into Disney+ App?', type: 'dropdown', dropdownKey: 'deep_link_support' },
      { key: 'deepLinkDesc', fieldId: '15.1a', label: 'Deep Link — If Yes, describe scheme or format', type: 'text', parentField: 'deepLinkSupport' },
      { key: 'voiceAssistant', fieldId: '15.2', label: 'Voice Assistant Integration (list all)', type: 'text' },
      { key: 'homeScreenIntegration', fieldId: '15.3', label: 'Home Screen / Launcher Integration?', type: 'dropdown', dropdownKey: 'home_screen_integration' },
      { key: 'homeScreenDesc', fieldId: '15.3a', label: 'Home Screen Integration — If Yes, describe', type: 'text', parentField: 'homeScreenIntegration' },
      { key: 'continueWatching', fieldId: '15.4', label: 'Continue Watching Row on Home Screen?', type: 'dropdown', dropdownKey: 'continue_watching' },
      { key: 'continueWatchingDesc', fieldId: '15.4a', label: 'Continue Watching — If Yes, describe API or feed', type: 'text', parentField: 'continueWatching' },
      { key: 'universalSearch', fieldId: '15.5', label: 'Universal Search / Discovery Integration?', type: 'dropdown', dropdownKey: 'universal_search' },
      { key: 'universalSearchDesc', fieldId: '15.5a', label: 'Universal Search — If Yes, describe data format', type: 'text', parentField: 'universalSearch' },
      { key: 'recommendationsTiles', fieldId: '15.6', label: 'Recommendations / Editorial Tiles on Home Screen?', type: 'dropdown', dropdownKey: 'recommendations_tiles' },
      { key: 'appAutostart', fieldId: '15.7', label: 'App Autostart / Preload Supported?', type: 'dropdown', dropdownKey: 'app_autostart' },
    ],
  },
  {
    key: 'performanceBenchmarks',
    number: 16,
    title: 'Performance Benchmarks',
    fields: [
      { key: 'coldStartTime', fieldId: '16.1', label: 'App Cold Start Time (launch to interactive UI)', type: 'text' },
      { key: 'warmStartTime', fieldId: '16.2', label: 'App Warm Start Time (background to interactive UI)', type: 'text' },
      { key: 'ttff', fieldId: '16.3', label: 'Time to First Frame (TTFF) for Video Playback', type: 'text' },
      { key: 'uiFrameRate', fieldId: '16.4', label: 'UI Target Frame Rate', type: 'dropdown', dropdownKey: 'ui_frame_rate' },
      { key: 'uiFrameRateOther', fieldId: '16.4a', label: 'UI Target Frame Rate — Other (specify)', type: 'text', parentField: 'uiFrameRate' },
      { key: 'concurrentStreams', fieldId: '16.5', label: 'Concurrent Stream Handling', type: 'dropdown', dropdownKey: 'concurrent_streams' },
      { key: 'concurrentStreamsDesc', fieldId: '16.5a', label: 'Concurrent Streams — If Limited, describe', type: 'text', parentField: 'concurrentStreams' },
      { key: 'memoryBackground', fieldId: '16.6', label: 'App Memory Behavior When Backgrounded', type: 'dropdown', dropdownKey: 'memory_background' },
      { key: 'benchmarkAvailable', fieldId: '16.7', label: 'Performance Benchmarks / Lab Data Available?', type: 'dropdown', dropdownKey: 'benchmark_available' },
    ],
  },
];

export function buildEmptySpec(): Record<string, Record<string, null>> {
  const spec: Record<string, Record<string, null>> = {};
  for (const section of QUESTIONNAIRE_SECTIONS) {
    const sectionData: Record<string, null> = {};
    for (const field of section.fields) {
      sectionData[field.key] = null;
    }
    spec[section.key] = sectionData;
  }
  return spec;
}

export function getTotalFieldCount(): number {
  return QUESTIONNAIRE_SECTIONS.reduce((sum, s) => sum + s.fields.length, 0);
}

/** Flat lookup of field key → unit string (e.g. 'GHz', 'MB'). Used by DeviceDetailPage. */
export const SPEC_FIELD_UNITS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const section of QUESTIONNAIRE_SECTIONS) {
    for (const field of section.fields) {
      if (field.unit) map[field.key] = field.unit;
    }
  }
  return map;
})();
