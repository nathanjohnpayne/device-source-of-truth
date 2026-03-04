/**
 * DST-039: AI-Assisted Import Disambiguation
 *
 * STATUS: PRE-PRODUCTION / TESTING ONLY
 *
 * Calls the Anthropic Messages API to resolve ambiguous field values
 * in CSV imports. Falls back to rule-based normalization if the API
 * is unavailable or returns malformed data.
 */

import Anthropic from '@anthropic-ai/sdk';
import { log, formatError } from './logger.js';
import type {
  ImportType,
  DisambiguationFieldResult,
  ClarificationQuestion,
  ClarificationQuestionType,
  DisambiguationResponse,
} from '../types/index.js';

const AI_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_PER_BATCH = 2000;
const BATCH_SIZE = 50;
const API_TIMEOUT_MS = 5000;
const AUTO_RESOLVE_THRESHOLD = 0.90;
const VERIFY_THRESHOLD = 0.75;

interface PartnerRef {
  id: string;
  displayName: string;
}

interface AmbiguousField {
  rowIndex: number;
  field: string;
  rawValue: string;
  rowContext: Record<string, unknown>;
}

interface AIFieldResponse {
  field: string;
  raw_value: string;
  resolved_value: string | null;
  confidence: number;
  reasoning: string;
  needs_human: boolean;
  question: string | null;
}

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log.warn('ANTHROPIC_API_KEY not set — AI disambiguation unavailable');
    return null;
  }
  return new Anthropic({ apiKey });
}

function buildSystemPrompt(importType: ImportType, partners: PartnerRef[], fieldOptions?: Record<string, string[]>): string {
  const partnerNames = partners.map(p => p.displayName).join(', ');
  const importLabel = importType === 'intake' ? 'Intake Requests' : 'Partner Key Mapping';

  const validRegions = 'APAC, DOMESTIC, EMEA, GLOBAL, LATAM';

  let fieldOptionBlock = '';
  if (fieldOptions) {
    fieldOptionBlock = Object.entries(fieldOptions)
      .map(([key, vals]) => `${key}: ${vals.join(', ')}`)
      .join('\n');
  }

  return `You are a data normalization assistant for Disney's Device Source of Truth (DST) system.
You are processing a CSV import of ${importLabel}.

For each row and field marked as ambiguous, determine the most likely correct value based on:
- The field's purpose and valid value set (provided below)
- All other fields on the same row as contextual signals
- Patterns across the full file (e.g., if SK appears with APAC region on five rows and all partner names reference Korean carriers, the pattern is strong evidence for KR)
- Disney's internal region taxonomy (${validRegions})

Known partner names in the system:
${partnerNames || '(none yet)'}

Valid regions: ${validRegions}

Country codes use ISO 3166-1 alpha-2. Common aliases:
- UK → GB, USA → US, Worldwide/WW/Global/🌎 → XW

${fieldOptionBlock ? `Valid field options:\n${fieldOptionBlock}` : ''}

For each ambiguous field return a JSON object:
{
  "field": "<field_name>",
  "raw_value": "<original>",
  "resolved_value": "<best guess>",
  "confidence": 0.0-1.0,
  "reasoning": "<one sentence>",
  "needs_human": true | false,
  "question": "<question text if needs_human is true, else null>"
}

Confidence threshold for auto-resolve: 0.90.
Below 0.90, set needs_human = true and provide a question.
Never silently drop a value. If you cannot resolve it, preserve the raw value and ask.

Respond with ONLY a JSON array of these objects. No markdown, no explanation outside the array.`;
}

function buildUserPrompt(fields: AmbiguousField[]): string {
  const grouped: Record<number, { rowContext: Record<string, unknown>; fields: { field: string; rawValue: string }[] }> = {};

  for (const f of fields) {
    if (!grouped[f.rowIndex]) {
      grouped[f.rowIndex] = { rowContext: f.rowContext, fields: [] };
    }
    grouped[f.rowIndex].fields.push({ field: f.field, rawValue: f.rawValue });
  }

  const rows = Object.entries(grouped).map(([idx, data]) => ({
    row: parseInt(idx),
    context: data.rowContext,
    ambiguous_fields: data.fields,
  }));

  return JSON.stringify(rows, null, 2);
}

function identifyAmbiguousFields(
  importType: ImportType,
  rows: Record<string, unknown>[],
  partners: PartnerRef[],
): AmbiguousField[] {
  const ambiguous: AmbiguousField[] = [];
  const partnerNamesLower = new Set(partners.map(p => p.displayName.toLowerCase()));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (importType === 'partner_key') {
      const countries = String(row['countries_operate_iso2'] ?? '').trim();
      if (countries) {
        const tokens = countries.split(';').map(t => t.trim().toUpperCase()).filter(Boolean);
        for (const token of tokens) {
          if (token === 'SK' || /[\u{1F1E0}-\u{1F1FF}]/u.test(token) ||
              (token.length > 2 && !/^[A-Z]{2}$/.test(token))) {
            ambiguous.push({ rowIndex: i, field: 'countries_operate_iso2', rawValue: countries, rowContext: row });
            break;
          }
        }
      }

      const region = String(row['regions_operate'] ?? '').trim().toUpperCase();
      if (region === 'NA') {
        ambiguous.push({ rowIndex: i, field: 'regions_operate', rawValue: region, rowContext: row });
      }

      const partnerName = String(row['friendly_partner_name'] ?? '').trim();
      if (partnerName && !partnerNamesLower.has(partnerName.toLowerCase())) {
        ambiguous.push({ rowIndex: i, field: 'friendly_partner_name', rawValue: partnerName, rowContext: row });
      }
    }

    if (importType === 'intake') {
      const countries = String(row['countries'] ?? row['Country'] ?? '').trim();
      if (countries) {
        const stripped = countries.replace(/[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();
        const tokens = stripped.split(',').map(t => t.trim()).filter(Boolean);
        for (const token of tokens) {
          const upper = token.toUpperCase();
          if (upper === 'SK' || upper === 'SLOVAKIA' ||
              (token.length > 2 && !/^[A-Z]{2}$/.test(upper)) ||
              /[\u{1F1E0}-\u{1F1FF}]/u.test(countries)) {
            ambiguous.push({ rowIndex: i, field: 'countries', rawValue: countries, rowContext: row });
            break;
          }
        }
      }

      const region = String(row['regions'] ?? row['Region (from Partner)'] ?? '').trim().toUpperCase();
      if (region === 'NA' || (region && !['APAC', 'DOMESTIC', 'EMEA', 'GLOBAL', 'LATAM'].includes(region) && region !== '')) {
        ambiguous.push({ rowIndex: i, field: 'regions', rawValue: region, rowContext: row });
      }

      const partnerNames = String(row['rawPartnerNames'] ?? row['Partner'] ?? '').trim();
      if (partnerNames) {
        const names = partnerNames.split(',').map(n => n.trim()).filter(Boolean);
        for (const name of names) {
          if (!partnerNamesLower.has(name.toLowerCase())) {
            ambiguous.push({ rowIndex: i, field: 'partner', rawValue: name, rowContext: row });
          }
        }
      }

      const dateVal = String(row['targetLaunchDate'] ?? row['Target Launch Date'] ?? '').trim();
      if (dateVal) {
        const match = dateVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) {
          const day = parseInt(match[1]);
          const month = parseInt(match[2]);
          if (day <= 12 && month <= 12 && day !== month) {
            ambiguous.push({ rowIndex: i, field: 'date', rawValue: dateVal, rowContext: row });
          }
        }
      }

      // Delimiter detection for multi-value cells
      if (countries && countries.includes(',') && countries.includes(';')) {
        ambiguous.push({ rowIndex: i, field: 'delimiter', rawValue: countries, rowContext: row });
      }
    }
  }

  return ambiguous;
}

function classifyQuestionType(field: string): ClarificationQuestionType {
  if (field.includes('countr')) return 'country';
  if (field.includes('region')) return 'region';
  if (field.includes('partner') || field === 'friendly_partner_name') return 'partner';
  if (field.includes('date')) return 'date';
  if (field.includes('delimiter')) return 'delimiter';
  return 'other';
}

function toResolutionSource(confidence: number): 'ai_auto' | 'ai_suggested' {
  return confidence >= AUTO_RESOLVE_THRESHOLD ? 'ai_auto' : 'ai_suggested';
}

function aiResponseToResults(
  aiFields: AIFieldResponse[],
  ambiguousFields: AmbiguousField[],
): { fields: DisambiguationFieldResult[]; questions: ClarificationQuestion[] } {
  const fields: DisambiguationFieldResult[] = [];
  const questions: ClarificationQuestion[] = [];

  for (const aiField of aiFields) {
    const matchingAmbiguous = ambiguousFields.find(
      a => a.field === aiField.field && a.rawValue === aiField.raw_value,
    );
    const rowIndex = matchingAmbiguous?.rowIndex ?? 0;

    const result: DisambiguationFieldResult = {
      rowIndex,
      field: aiField.field,
      rawValue: aiField.raw_value,
      resolvedValue: aiField.resolved_value,
      confidence: aiField.confidence,
      reasoning: aiField.reasoning,
      needsHuman: aiField.needs_human,
      question: aiField.question,
      resolutionSource: aiField.needs_human ? 'ai_suggested' : toResolutionSource(aiField.confidence),
      overriddenByAdmin: false,
    };
    fields.push(result);

    if (aiField.needs_human && aiField.question) {
      const qType = classifyQuestionType(aiField.field);
      const question: ClarificationQuestion = {
        id: `q-${rowIndex}-${aiField.field}-${Date.now()}`,
        rowIndex,
        field: aiField.field,
        type: qType,
        rawValue: aiField.raw_value,
        question: aiField.question,
        suggestedValue: aiField.resolved_value,
        options: buildOptionsForField(qType, aiField),
        allowFreeText: qType === 'partner' || qType === 'other',
        pattern: `${aiField.field}:${aiField.raw_value}`,
      };
      questions.push(question);
    }
  }

  return { fields, questions };
}

function buildOptionsForField(type: ClarificationQuestionType, aiField: AIFieldResponse): { value: string; label: string; suggested: boolean }[] | null {
  if (type === 'country' && aiField.raw_value.toUpperCase() === 'SK') {
    return [
      { value: 'SK', label: 'SK — Slovakia', suggested: aiField.resolved_value === 'SK' },
      { value: 'KR', label: 'KR — South Korea', suggested: aiField.resolved_value === 'KR' },
    ];
  }
  if (type === 'region') {
    return [
      { value: 'APAC', label: 'APAC', suggested: aiField.resolved_value === 'APAC' },
      { value: 'DOMESTIC', label: 'DOMESTIC (North America)', suggested: aiField.resolved_value === 'DOMESTIC' },
      { value: 'EMEA', label: 'EMEA', suggested: aiField.resolved_value === 'EMEA' },
      { value: 'GLOBAL', label: 'GLOBAL', suggested: aiField.resolved_value === 'GLOBAL' },
      { value: 'LATAM', label: 'LATAM', suggested: aiField.resolved_value === 'LATAM' },
    ];
  }
  return null;
}

async function callAnthropicAPI(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
): Promise<AIFieldResponse[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS_PER_BATCH,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    clearTimeout(timeout);

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in API response');
    }

    const raw = textBlock.text.trim();
    // Strip markdown code fence if present
    const jsonStr = raw.startsWith('[') ? raw : raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      throw new Error('API response is not a JSON array');
    }

    return parsed as AIFieldResponse[];
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export async function disambiguate(
  importType: ImportType,
  rows: Record<string, unknown>[],
  partners: PartnerRef[],
  fieldOptions?: Record<string, string[]>,
): Promise<DisambiguationResponse> {
  const ambiguousFields = identifyAmbiguousFields(importType, rows, partners);

  if (ambiguousFields.length === 0) {
    return { fields: [], questions: [], aiFallback: false };
  }

  const client = getClient();
  if (!client) {
    return {
      fields: [],
      questions: [],
      aiFallback: true,
      fallbackReason: 'ANTHROPIC_API_KEY not configured',
    };
  }

  const systemPrompt = buildSystemPrompt(importType, partners, fieldOptions);
  const allFields: DisambiguationFieldResult[] = [];
  const allQuestions: ClarificationQuestion[] = [];
  let hadFallback = false;
  let fallbackReason: string | undefined;

  for (let i = 0; i < ambiguousFields.length; i += BATCH_SIZE) {
    const batch = ambiguousFields.slice(i, i + BATCH_SIZE);
    const userPrompt = buildUserPrompt(batch);

    try {
      const aiResults = await callAnthropicAPI(client, systemPrompt, userPrompt);
      const { fields, questions } = aiResponseToResults(aiResults, batch);
      allFields.push(...fields);
      allQuestions.push(...questions);
    } catch (err) {
      log.error('AI disambiguation batch failed, falling back to rule-based', formatError(err));
      hadFallback = true;
      fallbackReason = err instanceof Error ? err.message : String(err);

      for (const ambField of batch) {
        allFields.push({
          rowIndex: ambField.rowIndex,
          field: ambField.field,
          rawValue: ambField.rawValue,
          resolvedValue: null,
          confidence: 0,
          reasoning: 'AI disambiguation unavailable — manual review required',
          needsHuman: true,
          question: `Row ${ambField.rowIndex + 1} — please review "${ambField.rawValue}" for field ${ambField.field}.`,
          resolutionSource: 'rule_based',
          overriddenByAdmin: false,
        });

        allQuestions.push({
          id: `fallback-${ambField.rowIndex}-${ambField.field}-${Date.now()}`,
          rowIndex: ambField.rowIndex,
          field: ambField.field,
          type: classifyQuestionType(ambField.field),
          rawValue: ambField.rawValue,
          question: `Row ${ambField.rowIndex + 1} — please review "${ambField.rawValue}" for field ${ambField.field}.`,
          suggestedValue: null,
          options: null,
          allowFreeText: true,
          pattern: `${ambField.field}:${ambField.rawValue}`,
        });
      }
    }
  }

  return {
    fields: allFields,
    questions: allQuestions,
    aiFallback: hadFallback,
    fallbackReason,
  };
}

export { AUTO_RESOLVE_THRESHOLD, VERIFY_THRESHOLD };
