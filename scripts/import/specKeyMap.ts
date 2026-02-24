// Maps description strings from questionnaires to canonical Device field names.
// Keys are lowercased and trimmed for fuzzy matching.

export const specKeyMap: Record<string, string> = {
  // General
  'model name of device': 'modelName',
  'model name': 'modelName',
  'device model': 'modelName',
  'consumer facing device name': 'modelName',
  'model number of device': 'modelNumber',
  'model number': 'modelNumber',
  'brand name': 'manufacturer',
  'stb vendor': 'manufacturer',
  'stb manufacturer': 'manufacturer',
  'manufacturer': 'manufacturer',
  'date stb initially deployed': 'deploymentDate',
  'date stb deliveries stopped': 'deliveryEndDate',
  'date device initially deployed': 'deploymentDate',
  'date device deliveries ended': 'deliveryEndDate',
  'number of devices in use': 'activeDeviceCount',
  'active device count': 'activeDeviceCount',
  'number of subscribers with device': 'subscriberCount',
  'number of subscribers': 'subscriberCount',
  'countries where device deployed': 'countries',
  'countries where device is deployed': 'countries',
  'other 3rd party apps deployed': 'thirdPartyApps',
  'other 3rd party apps': 'thirdPartyApps',
  '3rd party apps on device': 'thirdPartyApps',
  'type of connection': 'connectionType',
  'connection type': 'connectionType',

  // Hardware - SoC
  'soc vendor': 'socVendor',
  'soc vendor / chipset maker': 'socVendor',
  'chipset vendor': 'socVendor',
  'soc model and chipset revision': 'socModel',
  'soc model': 'socModel',
  'chipset / soc': 'socModel',
  'chipset': 'socModel',
  'soc base reference software version': 'socRevision',
  'are there customizations to soc?': '_socCustomizations',
  'does partner have soc support contract?': '_socSupportContract',
  'cpu speed': 'cpuSpeedDmips',
  'cpu speed (dmips)': 'cpuSpeedDmips',
  'speed': 'cpuSpeedDmips',
  'number of cpu cores': 'cpuCores',
  'cpu cores': 'cpuCores',
  'cores': 'cpuCores',

  // Hardware - OS & Middleware
  'operating system': 'osName',
  'os version': 'osVersion',
  'os or firmware version': 'osVersion',
  'are there customizations to base os?': '_osCustomizations',
  'middleware provider': 'middlewareProvider',
  'middleware version': 'middlewareVersion',
  'is middleware support contract active?': '_middlewareSupportActive',
  'middleware integration company/partner': '_middlewareIntegrator',

  // Hardware - Memory & Storage
  'device memory / memory type': 'memoryRaw',
  'device memory': 'memoryRaw',
  'total system memory (ram)': 'memoryRaw',
  'system memory': 'memoryRaw',
  'ram memory available to disney+': 'ramForDisneyMb',
  'ram available for disney+': 'ramForDisneyMb',
  'memory available for disney+ app': 'ramForDisneyMb',
  'ram available to disney+': 'ramForDisneyMb',
  'how much ram is available for disney+?': 'ramForDisneyMb',
  'how much ram is made available to the disney+ app?': 'ramForDisneyMb',
  'total persistent storage size & type': 'storageRaw',
  'total persistent storage': 'storageRaw',
  'flash / storage size': 'storageRaw',
  'flash': 'storageRaw',
  'total persistent storage available to disney+': '_storageForDisney',
  'total non-persistent storage available': '_nonPersistentStorage',
  'maximum application binary size': '_maxAppBinarySize',

  // Hardware - Other
  'hdmi version': 'hdmiVersion',
  'hdmi output version': 'hdmiVersion',
  'device support video delivery': '_videoDeliveryType',
  'gpu capabilities': '_gpuCapabilities',
  'network interfaces': '_networkInterfaces',

  // Media Codecs - LONG FORM
  'is avc (h.264) supported?': 'supportsH264',
  'avc (h.264) supported': 'supportsH264',
  'h.264 / avc support': 'supportsH264',
  'is hevc (h.265) supported?': 'supportsH265',
  'hevc (h.265) supported': 'supportsH265',
  'h.265 / hevc support': 'supportsH265',
  'is e-ac-3 supported?': 'supportsEAC3',
  'e-ac-3 supported': 'supportsEAC3',
  'e-ac-3 support': 'supportsEAC3',
  'is e-ac-3 atmos (joc) supported?': 'supportsDolbyAtmos',
  'dolby atmos supported': 'supportsDolbyAtmos',
  'dolby atmos support': 'supportsDolbyAtmos',
  'e-ac-3 atmos (joc) supported': 'supportsDolbyAtmos',

  // Media Codecs - SHORT FORM (from questionnaires)
  'avc (video)': 'supportsH264',
  'avc': 'supportsH264',
  'hevc (video)': 'supportsH265',
  'hevc': 'supportsH265',
  'e-ac-3 (audio)': 'supportsEAC3',
  'e-ac-3': 'supportsEAC3',
  'e-ac-3 w/atmos (audio) (optional)': 'supportsDolbyAtmos',
  'e-ac-3 w/atmos (audio)': 'supportsDolbyAtmos',
  'e-ac-3 w/atmos': 'supportsDolbyAtmos',
  'e-ac-3 atmos': 'supportsDolbyAtmos',
  'dolby atmos': 'supportsDolbyAtmos',
  'is dolby atmos supported?': 'supportsDolbyAtmos',

  // HDR - LONG FORM
  'is hdr10 supported?': 'supportsHDR10',
  'hdr10 supported': 'supportsHDR10',
  'hdr10 support': 'supportsHDR10',
  'is dolby vision supported?': 'supportsDolbyVision',
  'dolby vision supported': 'supportsDolbyVision',
  'dolby vision support': 'supportsDolbyVision',
  'dolby vision profiles supported': 'dolbyVisionProfiles',
  'if dolby vision is supported, please indicate which profiles are supported': 'dolbyVisionProfiles',
  'is hlg supported?': 'supportsHLG',
  'hlg supported': 'supportsHLG',
  'hlg support': 'supportsHLG',
  'is hdr10+ supported?': 'supportsHDR10Plus',
  'hdr10+ supported': 'supportsHDR10Plus',
  'hdr10+ support': 'supportsHDR10Plus',

  // HDR - SHORT FORM & compound fields
  'hdr10 and/or dolby vision (uhd)': '_hdrCompound',
  'hdr10 and/or dolby vision': '_hdrCompound',
  'what hdr technologies are supported (e.g. dolby vision, hdr10, hlg)?': '_hdrTechnologies',
  'what hdr technologies are supported': '_hdrTechnologies',
  'hdr technologies supported': '_hdrTechnologies',
  'hdr10': 'supportsHDR10',
  'dolby vision': 'supportsDolbyVision',
  'hlg': 'supportsHLG',
  'hdr10+': 'supportsHDR10Plus',

  // Video Resolution
  'maximum video output resolution': 'maxVideoResolution',
  'max video output resolution': 'maxVideoResolution',
  'max supported video resolution (uhd, fhd, hd)': 'maxVideoResolution',
  'max supported video resolution': 'maxVideoResolution',
  'maximum video resolution': 'maxVideoResolution',
  'video resolution': 'maxVideoResolution',
  'what digital video output modes are supported?': 'maxVideoResolution',
  'what digital video output modes are supported': 'maxVideoResolution',
  'ui resolution': '_uiResolution',
  'maximum avc bitrate': '_maxAvcBitrate',
  'maximum hevc bitrate': '_maxHevcBitrate',
  'maximum frame rate': 'maxFrameRate',
  'max frame rate': 'maxFrameRate',

  // DRM - LONG FORM
  'playready version': 'playReadyVersion',
  'playready security level': 'playReadySecurityLevel',
  'is playready supported?': '_playReadySupported',
  'playready supported': '_playReadySupported',
  'widevine version': 'widevineVersion',
  'widevine security level': 'widevineSecurityLevel',
  'is widevine supported?': '_widevineSupported',
  'widevine supported': '_widevineSupported',
  'hdcp version': 'hdcpVersion',
  'hdcp version supported': 'hdcpVersion',

  // DRM - SHORT FORM & compound fields
  'is playready sl3000 and/or widevine l1 supported?': '_drmCompound',
  'playready sl3000 and/or widevine l1': '_drmCompound',
  'playready sl3000 and/or widevine l1 supported': '_drmCompound',
  'if playready cdm is supported, but below version 4.0, please indicate the version': 'playReadyVersion',
  'if playready cdm is supported, but below version 4.0, please indicate the version.': 'playReadyVersion',
  'if widevine cdm is supported below version 3.1 that does not support cbcs, please indicate the version': 'widevineVersion',
  'digital video output copy protection protocol?': 'hdcpVersion',
  'digital video output copy protection protocol': 'hdcpVersion',
  'copy protection': 'hdcpVersion',

  // Security
  'secure boot': 'supportsSecureBoot',
  'secure boot supported': 'supportsSecureBoot',
  'is secure boot supported?': 'supportsSecureBoot',
  'does the stb device support secure boot?': 'supportsSecureBoot',
  'hardware root of trust': '_hardwareRoT',
  'tee (trusted execution environment)': 'supportsTEE',
  'tee supported': 'supportsTEE',
  'trusted execution environment (tee)': 'supportsTEE',
  'is tee supported?': 'supportsTEE',
  'does the stb have a tee (trusted execution environment)?': 'supportsTEE',
  'secure video path': 'supportsSecureVideoPath',
  'secure video path supported': 'supportsSecureVideoPath',
  'is secure video path supported?': 'supportsSecureVideoPath',
  'does the stb device support secure video path?': 'supportsSecureVideoPath',
  'app code signing': '_appCodeSigning',
};

export function lookupSpecKey(description: string): string | null {
  const normalized = description.toLowerCase().trim().replace(/\s+/g, ' ');

  // Exact match
  if (specKeyMap[normalized]) return specKeyMap[normalized];

  // Try removing trailing question marks and periods
  const cleaned = normalized.replace(/[?.]+$/, '').trim();
  if (specKeyMap[cleaned]) return specKeyMap[cleaned];

  // Fuzzy: try substring matching
  for (const [key, value] of Object.entries(specKeyMap)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return null;
}
