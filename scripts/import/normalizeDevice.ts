import type { Device } from '../../src/lib/types';

function parseDmips(value: string | null | undefined): number | null {
  if (!value) return null;
  const str = String(value).toLowerCase().replace(/,/g, '');
  const match = str.match(/([\d.]+)\s*k?\s*dmips/i);
  if (match) {
    const num = parseFloat(match[1]);
    if (str.includes('k')) return num * 1000;
    return num;
  }
  const numMatch = str.match(/([\d.]+)\s*k/i);
  if (numMatch) return parseFloat(numMatch[1]) * 1000;
  const plain = parseFloat(str);
  return isNaN(plain) ? null : plain;
}

function parseMemory(raw: string | null | undefined): { capacityGb: number | null; type: string | null } {
  if (!raw) return { capacityGb: null, type: null };
  const str = String(raw);
  let capacityGb: number | null = null;
  let type: string | null = null;

  const gbMatch = str.match(/([\d.]+)\s*GB/i);
  const mbMatch = str.match(/([\d.]+)\s*MB/i);
  if (gbMatch) capacityGb = parseFloat(gbMatch[1]);
  else if (mbMatch) capacityGb = parseFloat(mbMatch[1]) / 1024;

  const typeMatch = str.match(/(DDR\d?L?|LPDDR\d?|eMMC|NAND)/i);
  if (typeMatch) type = typeMatch[1].toUpperCase();

  return { capacityGb, type };
}

function parseRamMb(value: string | null | undefined): number | null {
  if (!value) return null;
  const str = String(value);
  const gbMatch = str.match(/([\d.]+)\s*GB/i);
  if (gbMatch) return parseFloat(gbMatch[1]) * 1024;
  const mbMatch = str.match(/([\d.]+)\s*MB/i);
  if (mbMatch) return parseFloat(mbMatch[1]);
  const num = parseFloat(str);
  if (!isNaN(num)) {
    return num >= 100 ? num : num * 1024; // assume GB if small number
  }
  return null;
}

function parseStorage(raw: string | null | undefined): { capacityGb: number | null; type: string | null } {
  if (!raw) return { capacityGb: null, type: null };
  const str = String(raw);
  let capacityGb: number | null = null;

  const gbMatch = str.match(/([\d.]+)\s*GB/i);
  const mbMatch = str.match(/([\d.]+)\s*MB/i);
  if (gbMatch) capacityGb = parseFloat(gbMatch[1]);
  else if (mbMatch) capacityGb = parseFloat(mbMatch[1]) / 1024;

  const typeMatch = str.match(/(eMMC|NAND|SSD|NOR)/i);
  const type = typeMatch ? typeMatch[1].toUpperCase() : null;

  return { capacityGb, type };
}

function parseBool(value: string | null | undefined): boolean {
  if (!value) return false;
  const str = String(value).toLowerCase().trim();
  return ['yes', 'y', 'true', 'supported', '1', 'available'].some(v => str.startsWith(v));
}

function parseExcelDate(value: string | number | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'number' || /^\d{5}(\.\d+)?$/.test(String(value))) {
    const serial = typeof value === 'number' ? value : parseFloat(String(value));
    const date = new Date((serial - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  const yearMatch = String(value).match(/\b(19|20)\d{2}\b/);
  if (yearMatch) return yearMatch[0];
  return String(value);
}

function parseCountries(value: string | null | undefined): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,\/\n;]+/)
    .map(c => c.trim())
    .filter(Boolean);
}

function parseApps(value: string | null | undefined): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,\n;]+/)
    .map(a => a.trim().replace(/\(.*?\)/g, '').trim())
    .filter(Boolean);
}

function parseResolution(value: string | null | undefined): string | null {
  if (!value) return null;
  const str = String(value).toLowerCase();
  if (str.includes('2160') || str.includes('4k') || str.includes('uhd')) return '2160p';
  if (str.includes('1080') || str.includes('fhd') || str.includes('full hd')) return '1080p';
  if (str.includes('720') || str.includes('hd')) return '720p';
  return String(value);
}

function parseDolbyVisionProfiles(value: string | null | undefined): string[] {
  if (!value) return [];
  const str = String(value);
  const profiles = str.match(/profile\s*\d+/gi) || [];
  if (profiles.length > 0) return profiles.map(p => p.trim());
  const dvMatches = str.match(/dvh[ep]\.\d+/gi) || [];
  return dvMatches;
}

function parseFrameRate(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = String(value).match(/(\d+)\s*(fps|hz)?/i);
  return match ? parseInt(match[1]) : null;
}

function parseCores(value: string | null | undefined): number | null {
  if (!value) return null;
  const str = String(value).toLowerCase();
  if (str.includes('quad') || str.includes('4')) return 4;
  if (str.includes('dual') || str.includes('2')) return 2;
  if (str.includes('octa') || str.includes('8')) return 8;
  if (str.includes('hexa') || str.includes('6')) return 6;
  const num = parseInt(str);
  return isNaN(num) ? null : num;
}

export interface RawDeviceData {
  specMap: Record<string, string>;
  operator: string;
  sourceFile: string;
  deviceColumnName: string;
  salesData?: Array<Record<string, string>>;
  deviceSpecs?: Record<string, string>;
}

function inferDeviceType(raw: RawDeviceData): string {
  const col = raw.deviceColumnName.toLowerCase();
  const source = raw.sourceFile.toLowerCase();
  if (source.includes('smarttv') || source.includes('smart tv')) return 'SmartTV';
  if (source.includes('soc')) return 'SoC Reference';
  if (col.includes('tv') || col.includes('smart')) return 'SmartTV';
  return 'STB';
}

function inferHardwareOs(osName: string | null, raw: RawDeviceData): string {
  const os = (osName || '').toLowerCase();
  const source = raw.sourceFile.toLowerCase();
  if (os.includes('android') || source.includes('android')) return 'Android';
  return 'Linux';
}

function inferPlatform(osName: string | null, raw: RawDeviceData): string {
  const os = (osName || '').toLowerCase();
  const source = raw.sourceFile.toLowerCase();
  if (os.includes('android') || source.includes('android')) return 'Android TV';
  if (os.includes('tizen')) return 'Tizen';
  if (os.includes('webos')) return 'webOS';
  if (raw.operator === 'TITANOS') return 'Titan OS';
  if (source.includes('tivo')) return 'TiVo OS';
  if (os.includes('linux') || os.includes('kernel')) return 'Linux';
  return 'Linux';
}

const COUNTRY_TO_REGION: Record<string, string> = {
  // EMEA
  'United Kingdom': 'EMEA', 'UK': 'EMEA', 'Netherlands': 'EMEA', 'Belgium': 'EMEA',
  'Ireland': 'EMEA', 'Switzerland': 'EMEA', 'Slovakia': 'EMEA', 'Poland': 'EMEA',
  'Romania': 'EMEA', 'Hungary': 'EMEA', 'Czech Republic': 'EMEA', 'Germany': 'EMEA',
  'Austria': 'EMEA', 'Sweden': 'EMEA', 'France': 'EMEA', 'Norway': 'EMEA',
  'Spain': 'EMEA', 'Portugal': 'EMEA', 'Italy': 'EMEA', 'South Africa': 'EMEA',
  'Denmark': 'EMEA', 'Finland': 'EMEA', 'Greece': 'EMEA', 'Turkey': 'EMEA',
  'Israel': 'EMEA', 'UAE': 'EMEA', 'Saudi Arabia': 'EMEA', 'Egypt': 'EMEA',
  'Nigeria': 'EMEA', 'Kenya': 'EMEA',
  // NA
  'United States': 'NA', 'US': 'NA', 'USA': 'NA', 'Canada': 'NA',
  // LATAM
  'Brazil': 'LATAM', 'Mexico': 'LATAM', 'Argentina': 'LATAM', 'Paraguay': 'LATAM',
  'Uruguay': 'LATAM', 'Colombia': 'LATAM', 'Chile': 'LATAM', 'Peru': 'LATAM',
  'Venezuela': 'LATAM', 'Ecuador': 'LATAM', 'Bolivia': 'LATAM', 'Costa Rica': 'LATAM',
  'Panama': 'LATAM', 'Puerto Rico': 'LATAM', 'Dominican Republic': 'LATAM',
  // APAC
  'Australia': 'APAC', 'New Zealand': 'APAC', 'India': 'APAC', 'Japan': 'APAC',
  'South Korea': 'APAC', 'China': 'APAC', 'Singapore': 'APAC', 'Malaysia': 'APAC',
  'Thailand': 'APAC', 'Philippines': 'APAC', 'Indonesia': 'APAC', 'Vietnam': 'APAC',
  'Taiwan': 'APAC', 'Hong Kong': 'APAC',
};

function inferRegion(countries: string[]): string | null {
  for (const country of countries) {
    const trimmed = country.trim();
    if (COUNTRY_TO_REGION[trimmed]) return COUNTRY_TO_REGION[trimmed];
    // Try partial match for variants
    const lower = trimmed.toLowerCase();
    for (const [key, region] of Object.entries(COUNTRY_TO_REGION)) {
      if (key.toLowerCase() === lower) return region;
    }
  }
  return null;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

// Process compound fields from questionnaires that combine multiple answers
function processCompoundFields(s: Record<string, string>): void {
  // HDR compound: "HDR10 and/or Dolby Vision (UHD)" with values like "HDR10", "DV", "Both", "No"
  const hdrCompound = (s._hdrCompound || '').toLowerCase();
  if (hdrCompound) {
    if (hdrCompound.includes('hdr10') || hdrCompound.includes('both') || parseBool(hdrCompound)) {
      if (!s.supportsHDR10) s.supportsHDR10 = 'Yes';
    }
    if (hdrCompound.includes('dolby') || hdrCompound.includes('dv') || hdrCompound.includes('both')) {
      if (!s.supportsDolbyVision) s.supportsDolbyVision = 'Yes';
    }
  }

  // HDR technologies: "What HDR technologies are supported?" with freeform answer
  const hdrTech = (s._hdrTechnologies || '').toLowerCase();
  if (hdrTech) {
    if (hdrTech.includes('hdr10') && !hdrTech.includes('hdr10+')) {
      if (!s.supportsHDR10) s.supportsHDR10 = 'Yes';
    }
    if (hdrTech.includes('hdr10+')) {
      if (!s.supportsHDR10Plus) s.supportsHDR10Plus = 'Yes';
      if (!s.supportsHDR10) s.supportsHDR10 = 'Yes';
    }
    if (hdrTech.includes('dolby') || hdrTech.includes('dv')) {
      if (!s.supportsDolbyVision) s.supportsDolbyVision = 'Yes';
    }
    if (hdrTech.includes('hlg')) {
      if (!s.supportsHLG) s.supportsHLG = 'Yes';
    }
  }

  // DRM compound: "Is PlayReady SL3000 and/or Widevine L1 supported?"
  const drmCompound = (s._drmCompound || '').toLowerCase();
  if (drmCompound) {
    if (drmCompound.includes('sl3000') || drmCompound.includes('3000')) {
      if (!s.playReadySecurityLevel) s.playReadySecurityLevel = 'SL3000';
    }
    if (drmCompound.includes('sl2000') || drmCompound.includes('2000')) {
      if (!s.playReadySecurityLevel) s.playReadySecurityLevel = 'SL2000';
    }
    if (drmCompound.includes('l1') || drmCompound.includes('level 1')) {
      if (!s.widevineSecurityLevel) s.widevineSecurityLevel = 'L1';
    }
    if (drmCompound.includes('l3') || drmCompound.includes('level 3')) {
      if (!s.widevineSecurityLevel) s.widevineSecurityLevel = 'L3';
    }
    // If just "Yes", assume best-case
    if (parseBool(drmCompound) && !drmCompound.includes('sl') && !drmCompound.includes('l1') && !drmCompound.includes('l3')) {
      if (!s.playReadySecurityLevel) s.playReadySecurityLevel = 'SL3000';
      if (!s.widevineSecurityLevel) s.widevineSecurityLevel = 'L1';
    }
  }

  // Derive DRM levels from version strings if separate level field is missing
  const prVersion = (s.playReadyVersion || '').toLowerCase();
  if (prVersion && !s.playReadySecurityLevel) {
    if (prVersion.includes('3000') || prVersion.includes('sl3000')) s.playReadySecurityLevel = 'SL3000';
    else if (prVersion.includes('2000') || prVersion.includes('sl2000')) s.playReadySecurityLevel = 'SL2000';
  }

  const wvVersion = (s.widevineVersion || '').toLowerCase();
  if (wvVersion && !s.widevineSecurityLevel) {
    if (wvVersion.includes('l1') || wvVersion.includes('level 1')) s.widevineSecurityLevel = 'L1';
    else if (wvVersion.includes('l3') || wvVersion.includes('level 3')) s.widevineSecurityLevel = 'L3';
  }

  // Video output modes: "up to 2160p", "1080p, 2160p" → max resolution
  const videoModes = (s.maxVideoResolution || '').toLowerCase();
  if (!videoModes) {
    const outputModes = (s._videoOutputModes || '').toLowerCase();
    if (outputModes) {
      s.maxVideoResolution = outputModes;
    }
  }
}

export function normalizeDevice(raw: RawDeviceData): Device {
  const s = raw.specMap;

  // Process compound fields to derive individual values
  processCompoundFields(s);

  const modelName = s.modelName || raw.deviceColumnName || 'Unknown';
  const modelNumber = s.modelNumber || '';
  const manufacturer = s.manufacturer || '';
  const osName = s.osName || null;
  const mem = parseMemory(s.memoryRaw);
  const storage = parseStorage(s.storageRaw);

  const id = slugify(`${raw.operator}_${modelName}_${modelNumber || raw.deviceColumnName}`);

  const device: Device = {
    id,
    modelName,
    modelNumber,
    manufacturer,
    operator: raw.operator,
    deviceType: raw.deviceSpecs?.['Device Type'] || inferDeviceType(raw),
    platform: inferPlatform(osName, raw),
    hardwareOs: inferHardwareOs(osName, raw),
    region: null, // set below after countries are parsed
    liveAdkVersion: s.liveAdkVersion || null,
    is64Bit: parseBool(s.is64Bit),
    performanceCategory: null, // will be set after scoring

    deploymentDate: parseExcelDate(s.deploymentDate),
    deliveryEndDate: parseExcelDate(s.deliveryEndDate),
    activeDeviceCount: s.activeDeviceCount || null,
    subscriberCount: s.subscriberCount || null,
    countries: parseCountries(s.countries),
    thirdPartyApps: parseApps(s.thirdPartyApps),
    connectionType: s.connectionType || null,

    socVendor: s.socVendor || null,
    socModel: s.socModel || null,
    socRevision: s.socRevision || null,
    cpuSpeedDmips: parseDmips(s.cpuSpeedDmips),
    cpuCores: parseCores(s.cpuCores),
    osName,
    osVersion: s.osVersion || null,
    middlewareProvider: s.middlewareProvider || null,
    middlewareVersion: s.middlewareVersion || null,
    memoryCapacityGb: mem.capacityGb,
    memoryType: mem.type,
    ramForDisneyMb: parseRamMb(s.ramForDisneyMb),
    storageCapacityGb: storage.capacityGb,
    storageType: storage.type,
    hdmiVersion: s.hdmiVersion || null,

    supportsH264: parseBool(s.supportsH264),
    supportsH265: parseBool(s.supportsH265),
    supportsEAC3: parseBool(s.supportsEAC3),
    supportsDolbyAtmos: parseBool(s.supportsDolbyAtmos),
    supportsHDR10: parseBool(s.supportsHDR10),
    supportsDolbyVision: parseBool(s.supportsDolbyVision),
    dolbyVisionProfiles: parseDolbyVisionProfiles(s.dolbyVisionProfiles),
    supportsHLG: parseBool(s.supportsHLG),
    supportsHDR10Plus: parseBool(s.supportsHDR10Plus),
    maxVideoResolution: parseResolution(s.maxVideoResolution),
    maxFrameRate: parseFrameRate(s.maxFrameRate),

    playReadyVersion: s.playReadyVersion || null,
    playReadySecurityLevel: s.playReadySecurityLevel || null,
    widevineVersion: s.widevineVersion || null,
    widevineSecurityLevel: s.widevineSecurityLevel || null,
    hdcpVersion: s.hdcpVersion || null,
    supportsSecureBoot: parseBool(s.supportsSecureBoot),
    supportsTEE: parseBool(s.supportsTEE),
    supportsSecureVideoPath: parseBool(s.supportsSecureVideoPath),

    salesData: [],
    deviceScore: 0,
    scoreBreakdown: { hardware: 0, codec: 0, drm: 0, display: 0, security: 0 },

    sourceFiles: [raw.sourceFile],
    conflicts: [],
    lastUpdated: new Date().toISOString().split('T')[0],
    importedAt: new Date().toISOString(),
  };

  // Derive region: explicit > country-based > null
  if (s.region) {
    device.region = s.region;
  } else if (device.countries.length > 0) {
    device.region = inferRegion(device.countries);
  }

  return device;
}

export function assignPerformanceCategory(device: Device): void {
  if (!device.cpuSpeedDmips) {
    device.performanceCategory = 'Unknown';
    return;
  }
  if (device.cpuSpeedDmips >= 8000) device.performanceCategory = 'High';
  else if (device.cpuSpeedDmips >= 7000) device.performanceCategory = 'Medium';
  else device.performanceCategory = 'Low';
}

export function mergeDevices(existing: Device, incoming: Device): Device {
  const conflicts: string[] = [...existing.conflicts];

  const fieldsToCheck: (keyof Device)[] = [
    'socVendor', 'socModel', 'cpuSpeedDmips', 'memoryCapacityGb',
    'osName', 'osVersion', 'hardwareOs', 'supportsH265', 'supportsHDR10', 'supportsDolbyVision',
    'playReadySecurityLevel', 'widevineSecurityLevel', 'maxVideoResolution',
  ];

  for (const field of fieldsToCheck) {
    const existingVal = existing[field];
    const incomingVal = incoming[field];
    if (existingVal != null && incomingVal != null && existingVal !== incomingVal) {
      conflicts.push(`${field}: "${existingVal}" vs "${incomingVal}"`);
    }
  }

  // Prefer non-null values, favoring incoming (newer) data
  const merged = { ...existing };
  for (const key of Object.keys(incoming) as (keyof Device)[]) {
    if (key === 'sourceFiles' || key === 'conflicts' || key === 'id') continue;
    const val = incoming[key];
    if (val != null && val !== '' && val !== false) {
      (merged as Record<string, unknown>)[key] = val;
    }
  }

  merged.sourceFiles = [...new Set([...existing.sourceFiles, ...incoming.sourceFiles])];
  merged.conflicts = conflicts;
  merged.salesData = [...(existing.salesData || []), ...(incoming.salesData || [])];

  return merged;
}
