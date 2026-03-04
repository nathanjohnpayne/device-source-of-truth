import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle,
  RotateCcw, Clock, ExternalLink,
} from 'lucide-react';
import Papa from 'papaparse';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import type { MigrationBatch, IntakeRegion } from '../lib/types';

const EMOJI_REGEX = /[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

function stripEmoji(str: string): string {
  return str.replace(EMOJI_REGEX, '').trim();
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

const COLUMN_MAPPINGS = [
  { csv: 'Device', field: 'displayName' },
  { csv: 'Device ID', field: 'deviceId' },
  { csv: 'Vendor', field: 'oem' },
  { csv: 'Region', field: 'region' },
  { csv: 'Country', field: 'countries' },
  { csv: 'Device Type', field: 'deviceType' },
  { csv: 'Live ADK Version', field: 'liveAdkVersion' },
  { csv: '64 bit', field: 'is64Bit' },
  { csv: 'DRM', field: 'drm' },
  { csv: 'Tech Questionnaire URL', field: 'questionnaireUrl' },
  { csv: 'Partner', field: 'partnerKey' },
] as const;

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

const REGION_MAP: Record<string, IntakeRegion> = {
  'APAC': 'APAC', 'EMEA': 'EMEA', 'LATAM': 'LATAM',
  'DOMESTIC': 'DOMESTIC', 'GLOBAL': 'GLOBAL',
  'NA': 'DOMESTIC', 'WORLDWIDE': 'GLOBAL',
};

const VALID_REGIONS = new Set(Object.values(REGION_MAP));

function normalizeCountry(raw: string): { codes: string[]; warnings: string[] } {
  if (!raw.trim()) return { codes: [], warnings: [] };
  const stripped = stripEmoji(raw);
  const tokens = stripped.split(',').map(t => t.trim()).filter(Boolean);
  const codes: string[] = [];
  const warnings: string[] = [];

  for (const token of tokens) {
    const key = token.toLowerCase();
    const code = COUNTRY_LOOKUP[key];
    if (code) {
      codes.push(code);
    } else if (/^[A-Z]{2}$/i.test(token)) {
      codes.push(token.toUpperCase());
    } else {
      warnings.push(`Unrecognized country: "${token}"`);
    }
  }
  return { codes: [...new Set(codes)], warnings };
}

function normalizeRegion(raw: string): { region: IntakeRegion | null; warning: string | null } {
  const upper = stripEmoji(raw).trim().toUpperCase();
  if (!upper) return { region: null, warning: null };
  const mapped = REGION_MAP[upper];
  if (mapped) return { region: mapped, warning: null };
  if (VALID_REGIONS.has(upper as IntakeRegion)) return { region: upper as IntakeRegion, warning: null };
  return { region: null, warning: `Unrecognized region: "${raw.trim()}"` };
}

interface MigrationPreviewRow {
  rowIndex: number;
  displayName: string;
  deviceId: string;
  vendor: string;
  region: IntakeRegion | null;
  countries: string[];
  deviceType: string;
  liveAdkVersion: string;
  drm: string;
  partnerName: string;
  status: 'ready' | 'warning' | 'error';
  warnings: string[];
  errors: string[];
}

type Step = 'upload' | 'preview' | 'result';

export default function MigrationPage() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [previewRows, setPreviewRows] = useState<MigrationPreviewRow[]>([]);

  const [importResult, setImportResult] = useState<{
    importBatchId: string; created: number; duplicates: number; errored: number; errors: string[];
  } | null>(null);

  const [history, setHistory] = useState<MigrationBatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollbackModal, setRollbackModal] = useState<MigrationBatch | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.upload.migrationHistory();
      setHistory(res.data);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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

      const rows: MigrationPreviewRow[] = parsed.data.map((raw, idx) => {
        const warnings: string[] = [];
        const errors: string[] = [];

        const displayName = stripEmoji((raw['Device'] || '').trim());
        const deviceId = stripEmoji((raw['Device ID'] || raw['device_id'] || '').trim());
        const vendor = stripEmoji((raw['Vendor'] || raw['partner_key'] || '').trim());
        const regionRaw = (raw['Region'] || '').trim();
        const countryRaw = (raw['Country'] || '').trim();
        const deviceType = stripEmoji((raw['Device Type'] || raw['device_type'] || '').trim());
        const liveAdkVersion = stripEmoji((raw['Live ADK Version'] || raw['adk_version'] || '').trim());
        const drm = stripEmoji((raw['DRM'] || '').trim());
        const partnerName = stripEmoji((raw['Partner'] || '').trim());

        if (!deviceId) {
          errors.push('Missing Device ID — row will be skipped');
        }

        const { region, warning: regionWarning } = normalizeRegion(regionRaw);
        if (regionWarning) warnings.push(regionWarning);

        const { codes: countryCodes, warnings: countryWarnings } = normalizeCountry(countryRaw);
        warnings.push(...countryWarnings);

        let status: MigrationPreviewRow['status'] = 'ready';
        if (errors.length > 0) status = 'error';
        else if (warnings.length > 0) status = 'warning';

        return {
          rowIndex: idx + 1, displayName, deviceId, vendor, region,
          countries: countryCodes, deviceType, liveAdkVersion, drm,
          partnerName, status, warnings, errors,
        };
      });

      setPreviewRows(rows);
      setStep('preview');
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

  const summary = useMemo(() => {
    const total = previewRows.length;
    const ready = previewRows.filter(r => r.status === 'ready').length;
    const warnings = previewRows.filter(r => r.status === 'warning').length;
    const errors = previewRows.filter(r => r.status === 'error').length;
    return { total, ready, warnings, errors };
  }, [previewRows]);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setParseError(null);

    try {
      const result = await api.upload.migration(file);
      setImportResult(result);
      trackEvent('migration_run', { row_count: result.created });
      setStep('result');
      loadHistory();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setLoading(false);
    }
  }, [file, loadHistory]);

  const handleRollback = useCallback(async (batch: MigrationBatch) => {
    setRollbackLoading(true);
    try {
      await api.upload.migrationRollback(batch.importBatchId);
      setRollbackModal(null);
      loadHistory();
    } catch (err) {
      alert(`Rollback failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setRollbackLoading(false);
  }, [loadHistory]);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setParseError(null);
    setPreviewRows([]);
    setImportResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AllModels Migration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Import devices from the AllModels CSV export into DST
          </p>
          <a
            href="https://airtable.com/appEZYvUCudrm2Fc5/pagWcdpKtA1fm5lrV"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
          >
            B2B2C Partnerships &rsaquo; Devices &rsaquo; All Models
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {step !== 'upload' && (
          <button onClick={reset} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Start Over
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'preview', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-gray-300" />}
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              step === s ? 'bg-indigo-600 text-white' : s === 'result' && step === 'preview' ? 'bg-gray-200 text-gray-500' : s === 'preview' && step === 'upload' ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700'
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
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Idempotent operation</p>
                <p className="mt-1">
                  Existing devices matched by Device ID will be skipped. Re-running will not create duplicates.
                </p>
              </div>
            </div>
          </div>

          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
              dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
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
                  Drop your AllModels CSV here
                </p>
                <p className="mb-4 text-sm text-gray-500">or click to browse</p>
                <label className="cursor-pointer rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                  Select File
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
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

          <div className="mt-4 rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900">Column Mappings</h3>
            <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
              {COLUMN_MAPPINGS.map((m) => (
                <div key={m.csv} className="flex justify-between py-0.5">
                  <span className="text-gray-600">{m.csv}</span>
                  <code className="rounded bg-gray-100 px-1.5 text-indigo-700">{m.field}</code>
                </div>
              ))}
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

      {/* Step 2: Preview & Validate */}
      {step === 'preview' && (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white px-6 py-4">
            <span className="text-sm font-medium text-gray-700">{summary.total} rows parsed</span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1.5 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="font-medium text-emerald-700">{summary.ready}</span> ready
            </span>
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
                  <span className="font-medium text-red-700">{summary.errors}</span> will be skipped
                </span>
              </>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="max-h-[500px] overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Device</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Device ID</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Vendor</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Region</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Country</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Type</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">ADK</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewRows.slice(0, 200).map(row => (
                    <tr key={row.rowIndex} className={row.status === 'error' ? 'bg-red-50' : row.status === 'warning' ? 'bg-amber-50' : ''}>
                      <td className="px-3 py-2 text-xs text-gray-500">{row.rowIndex}</td>
                      <td className="px-3 py-2">
                        {row.status === 'error' ? <Badge variant="danger">Error</Badge>
                          : row.status === 'warning' ? <Badge variant="warning">Warning</Badge>
                          : <Badge variant="success">Ready</Badge>}
                      </td>
                      <td className="max-w-[150px] truncate whitespace-nowrap px-3 py-2 text-sm text-gray-900" title={row.displayName}>
                        {row.displayName || <span className="italic text-gray-400">unnamed</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-700">
                        {row.deviceId || <span className="italic text-red-400">missing</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.vendor || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm">
                        {row.region ? <Badge variant="info">{row.region}</Badge> : '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {row.countries.length > 0 ? row.countries.join(', ') : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.deviceType || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.liveAdkVersion || '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        {[...row.errors, ...row.warnings].map((note, i) => (
                          <p key={i} className={row.errors.includes(note) ? 'text-red-600' : 'text-amber-600'}>{note}</p>
                        ))}
                        {row.errors.length === 0 && row.warnings.length === 0 && <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewRows.length > 200 && (
              <div className="border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
                Showing first 200 of {previewRows.length} rows
              </div>
            )}
          </div>

          {parseError && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{parseError}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleImport}
              disabled={loading || summary.total === 0}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <LoadingSpinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              Run Migration ({summary.ready + summary.warnings} importable)
            </button>
          </div>
        </>
      )}

      {/* Step 3: Result */}
      {step === 'result' && importResult && (
        <div className="rounded-xl border border-gray-200 bg-white p-8">
          <div className="flex flex-col items-center text-center">
            <CheckCircle className="mb-4 h-16 w-16 text-emerald-500" />
            <h2 className="text-xl font-bold text-gray-900">Migration Complete</h2>
            <p className="mt-2 text-sm text-gray-600">
              {importResult.created} devices created, {importResult.duplicates} duplicates skipped, {importResult.errored} errors.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Batch ID: {importResult.importBatchId}
            </p>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto rounded-md bg-red-50 p-3">
              <p className="mb-1 text-xs font-medium text-red-700">Errors & Warnings</p>
              <ul className="space-y-0.5 text-xs text-red-600">
                {importResult.errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Import History */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Import History</h3>
          </div>
        </div>
        <div className="border-t border-gray-200 px-6 py-4">
          {historyLoading ? (
            <LoadingSpinner />
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500">No import batches yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map(batch => (
                <div key={batch.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-900">{batch.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(batch.importedAt).toLocaleString()} by {batch.importedByEmail}
                    </p>
                    <p className="text-xs text-gray-500">
                      {batch.created} created, {batch.duplicates} duplicates, {batch.errored} errors
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {batch.importBatchId.slice(0, 8)}...
                    </span>
                    {batch.rollbackAvailable ? (
                      <button
                        onClick={() => setRollbackModal(batch)}
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
              ))}
            </div>
          )}
        </div>
      </div>

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
              Rollback Migration
            </button>
          </>
        }
      >
        {rollbackModal && (
          <div className="space-y-3 text-sm text-gray-700">
            <p>This will permanently delete all devices created by this migration batch:</p>
            <div className="rounded-lg bg-gray-50 p-4 space-y-1">
              <p><span className="font-medium">Imported by:</span> {rollbackModal.importedByEmail}</p>
              <p><span className="font-medium">Date:</span> {new Date(rollbackModal.importedAt).toLocaleString()}</p>
              <p><span className="font-medium">File:</span> {rollbackModal.fileName}</p>
              <p><span className="font-medium">Devices created:</span> {rollbackModal.created}</p>
              <p><span className="font-medium">Batch ID:</span> {rollbackModal.importBatchId}</p>
            </div>
            <p className="font-medium text-red-600">This action cannot be undone.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
