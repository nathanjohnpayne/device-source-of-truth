/**
 * DST-042: Universal AI Import Framework
 *
 * Field-type-aware batching model that groups all ambiguous values of the same
 * type across the entire file into a single API call, dispatched in parallel.
 * Any import flow can opt in by declaring its field type mappings via
 * registerImportFlow() — no per-flow AI integration code required.
 */

import Anthropic from '@anthropic-ai/sdk';
import { log, formatError } from './logger.js';
import type {
  AIFieldType,
  DisambiguationFieldResult,
  ClarificationQuestion,
  ClarificationQuestionType,
  DisambiguationResponse,
} from '../types/index.js';

// ── Constants ──

const AI_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_PER_BATCH = 4000;
const API_TIMEOUT_MS = 5000;
export const AUTO_RESOLVE_THRESHOLD = 0.90;
export const VERIFY_THRESHOLD = 0.75;

// ── Types ──

export interface ImportFlowFieldMapping {
  csvColumn: string;
  fieldType: AIFieldType;
  optionsKey?: string;
}

export interface ImportFlowRegistration {
  flowId: string;
  fields: ImportFlowFieldMapping[];
}

interface PartnerRef {
  id: string;
  displayName: string;
}

interface BatchEntry {
  rowIndex: number;
  field: string;
  rawValue: string;
  contextSignals: Record<string, string>;
}

interface FieldTypeBatch {
  fieldType: AIFieldType;
  batchKey: string;
  entries: BatchEntry[];
  optionsKey?: string;
}

interface DeduplicatedEntry {
  cacheKey: string;
  rawValue: string;
  contextSignals: Record<string, string>;
  rowEntries: { rowIndex: number; field: string }[];
}

interface AIBatchResponse {
  index: number;
  resolved_value: string | null;
  confidence: number;
  reasoning: string;
  needs_human: boolean;
  question: string | null;
}

// ── Flow Registry ──

const flowRegistry = new Map<string, ImportFlowRegistration>();

export function registerImportFlow(registration: ImportFlowRegistration): void {
  flowRegistry.set(registration.flowId, registration);
}

export function getFlowRegistration(flowId: string): ImportFlowRegistration | undefined {
  return flowRegistry.get(flowId);
}

export function getRegisteredFlowIds(): string[] {
  return Array.from(flowRegistry.keys());
}

// ── Built-in flow registrations ──

registerImportFlow({
  flowId: 'intake',
  fields: [
    { csvColumn: 'Country', fieldType: 'country' },
    { csvColumn: 'Region (from Partner)', fieldType: 'region' },
    { csvColumn: 'Partner', fieldType: 'partner_name' },
    { csvColumn: 'Target Launch Date', fieldType: 'date' },
    { csvColumn: 'Release Target', fieldType: 'date' },
  ],
});

registerImportFlow({
  flowId: 'partner_key',
  fields: [
    { csvColumn: 'countries_operate_iso2', fieldType: 'country' },
    { csvColumn: 'regions_operate', fieldType: 'region' },
    { csvColumn: 'chipset', fieldType: 'enum', optionsKey: 'partner_chipset' },
  ],
});

// ── Rule-based checks (only values that fail these are sent to AI) ──

const VALID_REGIONS = new Set(['APAC', 'DOMESTIC', 'EMEA', 'GLOBAL', 'LATAM']);
const EMOJI_REGEX = /[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
const AMBIGUOUS_COUNTRY_TOKENS = new Set(['SK', 'WW', 'UK', 'NA']);

function needsAIDisambiguation(
  fieldType: AIFieldType,
  rawValue: string,
  partners: PartnerRef[],
  fieldOptions?: Record<string, string[]>,
  optionsKey?: string,
): boolean {
  const trimmed = rawValue.trim();
  if (!trimmed) return false;

  switch (fieldType) {
    case 'country': {
      if (EMOJI_REGEX.test(trimmed)) return true;
      const stripped = trimmed.replace(EMOJI_REGEX, '').trim();
      const tokens = stripped.split(/[,;]/).map(t => t.trim().toUpperCase()).filter(Boolean);
      if (tokens.length === 0) return false;
      for (const token of tokens) {
        if (AMBIGUOUS_COUNTRY_TOKENS.has(token)) return true;
        if (!/^[A-Z]{2}$/.test(token)) return true;
      }
      if (trimmed.includes(',') && trimmed.includes(';')) return true;
      return false;
    }

    case 'region': {
      const tokens = trimmed.split(/[,;]/).map(t => t.trim().toUpperCase()).filter(Boolean);
      for (const token of tokens) {
        if (token === 'NA') return true;
        if (!VALID_REGIONS.has(token)) return true;
      }
      return false;
    }

    case 'partner_name': {
      const partnerNamesLower = new Set(partners.map(p => p.displayName.toLowerCase()));
      const names = trimmed.split(',').map(n => n.trim()).filter(Boolean);
      return names.some(name => !partnerNamesLower.has(name.toLowerCase()));
    }

    case 'enum': {
      if (!optionsKey || !fieldOptions?.[optionsKey]) return false;
      const validOptions = new Set(fieldOptions[optionsKey].map(o => o.toLowerCase()));
      return !validOptions.has(trimmed.toLowerCase());
    }

    case 'date': {
      const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) return false;
      const a = parseInt(match[1]);
      const b = parseInt(match[2]);
      return a <= 12 && b <= 12 && a !== b;
    }

    case 'multi_value_delimiter':
      return trimmed.includes(',') && trimmed.includes(';');

    default:
      return false;
  }
}

// ── Context signal extraction ──

const CONTEXT_MAP: Partial<Record<AIFieldType, AIFieldType[]>> = {
  country: ['partner_name', 'region'],
  region: ['country', 'partner_name'],
  partner_name: ['country', 'region'],
  date: ['partner_name', 'country'],
};

function extractContextSignals(
  fieldType: AIFieldType,
  row: Record<string, unknown>,
  registration: ImportFlowRegistration,
): Record<string, string> {
  const context: Record<string, string> = {};
  const contextTypes = CONTEXT_MAP[fieldType] ?? [];

  for (const ct of contextTypes) {
    const mapping = registration.fields.find(f => f.fieldType === ct);
    if (mapping) {
      const val = String(row[mapping.csvColumn] ?? '').trim();
      if (val) context[ct] = val;
    }
  }

  return context;
}

// ── Within-session value cache (deduplication) ──

function computeCacheKey(
  fieldType: AIFieldType,
  rawValue: string,
  contextSignals: Record<string, string>,
): string {
  return JSON.stringify([fieldType, rawValue, Object.entries(contextSignals).sort()]);
}

function deduplicateEntries(fieldType: AIFieldType, entries: BatchEntry[]): DeduplicatedEntry[] {
  const dedupMap = new Map<string, DeduplicatedEntry>();

  for (const entry of entries) {
    const cacheKey = computeCacheKey(fieldType, entry.rawValue, entry.contextSignals);

    if (dedupMap.has(cacheKey)) {
      dedupMap.get(cacheKey)!.rowEntries.push({
        rowIndex: entry.rowIndex,
        field: entry.field,
      });
    } else {
      dedupMap.set(cacheKey, {
        cacheKey,
        rawValue: entry.rawValue,
        contextSignals: entry.contextSignals,
        rowEntries: [{ rowIndex: entry.rowIndex, field: entry.field }],
      });
    }
  }

  return Array.from(dedupMap.values());
}

// ── Batch construction ──

function buildFieldTypeBatches(
  flowId: string,
  rows: Record<string, unknown>[],
  partners: PartnerRef[],
  fieldOptions?: Record<string, string[]>,
): FieldTypeBatch[] {
  const registration = getFlowRegistration(flowId);
  if (!registration) {
    log.warn(`No flow registration found for flowId: ${flowId}`);
    return [];
  }

  const batchMap = new Map<string, FieldTypeBatch>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    for (const mapping of registration.fields) {
      const rawValue = String(row[mapping.csvColumn] ?? '').trim();
      if (!rawValue) continue;

      if (!needsAIDisambiguation(
        mapping.fieldType, rawValue, partners, fieldOptions, mapping.optionsKey,
      )) continue;

      const batchKey = mapping.optionsKey
        ? `${mapping.fieldType}:${mapping.optionsKey}`
        : mapping.fieldType;

      if (!batchMap.has(batchKey)) {
        batchMap.set(batchKey, {
          fieldType: mapping.fieldType,
          batchKey,
          entries: [],
          optionsKey: mapping.optionsKey,
        });
      }

      const contextSignals = extractContextSignals(mapping.fieldType, row, registration);
      batchMap.get(batchKey)!.entries.push({
        rowIndex: i,
        field: mapping.csvColumn,
        rawValue,
        contextSignals,
      });
    }
  }

  return Array.from(batchMap.values()).filter(b => b.entries.length > 0);
}

// ── Field-type-specific prompt builders ──

function buildFieldTypeSystemPrompt(
  fieldType: AIFieldType,
  partners: PartnerRef[],
  fieldOptions?: Record<string, string[]>,
  optionsKey?: string,
): string {
  const preamble = `You are a data normalization assistant for Disney's Device Source of Truth (DST) system.
You are resolving ambiguous ${fieldType.replace(/_/g, ' ')} values from a CSV import.

Confidence guidelines:
- 0.90+ → auto-resolve (high confidence)
- 0.75–0.89 → suggest but flag for human verification
- Below 0.75 → set needs_human = true and provide a clear question

Never silently drop a value. If you cannot resolve it, preserve the raw value and ask.

Respond with ONLY a JSON array. No markdown fences, no explanation outside the array.
Each object: { "index": N, "resolved_value": "...", "confidence": 0.0-1.0, "reasoning": "one sentence", "needs_human": true|false, "question": "..." or null }`;

  switch (fieldType) {
    case 'country':
      return `${preamble}

Resolve country values to ISO 3166-1 alpha-2 codes.
Common aliases: UK → GB, USA → US, Worldwide/WW/Global → XW
SK is ambiguous: Slovakia (SK) or South Korea (KR) — use partner_name and region context.
Flag emoji should be resolved to their ISO codes.
If a cell contains multiple countries, return them comma-separated.
Context signals provided per entry: partner_name, region.`;

    case 'region':
      return `${preamble}

Resolve region values. Valid regions: APAC, DOMESTIC, EMEA, GLOBAL, LATAM
"NA" is ambiguous: North America (→ DOMESTIC) or N/A (→ null). Use country and partner_name context.
"Worldwide" or "Global" → GLOBAL
Context signals provided per entry: country, partner_name.`;

    case 'partner_name': {
      const names = partners.map(p => p.displayName).join(', ');
      return `${preamble}

Match partner names to known partners in the system.
Known partners: ${names || '(none registered yet)'}
Look for: encoding corruption (mojibake), abbreviations, brand vs. legal name, subsidiaries.
If a value clearly maps to a known partner, resolve to the exact known name.
Context signals provided per entry: country, region.`;
    }

    case 'enum': {
      const options = optionsKey && fieldOptions?.[optionsKey]
        ? fieldOptions[optionsKey].join(', ')
        : '(no options available)';
      return `${preamble}

Match values to a controlled vocabulary.
Field: ${optionsKey || 'unknown'}
Valid values: ${options}
Match closely — e.g., "Yes—Hardware" → "Yes - Hardware", extra whitespace, diacritics.`;
    }

    case 'date':
      return `${preamble}

Resolve ambiguous date formats where day ≤ 12 and month ≤ 12.
Determine if the format is MM/DD/YYYY or DD/MM/YYYY using context and patterns across all entries.
Return the resolved date in YYYY-MM-DD format.
Context signals provided per entry: partner_name, country.`;

    case 'multi_value_delimiter':
      return `${preamble}

Resolve cells with ambiguous delimiters (both ',' and ';' present).
Determine which character is the list delimiter and which appears within a value name.
Return the properly split values as a semicolon-delimited string.`;

    default:
      return preamble;
  }
}

function buildBatchUserPrompt(deduplicatedEntries: DeduplicatedEntry[]): string {
  const entries = deduplicatedEntries.map((e, idx) => ({
    index: idx,
    raw_value: e.rawValue,
    ...e.contextSignals,
  }));
  return JSON.stringify(entries, null, 2);
}

// ── API call with timeout ──

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log.warn('ANTHROPIC_API_KEY not set — AI disambiguation unavailable');
    return null;
  }
  return new Anthropic({ apiKey });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`API timeout after ${ms}ms`)), ms),
    ),
  ]);
}

async function callBatchAPI(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
): Promise<AIBatchResponse[]> {
  const response = await withTimeout(
    client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS_PER_BATCH,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    API_TIMEOUT_MS,
  );

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in API response');
  }

  const raw = textBlock.text.trim();
  const jsonStr = raw.startsWith('[')
    ? raw
    : raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error('API response is not a JSON array');
  }

  return parsed as AIBatchResponse[];
}

// ── Result helpers ──

function classifyQuestionType(fieldType: AIFieldType): ClarificationQuestionType {
  switch (fieldType) {
    case 'country': return 'country';
    case 'region': return 'region';
    case 'partner_name': return 'partner';
    case 'date': return 'date';
    case 'multi_value_delimiter': return 'delimiter';
    default: return 'other';
  }
}

function toResolutionSource(confidence: number): 'ai_auto' | 'ai_suggested' {
  return confidence >= AUTO_RESOLVE_THRESHOLD ? 'ai_auto' : 'ai_suggested';
}

function buildOptionsForFieldType(
  fieldType: AIFieldType,
  rawValue: string,
  resolvedValue: string | null,
): { value: string; label: string; suggested: boolean }[] | null {
  if (fieldType === 'country' && rawValue.toUpperCase() === 'SK') {
    return [
      { value: 'SK', label: 'SK — Slovakia', suggested: resolvedValue === 'SK' },
      { value: 'KR', label: 'KR — South Korea', suggested: resolvedValue === 'KR' },
    ];
  }
  if (fieldType === 'region') {
    return ['APAC', 'DOMESTIC', 'EMEA', 'GLOBAL', 'LATAM'].map(r => ({
      value: r,
      label: r === 'DOMESTIC' ? 'DOMESTIC (North America)' : r,
      suggested: resolvedValue === r,
    }));
  }
  return null;
}

// ── Main disambiguation function ──

export async function disambiguateWithFieldTypeBatching(
  flowId: string,
  rows: Record<string, unknown>[],
  partners: PartnerRef[],
  fieldOptions?: Record<string, string[]>,
): Promise<DisambiguationResponse> {
  const batches = buildFieldTypeBatches(flowId, rows, partners, fieldOptions);

  if (batches.length === 0) {
    return {
      fields: [],
      questions: [],
      aiFallback: false,
      aiStats: { totalResolved: 0, cachedCount: 0 },
    };
  }

  const client = getClient();
  if (!client) {
    return {
      fields: [],
      questions: [],
      aiFallback: true,
      fallbackReason: 'ANTHROPIC_API_KEY not configured',
      aiStats: { totalResolved: 0, cachedCount: 0 },
    };
  }

  log.info('Starting field-type batched disambiguation', {
    flowId,
    rowCount: rows.length,
    batchCount: batches.length,
    batchTypes: batches.map(b => `${b.fieldType}(${b.entries.length})`).join(', '),
  });

  interface BatchResult {
    fields: DisambiguationFieldResult[];
    questions: ClarificationQuestion[];
    fallback: boolean;
    fallbackFieldType?: string;
    cachedInBatch: number;
  }

  // Dispatch all field-type batches in parallel
  const batchPromises: Promise<BatchResult>[] = batches.map(
    async (batch): Promise<BatchResult> => {
      const deduped = deduplicateEntries(batch.fieldType, batch.entries);
      const cachedInBatch = batch.entries.length - deduped.length;

      const systemPrompt = buildFieldTypeSystemPrompt(
        batch.fieldType, partners, fieldOptions, batch.optionsKey,
      );
      const userPrompt = buildBatchUserPrompt(deduped);

      try {
        const aiResults = await callBatchAPI(client, systemPrompt, userPrompt);
        const fields: DisambiguationFieldResult[] = [];
        const questions: ClarificationQuestion[] = [];

        for (const aiResult of aiResults) {
          const dedupEntry = deduped[aiResult.index];
          if (!dedupEntry) continue;

          for (let j = 0; j < dedupEntry.rowEntries.length; j++) {
            const rowEntry = dedupEntry.rowEntries[j];
            const isCached = j > 0;

            fields.push({
              rowIndex: rowEntry.rowIndex,
              field: rowEntry.field,
              rawValue: dedupEntry.rawValue,
              resolvedValue: aiResult.resolved_value,
              confidence: aiResult.confidence,
              reasoning: aiResult.reasoning,
              needsHuman: aiResult.needs_human,
              question: aiResult.question,
              resolutionSource: aiResult.needs_human
                ? 'ai_suggested'
                : toResolutionSource(aiResult.confidence),
              overriddenByAdmin: false,
              cached: isCached,
            });

            if (aiResult.needs_human && aiResult.question && !isCached) {
              const qType = classifyQuestionType(batch.fieldType);
              questions.push({
                id: `q-${rowEntry.rowIndex}-${rowEntry.field}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                rowIndex: rowEntry.rowIndex,
                field: rowEntry.field,
                type: qType,
                rawValue: dedupEntry.rawValue,
                question: aiResult.question,
                suggestedValue: aiResult.resolved_value,
                options: buildOptionsForFieldType(
                  batch.fieldType, dedupEntry.rawValue, aiResult.resolved_value,
                ),
                allowFreeText: qType === 'partner' || qType === 'other',
                pattern: `${rowEntry.field}:${dedupEntry.rawValue}`,
              });
            }
          }
        }

        return { fields, questions, fallback: false, cachedInBatch };
      } catch (err) {
        log.error(
          `AI batch for ${batch.fieldType} failed, falling back to rule-based`,
          formatError(err),
        );

        const fields: DisambiguationFieldResult[] = [];
        const questions: ClarificationQuestion[] = [];

        for (const entry of batch.entries) {
          fields.push({
            rowIndex: entry.rowIndex,
            field: entry.field,
            rawValue: entry.rawValue,
            resolvedValue: null,
            confidence: 0,
            reasoning: `AI disambiguation for ${batch.fieldType} fields unavailable — manual review required`,
            needsHuman: true,
            question: `Please review "${entry.rawValue}" for field ${entry.field} (row ${entry.rowIndex + 1}).`,
            resolutionSource: 'rule_based',
            overriddenByAdmin: false,
            cached: false,
          });

          questions.push({
            id: `fallback-${entry.rowIndex}-${entry.field}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            rowIndex: entry.rowIndex,
            field: entry.field,
            type: classifyQuestionType(batch.fieldType),
            rawValue: entry.rawValue,
            question: `Please review "${entry.rawValue}" for field ${entry.field} (row ${entry.rowIndex + 1}).`,
            suggestedValue: null,
            options: null,
            allowFreeText: true,
            pattern: `${entry.field}:${entry.rawValue}`,
          });
        }

        return {
          fields,
          questions,
          fallback: true,
          fallbackFieldType: batch.fieldType,
          cachedInBatch: 0,
        };
      }
    },
  );

  const results = await Promise.all(batchPromises);

  const allFields: DisambiguationFieldResult[] = [];
  const allQuestions: ClarificationQuestion[] = [];
  const fieldTypeFallbacks: string[] = [];
  let totalCached = 0;

  for (const result of results) {
    allFields.push(...result.fields);
    allQuestions.push(...result.questions);
    totalCached += result.cachedInBatch;
    if (result.fallback && result.fallbackFieldType) {
      fieldTypeFallbacks.push(result.fallbackFieldType);
    }
  }

  const totalResolved = allFields.filter(f => !f.needsHuman).length;

  log.info('Field-type batched disambiguation complete', {
    flowId,
    totalFields: allFields.length,
    totalResolved,
    totalCached,
    questionsGenerated: allQuestions.length,
    fallbacks: fieldTypeFallbacks,
  });

  return {
    fields: allFields,
    questions: allQuestions,
    aiFallback: fieldTypeFallbacks.length > 0,
    fallbackReason: fieldTypeFallbacks.length > 0
      ? `AI fell back to rule-based for: ${fieldTypeFallbacks.join(', ')}`
      : undefined,
    fieldTypeFallbacks: fieldTypeFallbacks.length > 0 ? fieldTypeFallbacks : undefined,
    aiStats: {
      totalResolved,
      cachedCount: totalCached,
    },
  };
}
