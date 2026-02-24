const XLSX = require('xlsx');
const wb = XLSX.readFile(process.cwd() + '/airtable-import/airtable_export_2-8-2025.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];

const wsRaw = XLSX.utils.sheet_to_json(ws, {header: 1});
console.log('Raw header row:', JSON.stringify(wsRaw[0]));

const data = XLSX.utils.sheet_to_json(ws);

// Sparse column analysis  
const cols = ['Device ID', 'Vendor', 'Country', 'Live ADK Version', 'DRM', '64 bit'];
for (const col of cols) {
  const vals = data.filter(r => r[col] !== undefined && r[col] !== null && r[col] !== '');
  console.log('\n' + col + ': ' + vals.length + ' entries populated');
  const uniques = [...new Set(vals.map(r => String(r[col])))];
  console.log('  Unique values (' + uniques.length + '): ' + uniques.slice(0, 60).join(' | '));
}

// Show all unique Device + Partner combos
console.log('\n=== All Partners ===');
const partners = [...new Set(data.map(r => r.Partner))].sort();
console.log(partners.join(', '));

// Count per partner
console.log('\n=== Devices per Partner ===');
for (const p of partners) {
  const devices = data.filter(r => r.Partner === p);
  console.log(p + ': ' + devices.length + ' devices');
}

// List all devices per partner for matching
console.log('\n=== ALL Device Names by Partner ===');
for (const p of partners) {
  const devices = data.filter(r => r.Partner === p).map(r => r.Device);
  console.log(p + ': ' + devices.join(' | '));
}
