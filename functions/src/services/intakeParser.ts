import type { IntakeRegion } from '../types/index.js';

// ── Country Normalization (ISO 3166-1 alpha-2) ──

const COUNTRY_LOOKUP: Record<string, string> = {
  'albania': 'AL',
  'argentina': 'AR',
  'au': 'AU', 'australia': 'AU',
  'at': 'AT', 'austria': 'AT',
  'be': 'BE', 'belgium': 'BE',
  'belize': 'BZ',
  'bolivia': 'BO',
  'br': 'BR', 'brazil': 'BR',
  'canada': 'CA',
  'cl': 'CL', 'chile': 'CL',
  'colombia': 'CO',
  'costa rica': 'CR',
  'czechia': 'CZ',
  'denmark': 'DK',
  'dominican republic': 'DO',
  'ecuador': 'EC',
  'el salvador': 'SV',
  'finland': 'FI',
  'france': 'FR',
  'de': 'DE', 'germany': 'DE',
  'greece': 'GR',
  'guatemala': 'GT',
  'hk': 'HK', 'hong kong': 'HK',
  'honduras': 'HN',
  'hungary': 'HU',
  'iceland': 'IS',
  'ie': 'IE', 'ireland': 'IE',
  'it': 'IT', 'italy': 'IT',
  'jamaica': 'JM',
  'japan': 'JP',
  'mx': 'MX', 'mexico': 'MX',
  'nl': 'NL', 'netherlands': 'NL',
  'nz': 'NZ', 'new zealand': 'NZ',
  'nicaragua': 'NI',
  'norway': 'NO',
  'panama': 'PA',
  'paraguay': 'PY',
  'pe': 'PE', 'peru': 'PE',
  'poland': 'PL',
  'pt': 'PT', 'portugal': 'PT',
  'romania': 'RO',
  'saint lucia': 'LC',
  'singapore': 'SG',
  'slovakia': 'SK',
  'south korea': 'KR',
  'es': 'ES', 'spain': 'ES',
  'se': 'SE', 'sweden': 'SE',
  'ch': 'CH', 'switzerland': 'CH',
  'tw': 'TW', 'taiwan': 'TW',
  'trinidad and tobago': 'TT',
  'uk': 'GB', 'united kingdom': 'GB',
  'us': 'US', 'usa': 'US', 'united states': 'US',
  'uruguay': 'UY',
  'venezuela': 'VE',
  'global': 'XW', 'ww': 'XW',
};

const VALID_REGIONS: Set<string> = new Set(['APAC', 'DOMESTIC', 'EMEA', 'GLOBAL', 'LATAM']);

const VALID_REQUEST_TYPES: Set<string> = new Set([
  'ADK', 'ANDTV', 'BBD', 'Content Provider API', 'Eligibility API',
  'Feeds & Integration', 'Partner API', 'Perks', 'Redemption Code',
  'Supplemental Data API', 'Web App',
]);

const EXPECTED_COLUMNS = [
  'Request Subject', 'RequestType', 'Request Status', 'Request Phase',
  'Partner', 'Country', 'Region (from Partner)', 'TAM',
  'Integration Engineering Lead', 'Target Launch Date', 'Release Target',
];

// ── Emoji Stripping ──

const EMOJI_REGEX = /[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

export function stripEmoji(str: string): string {
  return str.replace(EMOJI_REGEX, '').trim();
}

// ── Date Parsing ──

export function parseDate(raw: string): { date: string | null; error: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { date: null, error: false };

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return { date: null, error: true };

  const [, m, d, y] = match;
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  const year = parseInt(y, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return { date: null, error: true };

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { date: iso, error: false };
}

// ── Country Normalization ──

export interface CountryResult {
  codes: string[] | null;
  warnings: Array<{ type: 'sk_ambiguity' | 'unknown_country'; rawValue: string; message: string }>;
}

export function normalizeCountries(raw: string, region?: string): CountryResult {
  if (!raw.trim()) return { codes: null, warnings: [] };

  const stripped = stripEmoji(raw);
  const tokens = stripped.split(',').map(t => t.trim()).filter(Boolean);
  const codes: string[] = [];
  const warnings: CountryResult['warnings'] = [];

  for (const token of tokens) {
    const key = token.toLowerCase();
    const code = COUNTRY_LOOKUP[key];

    if (code === 'SK') {
      codes.push('SK');
      warnings.push({
        type: 'sk_ambiguity',
        rawValue: token,
        message: `"${token}" could be Slovakia (SK) or South Korea (KR)${region ? ` — Region: ${region}` : ''}. Please confirm.`,
      });
    } else if (code) {
      codes.push(code);
    } else {
      codes.push(`UNKNOWN:${token}`);
      warnings.push({
        type: 'unknown_country',
        rawValue: token,
        message: `Unrecognized country: "${token}"`,
      });
    }
  }

  const deduplicated = [...new Set(codes)];
  return { codes: deduplicated.length > 0 ? deduplicated : null, warnings };
}

// ── Region Normalization ──

export function normalizeRegions(raw: string): { regions: IntakeRegion[] | null; unknown: string[] } {
  if (!raw.trim()) return { regions: null, unknown: [] };

  const tokens = raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  const valid: IntakeRegion[] = [];
  const unknown: string[] = [];

  for (const token of tokens) {
    if (VALID_REGIONS.has(token)) {
      valid.push(token as IntakeRegion);
    } else {
      unknown.push(token);
    }
  }

  const deduplicated = [...new Set(valid)];
  return { regions: deduplicated.length > 0 ? deduplicated : null, unknown };
}

// ── Multi-value Splitting ──

export function splitAndTrim(raw: string): string[] {
  return raw.split(',').map(t => t.trim()).filter(Boolean);
}

// ── Column Validation ──

export function validateColumns(headers: string[]): { valid: boolean; missing: string[] } {
  const headerSet = new Set(headers.map(h => h.trim()));
  const missing = EXPECTED_COLUMNS.filter(col => !headerSet.has(col));
  return { valid: missing.length === 0, missing };
}

// ── Request Type Validation ──

export function isValidRequestType(value: string): boolean {
  return VALID_REQUEST_TYPES.has(value.trim());
}

// ── BOM Stripping ──

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

// ── Jaro-Winkler Similarity ──

function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3
  );
}

export function jaroWinklerSimilarity(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2);

  let prefixLength = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  const scalingFactor = 0.1;
  return jaro + prefixLength * scalingFactor * (1 - jaro);
}

export { EXPECTED_COLUMNS, VALID_REQUEST_TYPES, VALID_REGIONS, COUNTRY_LOOKUP };
