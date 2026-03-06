import { Router } from 'express';
import admin from 'firebase-admin';
import { requireRole } from '../middleware/auth.js';
import { diffAndLog, logAuditEntry } from '../services/audit.js';
import { formatError } from '../services/logger.js';
import { stripEmoji } from '../services/intakeParser.js';
import type { PartnerKeyRegion, DeduplicationInfo, FieldDiff, MatchConfidence } from '../types/index.js';
import type { Region } from '@dst/contracts';
import { loadActiveAliases, resolvePartnerAlias } from '../services/partnerAliasResolver.js';
import { jaroWinkler } from '../services/partnerResolver.js';

const PK_REGION_TO_PARTNER_REGION: Record<string, Region[]> = {
  APAC: ['APAC'],
  EMEA: ['EMEA'],
  LATAM: ['LATAM'],
  DOMESTIC: ['NA'],
  GLOBAL: ['NA', 'EMEA', 'LATAM', 'APAC'],
};

const router = Router();

// ── Normalization helpers ──

const REGION_MAP: Record<string, PartnerKeyRegion> = {
  APAC: 'APAC',
  EMEA: 'EMEA',
  LATAM: 'LATAM',
  NA: 'DOMESTIC',
  WORLDWIDE: 'GLOBAL',
};

// ISO 3166-1 alpha-2 codes plus XW (worldwide sentinel)
const VALID_ISO2_CODES = new Set([
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
  'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
  'DE','DJ','DK','DM','DO','DZ',
  'EC','EE','EG','EH','ER','ES','ET',
  'FI','FJ','FK','FM','FO','FR',
  'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
  'HK','HM','HN','HR','HT','HU',
  'ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
  'JE','JM','JO','JP',
  'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
  'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
  'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
  'OM',
  'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
  'QA',
  'RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
  'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
  'UA','UG','UM','US','UY','UZ',
  'VA','VC','VE','VG','VI','VN','VU',
  'WF','WS',
  'XK','XW',
  'YE','YT',
  'ZA','ZM','ZW',
]);

// Country name/alias → ISO 3166-1 alpha-2 lookup (uppercase keys)
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  // Short aliases & legacy codes
  UK: 'GB', WORLDWIDE: 'XW', GLOBAL: 'XW', WW: 'XW', USA: 'US', UAE: 'AE',
  // Full English names — major markets & common partner regions
  'AFGHANISTAN': 'AF', 'ALBANIA': 'AL', 'ALGERIA': 'DZ', 'ANDORRA': 'AD',
  'ANGOLA': 'AO', 'ANTIGUA AND BARBUDA': 'AG', 'ARGENTINA': 'AR', 'ARMENIA': 'AM',
  'AUSTRALIA': 'AU', 'AUSTRIA': 'AT', 'AZERBAIJAN': 'AZ',
  'BAHAMAS': 'BS', 'BAHRAIN': 'BH', 'BANGLADESH': 'BD', 'BARBADOS': 'BB',
  'BELARUS': 'BY', 'BELGIUM': 'BE', 'BELIZE': 'BZ', 'BENIN': 'BJ',
  'BHUTAN': 'BT', 'BOLIVIA': 'BO', 'BOSNIA AND HERZEGOVINA': 'BA', 'BOSNIA': 'BA',
  'BOTSWANA': 'BW', 'BRAZIL': 'BR', 'BRUNEI': 'BN', 'BULGARIA': 'BG',
  'BURKINA FASO': 'BF', 'BURUNDI': 'BI',
  'CAMBODIA': 'KH', 'CAMEROON': 'CM', 'CANADA': 'CA', 'CAPE VERDE': 'CV',
  'CENTRAL AFRICAN REPUBLIC': 'CF', 'CHAD': 'TD', 'CHILE': 'CL', 'CHINA': 'CN',
  'COLOMBIA': 'CO', 'COMOROS': 'KM', 'CONGO': 'CG',
  'DEMOCRATIC REPUBLIC OF THE CONGO': 'CD', 'DR CONGO': 'CD', 'DRC': 'CD',
  'COSTA RICA': 'CR', 'CROATIA': 'HR', 'CUBA': 'CU', 'CYPRUS': 'CY',
  'CZECH REPUBLIC': 'CZ', 'CZECHIA': 'CZ',
  'DENMARK': 'DK', 'DJIBOUTI': 'DJ', 'DOMINICA': 'DM', 'DOMINICAN REPUBLIC': 'DO',
  'EAST TIMOR': 'TL', 'TIMOR-LESTE': 'TL', 'ECUADOR': 'EC', 'EGYPT': 'EG',
  'EL SALVADOR': 'SV', 'EQUATORIAL GUINEA': 'GQ', 'ERITREA': 'ER',
  'ESTONIA': 'EE', 'ESWATINI': 'SZ', 'SWAZILAND': 'SZ', 'ETHIOPIA': 'ET',
  'FIJI': 'FJ', 'FINLAND': 'FI', 'FRANCE': 'FR',
  'GABON': 'GA', 'GAMBIA': 'GM', 'GEORGIA': 'GE', 'GERMANY': 'DE', 'GHANA': 'GH',
  'GREECE': 'GR', 'GRENADA': 'GD', 'GUATEMALA': 'GT', 'GUINEA': 'GN',
  'GUINEA-BISSAU': 'GW', 'GUYANA': 'GY',
  'HAITI': 'HT', 'HONDURAS': 'HN', 'HONG KONG': 'HK', 'HUNGARY': 'HU',
  'ICELAND': 'IS', 'INDIA': 'IN', 'INDONESIA': 'ID', 'IRAN': 'IR', 'IRAQ': 'IQ',
  'IRELAND': 'IE', 'ISRAEL': 'IL', 'ITALY': 'IT', 'IVORY COAST': 'CI', "COTE D'IVOIRE": 'CI',
  'JAMAICA': 'JM', 'JAPAN': 'JP', 'JORDAN': 'JO',
  'KAZAKHSTAN': 'KZ', 'KENYA': 'KE', 'KIRIBATI': 'KI', 'KOSOVO': 'XK',
  'KUWAIT': 'KW', 'KYRGYZSTAN': 'KG',
  'LAOS': 'LA', 'LATVIA': 'LV', 'LEBANON': 'LB', 'LESOTHO': 'LS',
  'LIBERIA': 'LR', 'LIBYA': 'LY', 'LIECHTENSTEIN': 'LI', 'LITHUANIA': 'LT',
  'LUXEMBOURG': 'LU',
  'MADAGASCAR': 'MG', 'MALAWI': 'MW', 'MALAYSIA': 'MY', 'MALDIVES': 'MV',
  'MALI': 'ML', 'MALTA': 'MT', 'MARSHALL ISLANDS': 'MH', 'MAURITANIA': 'MR',
  'MAURITIUS': 'MU', 'MEXICO': 'MX', 'MICRONESIA': 'FM', 'MOLDOVA': 'MD',
  'MONACO': 'MC', 'MONGOLIA': 'MN', 'MONTENEGRO': 'ME', 'MOROCCO': 'MA',
  'MOZAMBIQUE': 'MZ', 'MYANMAR': 'MM', 'BURMA': 'MM',
  'NAMIBIA': 'NA', 'NAURU': 'NR', 'NEPAL': 'NP', 'NETHERLANDS': 'NL',
  'HOLLAND': 'NL', 'THE NETHERLANDS': 'NL',
  'NEW ZEALAND': 'NZ', 'NICARAGUA': 'NI', 'NIGER': 'NE', 'NIGERIA': 'NG',
  'NORTH KOREA': 'KP', 'NORTH MACEDONIA': 'MK', 'MACEDONIA': 'MK', 'NORWAY': 'NO',
  'OMAN': 'OM',
  'PAKISTAN': 'PK', 'PALAU': 'PW', 'PALESTINE': 'PS', 'PANAMA': 'PA',
  'PAPUA NEW GUINEA': 'PG', 'PARAGUAY': 'PY', 'PERU': 'PE', 'PHILIPPINES': 'PH',
  'POLAND': 'PL', 'PORTUGAL': 'PT', 'PUERTO RICO': 'PR',
  'QATAR': 'QA',
  'ROMANIA': 'RO', 'RUSSIA': 'RU', 'RUSSIAN FEDERATION': 'RU', 'RWANDA': 'RW',
  'SAINT KITTS AND NEVIS': 'KN', 'SAINT LUCIA': 'LC',
  'SAINT VINCENT AND THE GRENADINES': 'VC', 'SAMOA': 'WS',
  'SAN MARINO': 'SM', 'SAO TOME AND PRINCIPE': 'ST', 'SAUDI ARABIA': 'SA',
  'SENEGAL': 'SN', 'SERBIA': 'RS', 'SEYCHELLES': 'SC', 'SIERRA LEONE': 'SL',
  'SINGAPORE': 'SG', 'SLOVAKIA': 'SK', 'SLOVENIA': 'SI', 'SOLOMON ISLANDS': 'SB',
  'SOMALIA': 'SO', 'SOUTH AFRICA': 'ZA', 'SOUTH KOREA': 'KR', 'KOREA': 'KR',
  'SOUTH SUDAN': 'SS', 'SPAIN': 'ES', 'SRI LANKA': 'LK', 'SUDAN': 'SD',
  'SURINAME': 'SR', 'SWEDEN': 'SE', 'SWITZERLAND': 'CH', 'SYRIA': 'SY',
  'TAIWAN': 'TW', 'TAJIKISTAN': 'TJ', 'TANZANIA': 'TZ', 'THAILAND': 'TH',
  'TOGO': 'TG', 'TONGA': 'TO', 'TRINIDAD AND TOBAGO': 'TT', 'TUNISIA': 'TN',
  'TURKEY': 'TR', 'TURKIYE': 'TR', 'TÜRKIYE': 'TR',
  'TURKMENISTAN': 'TM', 'TUVALU': 'TV',
  'UGANDA': 'UG', 'UKRAINE': 'UA',
  'UNITED ARAB EMIRATES': 'AE', 'UNITED KINGDOM': 'GB', 'GREAT BRITAIN': 'GB',
  'UNITED STATES': 'US', 'UNITED STATES OF AMERICA': 'US',
  'URUGUAY': 'UY', 'UZBEKISTAN': 'UZ',
  'VANUATU': 'VU', 'VATICAN': 'VA', 'VATICAN CITY': 'VA',
  'VENEZUELA': 'VE', 'VIETNAM': 'VN', 'VIET NAM': 'VN',
  'YEMEN': 'YE',
  'ZAMBIA': 'ZM', 'ZIMBABWE': 'ZW',
  // Common demonyms and alternative spellings seen in partner data
  'BRASIL': 'BR', 'REPUBLIC OF IRELAND': 'IE', 'EIRE': 'IE',
  'REPUBLIC OF KOREA': 'KR', 'ROK': 'KR',
  'PEOPLES REPUBLIC OF CHINA': 'CN', "PEOPLE'S REPUBLIC OF CHINA": 'CN', 'PRC': 'CN',
  'CZECH': 'CZ', 'SLOVAK REPUBLIC': 'SK',
  'TRINITE ET TOBAGO': 'TT', 'TRINIDAD': 'TT',
  'CONGO-KINSHASA': 'CD', 'CONGO-BRAZZAVILLE': 'CG',
  'HONG KONG SAR': 'HK', 'MACAU': 'MO', 'MACAO': 'MO',
  'ST. LUCIA': 'LC', 'ST LUCIA': 'LC',
  'ST. KITTS': 'KN', 'ST KITTS': 'KN',
  'CURACAO': 'CW', 'CURAÇAO': 'CW',
  'REUNION': 'RE', 'RÉUNION': 'RE',
};

function resolveCountryToken(token: string): { code: string; resolved: boolean } {
  const upper = token.toUpperCase().trim();

  // Direct ISO code
  if (VALID_ISO2_CODES.has(upper)) return { code: upper, resolved: false };

  // Name/alias lookup
  const mapped = COUNTRY_NAME_TO_ISO2[upper];
  if (mapped) return { code: mapped, resolved: true };

  // Try without "THE " prefix
  const withoutThe = upper.replace(/^THE\s+/, '');
  if (withoutThe !== upper) {
    const mappedNoThe = COUNTRY_NAME_TO_ISO2[withoutThe];
    if (mappedNoThe) return { code: mappedNoThe, resolved: true };
  }

  return { code: upper, resolved: false };
}

function normalizeCountries(raw: string | undefined): { countries: string[]; errors: string[]; warnings: string[] } {
  if (!raw || !raw.trim()) return { countries: [], errors: [], warnings: [] };
  const warnings: string[] = [];
  const errors: string[] = [];
  const stripped = stripEmoji(raw);
  const countries = stripped
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const { code, resolved } = resolveCountryToken(c);
      if (VALID_ISO2_CODES.has(code)) {
        if (resolved) {
          warnings.push(`Country resolved: "${c}" → ${code}`);
        }
        return code;
      }
      errors.push(`Unrecognized country: "${c}"`);
      return c.toUpperCase();
    });
  return { countries, errors, warnings };
}

function normalizeRegion(raw: string | undefined): { regions: PartnerKeyRegion[]; errors: string[]; warnings: string[] } {
  if (!raw || !raw.trim()) return { regions: [], errors: [], warnings: [] };
  const warnings: string[] = [];
  const errors: string[] = [];
  const trimmed = raw.trim().toUpperCase();
  const mapped = REGION_MAP[trimmed];
  if (mapped) {
    if (trimmed === 'NA') {
      warnings.push('NA region mapped to DOMESTIC — confirm this is North America, not N/A');
    }
    return { regions: [mapped], errors, warnings };
  }
  errors.push(`Invalid region: "${raw.trim()}" — must be one of: APAC, EMEA, LATAM, NA, WORLDWIDE`);
  return { regions: [], errors, warnings };
}

// Country → region mapping for cross-validation.
// Maps ISO 3166-1 alpha-2 codes to their PartnerKeyRegion.
const COUNTRY_TO_REGION: Record<string, PartnerKeyRegion> = {
  // DOMESTIC (North America)
  US: 'DOMESTIC', CA: 'DOMESTIC', PR: 'DOMESTIC', VI: 'DOMESTIC', GU: 'DOMESTIC',
  AS: 'DOMESTIC', MP: 'DOMESTIC', UM: 'DOMESTIC',
  // LATAM (Latin America & Caribbean)
  MX: 'LATAM', GT: 'LATAM', BZ: 'LATAM', HN: 'LATAM', SV: 'LATAM', NI: 'LATAM',
  CR: 'LATAM', PA: 'LATAM', CU: 'LATAM', JM: 'LATAM', HT: 'LATAM', DO: 'LATAM',
  TT: 'LATAM', BB: 'LATAM', BS: 'LATAM', AG: 'LATAM', DM: 'LATAM', GD: 'LATAM',
  KN: 'LATAM', LC: 'LATAM', VC: 'LATAM', CO: 'LATAM', VE: 'LATAM', GY: 'LATAM',
  SR: 'LATAM', EC: 'LATAM', PE: 'LATAM', BO: 'LATAM', CL: 'LATAM', AR: 'LATAM',
  UY: 'LATAM', PY: 'LATAM', BR: 'LATAM', GF: 'LATAM', GP: 'LATAM', MQ: 'LATAM',
  CW: 'LATAM', AW: 'LATAM', BQ: 'LATAM', SX: 'LATAM',
  // EMEA (Europe, Middle East, Africa)
  // Europe
  GB: 'EMEA', IE: 'EMEA', FR: 'EMEA', DE: 'EMEA', AT: 'EMEA', CH: 'EMEA',
  BE: 'EMEA', NL: 'EMEA', LU: 'EMEA', IT: 'EMEA', ES: 'EMEA', PT: 'EMEA',
  GR: 'EMEA', CY: 'EMEA', MT: 'EMEA', DK: 'EMEA', SE: 'EMEA', NO: 'EMEA',
  FI: 'EMEA', IS: 'EMEA', EE: 'EMEA', LV: 'EMEA', LT: 'EMEA', PL: 'EMEA',
  CZ: 'EMEA', SK: 'EMEA', HU: 'EMEA', RO: 'EMEA', BG: 'EMEA', HR: 'EMEA',
  SI: 'EMEA', BA: 'EMEA', RS: 'EMEA', ME: 'EMEA', MK: 'EMEA', AL: 'EMEA',
  XK: 'EMEA', MD: 'EMEA', UA: 'EMEA', BY: 'EMEA', RU: 'EMEA', GE: 'EMEA',
  AM: 'EMEA', AZ: 'EMEA', AD: 'EMEA', MC: 'EMEA', SM: 'EMEA', VA: 'EMEA',
  LI: 'EMEA', FO: 'EMEA', GG: 'EMEA', JE: 'EMEA', IM: 'EMEA', GI: 'EMEA',
  // Middle East
  TR: 'EMEA', IL: 'EMEA', PS: 'EMEA', LB: 'EMEA', SY: 'EMEA', JO: 'EMEA',
  IQ: 'EMEA', KW: 'EMEA', SA: 'EMEA', BH: 'EMEA', QA: 'EMEA', AE: 'EMEA',
  OM: 'EMEA', YE: 'EMEA', IR: 'EMEA',
  // Africa
  EG: 'EMEA', LY: 'EMEA', TN: 'EMEA', DZ: 'EMEA', MA: 'EMEA', EH: 'EMEA',
  MR: 'EMEA', ML: 'EMEA', BF: 'EMEA', NE: 'EMEA', TD: 'EMEA', SD: 'EMEA',
  SS: 'EMEA', ER: 'EMEA', DJ: 'EMEA', SO: 'EMEA', ET: 'EMEA', KE: 'EMEA',
  UG: 'EMEA', TZ: 'EMEA', RW: 'EMEA', BI: 'EMEA', CD: 'EMEA', CG: 'EMEA',
  GA: 'EMEA', GQ: 'EMEA', CM: 'EMEA', CF: 'EMEA', ST: 'EMEA', NG: 'EMEA',
  GH: 'EMEA', CI: 'EMEA', SN: 'EMEA', GM: 'EMEA', GW: 'EMEA', GN: 'EMEA',
  SL: 'EMEA', LR: 'EMEA', BJ: 'EMEA', TG: 'EMEA', CV: 'EMEA', MZ: 'EMEA',
  ZW: 'EMEA', ZM: 'EMEA', MW: 'EMEA', AO: 'EMEA', NA: 'EMEA', BW: 'EMEA',
  ZA: 'EMEA', LS: 'EMEA', SZ: 'EMEA', MG: 'EMEA', MU: 'EMEA', SC: 'EMEA',
  KM: 'EMEA', RE: 'EMEA', YT: 'EMEA',
  // APAC (Asia-Pacific)
  JP: 'APAC', KR: 'APAC', KP: 'APAC', CN: 'APAC', TW: 'APAC', HK: 'APAC',
  MO: 'APAC', MN: 'APAC', IN: 'APAC', PK: 'APAC', BD: 'APAC', LK: 'APAC',
  NP: 'APAC', BT: 'APAC', MV: 'APAC', AF: 'APAC', KZ: 'APAC', UZ: 'APAC',
  TM: 'APAC', KG: 'APAC', TJ: 'APAC', TH: 'APAC', VN: 'APAC', LA: 'APAC',
  KH: 'APAC', MM: 'APAC', MY: 'APAC', SG: 'APAC', ID: 'APAC', PH: 'APAC',
  BN: 'APAC', TL: 'APAC', AU: 'APAC', NZ: 'APAC', PG: 'APAC', FJ: 'APAC',
  SB: 'APAC', VU: 'APAC', NC: 'APAC', WS: 'APAC', TO: 'APAC', KI: 'APAC',
  MH: 'APAC', FM: 'APAC', PW: 'APAC', NR: 'APAC', TV: 'APAC', CK: 'APAC',
  NU: 'APAC', NF: 'APAC', WF: 'APAC', PF: 'APAC',
};

function crossCheckRegionCountries(
  regions: PartnerKeyRegion[],
  countries: string[],
): string[] {
  const warnings: string[] = [];
  if (regions.length === 0 || countries.length === 0) return warnings;

  // GLOBAL is compatible with all countries
  if (regions.includes('GLOBAL')) return warnings;

  const validCountries = countries.filter((c) => VALID_ISO2_CODES.has(c) && c !== 'XW');
  if (validCountries.length === 0) return warnings;

  const mismatched: string[] = [];
  for (const country of validCountries) {
    const expectedRegion = COUNTRY_TO_REGION[country];
    if (!expectedRegion) continue;
    if (!regions.includes(expectedRegion)) {
      mismatched.push(`${country} (${expectedRegion})`);
    }
  }

  if (mismatched.length > 0) {
    const regionStr = regions.join(', ');
    warnings.push(
      `Region mismatch: region is ${regionStr} but ${mismatched.join(', ')} belong to a different region — verify correctness`,
    );
  }

  return warnings;
}

function fixEncoding(name: string): string {
  return name.replace(/Telefnica/g, 'Telefónica').replace(/\x97/g, 'ó');
}

function parseCSV(csvData: string): Record<string, string>[] {
  const lines = csvData.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

// ── GET / — List all partner keys ──

router.get('/', async (req, res) => {
  try {
    const db = admin.firestore();
    const partnerId = req.query.partnerId as string | undefined;
    const search = req.query.search as string | undefined;
    const exactKey = req.query.exactKey as string | undefined;
    const activeOnly = req.query.activeOnly === 'true';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 500);

    req.log?.debug('Listing partner keys', { partnerId, search, exactKey, page, pageSize });

    // Fast path: exact key lookup via indexed Firestore query
    if (exactKey) {
      const exactSnap = await db.collection('partnerKeys').where('key', '==', exactKey).limit(1).get();
      if (exactSnap.empty) {
        res.json({ data: [], total: 0, page: 1, pageSize, totalPages: 0 });
        return;
      }
      const doc = exactSnap.docs[0];
      const keyData = { id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string; partnerId: string; key: string };
      let partnerDisplayName: string | null = null;
      if (keyData.partnerId) {
        const pDoc = await db.collection('partners').doc(keyData.partnerId).get();
        if (pDoc.exists) partnerDisplayName = pDoc.data()!.displayName;
      }
      res.json({ data: [{ ...keyData, partnerDisplayName }], total: 1, page: 1, pageSize, totalPages: 1 });
      return;
    }

    let query: admin.firestore.Query = db.collection('partnerKeys');
    if (partnerId) {
      query = query.where('partnerId', '==', partnerId);
    }

    const snap = await query.get();
    let keys = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string; partnerId: string; key: string; isActive?: boolean }));
    req.log?.debug('Fetched partner keys', { count: keys.length });

    if (activeOnly) {
      keys = keys.filter((k) => k.isActive !== false);
    }

    if (search) {
      const lower = search.toLowerCase();
      keys = keys.filter((k) => k.key?.toLowerCase().includes(lower));
    }

    const total = keys.length;
    const paged = keys.slice((page - 1) * pageSize, page * pageSize);

    const partnerIds = [...new Set(paged.map((k) => k.partnerId).filter(Boolean))];
    const partnerMap: Record<string, string> = {};
    const batchSize = 30;
    for (let i = 0; i < partnerIds.length; i += batchSize) {
      const batch = partnerIds.slice(i, i + batchSize);
      const pSnap = await db.collection('partners').where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
      for (const doc of pSnap.docs) {
        partnerMap[doc.id] = doc.data().displayName;
      }
    }

    const result = paged.map((k) => ({
      ...k,
      partnerDisplayName: partnerMap[k.partnerId] ?? null,
    }));

    req.log?.info('Partner keys listed', { total, returned: result.length, page });
    res.json({
      data: result,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    req.log?.error('Failed to list partner keys', formatError(err));
    res.status(500).json({ error: 'Failed to list partner keys', detail: String(err) });
  }
});

// ── GET /import-batches — List import batches ──

router.get('/import-batches', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('partnerKeyImportBatches').orderBy('importedAt', 'desc').get();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const batches = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        rollbackAvailable: data.importedAt > thirtyDaysAgo,
      };
    });

    res.json({ data: batches });
  } catch (err) {
    req.log?.error('Failed to list import batches', formatError(err));
    res.status(500).json({ error: 'Failed to list import batches', detail: String(err) });
  }
});

// ── POST /import-batches/:id/rollback — Rollback import batch ──

router.post('/import-batches/:id/rollback', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const batchId = req.params.id as string;

    const batchDoc = await db.collection('partnerKeyImportBatches').doc(batchId).get();
    if (!batchDoc.exists) {
      res.status(404).json({ error: 'Import batch not found' });
      return;
    }

    const batchData = batchDoc.data()!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    if (batchData.importedAt < thirtyDaysAgo) {
      res.status(400).json({ error: 'Rollback window has expired (30 days)' });
      return;
    }

    // Restore overwritten/merged records from pre-import snapshots
    let restoredCount = 0;
    if (batchData.preImportSnapshots) {
      const snapshots: Array<{ existingId: string; oldData: Record<string, unknown>; operation: string }> =
        JSON.parse(batchData.preImportSnapshots as string);

      for (let si = 0; si < snapshots.length; si += 450) {
        const chunk = snapshots.slice(si, si + 450);
        const restoreBatch = db.batch();
        for (const snap of chunk) {
          restoreBatch.set(db.collection('partnerKeys').doc(snap.existingId), snap.oldData);
          restoredCount++;
        }
        await restoreBatch.commit();
      }
    }

    // Delete newly created keys (those with importBatchId matching and createdAt set)
    const keysSnap = await db.collection('partnerKeys').where('importBatchId', '==', batchId).get();
    const newKeyDocs = keysSnap.docs.filter(d => {
      const data = d.data();
      return data.createdAt === data.updatedAt;
    });

    const batch = db.batch();
    let deletedCount = 0;
    for (const doc of newKeyDocs) {
      batch.delete(doc.ref);
      deletedCount++;
    }
    batch.delete(batchDoc.ref);
    await batch.commit();

    await logAuditEntry({
      entityType: 'partnerKey',
      entityId: batchId,
      field: 'importBatch',
      oldValue: `${deletedCount} keys deleted, ${restoredCount} restored`,
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Import batch rolled back', { batchId, deletedCount, restoredCount });
    res.json({ success: true, deleted: deletedCount, restored: restoredCount });
  } catch (err) {
    req.log?.error('Failed to rollback import batch', formatError(err));
    res.status(500).json({ error: 'Failed to rollback', detail: String(err) });
  }
});

// ── GET /:id — Get single partner key ──

router.get('/:id', async (req, res) => {
  try {
    const db = admin.firestore();
    const keyId = req.params.id as string;
    req.log?.debug('Getting partner key', { keyId });

    const doc = await db.collection('partnerKeys').doc(keyId).get();
    if (!doc.exists) {
      req.log?.warn('Partner key not found', { keyId });
      res.status(404).json({ error: 'Partner key not found' });
      return;
    }

    req.log?.info('Partner key fetched', { keyId });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    req.log?.error('Failed to get partner key', formatError(err));
    res.status(500).json({ error: 'Failed to get partner key', detail: String(err) });
  }
});

// ── POST / — Create partner key (manual) ──

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { key, partnerId, chipset, oem, kernel, os, countries, regions } = req.body;
    if (!key) {
      req.log?.warn('Partner key creation failed: missing key');
      res.status(400).json({ error: 'key is required' });
      return;
    }

    req.log?.info('Creating partner key', { key, partnerId, userId: req.user!.uid });

    const existing = await db.collection('partnerKeys').where('key', '==', key).limit(1).get();
    if (!existing.empty) {
      req.log?.warn('Partner key creation failed: duplicate key', { key });
      res.status(409).json({ error: 'Partner key already exists' });
      return;
    }

    const now = new Date().toISOString();
    const docRef = await db.collection('partnerKeys').add({
      key,
      partnerId: partnerId ?? null,
      chipset: chipset ?? null,
      oem: oem ?? null,
      kernel: kernel ?? null,
      os: os ?? null,
      countries: countries ?? [],
      regions: regions ?? [],
      isActive: true,
      source: 'manual',
      importBatchId: null,
      createdAt: now,
      createdBy: req.user!.email,
      updatedAt: now,
      updatedBy: req.user!.email,
    });

    await logAuditEntry({
      entityType: 'partnerKey',
      entityId: docRef.id,
      field: '*',
      oldValue: null,
      newValue: key,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    // Auto-link devices that were imported with this vendor slug before the key existed
    const pendingSnap = await db
      .collection('devices')
      .where('pendingPartnerKey', '==', key)
      .get();
    let linkedCount = 0;
    if (!pendingSnap.empty) {
      const batch = db.batch();
      for (const deviceDoc of pendingSnap.docs) {
        batch.update(deviceDoc.ref, {
          partnerKeyId: docRef.id,
          pendingPartnerKey: null,
          updatedAt: new Date().toISOString(),
        });
        linkedCount++;
      }
      await batch.commit();
      req.log?.info('Auto-linked pending devices to new partner key', { key, linkedCount });
    }

    // Auto-dismiss matching open new_partner_key alerts
    let dismissedAlertIds: string[] = [];
    const alertSnap = await db
      .collection('alerts')
      .where('type', '==', 'new_partner_key')
      .where('partnerKey', '==', key)
      .where('status', '==', 'open')
      .get();
    if (!alertSnap.empty) {
      const alertBatch = db.batch();
      const now2 = new Date().toISOString();
      for (const alertDoc of alertSnap.docs) {
        alertBatch.update(alertDoc.ref, {
          status: 'dismissed',
          dismissedBy: req.user!.email,
          dismissReason: 'Key Created',
          dismissedAt: now2,
        });
        dismissedAlertIds.push(alertDoc.id);
      }
      await alertBatch.commit();
      req.log?.info('Auto-dismissed new_partner_key alerts', { key, alertIds: dismissedAlertIds });
    }

    const created = await docRef.get();
    req.log?.info('Partner key created', { partnerKeyId: docRef.id, key, partnerId, linkedDevices: linkedCount, dismissedAlerts: dismissedAlertIds.length });
    res.status(201).json({ id: docRef.id, ...created.data(), linkedDevices: linkedCount, dismissedAlertIds });
  } catch (err) {
    req.log?.error('Failed to create partner key', formatError(err));
    res.status(500).json({ error: 'Failed to create partner key', detail: String(err) });
  }
});

// ── PUT /:id — Update partner key ──

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const keyId = req.params.id as string;
    req.log?.info('Updating partner key', { keyId, userId: req.user!.uid });

    const docRef = db.collection('partnerKeys').doc(keyId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Partner key not found for update', { keyId });
      res.status(404).json({ error: 'Partner key not found' });
      return;
    }

    const oldData = existing.data()!;
    const updates = { ...req.body };
    delete updates.id;
    delete updates.createdAt;
    delete updates.createdBy;
    delete updates.source;
    delete updates.importBatchId;
    updates.updatedAt = new Date().toISOString();
    updates.updatedBy = req.user!.email;

    await docRef.update(updates);
    await diffAndLog('partnerKey', keyId, oldData, updates, req.user!.uid, req.user!.email);

    const updated = await docRef.get();
    req.log?.info('Partner key updated', { keyId, updatedFields: Object.keys(req.body) });
    res.json({ id: docRef.id, ...updated.data() });
  } catch (err) {
    req.log?.error('Failed to update partner key', formatError(err));
    res.status(500).json({ error: 'Failed to update partner key', detail: String(err) });
  }
});

// ── DELETE /:id — Delete partner key ──

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const keyId = req.params.id as string;
    req.log?.info('Deleting partner key', { keyId, userId: req.user!.uid });

    const docRef = db.collection('partnerKeys').doc(keyId);
    const existing = await docRef.get();
    if (!existing.exists) {
      req.log?.warn('Partner key not found for deletion', { keyId });
      res.status(404).json({ error: 'Partner key not found' });
      return;
    }

    const keyValue = existing.data()!.key;
    await docRef.delete();
    await logAuditEntry({
      entityType: 'partnerKey',
      entityId: keyId,
      field: '*',
      oldValue: keyValue,
      newValue: null,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Partner key deleted', { keyId, key: keyValue });
    res.json({ success: true });
  } catch (err) {
    req.log?.error('Failed to delete partner key', formatError(err));
    res.status(500).json({ error: 'Failed to delete partner key', detail: String(err) });
  }
});

// ── POST /import/preview — Parse CSV and return preview ──

router.post('/import/preview', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { csvData } = req.body;
    if (!csvData) {
      res.status(400).json({ error: 'csvData is required' });
      return;
    }

    const fixed = fixEncoding(csvData);
    const rawRows = parseCSV(fixed);

    const expectedColumns = ['partner_key', 'friendly_partner_name', 'countries_operate_iso2', 'regions_operate', 'chipset', 'oem', 'kernel', 'os'];
    if (rawRows.length > 0) {
      const headers = Object.keys(rawRows[0]).map((h) => h.toLowerCase().trim());
      const missing = expectedColumns.filter((col) => {
        if (col === 'kernel') return !headers.includes('kernel') && !headers.includes('kernal');
        return !headers.includes(col);
      });
      if (missing.length > 0) {
        res.status(400).json({ error: `Missing required columns: ${missing.join(', ')}` });
        return;
      }
    }

    const partnersSnap = await db.collection('partners').get();
    const partners = partnersSnap.docs.map((d) => ({
      id: d.id,
      displayName: d.data().displayName as string,
    }));

    const aliases = await loadActiveAliases(db);
    const partnerLookup = new Map<string, string>();
    for (const p of partners) partnerLookup.set(p.id, p.displayName);

    const existingKeysSnap = await db.collection('partnerKeys').get();
    const existingKeyMap = new Map<string, { id: string; data: Record<string, unknown> }>();
    for (const doc of existingKeysSnap.docs) {
      const data = doc.data();
      existingKeyMap.set(data.key as string, { id: doc.id, data: data as Record<string, unknown> });
    }

    const PK_COMPARE_FIELDS = ['countries', 'regions', 'chipset', 'oem', 'kernel', 'os', 'partnerId'] as const;

    // Track within-file duplicates
    const seenInFile = new Map<string, number>();

    const rows = rawRows.map((raw, rowIdx) => {
      const key = stripEmoji((raw['partner_key'] ?? '').trim());
      const friendlyName = stripEmoji(fixEncoding((raw['friendly_partner_name'] ?? '').trim()));
      const { countries, errors: countryErrors, warnings: countryWarnings } = normalizeCountries(raw['countries_operate_iso2']);
      const { regions, errors: regionErrors, warnings: regionWarnings } = normalizeRegion(raw['regions_operate']);
      const chipset = (raw['chipset'] ?? '').trim() || null;
      const oem = (raw['oem'] ?? '').trim() || null;
      const kernel = (raw['kernel'] ?? raw['kernal'] ?? '').trim() || null;
      const os = (raw['os'] ?? '').trim() || null;

      const regionCountryWarnings = crossCheckRegionCountries(regions, countries);
      const warnings: string[] = [...countryWarnings, ...regionWarnings, ...regionCountryWarnings];
      const errors: string[] = [...countryErrors, ...regionErrors];

      if (!key) {
        errors.push('Missing partner_key');
      }

      let partnerId: string | null = null;
      let partnerDisplayName: string | null = null;
      let matchConfidence: MatchConfidence = 'unmatched';

      if (friendlyName) {
        const lowerName = friendlyName.toLowerCase();
        const exactMatch = partners.find((p) => p.displayName.toLowerCase() === lowerName);
        if (exactMatch) {
          partnerId = exactMatch.id;
          partnerDisplayName = exactMatch.displayName;
          matchConfidence = 'exact';
        } else {
          const aliasContext = { region: regions[0], country_iso: countries[0] };
          const aliasResult = resolvePartnerAlias(friendlyName, aliases, partnerLookup, aliasContext);
          if (aliasResult) {
            partnerId = aliasResult.partnerId;
            partnerDisplayName = aliasResult.partnerDisplayName;
            matchConfidence = aliasResult.matchConfidence;
            warnings.push(`Resolved via alias: "${friendlyName}" → "${aliasResult.partnerDisplayName}"`);
          } else {
            let bestScore = 0;
            let bestMatch: typeof partners[0] | null = null;
            for (const p of partners) {
              const score = jaroWinkler(lowerName, p.displayName.toLowerCase());
              if (score > bestScore) {
                bestScore = score;
                bestMatch = p;
              }
            }
            if (bestMatch && bestScore >= 0.90) {
              partnerId = bestMatch.id;
              partnerDisplayName = bestMatch.displayName;
              matchConfidence = 'fuzzy';
              warnings.push(`Fuzzy match: "${friendlyName}" → "${bestMatch.displayName}" (score: ${bestScore.toFixed(2)})`);
            } else {
              matchConfidence = 'new_partner';
              partnerDisplayName = friendlyName;
            }
          }
        }
      }

      // Deduplication check
      let dedupInfo: DeduplicationInfo | undefined;

      if (key) {
        // Within-file dedup
        if (seenInFile.has(key)) {
          dedupInfo = {
            dedupStatus: 'duplicate_in_file',
            duplicateOfRow: seenInFile.get(key)!,
          };
        } else {
          seenInFile.set(key, rowIdx + 1);

          // Check against existing DST records
          const existing = existingKeyMap.get(key);
          if (existing) {
            const incoming = { countries, regions, chipset, oem, kernel, os, partnerId };
            const diffs: FieldDiff[] = [];

            for (const field of PK_COMPARE_FIELDS) {
              const ev = JSON.stringify(existing.data[field] ?? null);
              const iv = JSON.stringify(incoming[field] ?? null);
              if (ev !== iv) {
                diffs.push({
                  field,
                  existingValue: typeof existing.data[field] === 'object' ? ev : String(existing.data[field] ?? ''),
                  incomingValue: typeof incoming[field] === 'object' ? iv : String(incoming[field] ?? ''),
                });
              }
            }

            if (diffs.length === 0) {
              dedupInfo = { dedupStatus: 'duplicate', existingId: existing.id, resolution: 'skip' };
            } else {
              dedupInfo = { dedupStatus: 'conflict', existingId: existing.id, diffs };
            }
          }
        }
      }

      let status: 'ready' | 'warning' | 'error' | 'skipped' = 'ready';
      if (errors.length > 0) status = 'error';
      else if (warnings.length > 0) status = 'warning';

      return {
        key,
        friendlyPartnerName: friendlyName,
        countries,
        regions,
        chipset,
        oem,
        kernel,
        os,
        partnerId,
        partnerDisplayName,
        matchConfidence,
        warnings,
        errors,
        status,
        dedupInfo,
      };
    });

    const readyCount = rows.filter((r) => r.status === 'ready').length;
    const warningCount = rows.filter((r) => r.status === 'warning').length;
    const errorCount = rows.filter((r) => r.status === 'error').length;
    const newCount = rows.filter((r) => !r.dedupInfo).length;
    const duplicateCount = rows.filter((r) => r.dedupInfo?.dedupStatus === 'duplicate').length;
    const conflictCount = rows.filter((r) => r.dedupInfo?.dedupStatus === 'conflict').length;
    const inFileDuplicateCount = rows.filter((r) => r.dedupInfo?.dedupStatus === 'duplicate_in_file').length;

    const newPartnerNames = new Set(
      rows
        .filter((r) => r.matchConfidence === 'new_partner' && r.friendlyPartnerName && r.status !== 'error')
        .map((r) => r.friendlyPartnerName),
    );
    const newPartnerCount = newPartnerNames.size;

    res.json({
      rows,
      totalRows: rows.length,
      readyCount,
      warningCount,
      errorCount,
      skippedCount: errorCount,
      newCount,
      duplicateCount,
      conflictCount,
      inFileDuplicateCount,
      newPartnerCount,
      newPartnerNames: [...newPartnerNames],
    });
  } catch (err) {
    req.log?.error('Failed to preview partner key import', formatError(err));
    res.status(500).json({ error: 'Failed to preview import', detail: String(err) });
  }
});

// ── POST /import/confirm — Confirm and execute import ──

router.post('/import/confirm', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { rows, fileName } = req.body as {
      rows: Array<{
        key: string;
        friendlyPartnerName?: string;
        matchConfidence?: MatchConfidence;
        countries: string[];
        regions: PartnerKeyRegion[];
        chipset: string | null;
        oem: string | null;
        kernel: string | null;
        os: string | null;
        partnerId: string | null;
        status: string;
        dedupInfo?: DeduplicationInfo;
      }>;
      fileName: string;
    };

    if (!rows || !Array.isArray(rows)) {
      res.status(400).json({ error: 'rows array is required' });
      return;
    }

    // Filter out rows that should be skipped
    const importable = rows.filter((r) => {
      if (r.status === 'error' || r.status === 'skipped' || !r.key) return false;
      if (r.dedupInfo?.dedupStatus === 'duplicate_in_file') return false;
      if (r.dedupInfo?.dedupStatus === 'duplicate' && r.dedupInfo.resolution !== 'overwrite') return false;
      if (r.dedupInfo?.dedupStatus === 'conflict' && r.dedupInfo.resolution === 'skip') return false;
      return true;
    });
    if (importable.length === 0) {
      res.status(400).json({ error: 'No valid rows to import' });
      return;
    }

    const now = new Date().toISOString();
    const batchRef = db.collection('partnerKeyImportBatches').doc();
    const batchId = batchRef.id;

    await batchRef.set({
      fileName: fileName ?? 'partner_key_import.csv',
      importedCount: importable.length,
      importedAt: now,
      importedBy: req.user!.uid,
      importedByEmail: req.user!.email,
    });

    // Auto-create partners for unmatched friendly names.
    // Group all rows by friendly name so each unique name creates exactly one partner,
    // and aggregate their countries/regions across all rows with that name.
    const createdPartnerMap = new Map<string, string>();
    let partnersCreated = 0;

    const newPartnerRows = importable.filter(
      (r) => r.matchConfidence === 'new_partner' && r.friendlyPartnerName && !r.partnerId,
    );
    const partnerGrouped = new Map<string, typeof importable>();
    for (const row of newPartnerRows) {
      const name = row.friendlyPartnerName!;
      if (!partnerGrouped.has(name)) partnerGrouped.set(name, []);
      partnerGrouped.get(name)!.push(row);
    }

    for (const [displayName, groupRows] of partnerGrouped) {
      const allCountries = new Set<string>();
      const allPartnerRegions = new Set<Region>();
      for (const r of groupRows) {
        for (const c of r.countries ?? []) allCountries.add(c);
        for (const pkRegion of r.regions ?? []) {
          const mapped = PK_REGION_TO_PARTNER_REGION[pkRegion];
          if (mapped) mapped.forEach((pr) => allPartnerRegions.add(pr));
        }
      }

      const partnerRef = await db.collection('partners').add({
        displayName,
        regions: [...allPartnerRegions],
        countriesIso2: [...allCountries].filter((c) => c !== 'XW'),
        createdAt: now,
        updatedAt: now,
      });
      createdPartnerMap.set(displayName, partnerRef.id);
      partnersCreated++;

      await logAuditEntry({
        entityType: 'partner',
        entityId: partnerRef.id,
        field: '*',
        oldValue: null,
        newValue: `Auto-created from partner key import: "${displayName}"`,
        userId: req.user!.uid,
        userEmail: req.user!.email,
      });

      req.log?.info('Auto-created partner from import', {
        displayName,
        partnerId: partnerRef.id,
        countries: [...allCountries],
        regions: [...allPartnerRegions],
      });
    }

    // Assign created partner IDs to rows
    for (const row of importable) {
      if (row.matchConfidence === 'new_partner' && row.friendlyPartnerName && !row.partnerId) {
        row.partnerId = createdPartnerMap.get(row.friendlyPartnerName) ?? null;
      }
    }

    const FIRESTORE_BATCH_LIMIT = 450;
    let newCount = 0;
    let overwrittenCount = 0;
    let mergedCount = 0;
    let skipped = 0;
    const newKeys: Array<{ key: string; docId: string }> = [];
    const preImportSnapshots: Array<{ existingId: string; oldData: Record<string, unknown>; operation: string }> = [];

    for (let i = 0; i < importable.length; i += FIRESTORE_BATCH_LIMIT) {
      const chunk = importable.slice(i, i + FIRESTORE_BATCH_LIMIT);
      const writeBatch = db.batch();

      for (const row of chunk) {
        const resolution = row.dedupInfo?.resolution;
        const existingId = row.dedupInfo?.existingId;

        if (existingId && (resolution === 'overwrite' || resolution === 'merge')) {
          const existingDoc = await db.collection('partnerKeys').doc(existingId).get();
          if (existingDoc.exists) {
            preImportSnapshots.push({
              existingId,
              oldData: existingDoc.data() as Record<string, unknown>,
              operation: resolution,
            });
          }

          const incomingFields: Record<string, unknown> = {
            countries: row.countries ?? [],
            regions: row.regions ?? [],
            chipset: row.chipset ?? null,
            oem: row.oem ?? null,
            kernel: row.kernel ?? null,
            os: row.os ?? null,
            partnerId: row.partnerId ?? null,
          };

          const updateData: Record<string, unknown> = {
            updatedAt: now,
            updatedBy: req.user!.email,
            importBatchId: batchId,
          };

          if (resolution === 'overwrite') {
            Object.assign(updateData, incomingFields);
            overwrittenCount++;
          } else {
            for (const [key, value] of Object.entries(incomingFields)) {
              if (value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
                updateData[key] = value;
              }
            }
            mergedCount++;
          }

          writeBatch.update(db.collection('partnerKeys').doc(existingId), updateData);
        } else {
          const existingSnap = await db.collection('partnerKeys').where('key', '==', row.key).limit(1).get();
          if (!existingSnap.empty) {
            skipped++;
            continue;
          }

          const docRef = db.collection('partnerKeys').doc();
          writeBatch.set(docRef, {
            key: row.key,
            partnerId: row.partnerId ?? null,
            countries: row.countries ?? [],
            regions: row.regions ?? [],
            chipset: row.chipset ?? null,
            oem: row.oem ?? null,
            kernel: row.kernel ?? null,
            os: row.os ?? null,
            isActive: true,
            source: 'csv_import',
            importBatchId: batchId,
            createdAt: now,
            createdBy: req.user!.email,
            updatedAt: now,
            updatedBy: req.user!.email,
          });
          newKeys.push({ key: row.key, docId: docRef.id });
          newCount++;
        }
      }

      await writeBatch.commit();
    }

    // Auto-link devices with pendingPartnerKey matching any newly created keys
    let linkedDevices = 0;
    for (const { key, docId } of newKeys) {
      const pendingSnap = await db
        .collection('devices')
        .where('pendingPartnerKey', '==', key)
        .get();
      if (!pendingSnap.empty) {
        const linkBatch = db.batch();
        for (const deviceDoc of pendingSnap.docs) {
          linkBatch.update(deviceDoc.ref, {
            partnerKeyId: docId,
            pendingPartnerKey: null,
            updatedAt: now,
          });
          linkedDevices++;
        }
        await linkBatch.commit();
      }
    }
    if (linkedDevices > 0) {
      req.log?.info('Auto-linked pending devices during bulk import', { linkedDevices });
    }

    const imported = newCount + overwrittenCount + mergedCount;
    await batchRef.update({
      importedCount: imported,
      newCount,
      overwrittenCount,
      mergedCount,
      partnersCreated,
      preImportSnapshots: preImportSnapshots.length > 0
        ? JSON.stringify(preImportSnapshots)
        : null,
    });

    await logAuditEntry({
      entityType: 'partnerKey',
      entityId: batchId,
      field: 'csvImport',
      oldValue: null,
      newValue: `${imported} keys imported from ${fileName ?? 'CSV'} (${newCount} new, ${overwrittenCount} overwritten, ${mergedCount} merged, ${partnersCreated} partners created)`,
      userId: req.user!.uid,
      userEmail: req.user!.email,
    });

    req.log?.info('Partner key import completed', { batchId, imported, newCount, overwrittenCount, mergedCount, skipped, linkedDevices, partnersCreated });
    res.json({ success: true, imported, skipped, batchId, linkedDevices, newCount, overwrittenCount, mergedCount, partnersCreated });
  } catch (err) {
    req.log?.error('Failed to import partner keys', formatError(err));
    res.status(500).json({ error: 'Failed to import partner keys', detail: String(err) });
  }
});

export default router;
