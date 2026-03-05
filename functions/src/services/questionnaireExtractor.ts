/**
 * DST-047: Questionnaire AI Extraction Service
 *
 * Per-device Cloud Tasks architecture with idempotent processing,
 * transaction-safe finalization, and safe fan-out enqueuing.
 */

import Anthropic from '@anthropic-ai/sdk';
import admin from 'firebase-admin';
import { getFunctions } from 'firebase-admin/functions';
import { log, formatError } from './logger.js';
import type {
  ConflictStatus,
  ExtractionMethod,
  ExtractionStatus,
  ExtractionTaskPayload,
  DeviceSpec,
} from '../types/index.js';
import type { RawQAPair } from './questionnaireParser.js';

// ── Constants ──

const AI_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;
const API_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 3_000;
const CHUNK_SIZE = 30;
const INTER_CHUNK_DELAY_MS = 1_500;
const TASK_QUEUE_NAME = 'locations/us-central1/functions/extractDeviceTask';
const DISPATCH_DEADLINE_SECONDS = 1800;

// ── Types ──

export interface AIExtractionResult {
  dstFieldKey: string | null;
  extractedValue: string | null;
  confidence: number;
  reasoning: string;
}

interface DeviceExtractionContext {
  partnerName: string;
  rawHeaderLabel: string;
  platformType: string;
}

// ── Spec Schema for AI Prompt ──

interface FieldSchemaEntry {
  section: string;
  key: string;
  label: string;
  type: string;
}

const SPEC_FIELD_SCHEMA: FieldSchemaEntry[] = [
  { section: 'general', key: 'modelName', label: 'Model Name (customer-facing)', type: 'text' },
  { section: 'general', key: 'modelNumber', label: 'Model Number', type: 'text' },
  { section: 'general', key: 'dateDeployed', label: 'Date STB Initially Deployed to Market', type: 'date' },
  { section: 'general', key: 'dateDeliveriesStopped', label: 'Date STB Deliveries Stopped', type: 'date|text' },
  { section: 'general', key: 'activeDevicesMonthly', label: 'Active Devices in Use - Monthly Average', type: 'text' },
  { section: 'general', key: 'totalInstalledBase', label: 'Total Installed Base (subscribers)', type: 'text' },
  { section: 'general', key: 'forecastedGrowth', label: 'Forecasted Growth/Decline', type: 'text' },
  { section: 'general', key: 'countriesDeployed', label: 'Countries Where Device Is Deployed', type: 'text' },
  { section: 'general', key: 'thirdPartyApps', label: '3rd Party Apps Deployed', type: 'text' },
  { section: 'general', key: 'connectionType', label: 'Type of Connection', type: 'enum' },
  { section: 'general', key: 'connectionTypeOther', label: 'Type of Connection - Other', type: 'text' },
  { section: 'hardware', key: 'socVendor', label: 'SoC Vendor', type: 'enum' },
  { section: 'hardware', key: 'socVendorOther', label: 'SoC Vendor - Other', type: 'text' },
  { section: 'hardware', key: 'socModelChipset', label: 'SoC Model & Chipset Revision', type: 'text' },
  { section: 'hardware', key: 'softwareArchitecture', label: 'Software Architecture', type: 'enum' },
  { section: 'hardware', key: 'softwareArchitectureOther', label: 'Software Architecture - Other', type: 'text' },
  { section: 'hardware', key: 'socBaseRefVersion', label: 'SoC Base Reference Software Version', type: 'text' },
  { section: 'hardware', key: 'socCustomizations', label: 'Customizations to SoC Base Reference Software?', type: 'boolean' },
  { section: 'hardware', key: 'socCustomizationsDesc', label: 'SoC Customizations description', type: 'text' },
  { section: 'hardware', key: 'socSupportContract', label: 'Active SoC Support Contract?', type: 'enum' },
  { section: 'hardware', key: 'socSupportExpiration', label: 'SoC Support Contract Expiration Date', type: 'date|text' },
  { section: 'hardware', key: 'cpuClockRateGhz', label: 'CPU Clock Rate (GHz)', type: 'number' },
  { section: 'hardware', key: 'cpuDmips', label: 'CPU DMIPS Rating', type: 'text' },
  { section: 'hardware', key: 'cpuCores', label: 'Number of CPU Cores', type: 'enum' },
  { section: 'hardware', key: 'cpuCoresOther', label: 'CPU Cores - Other', type: 'text' },
  { section: 'hardware', key: 'stbManufacturer', label: 'STB Manufacturer / Device vendor / ODM', type: 'text' },
  { section: 'hardware', key: 'operatingSystem', label: 'Operating System', type: 'enum' },
  { section: 'hardware', key: 'operatingSystemOther', label: 'Operating System - Other', type: 'text' },
  { section: 'hardware', key: 'osVersion', label: 'OS Version', type: 'text' },
  { section: 'hardware', key: 'osCustomization', label: 'Customizations to Base OS / Different Kernel?', type: 'enum' },
  { section: 'hardware', key: 'osCustomizationDesc', label: 'OS Customization description', type: 'text' },
  { section: 'hardware', key: 'middlewareProvider', label: 'Middleware Provider', type: 'enum' },
  { section: 'hardware', key: 'middlewareProviderOther', label: 'Middleware Provider - Other', type: 'text' },
  { section: 'hardware', key: 'middlewareVersion', label: 'Middleware Version', type: 'text' },
  { section: 'hardware', key: 'middlewareContract', label: 'Middleware Support Contract Active?', type: 'enum' },
  { section: 'hardware', key: 'middlewareContractExpiration', label: 'Middleware Contract Expiration Date', type: 'date|text' },
  { section: 'hardware', key: 'middlewareIntegrationCompany', label: 'Middleware Integration Company', type: 'text' },
  { section: 'hardware', key: 'videoDelivery', label: 'Video Delivery Support', type: 'enum' },
  { section: 'hardware', key: 'videoDeliveryOther', label: 'Video Delivery - Other', type: 'text' },
  { section: 'hardware', key: 'memoryTotalGb', label: 'Device Memory Total Size (GB)', type: 'number' },
  { section: 'hardware', key: 'memoryType', label: 'Device Memory Type', type: 'enum' },
  { section: 'hardware', key: 'memoryTypeOther', label: 'Memory Type - Other', type: 'text' },
  { section: 'hardware', key: 'ramAvailableGb', label: 'RAM Available to App (GB)', type: 'number' },
  { section: 'hardware', key: 'linuxMemoryAvailableMb', label: 'Linux System Memory Available (MB)', type: 'number' },
  { section: 'hardware', key: 'gpuMemoryAvailableMb', label: 'GPU Memory Available (MB)', type: 'number' },
  { section: 'hardware', key: 'gpuTextureMemoryMb', label: 'GPU Texture Memory (MB)', type: 'number' },
  { section: 'hardware', key: 'gpuMemorySharing', label: 'GPU Memory: Shared or Dedicated?', type: 'enum' },
  { section: 'hardware', key: 'gpuMemorySharingOther', label: 'GPU Memory Sharing - Other', type: 'text' },
  { section: 'hardware', key: 'gpuMemoryReservedMb', label: 'GPU Memory Reserved (MB)', type: 'number' },
  { section: 'hardware', key: 'storageTotalGb', label: 'Total Persistent Storage (GB)', type: 'number' },
  { section: 'hardware', key: 'storageType', label: 'Persistent Storage Type', type: 'enum' },
  { section: 'hardware', key: 'storageTypeOther', label: 'Storage Type - Other', type: 'text' },
  { section: 'hardware', key: 'storageAvailableMb', label: 'Persistent Storage Available to App (MB)', type: 'number' },
  { section: 'hardware', key: 'nonPersistentStorageMb', label: 'Non-Persistent Storage Available (MB)', type: 'number' },
  { section: 'hardware', key: 'maxAppBinarySizeMb', label: 'Max Application Binary Size (MB)', type: 'number' },
  { section: 'hardware', key: 'filesystemType', label: 'Filesystem Type', type: 'enum' },
  { section: 'hardware', key: 'filesystemTypeOther', label: 'Filesystem Type - Other', type: 'text' },
  { section: 'hardware', key: 'storageLimitations', label: 'Storage Limitations?', type: 'boolean' },
  { section: 'hardware', key: 'storageLimitationsDesc', label: 'Storage Limitations description', type: 'text' },
  { section: 'hardware', key: 'gpuAvailability', label: 'GPU Availability Level', type: 'enum' },
  { section: 'hardware', key: 'gpuAvailableForApp', label: 'GPU Available for App Use?', type: 'enum' },
  { section: 'hardware', key: 'gpuGraphicsLibrary', label: 'GPU Graphics Library', type: 'enum' },
  { section: 'hardware', key: 'gpuGraphicsLibraryOther', label: 'GPU Graphics Library - Other', type: 'text' },
  { section: 'hardware', key: 'openglEs2Apps', label: 'OTT Apps Using OpenGL ES 2.0?', type: 'enum' },
  { section: 'hardware', key: 'openglEs2AppsNames', label: 'OpenGL ES 2.0 Apps names', type: 'text' },
  { section: 'hardware', key: 'streamingInterface', label: 'OTT Streaming Interface', type: 'enum' },
  { section: 'hardware', key: 'streamingInterfaceOther', label: 'Streaming Interface - Other', type: 'text' },
  { section: 'hardware', key: 'ethernetPort', label: 'Ethernet Port Present?', type: 'enum' },
  { section: 'hardware', key: 'wifiStandards', label: 'Wi-Fi Standards Supported', type: 'text' },
  { section: 'hardware', key: 'wifiBands', label: 'Wi-Fi Bands Supported', type: 'text' },
  { section: 'hardware', key: 'mocaPresent', label: 'MoCA Present?', type: 'enum' },
  { section: 'hardware', key: 'maxStreamingThroughputMbps', label: 'Max Streaming Throughput (Mbps)', type: 'number' },
  { section: 'hardware', key: 'hdmiCapabilitiesRetrieval', label: 'HDMI Capabilities Retrieval?', type: 'enum' },
  { section: 'hardware', key: 'hdmiVersion', label: 'HDMI Version', type: 'enum' },
  { section: 'hardware', key: 'hdmiVersionOther', label: 'HDMI Version - Other', type: 'text' },
  { section: 'hardware', key: 'digitalVideoOutputModes', label: 'Digital Video Output Modes', type: 'text' },
  { section: 'hardware', key: 'analogVideoOutputModes', label: 'Analog Video Output Modes', type: 'text' },
  { section: 'hardware', key: 'uiNativeResolution', label: 'STB UI Native Resolution', type: 'enum' },
  { section: 'hardware', key: 'uiNativeResolutionOther', label: 'UI Resolution - Other', type: 'text' },
  { section: 'hardware', key: 'ottAppRestrictions', label: 'OTT App Restrictions', type: 'text' },
  { section: 'firmwareUpdates', key: 'firmwareSupported', label: 'STB Still Supported via Firmware Updates?', type: 'enum' },
  { section: 'firmwareUpdates', key: 'firmwareFrequency', label: 'Frequency of Firmware Updates', type: 'enum' },
  { section: 'firmwareUpdates', key: 'firmwareFrequencyOther', label: 'Firmware Frequency - Other', type: 'text' },
  { section: 'firmwareUpdates', key: 'internalLeadTime', label: 'Internal Lead Time to Release', type: 'text' },
  { section: 'firmwareUpdates', key: 'rolloutDuration', label: 'Rollout Duration to Homes', type: 'text' },
  { section: 'firmwareUpdates', key: 'emergencyUpdate', label: 'Emergency Firmware Update Capability?', type: 'enum' },
  { section: 'firmwareUpdates', key: 'emergencyUpdateTime', label: 'Emergency Update Time', type: 'text' },
  { section: 'firmwareUpdates', key: 'codeSigning', label: 'Code Signing Required?', type: 'boolean' },
  { section: 'firmwareUpdates', key: 'codeSigningDesc', label: 'Code Signing description', type: 'text' },
  { section: 'mediaCodec', key: 'avcH264', label: 'AVC / H.264 support', type: 'enum' },
  { section: 'mediaCodec', key: 'hevcH265', label: 'HEVC / H.265 support', type: 'enum' },
  { section: 'mediaCodec', key: 'eac3DolbyDigitalPlus', label: 'E-AC-3 / Dolby Digital Plus support', type: 'enum' },
  { section: 'mediaCodec', key: 'eac3Atmos', label: 'E-AC-3 with Atmos support', type: 'enum' },
  { section: 'mediaCodec', key: 'hdr10', label: 'HDR10 support', type: 'enum' },
  { section: 'mediaCodec', key: 'hdr10Plus', label: 'HDR10+ support', type: 'enum' },
  { section: 'mediaCodec', key: 'av1', label: 'AV1 support', type: 'enum' },
  { section: 'mediaCodec', key: 'dolbyVisionSupported', label: 'Dolby Vision Supported?', type: 'enum' },
  { section: 'mediaCodec', key: 'dolbyVisionVersion', label: 'Dolby Vision Version', type: 'text' },
  { section: 'contentProtection', key: 'drmSystem', label: 'DRM System', type: 'enum' },
  { section: 'contentProtection', key: 'encryptionScheme', label: 'Encryption Scheme', type: 'enum' },
  { section: 'contentProtection', key: 'playreadySupported', label: 'PlayReady Supported?', type: 'boolean' },
  { section: 'contentProtection', key: 'playreadyVersion', label: 'PlayReady Version', type: 'enum' },
  { section: 'contentProtection', key: 'playreadySecurityLevel', label: 'PlayReady Security Level', type: 'enum' },
  { section: 'contentProtection', key: 'widevineSupported', label: 'Widevine Supported?', type: 'boolean' },
  { section: 'contentProtection', key: 'widevineSecurityLevel', label: 'Widevine Security Level', type: 'enum' },
  { section: 'contentProtection', key: 'widevineVersion', label: 'Widevine Version', type: 'text' },
  { section: 'contentProtection', key: 'broadcomSage', label: 'Broadcom SAGE Security Coprocessor', type: 'enum' },
  { section: 'appRuntime', key: 'webEngine', label: 'HTML5 Browser / Web Engine', type: 'enum' },
  { section: 'appRuntime', key: 'webEngineVersion', label: 'Web Engine Version', type: 'text' },
  { section: 'appRuntime', key: 'adkVersion', label: 'ADK Version Supported', type: 'text' },
  { section: 'appRuntime', key: 'mseSupport', label: 'MSE Supported?', type: 'enum' },
  { section: 'appRuntime', key: 'emeSupport', label: 'EME Supported?', type: 'enum' },
  { section: 'appRuntime', key: 'jsEngine', label: 'JavaScript Engine', type: 'enum' },
  { section: 'appRuntime', key: 'jsEngineVersion', label: 'JavaScript Engine Version', type: 'text' },
  { section: 'appRuntime', key: 'wasmSupport', label: 'WebAssembly Supported?', type: 'enum' },
  { section: 'appRuntime', key: 'webglSupport', label: 'WebGL Supported?', type: 'enum' },
  { section: 'appRuntime', key: 'webCryptoSupport', label: 'Web Crypto API Supported?', type: 'enum' },
];

let cachedSchemaPrompt: string | null = null;

function buildSpecSchemaPrompt(): string {
  if (cachedSchemaPrompt) return cachedSchemaPrompt;

  const lines: string[] = [];
  let currentSection = '';
  for (const entry of SPEC_FIELD_SCHEMA) {
    if (entry.section !== currentSection) {
      currentSection = entry.section;
      lines.push(`\n## ${currentSection}`);
    }
    lines.push(`- ${entry.section}.${entry.key}: "${entry.label}" (${entry.type})`);
  }
  cachedSchemaPrompt = lines.join('\n');
  return cachedSchemaPrompt;
}

// ── Section/key lookup ──

const FIELD_KEY_TO_SECTION = new Map<string, string>();
for (const entry of SPEC_FIELD_SCHEMA) {
  FIELD_KEY_TO_SECTION.set(entry.key, entry.section);
}

export function getSectionForFieldKey(fieldKey: string): string | undefined {
  return FIELD_KEY_TO_SECTION.get(fieldKey);
}

// ── AI Extraction (per device) ──

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`API timeout after ${ms}ms`)), ms),
    ),
  ]);
}

async function extractChunk(
  qaPairs: RawQAPair[],
  chunkIndex: number,
  totalChunks: number,
  context: DeviceExtractionContext,
  systemPrompt: string,
  client: Anthropic,
): Promise<AIExtractionResult[]> {
  const pairsText = qaPairs
    .map((p, i) => `${i + 1}. Q: "${p.rawQuestionText}" | A: ${p.rawAnswerText ? `"${p.rawAnswerText}"` : '(blank)'}`)
    .join('\n');

  const userPrompt = `Partner: ${context.partnerName}
Device column header: ${context.rawHeaderLabel}
Platform type: ${context.platformType}
Batch ${chunkIndex + 1} of ${totalChunks}

Question-answer pairs:
${pairsText}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await withTimeout(
        client.messages.create({
          model: AI_MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        API_TIMEOUT_MS,
      );

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        log.warn('AI extraction chunk returned no text block', { device: context.rawHeaderLabel, chunk: chunkIndex + 1 });
        return [];
      }

      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        log.warn('AI extraction chunk returned no JSON array', { device: context.rawHeaderLabel, chunk: chunkIndex + 1, text: textBlock.text.slice(0, 200) });
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        dst_field_key: string | null;
        extracted_value: string | null;
        confidence: number;
        reasoning: string;
      }>;

      return parsed.map(r => ({
        dstFieldKey: r.dst_field_key,
        extractedValue: r.extracted_value != null ? String(r.extracted_value) : null,
        confidence: r.confidence,
        reasoning: r.reasoning,
      }));
    } catch (err) {
      const isRateLimit = err instanceof Error && (err.message.includes('429') || err.message.includes('rate_limit'));
      const isTimeout = err instanceof Error && err.message.includes('timeout');

      if ((isRateLimit || isTimeout) && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        log.warn('AI extraction chunk retrying', { attempt: attempt + 1, delay, device: context.rawHeaderLabel, chunk: chunkIndex + 1, reason: isRateLimit ? 'rate_limit' : 'timeout' });
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      log.error('AI extraction chunk failed', { error: formatError(err), device: context.rawHeaderLabel, chunk: chunkIndex + 1, attempts: attempt + 1 });
      return [];
    }
  }

  return [];
}

export async function extractDeviceFields(
  qaPairs: RawQAPair[],
  context: DeviceExtractionContext,
  client: Anthropic,
): Promise<AIExtractionResult[]> {
  const schemaPrompt = buildSpecSchemaPrompt();

  const systemPrompt = `You are a device specification extraction engine for Disney Streaming's internal device registry. Your task is to map each question-answer pair from a partner questionnaire to a normalized spec field.

Return ONLY a JSON array with one element per question-answer pair (in the same order). Each element must have:
  - dst_field_key: the canonical field name from the schema below, in "section.fieldKey" format (e.g. "hardware.socVendor"). Set to null if the question does not map to any field.
  - extracted_value: the normalized value (type-coerced per field type). For numbers, return just the numeric value. For booleans, return "true" or "false". For dates, return ISO YYYY-MM-DD format. For text, return the cleaned value. Set to null if the answer is blank, "n/a", or uninformative.
  - confidence: float 0.0-1.0
  - reasoning: one sentence explaining the extraction (max 120 chars)

Target schema (section.fieldKey: "label" (type)):
${schemaPrompt}

Important: Many fields not listed above (like frame rates, UHD/HDR, audio/video output, accessibility, platform integration, benchmarks) should still be matched if they clearly correspond to a spec category. Use the section.key format for the full field path.`;

  const chunks: RawQAPair[][] = [];
  for (let i = 0; i < qaPairs.length; i += CHUNK_SIZE) {
    chunks.push(qaPairs.slice(i, i + CHUNK_SIZE));
  }

  log.info('extraction.task.chunk_start', { device: context.rawHeaderLabel, totalPairs: qaPairs.length, chunks: chunks.length });

  const allResults: AIExtractionResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkResults = await extractChunk(chunks[i], i, chunks.length, context, systemPrompt, client);
    allResults.push(...chunkResults);

    log.info('extraction.task.chunk_complete', { device: context.rawHeaderLabel, chunk: i + 1, totalChunks: chunks.length, resultsInChunk: chunkResults.length });

    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, INTER_CHUNK_DELAY_MS));
    }
  }

  return allResults;
}

// ── Post-Extraction Normalization ──

export function normalizeExtractedValue(fieldKey: string, rawValue: string | null): string | null {
  if (!rawValue) return null;
  const val = rawValue.trim();
  if (!val || val.toLowerCase() === 'n/a' || val === '-' || val === '–') return null;

  if (fieldKey.includes('Gb') || fieldKey.includes('Mb') || fieldKey.includes('Ghz') || fieldKey.includes('Mbps')) {
    return normalizeNumeric(val);
  }

  const booleanFields = [
    'playreadySupported', 'widevineSupported', 'bluetoothPresent', 'codeSigning',
    'storageLimitations', 'socCustomizations',
  ];
  if (booleanFields.some(bf => fieldKey.endsWith(bf))) {
    return normalizeBoolean(val);
  }

  if (fieldKey.includes('date') || fieldKey.includes('Date') || fieldKey.includes('Expiration')) {
    return normalizeDate(val);
  }

  return val.replace(/\u00A0/g, ' ').trim();
}

function normalizeNumeric(val: string): string | null {
  const cleaned = val.replace(/[,\s]/g, '');

  const gbMatch = cleaned.match(/^([\d.]+)\s*GB/i);
  if (gbMatch) return gbMatch[1];

  const mbMatch = cleaned.match(/^([\d.]+)\s*MB/i);
  if (mbMatch) return mbMatch[1];

  const ghzMatch = cleaned.match(/^([\d.]+)\s*GHz/i);
  if (ghzMatch) return ghzMatch[1];

  const mbpsMatch = cleaned.match(/^([\d.]+)\s*Mbps/i);
  if (mbpsMatch) return mbpsMatch[1];

  const numMatch = cleaned.match(/^[\d.]+$/);
  if (numMatch) return numMatch[0];

  const memMatch = cleaned.match(/([\d.]+)\s*(?:GB|MB|GHz|Mbps)/i);
  if (memMatch) return memMatch[1];

  return val.trim();
}

function normalizeBoolean(val: string): string | null {
  const lower = val.toLowerCase().trim();
  if (['yes', 'true', 'supported', '✓', '1'].includes(lower)) return 'true';
  if (['no', 'false', 'not supported', '✗', '0', 'n/a', 'na'].includes(lower)) return 'false';
  return val;
}

function normalizeDate(val: string): string | null {
  if (['n/a', 'na', 'not released', 'unknown', 'tbd'].includes(val.toLowerCase())) return null;

  const isoMatch = val.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoMatch) return val;

  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // fall through
  }
  return val;
}

// ── Conflict Detection ──

export function detectConflicts(
  dstFieldKey: string,
  extractedValue: string | null,
  existingSpec: DeviceSpec | null,
): { conflictStatus: ConflictStatus; existingValue: string | null } {
  if (!existingSpec) {
    return { conflictStatus: 'no_existing_device', existingValue: null };
  }

  const [section, fieldKey] = dstFieldKey.split('.');
  if (!section || !fieldKey) {
    return { conflictStatus: 'new_field', existingValue: null };
  }

  const sectionData = existingSpec[section as keyof DeviceSpec];
  if (!sectionData || typeof sectionData !== 'object') {
    return { conflictStatus: 'new_field', existingValue: null };
  }

  const existing = (sectionData as unknown as Record<string, unknown>)[fieldKey];
  const existingStr = existing != null ? String(existing) : null;

  if (existingStr == null || existingStr === '') {
    return { conflictStatus: 'new_field', existingValue: null };
  }

  if (extractedValue == null) {
    return { conflictStatus: 'matches_existing', existingValue: existingStr };
  }

  const normalizedExisting = existingStr.trim().toLowerCase();
  const normalizedExtracted = extractedValue.trim().toLowerCase();

  if (normalizedExisting === normalizedExtracted) {
    return { conflictStatus: 'matches_existing', existingValue: existingStr };
  }

  return { conflictStatus: 'conflicts_with_existing', existingValue: existingStr };
}

// ── Device Registry Matching ──

export async function matchDeviceToRegistry(
  detectedModelName: string | null,
  detectedModelNumber: string | null,
  _detectedManufacturer: string | null,
  db: FirebaseFirestore.Firestore,
): Promise<{
  matchedDeviceId: string | null;
  matchConfidence: number | null;
  matchMethod: 'exact_model_number' | 'ai' | null;
}> {
  if (!detectedModelNumber && !detectedModelName) {
    return { matchedDeviceId: null, matchConfidence: null, matchMethod: null };
  }

  const devicesSnap = await db.collection('devices').get();

  if (detectedModelNumber) {
    for (const doc of devicesSnap.docs) {
      const data = doc.data();
      if (data.deviceId === detectedModelNumber || data.displayName === detectedModelNumber) {
        return {
          matchedDeviceId: doc.id,
          matchConfidence: 1.0,
          matchMethod: 'exact_model_number',
        };
      }
    }
  }

  if (detectedModelName) {
    for (const doc of devicesSnap.docs) {
      const data = doc.data();
      const displayLower = (data.displayName as string || '').toLowerCase();
      const modelLower = detectedModelName.toLowerCase();
      if (displayLower === modelLower) {
        return {
          matchedDeviceId: doc.id,
          matchConfidence: 0.90,
          matchMethod: 'exact_model_number',
        };
      }
    }
  }

  return { matchedDeviceId: null, matchConfidence: null, matchMethod: null };
}

// ── Fan-Out: Enqueue Extraction Tasks ──

export interface EnqueueResult {
  deviceId: string;
  success: boolean;
  error?: string;
}

export async function enqueueExtractionTasks(
  intakeJobId: string,
  stagedDeviceIds: string[],
  db: FirebaseFirestore.Firestore,
): Promise<EnqueueResult[]> {
  const queue = getFunctions().taskQueue(TASK_QUEUE_NAME);
  const results: EnqueueResult[] = [];

  for (const stagedDeviceId of stagedDeviceIds) {
    const payload: ExtractionTaskPayload = { intakeJobId, stagedDeviceId };
    try {
      await queue.enqueue(payload, { dispatchDeadlineSeconds: DISPATCH_DEADLINE_SECONDS });
      results.push({ deviceId: stagedDeviceId, success: true });
      log.info('extraction.task.enqueued', { intakeJobId, stagedDeviceId });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({ deviceId: stagedDeviceId, success: false, error: errorMsg });
      log.error('extraction.task.enqueue_failed', { intakeJobId, stagedDeviceId, error: errorMsg });
      await db.collection('questionnaireStagedDevices').doc(stagedDeviceId).update({
        extractionStatus: 'failed' as ExtractionStatus,
        extractionError: `Failed to enqueue extraction task: ${errorMsg}`,
      });
    }
  }

  return results;
}

// ── Per-Device Task Handler (idempotent) ──

export async function processDeviceExtraction(payload: ExtractionTaskPayload): Promise<void> {
  const db = admin.firestore();
  const { intakeJobId, stagedDeviceId } = payload;

  const deviceRef = db.collection('questionnaireStagedDevices').doc(stagedDeviceId);

  // CAS: only proceed if status is 'pending' or 'processing' (retry after crash)
  const acquired = await db.runTransaction(async (tx) => {
    const snap = await tx.get(deviceRef);
    if (!snap.exists) return false;
    const status = snap.data()?.extractionStatus as ExtractionStatus | undefined;
    if (status === 'complete' || status === 'failed') return false;
    tx.update(deviceRef, {
      extractionStatus: 'processing' as ExtractionStatus,
      extractionProcessingAt: new Date().toISOString(),
    });
    return true;
  });

  if (!acquired) {
    log.info('extraction.task.skipped', { intakeJobId, stagedDeviceId });
    return;
  }

  log.info('extraction.task.started', { intakeJobId, stagedDeviceId });

  const jobRef = db.collection('questionnaireIntakeJobs').doc(intakeJobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) {
    await deviceRef.update({
      extractionStatus: 'failed' as ExtractionStatus,
      extractionError: 'Parent intake job not found',
    });
    await tryFinalizeJob(intakeJobId);
    return;
  }
  const job = jobSnap.data()!;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await deviceRef.update({
      extractionStatus: 'failed' as ExtractionStatus,
      extractionError: 'ANTHROPIC_API_KEY not configured',
    });
    await tryFinalizeJob(intakeJobId);
    return;
  }

  const deviceSnap = await deviceRef.get();
  const deviceData = deviceSnap.data()!;

  await jobRef.update({
    extractionStep: 2,
    extractionCurrentDevice: deviceData.rawHeaderLabel as string,
  }).catch(() => {});

  try {
    const client = new Anthropic({ apiKey });

    const fieldsSnap = await db.collection('questionnaireStagedFields')
      .where('stagedDeviceId', '==', stagedDeviceId)
      .where('intakeJobId', '==', intakeJobId)
      .get();

    const qaPairs: RawQAPair[] = fieldsSnap.docs.map((f, i) => ({
      rowIndex: i,
      rawQuestionText: f.data().rawQuestionText as string,
      rawAnswerText: f.data().rawAnswerText as string | null,
    }));

    if (qaPairs.length === 0) {
      await deviceRef.update({ extractionStatus: 'complete' as ExtractionStatus });
      log.info('extraction.task.complete', { intakeJobId, stagedDeviceId, fieldsExtracted: 0 });
      await tryFinalizeJob(intakeJobId);
      return;
    }

    const partnerName = job.partnerId
      ? await getPartnerName(db, job.partnerId as string)
      : 'Unknown';

    const context: DeviceExtractionContext = {
      partnerName,
      rawHeaderLabel: deviceData.rawHeaderLabel as string,
      platformType: deviceData.platformType as string,
    };

    const results = await extractDeviceFields(qaPairs, context, client);

    if (results.length === 0) {
      await deviceRef.update({
        extractionStatus: 'failed' as ExtractionStatus,
        extractionError: 'AI extraction returned no results after retries',
      });
      log.error('extraction.task.failed', { intakeJobId, stagedDeviceId, reason: 'no_results' });
      await tryFinalizeJob(intakeJobId);
      return;
    }

    // Look up existing spec for conflict detection
    let existingSpec: DeviceSpec | null = null;
    if (deviceData.matchedDeviceId) {
      const specSnap = await db.collection('deviceSpecs')
        .where('deviceId', '==', deviceData.matchedDeviceId)
        .limit(1)
        .get();
      if (!specSnap.empty) {
        existingSpec = { id: specSnap.docs[0].id, ...specSnap.docs[0].data() } as DeviceSpec;
      }
    }

    // Write extraction results to staged fields (idempotent via set/merge)
    const fieldDocs = fieldsSnap.docs;
    const BATCH_LIMIT = 450;
    for (let batchStart = 0; batchStart < fieldDocs.length && batchStart < results.length; batchStart += BATCH_LIMIT) {
      const batch = db.batch();
      const batchEnd = Math.min(batchStart + BATCH_LIMIT, fieldDocs.length, results.length);

      for (let i = batchStart; i < batchEnd; i++) {
        const result = results[i];
        const fieldRef = fieldDocs[i].ref;

        const normalizedValue = result.dstFieldKey
          ? normalizeExtractedValue(result.dstFieldKey.split('.')[1] ?? '', result.extractedValue)
          : result.extractedValue;

        const { conflictStatus, existingValue } = result.dstFieldKey
          ? detectConflicts(result.dstFieldKey, normalizedValue, existingSpec)
          : { conflictStatus: 'new_field' as ConflictStatus, existingValue: null };

        const section = result.dstFieldKey?.split('.')[0] ?? '';

        batch.update(fieldRef, {
          dstFieldKey: result.dstFieldKey ?? '__unmapped__',
          dstFieldCategory: section,
          extractedValue: normalizedValue,
          extractionMethod: result.dstFieldKey ? 'ai' as ExtractionMethod : 'skipped' as ExtractionMethod,
          aiConfidence: result.confidence,
          aiReasoning: result.reasoning,
          conflictStatus,
          existingValue,
        });
      }

      if (batchStart === 0) {
        const identityUpdates: Record<string, unknown> = { extractionError: null };
        for (const result of results) {
          if (!result.dstFieldKey || !result.extractedValue) continue;
          if (result.dstFieldKey === 'general.modelName') {
            identityUpdates.detectedModelName = result.extractedValue;
          } else if (result.dstFieldKey === 'general.modelNumber') {
            identityUpdates.detectedModelNumber = result.extractedValue;
          } else if (result.dstFieldKey === 'hardware.stbManufacturer') {
            identityUpdates.detectedManufacturer = result.extractedValue;
          }
        }
        identityUpdates.extractionStatus = 'complete' as ExtractionStatus;
        batch.update(deviceRef, identityUpdates);
      }

      await batch.commit();
    }

    // Device registry matching (after extraction so we have identity fields)
    const freshDeviceData = (await deviceRef.get()).data() ?? deviceData;
    const modelName = freshDeviceData.detectedModelName as string | null;
    const modelNumber = freshDeviceData.detectedModelNumber as string | null;
    const manufacturer = freshDeviceData.detectedManufacturer as string | null;

    if (!deviceData.matchedDeviceId) {
      const matchResult = await matchDeviceToRegistry(modelName, modelNumber, manufacturer, db);
      if (matchResult.matchedDeviceId) {
        await deviceRef.update({
          matchedDeviceId: matchResult.matchedDeviceId,
          matchConfidence: matchResult.matchConfidence,
          matchMethod: matchResult.matchMethod,
        });
      }
    }

    log.info('extraction.task.complete', {
      intakeJobId,
      stagedDeviceId,
      fieldsExtracted: results.filter(r => r.dstFieldKey).length,
    });
  } catch (err) {
    const isRateLimit = err instanceof Error && (err.message.includes('429') || err.message.includes('rate_limit'));
    const isTimeout = err instanceof Error && err.message.includes('timeout');

    if (isRateLimit || isTimeout) {
      log.warn('extraction.task.retrying', {
        intakeJobId,
        stagedDeviceId,
        reason: isRateLimit ? 'rate_limit' : 'timeout',
        error: formatError(err),
      });
      // Leave status as 'processing' so the CAS allows retry
      throw err;
    }

    const errorMsg = err instanceof Error ? err.message : String(err);
    await deviceRef.update({
      extractionStatus: 'failed' as ExtractionStatus,
      extractionError: errorMsg,
    });
    log.error('extraction.task.failed', { intakeJobId, stagedDeviceId, error: formatError(err) });
  }

  await tryFinalizeJob(intakeJobId);
}

// ── Transaction-Safe Job Finalization ──

async function tryFinalizeJob(intakeJobId: string): Promise<void> {
  const db = admin.firestore();
  const jobRef = db.collection('questionnaireIntakeJobs').doc(intakeJobId);

  const finalized = await db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) return false;
    const job = jobSnap.data()!;

    if (job.status !== 'extracting') return false;

    const devicesSnap = await tx.get(
      db.collection('questionnaireStagedDevices')
        .where('intakeJobId', '==', intakeJobId),
    );

    const total = devicesSnap.size;
    let complete = 0;
    let failed = 0;

    for (const doc of devicesSnap.docs) {
      const status = doc.data().extractionStatus as ExtractionStatus;
      if (status === 'complete') complete++;
      else if (status === 'failed') failed++;
    }

    const pending = total - complete - failed;
    if (pending > 0) return false;

    const finalStatus = complete === 0 ? 'extraction_failed' : 'pending_review';
    tx.update(jobRef, {
      status: finalStatus,
      devicesComplete: complete,
      devicesFailed: failed,
      aiExtractionCompletedAt: new Date().toISOString(),
      extractionStep: complete > 0 ? 4 : null,
      extractionCurrentDevice: null,
      extractionError: failed > 0
        ? `${failed} of ${total} device(s) failed extraction.`
        : null,
      updatedAt: new Date().toISOString(),
    });

    log.info('extraction.job.finalized', { intakeJobId, finalStatus, complete, failed, total });
    return finalStatus === 'pending_review';
  });

  if (finalized) {
    const jobSnap = await db.collection('questionnaireIntakeJobs').doc(intakeJobId).get();
    const job = jobSnap.data()!;
    if (!job.notificationSentAt) {
      const complete = (job.devicesComplete as number) || 0;
      const failed = (job.devicesFailed as number) || 0;
      const notifBody = failed > 0
        ? `${job.fileName} — ${complete} device(s) extracted (${failed} failed), ready for review`
        : `${job.fileName} — ${complete} device(s) extracted, ready for admin review`;
      const notifId = db.collection('notifications').doc().id;
      await db.collection('notifications').doc(notifId).set({
        id: notifId,
        recipientRole: 'admin',
        title: 'Questionnaire ready for review',
        body: notifBody,
        link: `/admin/questionnaires/${intakeJobId}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      await jobSnap.ref.update({ notificationSentAt: new Date().toISOString() });
      log.info('extraction.job.notification_sent', { intakeJobId });
    }
  }
}

async function getPartnerName(
  db: FirebaseFirestore.Firestore,
  partnerId: string,
): Promise<string> {
  const doc = await db.collection('partners').doc(partnerId).get();
  return doc.exists ? (doc.data()!.displayName as string) : 'Unknown';
}
