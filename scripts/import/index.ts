import * as fs from 'fs';
import * as path from 'path';
import XLSX from 'xlsx';
import { parseFormatA } from './parseFormatA';
import { parseFormatB } from './parseFormatB';
import { parseFormatC } from './parseFormatC';
import { normalizeDevice, mergeDevices, assignPerformanceCategory, type RawDeviceData } from './normalizeDevice';
import { parseAirtable } from './parseAirtable';
import { calculateScoreBreakdown, calculateDeviceScore } from '../../src/lib/scoring';
import { initFirebaseAdmin, uploadDevices, seedAllowlist } from './uploadToFirestore';
import { seedPartners } from './seedPartners';
import type { Device } from '../../src/lib/types';

const QUESTIONNAIRES_DIR = path.join(process.cwd(), 'technical-questionnaires');
const AIRTABLE_DIR = path.join(process.cwd(), 'airtable-import');

// Operator extraction from filename
function extractOperator(filename: string): string {
  const lower = filename.toLowerCase();

  const operatorPatterns: [string, string][] = [
    ['claro brazil', 'Claro Brazil'],
    ['cablevision', 'Cablevision'],
    ['totalplay', 'TotalPlay Mexico'],
    ['foxtel', 'Foxtel'],
    ['humax', 'Humax'],
    ['virgin media', 'Liberty Global'],
    ['ziggo', 'Liberty Global'],
    ['telenet', 'Liberty Global'],
    ['liberty global', 'Liberty Global'],
    ['commscope', 'CommScope'],
    ['orange', 'Orange'],
    ['sfr', 'SFR'],
    ['free', 'Free'],
    ['fetch', 'Fetch'],
    ['movistar', 'Movistar'],
    ['nos ', 'NOS'],
    ['polsat', 'POLSAT'],
    ['philips', 'Philips'],
    ['titanos', 'TITANOS'],
    ['tivo', 'TiVo'],
    ['amlogic', 'AMLogic'],
    ['vodafone', 'Vodafone'],
    ['bt ', 'BT'],
    ['telefonica', 'Telefonica Brasil'],
    ['vivo', 'Telefonica Brasil'],
    ['aoc', 'AOC'],
    ['jvc', 'JVC'],
  ];

  for (const [pattern, operator] of operatorPatterns) {
    if (lower.includes(pattern)) return operator;
  }

  // Fallback: use first meaningful word from filename
  const cleaned = filename.replace(/Disney\+.*Questionnaire/i, '').replace(/\.xlsx$/i, '').trim();
  return cleaned || 'Unknown';
}

function detectFormat(workbook: XLSX.WorkBook, filename: string): 'A' | 'B' | 'C' {
  const sheetCount = workbook.SheetNames.length;
  const sheetNames = workbook.SheetNames.map(s => s.toLowerCase());

  // Format C: Cablevision with 7 sheets
  if (filename.toLowerCase().includes('cablevision') && sheetCount >= 5) {
    return 'C';
  }

  // Format B: 4-sheet SmartTV/SoC package
  if (sheetCount >= 3 && sheetNames.some(s => s.includes('instruction') || s.includes('device spec'))) {
    return 'B';
  }

  // Default: Format A
  return 'A';
}

function processFile(filepath: string): RawDeviceData[] {
  const filename = path.basename(filepath);
  const operator = extractOperator(filename);

  console.log(`Processing: ${filename} (operator: ${operator})`);

  const workbook = XLSX.readFile(filepath);
  const format = detectFormat(workbook, filename);

  console.log(`  Format: ${format}, Sheets: ${workbook.SheetNames.length}`);

  switch (format) {
    case 'A': return parseFormatA(workbook, filename, operator);
    case 'B': return parseFormatB(workbook, filename, operator);
    case 'C': return parseFormatC(workbook, filename, operator);
  }
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== DSOT Import Pipeline ===\n');

  // Read all XLSX files
  const files = fs.readdirSync(QUESTIONNAIRES_DIR)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~'))
    .map(f => path.join(QUESTIONNAIRES_DIR, f));

  console.log(`Found ${files.length} XLSX files\n`);

  // Parse all files
  const allRawDevices: RawDeviceData[] = [];
  for (const filepath of files) {
    try {
      const devices = processFile(filepath);
      console.log(`  Found ${devices.length} devices\n`);
      allRawDevices.push(...devices);
    } catch (err) {
      console.error(`  ERROR processing ${path.basename(filepath)}:`, err);
    }
  }

  console.log(`\nTotal raw questionnaire entries: ${allRawDevices.length}`);

  // Process Airtable import files
  if (fs.existsSync(AIRTABLE_DIR)) {
    const airtableFiles = fs.readdirSync(AIRTABLE_DIR)
      .filter(f => f.endsWith('.xlsx') && !f.startsWith('~'))
      .map(f => path.join(AIRTABLE_DIR, f));

    for (const filepath of airtableFiles) {
      try {
        const filename = path.basename(filepath);
        console.log(`\nProcessing Airtable: ${filename}`);
        const workbook = XLSX.readFile(filepath);
        const airtableDevices = parseAirtable(workbook, filename);
        allRawDevices.push(...airtableDevices);
      } catch (err) {
        console.error(`  ERROR processing Airtable file:`, err);
      }
    }
    console.log(`\nTotal entries (questionnaires + Airtable): ${allRawDevices.length}`);
  }

  // Normalize all devices
  const normalizedDevices = allRawDevices.map(normalizeDevice);

  // Merge duplicates
  const deviceMap = new Map<string, Device>();
  for (const device of normalizedDevices) {
    const key = slugify(`${device.operator}_${device.modelName}`);
    if (deviceMap.has(key)) {
      deviceMap.set(key, mergeDevices(deviceMap.get(key)!, device));
    } else {
      device.id = key;
      deviceMap.set(key, device);
    }
  }

  const mergedDevices = Array.from(deviceMap.values());
  console.log(`After merging: ${mergedDevices.length} unique devices`);

  // Calculate scores and assign performance categories
  for (const device of mergedDevices) {
    device.scoreBreakdown = calculateScoreBreakdown(device);
    device.deviceScore = calculateDeviceScore(device);
    assignPerformanceCategory(device);
  }

  // Print summary
  const scores = mergedDevices.map(d => d.deviceScore);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  console.log(`\nScore summary:`);
  console.log(`  Average: ${avgScore}`);
  console.log(`  Min: ${Math.min(...scores)}`);
  console.log(`  Max: ${Math.max(...scores)}`);
  console.log(`  Excellent (80+): ${scores.filter(s => s >= 80).length}`);
  console.log(`  Good (60-79): ${scores.filter(s => s >= 60 && s < 80).length}`);
  console.log(`  Adequate (40-59): ${scores.filter(s => s >= 40 && s < 60).length}`);
  console.log(`  Limited (20-39): ${scores.filter(s => s >= 20 && s < 40).length}`);
  console.log(`  Poor (0-19): ${scores.filter(s => s < 20).length}`);

  // Print conflicts
  const conflicted = mergedDevices.filter(d => d.conflicts.length > 0);
  if (conflicted.length > 0) {
    console.log(`\nDevices with conflicts: ${conflicted.length}`);
    for (const d of conflicted.slice(0, 5)) {
      console.log(`  ${d.modelName} (${d.operator}): ${d.conflicts.length} conflicts`);
    }
  }

  if (dryRun) {
    console.log('\n--dry-run: Skipping Firestore upload.');
    console.log('\nSample device:');
    console.log(JSON.stringify(mergedDevices[0], null, 2));

    // Write JSON output for inspection
    const outputPath = path.join(process.cwd(), 'import-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(mergedDevices, null, 2));
    console.log(`\nFull output written to: ${outputPath}`);
  } else {
    initFirebaseAdmin();
    await seedAllowlist(['nathan@nathanpayne.com']);
    await seedPartners();
    await uploadDevices(mergedDevices);
    console.log('\nImport complete!');
  }
}

main().catch(console.error);
