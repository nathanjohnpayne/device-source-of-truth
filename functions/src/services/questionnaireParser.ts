/**
 * DST-047: Questionnaire Parser Service
 *
 * Handles format detection, device column identification, platform type
 * detection, partner auto-detection, and raw Q/A pair extraction from
 * partner device questionnaire spreadsheets.
 */

import * as XLSX from 'xlsx';
import { log, formatError } from './logger.js';
import { loadActiveAliases, resolvePartnerAlias } from './partnerAliasResolver.js';
import type { QuestionnaireFormat, PlatformType, PartnerDetectionMethod } from '../types/index.js';

// ── Types ──

export interface ParsedDevice {
  columnIndex: number;
  rawHeaderLabel: string;
  platformType: PlatformType;
  isOutOfScope: boolean;
}

export interface RawQAPair {
  rowIndex: number;
  rawQuestionText: string;
  rawAnswerText: string | null;
}

export interface PartnerDetectionResult {
  partnerId: string | null;
  confidence: number;
  method: PartnerDetectionMethod;
}

export interface ParseResult {
  format: QuestionnaireFormat;
  devices: ParsedDevice[];
  qaPairsByDevice: Map<number, RawQAPair[]>;
  partnerDetection: PartnerDetectionResult;
}

const SAMPLE_HEADERS = ['sample response', 'sample', '(sample)'];

// ── Format Detection ──

export function detectFormat(workbook: XLSX.WorkBook): QuestionnaireFormat {
  const sheetNames = workbook.SheetNames;
  const hasSTBSheet = sheetNames.some(
    n => n.toLowerCase() === 'stb tech questionnaire',
  );
  const hasTechSheet = sheetNames.some(
    n => n === '3. Tech Questionnaire',
  );

  if (hasTechSheet) {
    const sheet = workbook.Sheets['3. Tech Questionnaire'];
    if (sheet) {
      const r1a = cellValue(sheet, 0, 0);
      const r1b = cellValue(sheet, 0, 1);
      const r1c = cellValue(sheet, 0, 2);
      if (matchesHeader(r1a, 'No.') && matchesHeader(r1b, 'Category') && matchesHeader(r1c, 'Description')) {
        return 'gm_2024';
      }
    }
  }

  if (hasSTBSheet) {
    const sheet = workbook.Sheets[sheetNames.find(
      n => n.toLowerCase() === 'stb tech questionnaire',
    )!];
    if (sheet) {
      const r1a = cellValue(sheet, 0, 0);
      if (r1a && String(r1a).toLowerCase() === 'drm') {
        const r2a = cellValue(sheet, 1, 0);
        const r2b = cellValue(sheet, 1, 1);
        const r2c = cellValue(sheet, 1, 2);
        if (matchesHeader(r2a, 'No.') && matchesHeader(r2b, 'Category') && matchesHeader(r2c, 'Description')) {
          return 'vodafone_combined';
        }
      }
      const r1b = cellValue(sheet, 0, 1);
      const r1c = cellValue(sheet, 0, 2);
      if (matchesHeader(r1a, 'No.') && matchesHeader(r1b, 'Category') && matchesHeader(r1c, 'Description')) {
        return 'lg_stb_v1';
      }
    }
  }

  if (sheetNames.length === 1) {
    const sheet = workbook.Sheets[sheetNames[0]];
    if (sheet) {
      const r1a = cellValue(sheet, 0, 0);
      const r1b = cellValue(sheet, 0, 1);
      const r1c = cellValue(sheet, 0, 2);
      if (matchesHeader(r1a, 'No.') && matchesHeader(r1b, 'Category') && matchesHeader(r1c, 'Description')) {
        const allQuestions = getAllQuestionTexts(sheet, 0);
        const hasPartnerName = allQuestions.some(q =>
          q.toLowerCase().includes('partner name') || q.toLowerCase().includes('partner type'),
        );
        if (hasPartnerName) {
          return 'android_atv';
        }
        return 'lg_stb_v1';
      }
    }
  }

  return 'unknown';
}

// ── Sheet & Header Row Resolution ──

function getTargetSheet(workbook: XLSX.WorkBook, format: QuestionnaireFormat): XLSX.WorkSheet | null {
  switch (format) {
    case 'gm_2024':
      return workbook.Sheets['3. Tech Questionnaire'] ?? null;
    case 'vodafone_combined':
    case 'lg_stb_v1': {
      const name = workbook.SheetNames.find(
        n => n.toLowerCase() === 'stb tech questionnaire',
      );
      return name ? workbook.Sheets[name] : null;
    }
    case 'android_atv':
      return workbook.Sheets[workbook.SheetNames[0]] ?? null;
    case 'unknown':
      return workbook.Sheets[workbook.SheetNames[0]] ?? null;
  }
}

function getHeaderRowIndex(format: QuestionnaireFormat): number {
  return format === 'vodafone_combined' ? 1 : 0;
}

// ── Device Column Detection ──

export function findDeviceColumns(
  sheet: XLSX.WorkSheet,
  format: QuestionnaireFormat,
): ParsedDevice[] {
  const headerRow = getHeaderRowIndex(format);
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const descCol = findDescriptionColumn(sheet, headerRow, range);
  if (descCol < 0) return [];

  const devices: ParsedDevice[] = [];
  for (let c = descCol + 1; c <= range.e.c; c++) {
    const header = cellValue(sheet, headerRow, c);
    if (!header) continue;
    const headerStr = String(header).trim();
    if (!headerStr) continue;
    if (SAMPLE_HEADERS.includes(headerStr.toLowerCase())) continue;

    devices.push({
      columnIndex: c,
      rawHeaderLabel: headerStr,
      platformType: 'unknown',
      isOutOfScope: false,
    });
  }

  return devices;
}

// ── Platform Type Detection ──

export function detectPlatformTypes(
  sheet: XLSX.WorkSheet,
  format: QuestionnaireFormat,
  devices: ParsedDevice[],
): ParsedDevice[] {
  const headerRow = getHeaderRowIndex(format);
  const questions = getAllQuestionTexts(sheet, headerRow);
  const questionsLower = questions.map(q => q.toLowerCase());

  const hasAndroidSignals =
    questionsLower.some(q => q.includes('android os type') || q.includes('ro.product.device'));
  const hasLinuxSignals =
    questionsLower.some(q => q.includes('soc vendor')) &&
    questionsLower.some(q => q.includes('broadcom sage') || q.includes('broadcom'));

  return devices.map(device => {
    let platformType: PlatformType = 'unknown';

    if (hasAndroidSignals && !hasLinuxSignals) {
      platformType = 'android_tv';
    } else if (hasLinuxSignals) {
      platformType = 'ncp_linux';
    } else if (hasAndroidSignals && hasLinuxSignals) {
      platformType = 'ncp_linux';
    }

    if (format === 'android_atv') {
      platformType = 'android_tv';
    }

    return {
      ...device,
      platformType,
      isOutOfScope: platformType === 'android_tv' || platformType === ('android_aosp' as PlatformType),
    };
  });
}

// ── Partner Auto-Detection ──

export async function detectPartner(
  filename: string,
  sheet: XLSX.WorkSheet,
  format: QuestionnaireFormat,
  db: FirebaseFirestore.Firestore,
): Promise<PartnerDetectionResult> {
  const noMatch: PartnerDetectionResult = {
    partnerId: null,
    confidence: 0,
    method: 'filename',
  };

  // 1. Filename pattern matching via alias registry
  try {
    const aliases = await loadActiveAliases(db);
    const partnersSnap = await db.collection('partners').get();
    const partners = partnersSnap.docs.map(d => ({
      id: d.id,
      displayName: d.data().displayName as string,
    }));

    const nameTokens = extractPartnerTokensFromFilename(filename);
    for (const token of nameTokens) {
      const aliasResult = resolvePartnerAlias(token, aliases, new Map());
      if (aliasResult) {
        return {
          partnerId: aliasResult.partnerId,
          confidence: 0.95,
          method: 'filename',
        };
      }
      const directMatch = partners.find(
        p => p.displayName.toLowerCase() === token.toLowerCase(),
      );
      if (directMatch) {
        return {
          partnerId: directMatch.id,
          confidence: 0.95,
          method: 'filename',
        };
      }
    }

    // 2. Content signals — look for "Partner name" row
    const headerRow = getHeaderRowIndex(format);
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
    const maxScanRows = Math.min(headerRow + 30, range.e.r);

    for (let r = headerRow + 1; r <= maxScanRows; r++) {
      const questionCell = cellValue(sheet, r, 2);
      if (!questionCell) continue;
      const qText = String(questionCell).toLowerCase().trim();
      if (qText.includes('partner name') || qText === 'partner') {
        for (let c = 3; c <= range.e.c; c++) {
          const val = cellValue(sheet, r, c);
          if (val) {
            const partnerName = String(val).trim();
            const aliasResult = resolvePartnerAlias(partnerName, aliases, new Map());
            if (aliasResult) {
              return {
                partnerId: aliasResult.partnerId,
                confidence: 0.95,
                method: 'content',
              };
            }
            const directMatch = partners.find(
              p => p.displayName.toLowerCase() === partnerName.toLowerCase(),
            );
            if (directMatch) {
              return {
                partnerId: directMatch.id,
                confidence: 0.90,
                method: 'content',
              };
            }
          }
        }
      }
    }
  } catch (err) {
    log.warn('Partner detection error', { error: formatError(err) });
  }

  return noMatch;
}

// ── Raw Q/A Pair Extraction ──

export function extractRawQAPairs(
  sheet: XLSX.WorkSheet,
  format: QuestionnaireFormat,
  deviceColumnIndex: number,
): RawQAPair[] {
  const headerRow = getHeaderRowIndex(format);
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const pairs: RawQAPair[] = [];

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const questionCell = cellValue(sheet, r, 2);
    const answerCell = cellValue(sheet, r, deviceColumnIndex);

    const questionText = questionCell ? String(questionCell).trim() : null;
    const answerText = answerCell ? String(answerCell).trim() : null;

    if (!questionText && !answerText) continue;
    if (!questionText) continue;

    pairs.push({
      rowIndex: r,
      rawQuestionText: questionText,
      rawAnswerText: answerText || null,
    });
  }

  return pairs;
}

// ── Full Parse Orchestration ──

export async function parseQuestionnaire(
  fileBuffer: Buffer,
  filename: string,
  db: FirebaseFirestore.Firestore,
): Promise<ParseResult> {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const format = detectFormat(workbook);

  log.info('Questionnaire format detected', { format, filename });

  const sheet = getTargetSheet(workbook, format);
  if (!sheet) {
    throw new Error(`Could not find target sheet for format: ${format}`);
  }

  let devices = findDeviceColumns(sheet, format);
  devices = detectPlatformTypes(sheet, format, devices);

  log.info('Device columns found', {
    count: devices.length,
    headers: devices.map(d => d.rawHeaderLabel),
  });

  const qaPairsByDevice = new Map<number, RawQAPair[]>();
  for (const device of devices) {
    const pairs = extractRawQAPairs(sheet, format, device.columnIndex);
    qaPairsByDevice.set(device.columnIndex, pairs);
  }

  const partnerDetection = await detectPartner(filename, sheet, format, db);

  return { format, devices, qaPairsByDevice, partnerDetection };
}

// ── Helpers ──

function cellValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  return cell ? cell.v : undefined;
}

function matchesHeader(value: unknown, expected: string): boolean {
  if (!value) return false;
  return String(value).trim().toLowerCase() === expected.toLowerCase();
}

function findDescriptionColumn(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  range: XLSX.Range,
): number {
  for (let c = 0; c <= range.e.c; c++) {
    const val = cellValue(sheet, headerRow, c);
    if (val && String(val).trim().toLowerCase() === 'description') {
      return c;
    }
  }
  return -1;
}

function getAllQuestionTexts(sheet: XLSX.WorkSheet, headerRow: number): string[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const texts: string[] = [];
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const val = cellValue(sheet, r, 2);
    if (val) texts.push(String(val).trim());
  }
  return texts;
}

function extractPartnerTokensFromFilename(filename: string): string[] {
  const base = filename.replace(/\.(xlsx?|csv)$/i, '');
  const cleaned = base
    .replace(/Disney_?/gi, '')
    .replace(/_STB_Questionnaire.*$/i, '')
    .replace(/_Device_questionnaires.*$/i, '')
    .replace(/_Tech.*$/i, '')
    .replace(/_Q[1-4]_\d{4}$/i, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim();

  const tokens = cleaned
    .split(/[_\-\s]+/)
    .filter(t => t.length > 1)
    .map(t => t.trim());

  if (tokens.length > 1) {
    tokens.push(tokens.join(' '));
  }

  return tokens;
}
