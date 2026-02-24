import XLSX from 'xlsx';
import { lookupSpecKey } from './specKeyMap';
import type { RawDeviceData } from './normalizeDevice';

// Format C: Cablevision special case
// Each sheet is a separate device questionnaire

const SKIP_SHEETS = ['requirements matrix', 'revision history', 'api q&a', 'instructions'];

export function parseFormatC(workbook: XLSX.WorkBook, filename: string, operator: string): RawDeviceData[] {
  const devices: RawDeviceData[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.some(s => sheetName.toLowerCase().includes(s))) continue;

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (data.length < 5) continue;

    // Find description and value columns
    let descColIdx = -1;
    let valueColIdx = -1;
    let headerRowIdx = -1;

    for (let r = 0; r < Math.min(10, data.length); r++) {
      const row = data[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').toLowerCase().trim();
        if (cell === 'description') {
          descColIdx = c;
          headerRowIdx = r;
        }
      }
      if (descColIdx >= 0) break;
    }

    if (headerRowIdx === -1 || descColIdx === -1) continue;

    // The value column is typically the one after "SAMPLE RESPONSE"
    const headerRow = data[headerRowIdx];
    if (!headerRow) continue;

    for (let c = descColIdx + 1; c < headerRow.length; c++) {
      const cell = String(headerRow[c] || '').toLowerCase().trim();
      if (cell !== 'sample response' && cell !== 'sample' && cell !== 'category' && cell !== '') {
        valueColIdx = c;
        break;
      }
    }

    if (valueColIdx === -1) {
      // Fallback: use column after sample response or description + 2
      valueColIdx = descColIdx + 2;
    }

    const specMap: Record<string, string> = {};

    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;

      const description = row[descColIdx];
      if (!description) continue;
      const descStr = String(description).trim();
      if (!descStr) continue;

      const value = row[valueColIdx];
      const valueStr = value != null ? String(value).trim() : '';

      const fieldName = lookupSpecKey(descStr);
      if (fieldName && valueStr) {
        specMap[fieldName] = valueStr;
      }
    }

    devices.push({
      specMap,
      operator,
      sourceFile: filename,
      deviceColumnName: sheetName,
    });
  }

  return devices;
}
