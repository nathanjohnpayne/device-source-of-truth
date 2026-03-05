import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle,
  ChevronLeft, ChevronRight, RotateCcw, Clock, Sparkles, ExternalLink, Info,
} from 'lucide-react';
import Papa from 'papaparse';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ClarificationPanel from '../components/shared/ClarificationPanel';
import AIPassStatusPanel from '../components/shared/AIPassStatusPanel';
import PrerequisiteBanner from '../components/shared/PrerequisiteBanner';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import { useImportPrerequisites } from '../hooks/useImportPrerequisites';
import { useAIPassStatus } from '../hooks/useAIPassStatus';
import type {
  IntakePreviewRow, IntakePreviewWarning,
  IntakePreviewPartnerMatch, IntakeImportBatch, IntakeRegion,
  DisambiguationFieldResult, ClarificationAnswer,
  ConflictResolution,
} from '../lib/types';

const EXPECTED_COLUMNS = [
  'Request Subject', 'RequestType', 'Request Status', 'Request Phase',
  'Partner', 'Country', 'Region (from Partner)', 'TAM',
  'Integration Engineering Lead', 'Target Launch Date', 'Release Target',
];

const VALID_REQUEST_TYPES = new Set([
  'ADK', 'ANDTV', 'BBD', 'Content Provider API', 'Eligibility API',
  'Feeds & Integration', 'Partner API', 'Perks', 'Redemption Code',
  'Supplemental Data API', 'Web App',
]);

const COUNTRY_LOOKUP: Record<string, string> = {
  'albania': 'AL', 'argentina': 'AR',
  'au': 'AU', 'australia': 'AU', 'at': 'AT', 'austria': 'AT',
  'be': 'BE', 'belgium': 'BE', 'belize': 'BZ', 'bolivia': 'BO',
  'br': 'BR', 'brazil': 'BR', 'canada': 'CA',
  'cl': 'CL', 'chile': 'CL', 'colombia': 'CO', 'costa rica': 'CR',
  'czechia': 'CZ', 'denmark': 'DK', 'dominican republic': 'DO',
  'ecuador': 'EC', 'el salvador': 'SV', 'finland': 'FI', 'france': 'FR',
  'de': 'DE', 'germany': 'DE', 'greece': 'GR', 'guatemala': 'GT',
  'hk': 'HK', 'hong kong': 'HK', 'honduras': 'HN', 'hungary': 'HU',
  'iceland': 'IS', 'ie': 'IE', 'ireland': 'IE',
  'it': 'IT', 'italy': 'IT', 'jamaica': 'JM', 'japan': 'JP',
  'mx': 'MX', 'mexico': 'MX', 'nl': 'NL', 'netherlands': 'NL',
  'nz': 'NZ', 'new zealand': 'NZ', 'nicaragua': 'NI', 'norway': 'NO',
  'panama': 'PA', 'paraguay': 'PY', 'pe': 'PE', 'peru': 'PE',
  'poland': 'PL', 'pt': 'PT', 'portugal': 'PT', 'romania': 'RO',
  'saint lucia': 'LC', 'singapore': 'SG', 'slovakia': 'SK',
  'south korea': 'KR', 'es': 'ES', 'spain': 'ES',
  'se': 'SE', 'sweden': 'SE', 'ch': 'CH', 'switzerland': 'CH',
  'tw': 'TW', 'taiwan': 'TW', 'trinidad and tobago': 'TT',
  'uk': 'GB', 'united kingdom': 'GB',
  'us': 'US', 'usa': 'US', 'united states': 'US',
  'uruguay': 'UY', 'venezuela': 'VE',
  'global': 'XW', 'ww': 'XW',
};

const VALID_REGIONS = new Set(['APAC', 'DOMESTIC', 'EMEA', 'GLOBAL', 'LATAM']);

const EMOJI_REGEX = /[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

function stripEmoji(str: string): string {
  return str.replace(EMOJI_REGEX, '').trim();
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function parseDate(raw: string): { date: string | null; error: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { date: null, error: false };
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return { date: null, error: true };
  const [, m, d, y] = match;
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  const year = parseInt(y, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return { date: null, error: true };
  return { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, error: false };
}

function normalizeCountries(raw: string, region?: string): { codes: string[] | null; warnings: IntakePreviewWarning[] } {
  if (!raw.trim()) return { codes: null, warnings: [] };
  const stripped = stripEmoji(raw);
  const tokens = stripped.split(',').map(t => t.trim()).filter(Boolean);
  const codes: string[] = [];
  const warnings: IntakePreviewWarning[] = [];

  for (const token of tokens) {
    const key = token.toLowerCase();
    const code = COUNTRY_LOOKUP[key];
    if (code === 'SK') {
      codes.push('SK');
      warnings.push({
        type: 'sk_ambiguity', field: 'Country', rawValue: token,
        message: `"${token}" could be Slovakia (SK) or South Korea (KR)${region ? ` — Region: ${region}` : ''}. Please confirm.`,
      });
    } else if (code) {
      codes.push(code);
    } else {
      codes.push(`UNKNOWN:${token}`);
      warnings.push({
        type: 'unknown_country', field: 'Country', rawValue: token,
        message: `Unrecognized country: "${token}"`,
      });
    }
  }
  return { codes: [...new Set(codes)].length > 0 ? [...new Set(codes)] : null, warnings };
}

function normalizeRegions(raw: string): IntakeRegion[] | null {
  if (!raw.trim()) return null;
  const tokens = raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  const valid = tokens.filter(t => VALID_REGIONS.has(t)) as IntakeRegion[];
  return [...new Set(valid)].length > 0 ? [...new Set(valid)] : null;
}

type Step = 'upload' | 'preview' | 'result';

const PAGE_SIZE = 50;

export default function IntakeImportPage() {
  const prereqs = useImportPrerequisites();
  const isBlocked = !prereqs.loading && !prereqs.partnersExist;
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [previewRows, setPreviewRows] = useState<IntakePreviewRow[]>([]);
  const [page, setPage] = useState(1);

  const [importResult, setImportResult] = useState<{
    importBatchId: string; importedCount: number; skippedCount: number; errorCount: number;
    newCount?: number; overwrittenCount?: number; mergedCount?: number;
  } | null>(null);

  const [history, setHistory] = useState<IntakeImportBatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollbackModal, setRollbackModal] = useState<IntakeImportBatch | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const { passState, disambiguation, setDisambiguation, runAIPass, restartAIPass, resetPass, collapsed: aiPanelCollapsed } = useAIPassStatus();
  const [resolving, setResolving] = useState(false);
  const [rawCsvRows, setRawCsvRows] = useState<Record<string, unknown>[]>([]);
  const [useAI, setUseAI] = useState(false);
  const [showAICostModal, setShowAICostModal] = useState(false);
  const aiModalShownRef = useRef(false);
  const useAIRef = useRef(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.intake.history();
      setHistory(res.data);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, []);

  const handleFile = useCallback(async (f: File) => {
    setParseError(null);
    if (!f.name.endsWith('.csv')) {
      setParseError('Only .csv files are accepted.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setParseError('File exceeds the 10 MB limit.');
      return;
    }

    setFile(f);
    setLoading(true);

    try {
      const text = stripBom(await f.text());
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        setParseError(`CSV parse errors: ${parsed.errors.map(e => e.message).join('; ')}`);
        setLoading(false);
        return;
      }

      const headers = parsed.meta.fields || [];
      const missing = EXPECTED_COLUMNS.filter(col => !headers.includes(col));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(', ')}. Verify this is an Airtable Intake Requests export and try again.`);
        setLoading(false);
        return;
      }

      const clientRows: Omit<IntakePreviewRow, 'partnerMatches' | 'status'>[] = parsed.data.map((raw, idx) => {
        const warnings: IntakePreviewWarning[] = [];
        const errors: IntakePreviewWarning[] = [];

        const subject = (raw['Request Subject'] || '').trim();
        if (!subject) {
          errors.push({ type: 'blank_subject', field: 'Request Subject', rawValue: '', message: 'Request Subject is blank — row will be skipped.' });
        }

        const requestType = (raw['RequestType'] || '').trim();
        if (requestType && !VALID_REQUEST_TYPES.has(requestType)) {
          errors.push({ type: 'unrecognized_request_type', field: 'RequestType', rawValue: requestType, message: `Unrecognized request type: "${requestType}"` });
        }

        const regionRaw = (raw['Region (from Partner)'] || '').trim();
        const countryResult = normalizeCountries(raw['Country'] || '', regionRaw);
        warnings.push(...countryResult.warnings);

        const regions = normalizeRegions(regionRaw);

        const tamRaw = (raw['TAM'] || '').trim();
        const tamNames = tamRaw ? tamRaw.split(',').map(t => t.trim()).filter(Boolean) : null;

        const ieRaw = (raw['Integration Engineering Lead'] || '').trim();
        const ieLeadNames = ieRaw ? ieRaw.split(',').map(t => t.trim()).filter(Boolean) : null;

        const launchDateResult = parseDate(raw['Target Launch Date'] || '');
        if (launchDateResult.error) {
          warnings.push({ type: 'unparseable_date', field: 'Target Launch Date', rawValue: raw['Target Launch Date'] || '', message: `Could not parse date: "${raw['Target Launch Date']}"` });
        }

        const releaseRaw = (raw['Release Target'] || '').trim();
        let releaseTargets: string[] | null = null;
        if (releaseRaw) {
          const parts = releaseRaw.split(',').map(t => t.trim()).filter(Boolean);
          const parsed2: string[] = [];
          for (const p of parts) {
            const r = parseDate(p);
            if (r.error) {
              warnings.push({ type: 'unparseable_date', field: 'Release Target', rawValue: p, message: `Could not parse date: "${p}"` });
            } else if (r.date) {
              parsed2.push(r.date);
            }
          }
          releaseTargets = parsed2.length > 0 ? parsed2 : null;
        }

        const partnerRaw = (raw['Partner'] || '').trim();
        const rawPartnerNames = partnerRaw ? partnerRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

        return {
          rowIndex: idx + 1,
          airtableSubject: subject,
          requestType,
          requestStatus: (raw['Request Status'] || 'Approved & Provisioned').trim(),
          requestPhase: (raw['Request Phase'] || '').trim() || null,
          countries: countryResult.codes,
          regions,
          tamNames,
          ieLeadNames,
          targetLaunchDate: launchDateResult.date,
          releaseTargets,
          rawPartnerNames,
          warnings,
          errors,
        };
      });

      const previewResponse = await api.intake.preview(clientRows as Parameters<typeof api.intake.preview>[0]);
      setPreviewRows(previewResponse.rows);
      setRawCsvRows(parsed.data as Record<string, unknown>[]);
      setPage(1);
      setStep('preview');

      const hasWarnings = previewResponse.summary.warnings > 0;
      const hasUnmatched = previewResponse.rows.some(r =>
        r.partnerMatches?.some((m: IntakePreviewPartnerMatch) => m.matchConfidence === 'unmatched'),
      );
      if (useAIRef.current && (hasWarnings || hasUnmatched)) {
        const INTAKE_FIELD_TYPE_COUNT = 4; // country, region, partner_name, date
        await runAIPass('intake', parsed.data as Record<string, unknown>[], INTAKE_FIELD_TYPE_COUNT);
      }
    } catch (err) {
      setParseError(`Failed to process file: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSkipRow = useCallback((rowIndex: number) => {
    setPreviewRows(prev => prev.map(r =>
      r.rowIndex === rowIndex ? { ...r, skipped: !r.skipped } : r,
    ));
  }, []);

  const handleResolution = useCallback((rowIndex: number, resolution: ConflictResolution) => {
    setPreviewRows(prev => prev.map(r => {
      if (r.rowIndex !== rowIndex || !r.dedupInfo) return r;
      return { ...r, dedupInfo: { ...r.dedupInfo, resolution } };
    }));
  }, []);

  const handleApplyToAllConflicts = useCallback((resolution: ConflictResolution) => {
    setPreviewRows(prev => prev.map(r => {
      if (!r.dedupInfo || r.dedupInfo.dedupStatus !== 'conflict') return r;
      if (r.dedupInfo.resolution) return r;
      return { ...r, dedupInfo: { ...r.dedupInfo, resolution } };
    }));
  }, []);

  const handleOverride = useCallback((rowIndex: number, key: string, value: string) => {
    setPreviewRows(prev => prev.map(r => {
      if (r.rowIndex !== rowIndex) return r;
      const overrides = { ...r.overrides, [key]: value };
      const resolvedWarnings = r.warnings.filter(w => {
        if (w.type === 'sk_ambiguity' && overrides['SK']) return false;
        if (w.type === 'unknown_country' && overrides[`UNKNOWN:${w.rawValue}`]) return false;
        return true;
      });
      const newStatus: IntakePreviewRow['status'] = r.errors.length > 0 ? 'error' : resolvedWarnings.length > 0 ? 'warning' : 'ready';
      return { ...r, overrides, warnings: r.warnings, status: newStatus };
    }));
  }, []);

  const summary = useMemo(() => {
    const total = previewRows.length;
    const skipped = previewRows.filter(r => r.skipped).length;
    const errorRows = previewRows.filter(r => !r.skipped && r.status === 'error').length;

    const unresolvedWarnings = previewRows.filter(r => {
      if (r.skipped) return false;
      return r.warnings.some(w => {
        if (w.type === 'sk_ambiguity') return !r.overrides?.['SK'];
        if (w.type === 'unknown_country') return !r.overrides?.[`UNKNOWN:${w.rawValue}`];
        return true;
      });
    }).length;

    const duplicates = previewRows.filter(r => r.dedupInfo?.dedupStatus === 'duplicate').length;
    const conflicts = previewRows.filter(r => r.dedupInfo?.dedupStatus === 'conflict').length;
    const unresolvedConflicts = previewRows.filter(r =>
      r.dedupInfo?.dedupStatus === 'conflict' && !r.dedupInfo.resolution,
    ).length;
    const inFileDuplicates = previewRows.filter(r => r.dedupInfo?.dedupStatus === 'duplicate_in_file').length;
    const newRows = previewRows.filter(r => !r.dedupInfo || r.dedupInfo.dedupStatus === 'new').length;

    const ready = total - skipped - errorRows - unresolvedWarnings - duplicates - inFileDuplicates - unresolvedConflicts;
    return { total, ready, warnings: unresolvedWarnings, errors: errorRows, skipped, duplicates, conflicts, unresolvedConflicts, inFileDuplicates, newRows };
  }, [previewRows]);

  const canImport = summary.warnings === 0 && summary.unresolvedConflicts === 0 && summary.ready > 0;

  const handleImport = useCallback(async () => {
    if (!canImport || !file) return;
    setLoading(true);
    try {
      const rowsToImport = previewRows.filter(r => !r.skipped && r.status !== 'error');
      const result = await api.intake.import(rowsToImport, file.name);
      setImportResult(result);
      setStep('result');
      loadHistory();
    } catch (err) {
      setParseError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }, [canImport, file, previewRows, loadHistory]);

  const handleRollback = useCallback(async (batch: IntakeImportBatch) => {
    setRollbackLoading(true);
    try {
      await api.intake.rollback(batch.importBatchId);
      setRollbackModal(null);
      loadHistory();
    } catch (err) {
      alert(`Rollback failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setRollbackLoading(false);
  }, [loadHistory]);

  const sortedRows = useMemo(() => {
    const dedupOrder: Record<string, number> = {
      conflict: 0,
      duplicate: 1,
      duplicate_in_file: 2,
    };
    return [...previewRows].sort((a, b) => {
      const aOrder = a.dedupInfo ? (dedupOrder[a.dedupInfo.dedupStatus] ?? 3) : 3;
      const bOrder = b.dedupInfo ? (dedupOrder[b.dedupInfo.dedupStatus] ?? 3) : 3;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.rowIndex - b.rowIndex;
    });
  }, [previewRows]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  const totalPages = Math.ceil(previewRows.length / PAGE_SIZE);

  const handleClarificationSubmit = useCallback(async (answers: ClarificationAnswer[]) => {
    if (!disambiguation) return;
    setResolving(true);
    try {
      const res = await api.disambiguation.resolve(
        'intake',
        answers,
        disambiguation.fields,
        rawCsvRows,
      );
      setDisambiguation(prev => prev ? {
        ...prev,
        fields: res.fields,
        questions: prev.questions.filter(q =>
          res.fields.some(f => f.rowIndex === q.rowIndex && f.field === q.field && f.needsHuman),
        ),
      } : null);
      trackEvent('intake_clarification_resolved', { answered: answers.length });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to resolve answers');
    } finally {
      setResolving(false);
    }
  }, [disambiguation, rawCsvRows]);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setParseError(null);
    setPreviewRows([]);
    setImportResult(null);
    resetPass();
    setRawCsvRows([]);
    setUseAI(false);
    useAIRef.current = false;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intake Request Import</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a CSV exported from the Airtable Intake Requests base
          </p>
          <a
            href="https://airtable.com/appEZYvUCudrm2Fc5/pagE1XJGzSxvf1yYG?YmHNz=allRecords"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
          >
            B2B2C Partnerships &rsaquo; Intake Requests &rsaquo; All Intakes
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {step !== 'upload' && (
          <button onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Start Over
          </button>
        )}
      </div>

      {/* Prerequisite banners */}
      {!prereqs.loading && !prereqs.partnersExist && (
        <PrerequisiteBanner
          severity="red"
          message="No partner records exist. Intake Requests import requires at least one partner for name resolution. Import Partners first."
          linkTo="/partners"
          linkLabel="Go to Partners"
        />
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'preview', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-gray-300" />}
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              step === s ? 'bg-blue-600 text-white' : s === 'result' && step === 'preview' ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {i + 1}
            </div>
            <span className={step === s ? 'font-medium text-gray-900' : 'text-gray-500'}>
              {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview & Validate' : 'Import Complete'}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="rounded-xl border border-gray-200 bg-white p-8">
          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
              dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {loading ? (
              <LoadingSpinner />
            ) : (
              <>
                <FileSpreadsheet className="mb-4 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-lg font-medium text-gray-700">
                  Drop your IntakeRequests.csv here
                </p>
                <p className="mb-4 text-sm text-gray-500">or click to browse</p>
                <label className={`rounded-lg px-6 py-2.5 text-sm font-medium text-white ${
                  isBlocked ? 'cursor-not-allowed bg-gray-400' : 'cursor-pointer bg-blue-600 hover:bg-blue-700'
                }`}>
                  Select File
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    disabled={isBlocked}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </label>
                <p className="mt-3 text-xs text-gray-400">.csv only, max 10 MB</p>
              </>
            )}
          </div>

          {/* AI Import opt-in (DST-040) */}
          <div className="mt-4 flex items-center gap-2">
            <input
              id="intake-use-ai"
              type="checkbox"
              checked={useAI}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked && !aiModalShownRef.current) {
                  setShowAICostModal(true);
                } else {
                  setUseAI(checked);
                  useAIRef.current = checked;
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="intake-use-ai" className="text-sm text-gray-700">
              Use AI Import?
            </label>
            <div className="group relative">
              <Info className="h-4 w-4 text-gray-400" />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                Runs an AI pass to automatically resolve ambiguous values. May incur additional Anthropic API costs.
              </div>
            </div>
          </div>

          {parseError && (
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-red-50 p-4">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{parseError}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preview & Validation */}
      {step === 'preview' && (
        <>
          {/* Summary banner */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white px-6 py-4">
            <span className="text-sm font-medium text-gray-700">
              {summary.total} rows parsed
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1.5 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="font-medium text-emerald-700">{summary.newRows}</span> new
            </span>
            {summary.duplicates > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1.5 text-sm">
                  <span className="font-medium text-blue-700">{summary.duplicates}</span>
                  <span className="text-blue-600">duplicates (will skip)</span>
                </span>
              </>
            )}
            {summary.conflicts > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-amber-700">{summary.conflicts}</span>
                  <span className="text-amber-600">
                    conflicts{summary.unresolvedConflicts > 0 ? ` (${summary.unresolvedConflicts} unresolved)` : ' (all resolved)'}
                  </span>
                </span>
              </>
            )}
            {summary.inFileDuplicates > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1.5 text-sm">
                  <span className="font-medium text-red-700">{summary.inFileDuplicates}</span>
                  <span className="text-red-600">duplicate in file</span>
                </span>
              </>
            )}
            {summary.warnings > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-amber-700">{summary.warnings}</span> with warnings
                </span>
              </>
            )}
            {summary.errors > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1.5 text-sm">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-red-700">{summary.errors}</span> errors
                </span>
              </>
            )}
            {disambiguation?.aiStats && disambiguation.aiStats.totalResolved > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1.5 text-sm">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <span className="font-medium text-indigo-700">
                    {disambiguation.aiStats.totalResolved}
                  </span>
                  <span className="text-indigo-600">
                    values resolved by AI
                    {disambiguation.aiStats.cachedCount > 0 && (
                      <span> ({disambiguation.aiStats.cachedCount} cached)</span>
                    )}
                  </span>
                </span>
              </>
            )}
          </div>

          {aiPanelCollapsed && disambiguation?.fieldTypeFallbacks && disambiguation.fieldTypeFallbacks.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-sm text-amber-800">
                AI disambiguation fell back to rule-based handling for: {disambiguation.fieldTypeFallbacks.join(', ')}.
                Those fields require manual review.
              </p>
            </div>
          )}

          {/* Apply to all conflicts */}
          {summary.unresolvedConflicts > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-amber-800">
                {summary.unresolvedConflicts} conflict{summary.unresolvedConflicts !== 1 ? 's' : ''} require resolution before import.
              </span>
              <span className="text-sm text-amber-700">Apply to all:</span>
              {(['skip', 'overwrite', 'merge'] as ConflictResolution[]).map(r => (
                <button
                  key={r}
                  onClick={() => handleApplyToAllConflicts(r)}
                  className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* AI Disambiguation Panel */}
          {passState.status !== 'idle' && (
            <AIPassStatusPanel
              passState={passState}
              onRestart={restartAIPass}
              collapsed={aiPanelCollapsed}
            />
          )}

          {disambiguation && passState.status !== 'running' && (
            <ClarificationPanel
              questions={disambiguation.questions}
              fields={disambiguation.fields}
              onSubmitAnswers={handleClarificationSubmit}
              loading={resolving}
              aiFallback={disambiguation.aiFallback}
              fallbackReason={disambiguation.fallbackReason}
            />
          )}

          {/* Preview table */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Subject</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Type</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Partner(s)</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Country</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Region</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Warnings</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRows.map(row => {
                    const csvIdx = row.rowIndex - 1;
                    const rowAiResults = disambiguation
                      ? disambiguation.fields.filter(f => f.rowIndex === csvIdx)
                      : undefined;
                    return (
                      <PreviewTableRow
                        key={row.rowIndex}
                        row={row}
                        onSkip={handleSkipRow}
                        onOverride={handleOverride}
                        onResolution={handleResolution}
                        aiResults={rowAiResults}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages} ({previewRows.length} rows)
                </p>
                <div className="flex gap-1">
                  <button
                    className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {parseError && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{parseError}</p>
            </div>
          )}

          {/* Import button */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleImport}
              disabled={!canImport || loading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <LoadingSpinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              Import {summary.ready} records
            </button>
          </div>
        </>
      )}

      {/* Step 3: Result */}
      {step === 'result' && importResult && (
        <div className="rounded-xl border border-gray-200 bg-white p-8">
          <div className="flex flex-col items-center text-center">
            <CheckCircle className="mb-4 h-16 w-16 text-emerald-500" />
            <h2 className="text-xl font-bold text-gray-900">Import Complete</h2>
            <p className="mt-2 text-sm text-gray-600">
              {importResult.importedCount} records imported, {importResult.skippedCount} skipped.
            </p>
            {(importResult.newCount != null || importResult.overwrittenCount != null) && (
              <p className="mt-1 text-xs text-gray-500">
                {importResult.newCount ?? 0} new, {importResult.overwrittenCount ?? 0} overwritten, {importResult.mergedCount ?? 0} merged
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Batch ID: {importResult.importBatchId}
            </p>
          </div>
        </div>
      )}

      {/* Import History */}
      <ImportHistory
        history={history}
        loading={historyLoading}
        onLoad={loadHistory}
        onRollback={setRollbackModal}
      />

      {/* Rollback Confirmation Modal */}
      <Modal
        open={!!rollbackModal}
        onClose={() => setRollbackModal(null)}
        title="Confirm Rollback"
        wide
        footer={
          <>
            <button
              onClick={() => setRollbackModal(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => rollbackModal && handleRollback(rollbackModal)}
              disabled={rollbackLoading}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {rollbackLoading && <LoadingSpinner className="h-4 w-4" />}
              Rollback Import
            </button>
          </>
        }
      >
        {rollbackModal && (
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              {(rollbackModal.overwrittenCount || rollbackModal.mergedCount)
                ? 'This will delete new records and restore overwritten/merged records to their pre-import state:'
                : 'This will permanently delete all records from this import batch:'}
            </p>
            <div className="rounded-lg bg-gray-50 p-4 space-y-1">
              <p><span className="font-medium">Imported by:</span> {rollbackModal.importedBy}</p>
              <p><span className="font-medium">Date:</span> {new Date(rollbackModal.importedAt).toLocaleDateString()}</p>
              <p><span className="font-medium">File:</span> {rollbackModal.fileName}</p>
              <p><span className="font-medium">Records:</span> {rollbackModal.importedCount} imported, {rollbackModal.skippedCount} skipped</p>
              {rollbackModal.newCount != null && (
                <p className="text-xs text-gray-500">
                  {rollbackModal.newCount} new, {rollbackModal.overwrittenCount ?? 0} overwritten, {rollbackModal.mergedCount ?? 0} merged
                </p>
              )}
              <p><span className="font-medium">Batch ID:</span> {rollbackModal.importBatchId}</p>
            </div>
            <p className="text-red-600 font-medium">This action cannot be undone.</p>
          </div>
        )}
      </Modal>

      {/* AI Cost Disclosure Modal (DST-042) */}
      <Modal
        open={showAICostModal}
        onClose={() => {
          setShowAICostModal(false);
          setUseAI(false);
          useAIRef.current = false;
        }}
        title="AI-Assisted Import"
        footer={
          <>
            <button
              onClick={() => {
                setShowAICostModal(false);
                setUseAI(false);
                useAIRef.current = false;
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowAICostModal(false);
                setUseAI(true);
                useAIRef.current = true;
                aiModalShownRef.current = true;
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Sparkles className="h-4 w-4" />
              Enable AI Import
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Enabling AI Import runs ambiguous field values through Claude to automatically resolve
          issues like country codes, region names, and partner name variations. Only values that
          fail standard validation are sent — clean data is never transmitted. This uses the
          Anthropic API and may incur additional usage costs billed to your organization's API
          account.
        </p>
      </Modal>
    </div>
  );
}

// ── Preview Table Row ──

function IntakeAIBadge({ result }: { result: DisambiguationFieldResult }) {
  if (result.resolutionSource === 'human') {
    return (
      <span className="group/ai relative ml-1 inline-flex">
        <span className="cursor-default rounded bg-blue-100 px-1 py-0.5 text-[10px] font-semibold text-blue-700">
          Manual
        </span>
        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-48 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover/ai:block">
          <span className="block font-medium">Admin override</span>
          <span className="block mt-1 text-gray-300">Raw: {result.rawValue}</span>
          <span className="block text-gray-300">Resolved: {result.resolvedValue}</span>
        </span>
      </span>
    );
  }
  const isAuto = result.confidence >= 0.90;
  return (
    <span className="group/ai relative ml-1 inline-flex">
      <span className={`cursor-default rounded px-1 py-0.5 text-[10px] font-semibold ${
        isAuto ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
      }`}>
        {isAuto ? 'AI' : 'AI \u26A0'}
        {result.cached && ' (cached)'}
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover/ai:block">
        <span className="block font-medium">{isAuto ? 'AI auto-resolved' : 'AI suggested — verify'}</span>
        <span className="block mt-1 text-gray-300">Raw: {result.rawValue}</span>
        <span className="block text-gray-300">Resolved: {result.resolvedValue}</span>
        <span className="block text-gray-300">Confidence: {(result.confidence * 100).toFixed(0)}%</span>
        <span className="block text-gray-400 mt-0.5">{result.reasoning}</span>
      </span>
    </span>
  );
}

function PreviewTableRow({
  row,
  onSkip,
  onOverride,
  onResolution,
  aiResults,
}: {
  row: IntakePreviewRow;
  onSkip: (rowIndex: number) => void;
  onOverride: (rowIndex: number, key: string, value: string) => void;
  onResolution: (rowIndex: number, resolution: ConflictResolution) => void;
  aiResults?: DisambiguationFieldResult[];
}) {
  const dedup = row.dedupInfo;
  const isDuplicate = dedup?.dedupStatus === 'duplicate';
  const isConflict = dedup?.dedupStatus === 'conflict';
  const isInFileDupe = dedup?.dedupStatus === 'duplicate_in_file';

  const bgClass = isInFileDupe
    ? 'bg-red-50 opacity-60'
    : isDuplicate
      ? 'bg-blue-50 opacity-70'
      : isConflict
        ? 'bg-amber-50'
        : row.skipped
          ? 'bg-gray-50 opacity-60'
          : row.status === 'error'
            ? 'bg-red-50'
            : row.status === 'warning'
              ? 'bg-amber-50'
              : '';

  const hasUnmatched = row.partnerMatches?.some((m: IntakePreviewPartnerMatch) => m.matchConfidence === 'unmatched');
  const hasFuzzy = row.partnerMatches?.some((m: IntakePreviewPartnerMatch) => m.matchConfidence === 'fuzzy');

  const unresolvedSK = row.warnings?.some(w => w.type === 'sk_ambiguity' && !row.overrides?.['SK']);
  const unresolvedUnknown = row.warnings?.filter(w => w.type === 'unknown_country' && !row.overrides?.[`UNKNOWN:${w.rawValue}`]);

  const aiByField = (field: string) =>
    aiResults?.find(r => r.field === field && !r.needsHuman);
  const countryAi = aiByField('Country');
  const regionAi = aiByField('Region (from Partner)');
  const partnerAi = aiByField('Partner');

  return (
    <>
      <tr className={bgClass}>
        <td className="px-3 py-2 text-xs text-gray-500">{row.rowIndex}</td>
        <td className="px-3 py-2">
          {isInFileDupe ? (
            <Badge variant="danger">Dup in file</Badge>
          ) : isDuplicate ? (
            <Badge variant="info">Duplicate</Badge>
          ) : isConflict ? (
            <Badge variant="warning">Conflict</Badge>
          ) : row.skipped ? (
            <Badge variant="default">Skipped</Badge>
          ) : row.status === 'error' ? (
            <Badge variant="danger">Error</Badge>
          ) : row.status === 'warning' ? (
            <Badge variant="warning">Warning</Badge>
          ) : (
            <Badge variant="success">New</Badge>
          )}
        </td>
        <td className="max-w-[200px] truncate px-3 py-2 text-sm text-gray-700" title={row.airtableSubject}>
          {row.airtableSubject || <span className="italic text-gray-400">blank</span>}
        </td>
        <td className="px-3 py-2 text-sm text-gray-700">{row.requestType || '—'}</td>
        <td className="max-w-[180px] px-3 py-2 text-sm">
          {row.partnerMatches?.map((m: IntakePreviewPartnerMatch, i: number) => (
            <span key={i} className="block">
              <span className={
                m.matchConfidence === 'exact' ? 'text-emerald-700' :
                m.matchConfidence === 'fuzzy' ? 'text-blue-700' :
                'text-amber-700'
              }>
                {m.partnerNameRaw}
              </span>
              {i === 0 && partnerAi && <IntakeAIBadge result={partnerAi} />}
              {m.matchConfidence === 'fuzzy' && m.partnerDisplayName && (
                <span className="ml-1 text-xs text-gray-400">
                  ~{m.partnerDisplayName} ({Math.round((m.similarityScore || 0) * 100)}%)
                </span>
              )}
              {m.matchConfidence === 'unmatched' && (
                <span className="ml-1 text-xs text-amber-500">unmatched</span>
              )}
            </span>
          )) || '—'}
          {(hasUnmatched || hasFuzzy) && !row.skipped && (
            <span className="block text-xs text-yellow-600 mt-0.5">
              {hasUnmatched ? 'Unmatched partners will be linked post-import' : 'Fuzzy matches — confirm in review'}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-sm text-gray-700">
          {row.countries?.map((c, i) => (
            <span key={i} className={`mr-1 ${c.startsWith('UNKNOWN:') ? 'text-amber-600' : ''}`}>
              {c.startsWith('UNKNOWN:') ? c.replace('UNKNOWN:', '') : c}
            </span>
          )) || '—'}
          {countryAi && <IntakeAIBadge result={countryAi} />}
          {unresolvedSK && !row.skipped && (
            <div className="mt-1">
              <select
                className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs"
                defaultValue=""
                onChange={(e) => onOverride(row.rowIndex, 'SK', e.target.value)}
              >
                <option value="" disabled>SK = ?</option>
                <option value="SK">Slovakia (SK)</option>
                <option value="KR">South Korea (KR)</option>
              </select>
            </div>
          )}
          {unresolvedUnknown && unresolvedUnknown.length > 0 && !row.skipped && unresolvedUnknown.map((w, i) => (
            <div key={i} className="mt-1">
              <input
                className="w-16 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs"
                placeholder={`Fix: ${w.rawValue}`}
                onChange={(e) => onOverride(row.rowIndex, `UNKNOWN:${w.rawValue}`, e.target.value.toUpperCase())}
              />
            </div>
          ))}
        </td>
        <td className="px-3 py-2 text-sm text-gray-700">
          {row.regions?.join(', ') || '—'}
          {regionAi && <IntakeAIBadge result={regionAi} />}
        </td>
        <td className="px-3 py-2 text-xs text-gray-500">
          {isInFileDupe && (
            <span className="block text-red-600">Duplicate within file — row {dedup.duplicateOfRow} kept</span>
          )}
          {row.errors?.map((e: IntakePreviewWarning, i: number) => (
            <span key={i} className="block text-red-600">{e.message}</span>
          ))}
          {row.warnings?.filter(w => {
            if (w.type === 'sk_ambiguity' && row.overrides?.['SK']) return false;
            if (w.type === 'unknown_country' && row.overrides?.[`UNKNOWN:${w.rawValue}`]) return false;
            return true;
          }).map((w: IntakePreviewWarning, i: number) => (
            <span key={i} className="block text-amber-600">{w.message}</span>
          ))}
          {!isInFileDupe && row.errors?.length === 0 && row.warnings?.length === 0 && '—'}
        </td>
        <td className="px-3 py-2">
          {isConflict || isDuplicate ? (
            <select
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              value={dedup?.resolution ?? ''}
              onChange={(e) => onResolution(row.rowIndex, e.target.value as ConflictResolution)}
            >
              {!dedup?.resolution && <option value="" disabled>Choose…</option>}
              <option value="skip">Skip</option>
              <option value="overwrite">Overwrite</option>
              {isConflict && <option value="merge">Merge</option>}
            </select>
          ) : !isInFileDupe ? (
            <button
              onClick={() => onSkip(row.rowIndex)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                row.skipped
                  ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {row.skipped ? 'Unskip' : 'Skip'}
            </button>
          ) : null}
        </td>
      </tr>
      {/* Inline diff for conflict rows */}
      {isConflict && dedup.diffs && dedup.diffs.length > 0 && (
        <tr className="bg-amber-50/50">
          <td />
          <td colSpan={8} className="px-3 py-2">
            <div className="flex flex-wrap gap-3 text-xs">
              {dedup.diffs.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded bg-white px-2 py-1 border border-amber-200">
                  <span className="font-medium text-gray-700">{d.field}:</span>
                  <span className="text-gray-400 line-through">{d.existingValue || '(blank)'}</span>
                  <span className="text-amber-700">{d.incomingValue || '(blank)'}</span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Import History ──

function ImportHistory({
  history,
  loading,
  onLoad,
  onRollback,
}: {
  history: IntakeImportBatch[];
  loading: boolean;
  onLoad: () => void;
  onRollback: (batch: IntakeImportBatch) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => { setExpanded(!expanded); if (!expanded && history.length === 0) onLoad(); }}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Import History</h3>
        </div>
        <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-6 py-4">
          {loading ? (
            <LoadingSpinner />
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500">No import batches yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map(batch => {
                const daysSince = (Date.now() - new Date(batch.importedAt).getTime()) / (1000 * 60 * 60 * 24);
                const canRollback = daysSince <= 30;

                return (
                  <div key={batch.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-gray-900">{batch.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(batch.importedAt).toLocaleString()} by {batch.importedBy}
                      </p>
                      <p className="text-xs text-gray-500">
                        {batch.importedCount} imported, {batch.skippedCount} skipped
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {batch.importBatchId.slice(0, 8)}...
                      </span>
                      {canRollback ? (
                        <button
                          onClick={() => onRollback(batch)}
                          className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Rollback
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Rollback expired</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
