import XLSX from 'xlsx';
import { lookupSpecKey } from './specKeyMap';
import type { RawDeviceData } from './normalizeDevice';

// Format A: Single-sheet STB Technical Questionnaire
// Rows = spec questions, Columns = devices (transposed)

export function parseFormatA(workbook: XLSX.WorkBook, filename: string, operator: string): RawDeviceData[] {
  const devices: RawDeviceData[] = [];

  // Find the questionnaire sheet (skip known non-data sheets)
  const sheetName = workbook.SheetNames.find(name => {
    const lower = name.toLowerCase();
    return !lower.includes('revision') && !lower.includes('api q&a');
  }) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return devices;

  const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (data.length < 5) return devices;

  // Find header row: look for "Description" or "Category" in the first few rows
  let headerRowIdx = -1;
  let categoryColIdx = -1;
  let descriptionColIdx = -1;
  let firstDeviceColIdx = -1;

  for (let r = 0; r < Math.min(10, data.length); r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().trim();
      if (cell === 'category') categoryColIdx = c;
      if (cell === 'description') descriptionColIdx = c;
      if (cell === 'sample response' || cell === 'sample') {
        // First device column is after sample response
        firstDeviceColIdx = c + 1;
      }
    }
    if (descriptionColIdx >= 0) {
      headerRowIdx = r;
      break;
    }
  }

  // Fallback: if no explicit header, assume col 0=Category, col 1=Description
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    categoryColIdx = 0;
    descriptionColIdx = 1;
    firstDeviceColIdx = 3; // Skip No, Category, Description, Sample
  }

  if (firstDeviceColIdx === -1) {
    firstDeviceColIdx = descriptionColIdx + 2; // Skip sample column
  }

  const headerRow = data[headerRowIdx];
  if (!headerRow) return devices;

  // Identify device columns
  const deviceColumns: { colIdx: number; name: string }[] = [];
  for (let c = firstDeviceColIdx; c < headerRow.length; c++) {
    const name = String(headerRow[c] || '').trim();
    if (name && name.toLowerCase() !== 'sample response' && name.toLowerCase() !== 'sample') {
      deviceColumns.push({ colIdx: c, name });
    }
  }

  // For each device column, extract spec values
  for (const deviceCol of deviceColumns) {
    const specMap: Record<string, string> = {};
    let currentCategory = '';

    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;

      // Update category if present
      if (categoryColIdx >= 0 && row[categoryColIdx]) {
        currentCategory = String(row[categoryColIdx]).trim();
      }

      const description = row[descriptionColIdx];
      if (!description) continue;

      const descStr = String(description).trim();
      if (!descStr) continue;

      const value = row[deviceCol.colIdx];
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
      deviceColumnName: deviceCol.name,
    });
  }

  return devices;
}
