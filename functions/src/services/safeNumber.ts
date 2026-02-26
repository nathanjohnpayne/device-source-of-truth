/**
 * Safely coerce a Firestore field to a number.
 * Handles strings like "1,4K", "614K", "1.2M", "n/a", free-text, etc.
 */
export function safeNumber(val: unknown): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (val == null) return 0;
  const s = String(val).replace(/,/g, '').trim().toLowerCase();
  if (!s || s === 'n/a') return 0;
  const suffixMatch = s.match(/^([\d.]+)\s*([kmb])?$/);
  if (suffixMatch) {
    const n = parseFloat(suffixMatch[1]);
    const mult = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[suffixMatch[2] ?? ''] ?? 1;
    return isNaN(n) ? 0 : Math.round(n * mult);
  }
  const parsed = parseFloat(s);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}
