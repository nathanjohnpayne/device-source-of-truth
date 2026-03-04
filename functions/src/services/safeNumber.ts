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

/**
 * Safely coerce a CSV/Firestore field to a boolean.
 * Treats "true", "yes", "1", "y" as true; "false", "no", "0", "n" as false; everything else as null.
 */
export function safeBool(val: unknown): boolean | null {
  if (typeof val === 'boolean') return val;
  if (val == null) return null;
  const s = String(val).trim().toLowerCase();
  if (!s || s === 'n/a') return null;
  if (['true', 'yes', '1', 'y'].includes(s)) return true;
  if (['false', 'no', '0', 'n'].includes(s)) return false;
  return null;
}

/**
 * Safely coerce a CSV/Firestore field to a trimmed string or null.
 * Returns null for empty/whitespace-only/n-a values.
 */
export function safeString(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'n/a') return null;
  return s;
}

/**
 * Safely coerce a CSV/Firestore field to an integer or null.
 * Unlike safeNumber (which returns 0 for invalid), this returns null.
 */
export function safeInt(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number' && !isNaN(val)) return Math.round(val);
  const s = String(val).replace(/,/g, '').trim();
  if (!s || s.toLowerCase() === 'n/a') return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/**
 * Safely coerce a CSV/Firestore field to a float or null.
 */
export function safeFloat(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const s = String(val).replace(/,/g, '').trim();
  if (!s || s.toLowerCase() === 'n/a') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
