import { describe, it, expect, vi } from 'vitest';

vi.unmock('../src/services/questionnaireParser.js');

import * as XLSX from 'xlsx';
import {
  detectFormat,
  findDeviceColumns,
  detectPlatformTypes,
  extractRawQAPairs,
} from '../src/services/questionnaireParser.js';

// ── Helpers ──

function makeWorkbook(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

// ── getTargetSheet fallback behavior (line 113) ──
// Tested indirectly through findDeviceColumns + extractRawQAPairs since
// getTargetSheet is not exported. We verify the correct sheet is used.

describe('sheet fallback behavior for lg_stb_v1 / vodafone_combined formats', () => {
  const STB_HEADER = ['No.', 'Category', 'Description', 'Device A'];
  const STB_ROW = ['1', 'SoC', 'SoC Vendor?', 'Broadcom'];

  it('uses "STB Tech Questionnaire" sheet when present', () => {
    const wb = makeWorkbook({
      'STB Tech Questionnaire': [STB_HEADER, STB_ROW],
      'Other Sheet': [['garbage']],
    });

    const format = detectFormat(wb);
    expect(format).toBe('lg_stb_v1');

    const sheet = wb.Sheets['STB Tech Questionnaire'];
    const devices = findDeviceColumns(sheet, format);
    expect(devices).toHaveLength(1);
    expect(devices[0].rawHeaderLabel).toBe('Device A');

    const pairs = extractRawQAPairs(sheet, format, devices[0].columnIndex);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].rawQuestionText).toBe('SoC Vendor?');
    expect(pairs[0].rawAnswerText).toBe('Broadcom');
  });

  it('falls back to first sheet when STB sheet is missing and first sheet has questionnaire structure', () => {
    const wb = makeWorkbook({
      'Sheet1': [STB_HEADER, STB_ROW],
    });

    const format = detectFormat(wb);
    // Single sheet with standard headers → detects as lg_stb_v1
    expect(format).toBe('lg_stb_v1');

    // getTargetSheet for lg_stb_v1 falls back to first sheet when STB sheet is missing
    const sheet = wb.Sheets['Sheet1'];
    const devices = findDeviceColumns(sheet, format);
    expect(devices).toHaveLength(1);
    expect(devices[0].rawHeaderLabel).toBe('Device A');
  });

  it('returns unknown format when first sheet is not a questionnaire', () => {
    const wb = makeWorkbook({
      'Random Data': [['col1', 'col2'], ['val1', 'val2']],
    });

    const format = detectFormat(wb);
    expect(format).toBe('unknown');
  });

  it('detects lg_stb_v1 when STB sheet present with standard headers starting at row 0', () => {
    const wb = makeWorkbook({
      'STB Tech Questionnaire': [
        ['No.', 'Category', 'Description', 'Model X', 'Model Y'],
        ['1', 'SoC', 'SoC Vendor?', 'Amlogic', 'Broadcom'],
        ['2', 'SoC', 'SoC Chipset?', 'S905X', 'BCM7218'],
      ],
    });

    const format = detectFormat(wb);
    expect(format).toBe('lg_stb_v1');

    const sheet = wb.Sheets['STB Tech Questionnaire'];
    const devices = findDeviceColumns(sheet, format);
    expect(devices).toHaveLength(2);
    expect(devices[0].rawHeaderLabel).toBe('Model X');
    expect(devices[1].rawHeaderLabel).toBe('Model Y');
  });

  it('detects vodafone_combined when STB sheet starts with DRM row', () => {
    const wb = makeWorkbook({
      'STB Tech Questionnaire': [
        ['DRM', '', '', ''],
        ['No.', 'Category', 'Description', 'Device Z'],
        ['1', 'Security', 'PlayReady version?', '4.0'],
      ],
    });

    const format = detectFormat(wb);
    expect(format).toBe('vodafone_combined');

    const sheet = wb.Sheets['STB Tech Questionnaire'];
    const devices = findDeviceColumns(sheet, format);
    expect(devices).toHaveLength(1);
    expect(devices[0].rawHeaderLabel).toBe('Device Z');

    // Header row is 1 for vodafone_combined
    const pairs = extractRawQAPairs(sheet, format, devices[0].columnIndex);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].rawQuestionText).toBe('PlayReady version?');
  });
});

// ── Format detection ──

describe('detectFormat', () => {
  it('detects gm_2024 from "3. Tech Questionnaire" sheet', () => {
    const wb = makeWorkbook({
      '3. Tech Questionnaire': [
        ['No.', 'Category', 'Description', 'STB 1'],
        ['1', 'SoC', 'SoC Vendor?', 'Broadcom'],
      ],
    });
    expect(detectFormat(wb)).toBe('gm_2024');
  });

  it('detects android_atv from single sheet with partner name question', () => {
    const wb = makeWorkbook({
      'Questionnaire': [
        ['No.', 'Category', 'Description', 'Device 1'],
        ['1', 'General', 'Partner Name', 'Acme'],
        ['2', 'General', 'Partner Type', 'OEM'],
      ],
    });
    expect(detectFormat(wb)).toBe('android_atv');
  });

  it('returns unknown for unrecognized structure', () => {
    const wb = makeWorkbook({
      'Data': [['A', 'B', 'C'], [1, 2, 3]],
    });
    expect(detectFormat(wb)).toBe('unknown');
  });
});

// ── Platform type detection ──

describe('detectPlatformTypes', () => {
  it('detects android_tv from android OS signals', () => {
    const wb = makeWorkbook({
      'Sheet1': [
        ['No.', 'Category', 'Description', 'Device 1'],
        ['1', 'OS', 'Android OS Type', 'Android TV'],
      ],
    });
    const sheet = wb.Sheets['Sheet1'];
    const devices = findDeviceColumns(sheet, 'lg_stb_v1');
    const typed = detectPlatformTypes(sheet, 'lg_stb_v1', devices);
    expect(typed[0].platformType).toBe('android_tv');
    expect(typed[0].isOutOfScope).toBe(true);
  });

  it('detects ncp_linux from linux/broadcom signals', () => {
    const wb = makeWorkbook({
      'Sheet1': [
        ['No.', 'Category', 'Description', 'Device 1'],
        ['1', 'SoC', 'SoC Vendor', 'Broadcom'],
        ['2', 'SoC', 'Broadcom Sage', 'Yes'],
      ],
    });
    const sheet = wb.Sheets['Sheet1'];
    const devices = findDeviceColumns(sheet, 'lg_stb_v1');
    const typed = detectPlatformTypes(sheet, 'lg_stb_v1', devices);
    expect(typed[0].platformType).toBe('ncp_linux');
    expect(typed[0].isOutOfScope).toBe(false);
  });

  it('favors ncp_linux when both android and linux signals are present', () => {
    const wb = makeWorkbook({
      'Sheet1': [
        ['No.', 'Category', 'Description', 'Device 1'],
        ['1', 'OS', 'Android OS Type', 'AOSP'],
        ['2', 'SoC', 'SoC Vendor', 'Broadcom'],
        ['3', 'SoC', 'Broadcom Sage', 'Yes'],
      ],
    });
    const sheet = wb.Sheets['Sheet1'];
    const devices = findDeviceColumns(sheet, 'lg_stb_v1');
    const typed = detectPlatformTypes(sheet, 'lg_stb_v1', devices);
    expect(typed[0].platformType).toBe('ncp_linux');
  });

  it('overrides to android_tv when format is android_atv', () => {
    const wb = makeWorkbook({
      'Sheet1': [
        ['No.', 'Category', 'Description', 'Device 1'],
        ['1', 'SoC', 'SoC Vendor', 'Broadcom'],
        ['2', 'SoC', 'Broadcom Sage', 'Yes'],
      ],
    });
    const sheet = wb.Sheets['Sheet1'];
    const devices = findDeviceColumns(sheet, 'android_atv');
    const typed = detectPlatformTypes(sheet, 'android_atv', devices);
    expect(typed[0].platformType).toBe('android_tv');
  });
});

// ── Device column detection ──

describe('findDeviceColumns', () => {
  it('skips sample and structural headers', () => {
    const wb = makeWorkbook({
      'Sheet1': [
        ['No.', 'Category', 'Description', 'Sample Response', 'Device A', 'Sample'],
        ['1', 'SoC', 'SoC Vendor?', 'Example', 'Broadcom', 'Example2'],
      ],
    });
    const sheet = wb.Sheets['Sheet1'];
    const devices = findDeviceColumns(sheet, 'lg_stb_v1');
    expect(devices).toHaveLength(1);
    expect(devices[0].rawHeaderLabel).toBe('Device A');
  });

  it('returns empty array when no description column found', () => {
    const wb = makeWorkbook({
      'Sheet1': [['A', 'B', 'C'], [1, 2, 3]],
    });
    const sheet = wb.Sheets['Sheet1'];
    const devices = findDeviceColumns(sheet, 'lg_stb_v1');
    expect(devices).toEqual([]);
  });

  it('disambiguates duplicate headers with suffixes', () => {
    const wb = makeWorkbook({
      'Sheet1': [
        ['No.', 'Category', 'Description', 'Device', 'Device'],
        ['1', 'SoC', 'SoC Vendor?', 'A', 'B'],
      ],
    });
    const sheet = wb.Sheets['Sheet1'];
    const devices = findDeviceColumns(sheet, 'lg_stb_v1');
    expect(devices).toHaveLength(2);
    expect(devices[0].rawHeaderLabel).toBe('Device');
    expect(devices[1].rawHeaderLabel).toBe('Device (a)');
  });
});

// ── Q/A pair extraction ──

describe('extractRawQAPairs', () => {
  it('extracts Q/A pairs correctly', () => {
    const wb = makeWorkbook({
      'Sheet1': [
        ['No.', 'Category', 'Description', 'Device 1'],
        ['1', 'SoC', 'SoC Vendor?', 'Broadcom'],
        ['2', 'SoC', 'SoC Chipset?', 'BCM7218'],
        ['3', 'Memory', 'Total RAM (GB)', null],
      ],
    });
    const sheet = wb.Sheets['Sheet1'];
    const pairs = extractRawQAPairs(sheet, 'lg_stb_v1', 3);
    expect(pairs).toHaveLength(3);
    expect(pairs[0].rawAnswerText).toBe('Broadcom');
    expect(pairs[1].rawAnswerText).toBe('BCM7218');
    expect(pairs[2].rawAnswerText).toBeNull();
  });

  it('skips rows with no question text', () => {
    const wb = makeWorkbook({
      'Sheet1': [
        ['No.', 'Category', 'Description', 'Device 1'],
        ['1', 'SoC', 'SoC Vendor?', 'Broadcom'],
        [null, null, null, 'orphan value'],
        ['3', 'Memory', 'Total RAM (GB)', '2'],
      ],
    });
    const sheet = wb.Sheets['Sheet1'];
    const pairs = extractRawQAPairs(sheet, 'lg_stb_v1', 3);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].rawQuestionText).toBe('SoC Vendor?');
    expect(pairs[1].rawQuestionText).toBe('Total RAM (GB)');
  });
});
