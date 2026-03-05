import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  CloudUpload,
  Clock,
  RotateCcw,
  ExternalLink,
  Pencil,
  ArrowRightLeft,
  Minus,
} from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import { formatDateTime, formatNumber } from '../lib/format';
import { useImportPrerequisites } from '../hooks/useImportPrerequisites';
import Badge from '../components/shared/Badge';
import Button from '../components/shared/Button';
import InlineNotice from '../components/shared/InlineNotice';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import PrerequisiteBanner from '../components/shared/PrerequisiteBanner';
import TimeRangeDropdown from '../components/shared/TimeRangeDropdown';
import WorkflowStepper from '../components/shared/WorkflowStepper';
import type { UploadHistoryWithRollback, TelemetryPreviewRow } from '../lib/types';

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function parseSnapshotDateFromFilename(fileName: string): string | null {
  try {
    const base = fileName.replace(/\.csv$/i, '');
    const segments = base.split('_');
    if (segments.length < 3) return null;

    const dateSegment = segments[segments.length - 2];
    const dateParts = dateSegment.split('-');
    if (dateParts.length !== 3) return null;

    const [yearStr, monthName, dayStr] = dateParts;
    const year = parseInt(yearStr);
    if (isNaN(year) || yearStr.length !== 4) return null;

    const monthIndex = MONTH_NAMES.indexOf(monthName.toLowerCase());
    if (monthIndex === -1) return null;

    const day = parseInt(dayStr);
    if (isNaN(day) || day < 1 || day > 31) return null;

    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  } catch {
    return null;
  }
}

function formatSnapshotDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const monthName = MONTH_NAMES[m - 1];
  if (!monthName) return isoDate;
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${d}, ${y}`;
}

type Step = 'upload' | 'preview' | 'result';
const STEP_KEYS: Step[] = ['upload', 'preview', 'result'];

const UPSERT_BADGE: Record<string, { variant: 'info' | 'success' | 'warning' | 'default'; label: string }> = {
  new: { variant: 'success', label: 'New' },
  update: { variant: 'info', label: 'Update' },
  no_change: { variant: 'default', label: 'No change' },
  stale: { variant: 'warning', label: 'Stale' },
};

function PrerequisitesWidget() {
  const prereqs = useImportPrerequisites();
  if (prereqs.loading) return null;

  const items = [
    {
      met: prereqs.partnerKeysLoaded,
      label: prereqs.partnerKeysLoaded
        ? `Partner Keys loaded (${prereqs.counts.partnerKeys} keys)`
        : 'Partner Keys — not loaded',
      warning: false,
    },
    {
      met: prereqs.devicesRegistered,
      label: prereqs.devicesRegistered
        ? `Devices registered (${prereqs.counts.devices} devices)`
        : 'Devices — none registered',
      warning: false,
    },
    {
      met: prereqs.versionRegistrySeeded,
      label: prereqs.versionRegistrySeeded
        ? `Version Registry seeded (${prereqs.counts.versionMappings} mappings)`
        : 'Version Registry — 0 mappings. Friendly versions will be blank.',
      warning: !prereqs.versionRegistrySeeded,
    },
    {
      met: prereqs.fieldOptionsSeeded,
      label: prereqs.fieldOptionsSeeded
        ? 'Reference Data seeded'
        : 'Reference Data — not seeded',
      warning: false,
    },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Prerequisites</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            {item.met ? (
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-500" />
            ) : item.warning ? (
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
            )}
            <span className={item.met ? 'text-gray-700' : item.warning ? 'text-amber-700' : 'text-red-700'}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TelemetryUploadPage() {
  const prereqs = useImportPrerequisites();
  const isBlocked = !prereqs.loading && (!prereqs.partnerKeysLoaded || !prereqs.devicesRegistered);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [snapshotDate, setSnapshotDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [importTimeRange, setImportTimeRange] = useState<string | null>(null);
  const [dateParsedFromFile, setDateParsedFromFile] = useState(false);
  const [dateReadOnly, setDateReadOnly] = useState(false);
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [previewRows, setPreviewRows] = useState<TelemetryPreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState<{ total: number; new: number; update: number; noChange: number; stale: number } | null>(null);
  const [staleOverrides, setStaleOverrides] = useState<Set<number>>(new Set());

  const [uploadResult, setUploadResult] = useState<{
    uploadBatchId: string; rowCount: number; successCount: number;
    newCount: number; updatedCount: number; noChangeCount: number; staleOverwrittenCount: number;
    errorCount: number; errors: string[];
  } | null>(null);

  const [history, setHistory] = useState<UploadHistoryWithRollback[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [rollbackModal, setRollbackModal] = useState<UploadHistoryWithRollback | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.telemetry.history();
      setHistory(res.data);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleFile = useCallback(async (f: File) => {
    setParseError(null);
    setDateWarning(null);
    if (!f.name.endsWith('.csv')) {
      setParseError('Only .csv files are accepted.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setParseError('File exceeds the 10 MB limit.');
      return;
    }

    const parsedDate = parseSnapshotDateFromFilename(f.name);
    if (parsedDate) {
      setSnapshotDate(parsedDate);
      setDateParsedFromFile(true);
      setDateReadOnly(true);
      setDateWarning(null);
    } else {
      setSnapshotDate(new Date().toISOString().split('T')[0]);
      setDateParsedFromFile(false);
      setDateReadOnly(false);
      setDateWarning('Could not parse date from filename. Please confirm the snapshot date below.');
    }

    setFile(f);
    setLoading(true);
    setStaleOverrides(new Set());

    try {
      const dateToUse = parsedDate ?? new Date().toISOString().split('T')[0];
      const result = await api.telemetry.preview(f, dateToUse);
      setPreviewRows(result.rows);
      setPreviewSummary(result.summary);
      setStep('preview');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : `Failed to process file: ${String(err)}`);
    }
    setLoading(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const hasUnresolvedStale = useMemo(() => {
    return previewRows.some(r => r.upsertStatus === 'stale' && !staleOverrides.has(r.rowIndex));
  }, [previewRows, staleOverrides]);

  const handleUpload = useCallback(async () => {
    if (!file || !importTimeRange) return;
    setLoading(true);
    setParseError(null);

    try {
      const result = await api.telemetry.upload(file, snapshotDate, Array.from(staleOverrides), importTimeRange);
      setUploadResult(result);
      trackEvent('telemetry_upload', { file_name: file.name, row_count: result.rowCount });
      setStep('result');
      loadHistory();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [file, snapshotDate, staleOverrides, importTimeRange, loadHistory]);

  const handleRollback = useCallback(async (batch: UploadHistoryWithRollback) => {
    if (!batch.uploadBatchId) return;
    setRollbackLoading(true);
    try {
      await api.telemetry.rollback(batch.uploadBatchId);
      setRollbackModal(null);
      loadHistory();
    } catch (err) {
      setParseError(`Rollback failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setRollbackLoading(false);
  }, [loadHistory]);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setParseError(null);
    setDateWarning(null);
    setDateParsedFromFile(false);
    setDateReadOnly(false);
    setPreviewRows([]);
    setPreviewSummary(null);
    setStaleOverrides(new Set());
    setUploadResult(null);
    setImportTimeRange(null);
    setSnapshotDate(new Date().toISOString().split('T')[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Telemetry Upload</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload observability CSV exports to update device telemetry data
          </p>
          <a
            href={`https://disney.my.sentry.io/organizations/disney/explore/discover/results/?field=partner&field=device&field=core_version&field=count_unique%28device_id%29&field=count%28%29&name=ADK%20Partner%20-%20Device%20Combinations&project=23&query=%21partner%3Arefapp%20%21partner%3Abroadcom%20%21partner%3Avpe%20title%3Alaunch%20%21partner%3Adss%20%21partner%3Atwdc_microsoft%20%21partner%3Atwdc_amazon&sort=-count_unique_device_id&statsPeriod=${importTimeRange ?? '24h'}&yAxis=count_unique%28device_id%29&yAxis=count%28%29`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
          >
            ADK Partner - Device Combinations
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {step !== 'upload' && (
          <Button onClick={reset} variant="secondary">
            Start Over
          </Button>
        )}
      </div>

      {/* Prerequisite banners */}
      {!prereqs.loading && !prereqs.partnerKeysLoaded && (
        <PrerequisiteBanner
          severity="red"
          message="Partner Keys have not been loaded. Telemetry rows cannot be attributed to a partner. Load Partner Keys before uploading."
          linkTo="/admin/partner-keys"
          linkLabel="Import Partner Keys"
        />
      )}
      {!prereqs.loading && !prereqs.devicesRegistered && (
        <PrerequisiteBanner
          severity="red"
          message="No devices are registered. All uploaded rows will generate Unregistered Device alerts and no counts will be attributed. Complete All Models Migration first."
          linkTo="/admin/migration"
          linkLabel="Go to All Models Migration"
        />
      )}
      {!prereqs.loading && prereqs.partnerKeysLoaded && prereqs.devicesRegistered && !prereqs.versionRegistrySeeded && (
        <PrerequisiteBanner
          severity="amber"
          message="Version Registry is empty. All uploaded rows will have a blank Friendly Version and this cannot be corrected retroactively without re-uploading. Seed the Version Registry first."
          linkTo="/admin/version-registry"
          linkLabel="Go to Version Registry"
        />
      )}

      {/* Prerequisites summary widget */}
      <PrerequisitesWidget />

      {/* Step indicator */}
      <WorkflowStepper
        mode="linear3"
        currentStep={step}
        completedSteps={step === 'result' ? STEP_KEYS : step === 'preview' ? ['upload'] : []}
        steps={[
          { key: 'upload', label: 'Upload' },
          { key: 'preview', label: 'Preview & Validate' },
          { key: 'result', label: 'Import Complete' },
        ]}
      />

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="rounded-xl border border-gray-200 bg-white p-8">
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
                <CloudUpload className="mb-4 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-lg font-medium text-gray-700">
                  Drop your observability CSV here
                </p>
                <p className="mb-4 text-sm text-gray-500">or click to browse</p>
                <label className={`rounded-lg px-6 py-2.5 text-sm font-medium text-white ${
                  isBlocked ? 'cursor-not-allowed bg-gray-400' : 'cursor-pointer bg-indigo-600 hover:bg-indigo-700'
                }`}>
                  Select File
                  <input
                    ref={fileInputRef}
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

          <div className="mt-4 flex flex-wrap gap-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                <Clock className="mr-1 inline h-3.5 w-3.5" />
                Snapshot Date
              </label>
              <input
                type="date"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Import Time Range {importTimeRange == null && <span className="text-red-500">*</span>}
              </label>
              <TimeRangeDropdown value={importTimeRange} onChange={setImportTimeRange} />
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-600">Expected CSV Columns</p>
            <p className="mt-1 font-mono text-xs text-gray-500">
              partner, device, core_version, count_unique_device_id, count
            </p>
          </div>

          {parseError && (
            <InlineNotice
              severity="error"
              className="mt-4"
              message={parseError}
            />
          )}
        </div>
      )}

      {/* Step 2: Preview & Validate */}
      {step === 'preview' && (
        <>
          {/* Snapshot date header */}
          <div className="rounded-lg border border-gray-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Snapshot date: {formatSnapshotDate(snapshotDate)}
                    {dateParsedFromFile && <span className="ml-2 text-xs text-gray-500">(parsed from filename)</span>}
                  </p>
                  {dateWarning && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> {dateWarning}
                    </p>
                  )}
                  {dateParsedFromFile && dateReadOnly && (
                    <p className="mt-0.5 text-xs text-gray-500">Parsed from filename.</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <TimeRangeDropdown value={importTimeRange} onChange={setImportTimeRange} />
                {dateReadOnly ? (
                  <Button
                    onClick={() => setDateReadOnly(false)}
                    variant="secondary"
                    size="sm"
                    className="text-gray-600"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                ) : (
                  <input
                    type="date"
                    value={snapshotDate}
                    onChange={(e) => setSnapshotDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Summary banner */}
          {previewSummary && (
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white px-6 py-4">
              <span className="text-sm font-medium text-gray-700">{previewSummary.total} rows</span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1.5 text-sm">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-emerald-700">{previewSummary.new}</span> new
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1.5 text-sm">
                <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
                <span className="font-medium text-indigo-700">{previewSummary.update}</span> updates
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1.5 text-sm">
                <Minus className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-600">{previewSummary.noChange}</span> no change
              </span>
              {previewSummary.stale > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="flex items-center gap-1.5 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="font-medium text-amber-700">{previewSummary.stale}</span> stale (review required)
                  </span>
                </>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="max-h-[500px] overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">#</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Partner Key</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Device ID</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Core Version</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Friendly Version</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-gray-500">Unique Devices</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-gray-500">Events</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewRows.slice(0, 200).map(row => {
                    const isStale = row.upsertStatus === 'stale';
                    const isOverridden = staleOverrides.has(row.rowIndex);
                    const badge = UPSERT_BADGE[row.upsertStatus] ?? UPSERT_BADGE.new;

                    return (
                      <tr
                        key={row.rowIndex}
                        className={
                          isStale && !isOverridden ? 'bg-amber-50' :
                          row.status === 'error' ? 'bg-red-50' :
                          row.status === 'warning' ? 'bg-amber-50/40' : ''
                        }
                      >
                        <td className="px-3 py-2 text-xs text-gray-500">{row.rowIndex}</td>
                        <td className="px-3 py-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">{row.partner || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.device || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.coreVersion || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">
                          {row.friendlyVersion ? (
                            <span className="font-medium text-gray-900">{row.friendlyVersion}</span>
                          ) : row.coreVersion ? (
                            <Badge variant="warning">Unmapped</Badge>
                          ) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-700">{formatNumber(row.uniqueDevices)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-700">{formatNumber(row.eventCount)}</td>
                        <td className="px-3 py-2 text-xs">
                          {isStale && !isOverridden && (
                            <div className="mb-1">
                              <label className="flex items-center gap-1.5 text-amber-700">
                                <input
                                  type="checkbox"
                                  checked={false}
                                  onChange={() => setStaleOverrides(prev => {
                                    const next = new Set(prev);
                                    next.add(row.rowIndex);
                                    return next;
                                  })}
                                  className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                />
                                Overwrite anyway
                              </label>
                            </div>
                          )}
                          {isStale && isOverridden && (
                            <p className="mb-1 text-xs text-emerald-600">Will overwrite older → newer</p>
                          )}
                          {[...row.errors, ...row.warnings].map((note, i) => (
                            <p key={i} className={row.errors.includes(note) ? 'text-red-600' : 'text-amber-600'}>{note}</p>
                          ))}
                          {row.errors.length === 0 && row.warnings.length === 0 && !isStale && <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
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
            <InlineNotice severity="error" message={parseError} />
          )}

          {hasUnresolvedStale && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
              <p className="text-sm text-amber-700">
                {previewRows.filter(r => r.upsertStatus === 'stale' && !staleOverrides.has(r.rowIndex)).length} stale row(s) will be skipped unless you check "Overwrite anyway" for each.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {!importTimeRange && (
              <p className="text-sm text-amber-600">Select an Import Time Range before uploading.</p>
            )}
            <button
              onClick={handleUpload}
              disabled={loading || (previewSummary?.total ?? 0) === 0 || !importTimeRange}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <LoadingSpinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              Upload {previewSummary?.total ?? 0} records
            </button>
          </div>
        </>
      )}

      {/* Step 3: Result */}
      {step === 'result' && uploadResult && (
        <div className="rounded-xl border border-gray-200 bg-white p-8">
          <div className="flex flex-col items-center text-center">
            <CheckCircle className="mb-4 h-16 w-16 text-emerald-500" />
            <h2 className="text-xl font-bold text-gray-900">Upload Complete</h2>
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{uploadResult.newCount} new</span>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">{uploadResult.updatedCount} updated</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">{uploadResult.noChangeCount} unchanged</span>
              {uploadResult.staleOverwrittenCount > 0 && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{uploadResult.staleOverwrittenCount} stale overwritten</span>
              )}
              {uploadResult.errorCount > 0 && (
                <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">{uploadResult.errorCount} errors</span>
              )}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Batch ID: {uploadResult.uploadBatchId}
            </p>
          </div>
          {uploadResult.errors.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-red-50 p-3">
              <p className="mb-1 text-xs font-medium text-red-700">Error Details</p>
              <ul className="space-y-0.5 text-xs text-red-600">
                {uploadResult.errors.map((err, i) => (
                  <li key={i}>&bull; {err}</li>
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
            <h3 className="text-sm font-semibold text-gray-900">Upload History</h3>
          </div>
        </div>
        <div className="border-t border-gray-200 px-6 py-4">
          {historyLoading ? (
            <LoadingSpinner />
          ) : history.length === 0 ? (
            <EmptyState title="No upload history yet" />
          ) : (
            <div className="space-y-3">
              {history.map(batch => {
                const canRollback = !!batch.rollbackAvailable;

                return (
                  <div key={batch.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-gray-900">{batch.fileName}</p>
                      <p className="text-xs text-gray-500">
                        Snapshot: {formatSnapshotDate(batch.snapshotDate)}
                        {batch.importTimeRange && <> &middot; Range: {batch.importTimeRange.toUpperCase()}</>}
                        {' '}&middot; Uploaded {formatDateTime(batch.uploadedAt)} by {batch.uploadedByEmail}
                      </p>
                      <p className="text-xs text-gray-500">
                        {batch.rowCount} rows
                        {batch.newCount != null && <> &middot; {batch.newCount} new</>}
                        {batch.updatedCount != null && <> &middot; {batch.updatedCount} updated</>}
                        {batch.noChangeCount != null && <> &middot; {batch.noChangeCount} unchanged</>}
                        {batch.staleOverwrittenCount != null && batch.staleOverwrittenCount > 0 && <> &middot; {batch.staleOverwrittenCount} stale overwritten</>}
                        {(batch.newCount == null) && <>, {batch.successCount} succeeded, {batch.errorCount} errors</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {batch.uploadBatchId && (
                        <span className="text-xs text-gray-400">
                          {batch.uploadBatchId.slice(0, 8)}...
                        </span>
                      )}
                      {canRollback ? (
                        <Button
                          onClick={() => setRollbackModal(batch)}
                          variant="secondary"
                          size="sm"
                          className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Rollback
                        </Button>
                      ) : batch.uploadBatchId ? (
                        <span className="text-xs text-gray-400">Rollback expired</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
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
              {rollbackLoading && <LoadingSpinner inline className="h-4 w-4" />}
              Rollback Upload
            </button>
          </>
        }
      >
        {rollbackModal && (
          <div className="space-y-3 text-sm text-gray-700">
            <p>This will permanently delete all telemetry snapshots from this upload batch:</p>
            <div className="rounded-lg bg-gray-50 p-4 space-y-1">
              <p><span className="font-medium">Uploaded by:</span> {rollbackModal.uploadedByEmail}</p>
              <p><span className="font-medium">Date:</span> {formatDateTime(rollbackModal.uploadedAt)}</p>
              <p><span className="font-medium">File:</span> {rollbackModal.fileName}</p>
              <p><span className="font-medium">Records:</span> {rollbackModal.successCount} uploaded</p>
            </div>
            <p className="font-medium text-red-600">This action cannot be undone.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
