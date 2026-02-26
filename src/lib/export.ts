function escapeCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: string[][],
) {
  const timestamp = new Date().toISOString();
  const csvRows = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
    '',
    `Generated at: ${timestamp}`,
  ];

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvRows.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPdf(
  filename: string,
  title: string,
  headers: string[],
  rows: string[][],
) {
  const timestamp = new Date().toISOString();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1a1a1a; }
    h1 { font-size: 18px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f3f4f6; text-align: left; padding: 8px 12px; border: 1px solid #e5e7eb; font-weight: 600; }
    td { padding: 6px 12px; border: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    .footer { margin-top: 24px; font-size: 11px; color: #6b7280; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  <p class="footer">Generated at: ${timestamp} &middot; ${filename}</p>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
