import { loadActiveAliases, resolvePartnerAlias } from './partnerAliasResolver.js';
import type { AliasResolutionContext } from './partnerAliasResolver.js';
import type { MatchConfidence } from '../types/index.js';

export interface PartnerRecord {
  id: string;
  displayName: string;
}

export interface PartnerResolutionResult {
  partnerId: string | null;
  partnerDisplayName: string | null;
  matchConfidence: MatchConfidence;
  warning?: string;
}

export interface PartnerResolutionContext {
  partners: PartnerRecord[];
  aliases: Awaited<ReturnType<typeof loadActiveAliases>>;
  partnerLookup: Map<string, string>;
}

export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const matchWindow = Math.max(Math.floor(maxLen / 2) - 1, 0);
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Load all data needed for partner name resolution (partners list, aliases, lookup map).
 */
export async function loadPartnerResolutionContext(
  db: FirebaseFirestore.Firestore,
): Promise<PartnerResolutionContext> {
  const [partnersSnap, aliases] = await Promise.all([
    db.collection('partners').get(),
    loadActiveAliases(db),
  ]);

  const partners: PartnerRecord[] = partnersSnap.docs.map((d) => ({
    id: d.id,
    displayName: (d.data().displayName as string) ?? '',
  }));

  const partnerLookup = new Map<string, string>();
  for (const p of partners) {
    partnerLookup.set(p.id, p.displayName);
  }

  return { partners, aliases, partnerLookup };
}

/**
 * DST-046 resolution chain: exact match → alias lookup → fuzzy match (Jaro-Winkler ≥ 0.90).
 * Returns unmatched if no resolution found.
 */
export function resolvePartnerName(
  name: string,
  ctx: PartnerResolutionContext,
  aliasContext?: AliasResolutionContext,
): PartnerResolutionResult {
  if (!name) {
    return { partnerId: null, partnerDisplayName: null, matchConfidence: 'unmatched' };
  }

  const lowerName = name.toLowerCase().trim();

  const exactMatch = ctx.partners.find((p) => p.displayName.toLowerCase() === lowerName);
  if (exactMatch) {
    return {
      partnerId: exactMatch.id,
      partnerDisplayName: exactMatch.displayName,
      matchConfidence: 'exact',
    };
  }

  const aliasResult = resolvePartnerAlias(name, ctx.aliases, ctx.partnerLookup, aliasContext);
  if (aliasResult) {
    return {
      partnerId: aliasResult.partnerId,
      partnerDisplayName: aliasResult.partnerDisplayName,
      matchConfidence: aliasResult.matchConfidence,
      warning: `Resolved via alias: "${name}" → "${aliasResult.partnerDisplayName}"`,
    };
  }

  let bestScore = 0;
  let bestMatch: PartnerRecord | null = null;
  for (const p of ctx.partners) {
    const score = jaroWinkler(lowerName, p.displayName.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  }
  if (bestMatch && bestScore >= 0.90) {
    return {
      partnerId: bestMatch.id,
      partnerDisplayName: bestMatch.displayName,
      matchConfidence: 'fuzzy',
      warning: `Fuzzy match: "${name}" → "${bestMatch.displayName}" (score: ${bestScore.toFixed(2)})`,
    };
  }

  return { partnerId: null, partnerDisplayName: name, matchConfidence: 'unmatched' };
}
