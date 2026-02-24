import XLSX from 'xlsx';
import type { RawDeviceData } from './normalizeDevice';

// Partner -> Operator mapping table
const partnerToOperator: Record<string, string> = {
  'Vivo': 'Telefonica Brasil',
  'Claro': 'Claro Brazil',
  'Cablevision': 'Cablevision',
  'Polsat': 'POLSAT',
  'VodafoneZiggo': 'Liberty Global',
  'Virgin Media': 'Liberty Global',
  'Virgin Media O2': 'Liberty Global',
  'Telenet': 'Liberty Global',
  'Sunrise': 'Liberty Global',
  'Totalplay': 'TotalPlay Mexico',
  'Titan - Novatek': 'TITANOS',
  'Titan - Mediatek': 'TITANOS',
  'DT': 'Deutsche Telekom',
  'Amlogic': 'AMLogic',
  'Movistar HispAm': 'Movistar',
  // These map directly (case-matched to existing operators):
  'BT': 'BT',
  'Fetch': 'Fetch',
  'Free': 'Free',
  'Movistar': 'Movistar',
  'NOS': 'NOS',
  'Orange': 'Orange',
  'SFR': 'SFR',
  'TiVo': 'TiVo',
  'Vodafone': 'Vodafone',
  'Foxtel': 'Foxtel',
};

function mapPartnerToOperator(partner: string): string {
  return partnerToOperator[partner] || partner;
}

function cleanCountry(raw: string): string {
  // Strip emoji flags (Unicode regional indicators and flag sequences)
  return raw.replace(/[\u{1F1E0}-\u{1F1FF}]{2}\s*/gu, '').trim();
}

function parseDrm(raw: string): { playReadySecurityLevel?: string; widevineSecurityLevel?: string } {
  const result: { playReadySecurityLevel?: string; widevineSecurityLevel?: string } = {};
  if (!raw) return result;

  const parts = raw.split(',').map(s => s.trim());
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.includes('playready')) {
      if (lower.includes('sl3000') || lower.includes('3000')) result.playReadySecurityLevel = 'SL3000';
      else if (lower.includes('sl2500') || lower.includes('2500')) result.playReadySecurityLevel = 'SL2500';
      else if (lower.includes('sl2000') || lower.includes('2000')) result.playReadySecurityLevel = 'SL2000';
    }
    if (lower.includes('widevine')) {
      if (lower.includes('l1') || lower.includes('level 1')) result.widevineSecurityLevel = 'L1';
      else if (lower.includes('l3') || lower.includes('level 3')) result.widevineSecurityLevel = 'L3';
    }
  }
  return result;
}

export function parseAirtable(workbook: XLSX.WorkBook, filename: string): RawDeviceData[] {
  const sheetName = workbook.SheetNames[0]; // "AllModels_Categorized_NEW"
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

  const devices: RawDeviceData[] = [];

  for (const row of rows) {
    const deviceName = String(row['Device'] || '').trim();
    if (!deviceName) continue;

    const partner = String(row['Partner'] || '').trim();
    const operator = mapPartnerToOperator(partner);

    const specMap: Record<string, string> = {};

    specMap.modelName = deviceName;

    // Device ID
    const deviceId = String(row['Device ID'] || '').trim();
    if (deviceId) specMap.modelNumber = deviceId;

    // Vendor -> socVendor
    const vendor = String(row['Vendor'] || '').trim();
    if (vendor) specMap.socVendor = vendor;

    // Region
    const region = String(row['Region'] || '').trim();
    if (region) specMap.region = region;

    // Country -- clean emoji flags and split comma-separated
    const rawCountry = String(row['Country'] || '').trim();
    if (rawCountry) {
      const countries = rawCountry.split(',').map(c => cleanCountry(c)).filter(Boolean);
      specMap.countries = countries.join(', ');
    }

    // Live ADK Version
    const adkVersion = String(row['Live ADK Version'] || '').trim();
    if (adkVersion) specMap.liveAdkVersion = adkVersion;

    // 64 bit
    const is64 = String(row['64 bit'] || '').trim();
    if (is64 === 'checked') specMap.is64Bit = 'yes';

    // DRM parsing
    const drmRaw = String(row['DRM'] || '').trim();
    if (drmRaw) {
      const drm = parseDrm(drmRaw);
      if (drm.playReadySecurityLevel) specMap.playReadySecurityLevel = drm.playReadySecurityLevel;
      if (drm.widevineSecurityLevel) specMap.widevineSecurityLevel = drm.widevineSecurityLevel;
    }

    devices.push({
      specMap,
      operator,
      sourceFile: filename,
      deviceColumnName: deviceName,
    });
  }

  console.log(`  Found ${devices.length} devices from Airtable`);
  return devices;
}
