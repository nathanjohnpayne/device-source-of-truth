import type { PartnerAliasContextRules, MatchConfidence } from '../types/index.js';

export interface AliasResolutionContext {
  region?: string;
  country_iso?: string;
  device_type?: string;
  vendor?: string;
}

export interface AliasResolutionResult {
  partnerId: string;
  partnerDisplayName: string;
  matchConfidence: Extract<MatchConfidence, 'alias_direct' | 'alias_contextual'>;
  aliasUsed: string;
}

interface CachedAlias {
  id: string;
  aliasNormalized: string;
  partnerId: string | null;
  resolutionType: 'direct' | 'contextual';
  contextRules: PartnerAliasContextRules | null;
}

export async function loadActiveAliases(
  db: FirebaseFirestore.Firestore,
): Promise<CachedAlias[]> {
  const snap = await db.collection('partnerAliases')
    .where('isActive', '==', true)
    .get();

  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      aliasNormalized: (data.alias as string).toLowerCase().trim(),
      partnerId: data.partnerId ?? null,
      resolutionType: data.resolutionType as 'direct' | 'contextual',
      contextRules: data.contextRules ?? null,
    };
  });
}

function evaluateContextRules(
  rules: PartnerAliasContextRules,
  context: AliasResolutionContext,
): string | null {
  for (const rule of rules.rules) {
    let allMatch = true;
    for (const [signal, values] of Object.entries(rule.conditions)) {
      const contextVal = context[signal as keyof AliasResolutionContext];
      if (!contextVal || !values.some(v => v.toLowerCase() === contextVal.toLowerCase())) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return rule.partner_id;
  }
  return rules.fallback;
}

export function resolvePartnerAlias(
  name: string,
  aliases: CachedAlias[],
  partnerLookup: Map<string, string>,
  context?: AliasResolutionContext,
): AliasResolutionResult | null {
  const normalized = name.toLowerCase().trim();
  const match = aliases.find(a => a.aliasNormalized === normalized);
  if (!match) return null;

  if (match.resolutionType === 'direct' && match.partnerId) {
    const displayName = partnerLookup.get(match.partnerId) ?? null;
    if (!displayName) return null;
    return {
      partnerId: match.partnerId,
      partnerDisplayName: displayName,
      matchConfidence: 'alias_direct',
      aliasUsed: name,
    };
  }

  if (match.resolutionType === 'contextual' && match.contextRules) {
    const resolvedPartnerId = evaluateContextRules(match.contextRules, context ?? {});
    if (!resolvedPartnerId) return null;
    const displayName = partnerLookup.get(resolvedPartnerId) ?? null;
    if (!displayName) return null;
    return {
      partnerId: resolvedPartnerId,
      partnerDisplayName: displayName,
      matchConfidence: 'alias_contextual',
      aliasUsed: name,
    };
  }

  return null;
}
