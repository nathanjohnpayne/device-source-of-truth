import XLSX from 'xlsx';
import { lookupSpecKey } from './specKeyMap';
import type { RawDeviceData } from './normalizeDevice';

// Format B: 4-sheet SmartTV/SoC Partner Information Package
// Sheet 1: Instructions (skip)
// Sheet 2: Device Specifications (tabular)
// Sheet 3: Sales/Market data (tabular)
// Sheet 4: Technical Questionnaire (transposed, same as Format A)

function parseDeviceSpecsSheet(sheet: XLSX.WorkSheet): Record<string, Record<string, string>> {
  const data: Record<string, string>[][] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const deviceMap: Record<string, Record<string, string>> = {};

  for (const row of data) {
    const model = String(row['Device Model'] || row['device model'] || '').trim();
    if (!model || model.toLowerCase() === 'device model') continue;
    deviceMap[model] = {};
    for (const [key, val] of Object.entries(row)) {
      deviceMap[model][key] = String(val).trim();
    }
  }

  return deviceMap;
}

function parseSalesSheet(sheet: XLSX.WorkSheet): Record<string, Array<Record<string, string>>> {
  const data: Record<string, string>[][] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const salesMap: Record<string, Array<Record<string, string>>> = {};

  for (const row of data) {
    const model = String(row['Device Model'] || row['device model'] || '').trim();
    if (!model || model.toLowerCase() === 'device model') continue;
    if (!salesMap[model]) salesMap[model] = [];
    const entry: Record<string, string> = {};
    for (const [key, val] of Object.entries(row)) {
      entry[key] = String(val).trim();
    }
    salesMap[model].push(entry);
  }

  return salesMap;
}

function parseTechQuestionnaireSheet(sheet: XLSX.WorkSheet): RawDeviceData[] {
  const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (data.length < 5) return [];

  const devices: RawDeviceData[] = [];

  // Find header row
  let headerRowIdx = -1;
  let descriptionColIdx = -1;
  let firstDeviceColIdx = -1;

  for (let r = 0; r < Math.min(10, data.length); r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase().trim();
      if (cell === 'description') {
        descriptionColIdx = c;
        headerRowIdx = r;
      }
      if (cell === 'sample response' || cell === 'sample') {
        firstDeviceColIdx = c + 1;
      }
    }
    if (descriptionColIdx >= 0) break;
  }

  if (headerRowIdx === -1 || descriptionColIdx === -1) return [];
  if (firstDeviceColIdx === -1) firstDeviceColIdx = descriptionColIdx + 2;

  const headerRow = data[headerRowIdx];
  if (!headerRow) return [];

  const deviceColumns: { colIdx: number; name: string }[] = [];
  for (let c = firstDeviceColIdx; c < headerRow.length; c++) {
    const name = String(headerRow[c] || '').trim();
    if (name && name.toLowerCase() !== 'sample response') {
      deviceColumns.push({ colIdx: c, name });
    }
  }

  for (const deviceCol of deviceColumns) {
    const specMap: Record<string, string> = {};

    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;

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
      operator: '',
      sourceFile: '',
      deviceColumnName: deviceCol.name,
    });
  }

  return devices;
}

export function parseFormatB(workbook: XLSX.WorkBook, filename: string, operator: string): RawDeviceData[] {
  const devices: RawDeviceData[] = [];

  // Find sheets by name patterns
  const specsSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('device spec'));
  const salesSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('sales') || n.toLowerCase().includes('forecast'));
  const techSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('technical') || n.toLowerCase().includes('questionnaire'));

  const deviceSpecsMap = specsSheetName ? parseDeviceSpecsSheet(workbook.Sheets[specsSheetName]) : {};
  const salesDataMap = salesSheetName ? parseSalesSheet(workbook.Sheets[salesSheetName]) : {};

  // Parse technical questionnaire sheet (main data)
  if (techSheetName) {
    const techDevices = parseTechQuestionnaireSheet(workbook.Sheets[techSheetName]);

    for (const rawDevice of techDevices) {
      rawDevice.operator = operator;
      rawDevice.sourceFile = filename;

      // Try to match with device specs and sales data
      const colName = rawDevice.deviceColumnName;
      const matchedSpecsKey = Object.keys(deviceSpecsMap).find(k =>
        colName.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(colName.toLowerCase().split(' ')[0])
      );

      if (matchedSpecsKey) {
        rawDevice.deviceSpecs = deviceSpecsMap[matchedSpecsKey];
      }

      const matchedSalesKey = Object.keys(salesDataMap).find(k =>
        colName.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(colName.toLowerCase().split(' ')[0])
      );

      if (matchedSalesKey) {
        rawDevice.salesData = salesDataMap[matchedSalesKey];
      }

      devices.push(rawDevice);
    }
  }

  // If no tech questionnaire found, create devices from specs sheet only
  if (!techSheetName && specsSheetName) {
    for (const [model, specs] of Object.entries(deviceSpecsMap)) {
      devices.push({
        specMap: {},
        operator,
        sourceFile: filename,
        deviceColumnName: model,
        deviceSpecs: specs,
        salesData: salesDataMap[model],
      });
    }
  }

  return devices;
}
