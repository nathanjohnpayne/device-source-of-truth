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
} from 'lucide-react';
import Papa from 'papaparse';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import type { UploadHistory } from '../lib/types';

const EMOJI_REGEX = /[\u{1F1E0}-\u{1F1FF}\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

function stripEmoji(str: string): string {
  return str.replace(EMOJI_REGEX, '').trim();
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

const EXPECTED_COLUMNS = ['partner', 'device', 'core_version', 'count_unique_device_id', 'count'];

interface TelemetryPreviewRow {
  rowIndex: number;
  partner: string;
  device: string;
  coreVersion: string;
  uniqueDevices: number;
  eventCount: number;
  status: 'ready' | 'warning' | 'error';
  warnings: string[];
  errors: string[];
}

type Step = 'upload' | 'preview' | 'result';

export default function TelemetryUploadPage() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [snapshotDate, setSnapshotDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [previewRows, setPreviewRows] = useState<TelemetryPreviewRow[]>([]);

  const [uploadResult, setUploadResult] = useState<{
    uploadBatchId: string; rowCount: number; successCount: number; errorCount: number; errors: string[];
  } | null>(null);

  const [history, setHistory] = useState<(UploadHistory & { uploadBatchId?: string; rollbackAvailable?: boolean })[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [rollbackModal, setRollbackModal] = useState<(UploadHistory & { uploadBatchId?: string }) | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await api.telemetry.history();
      setHistory(res.data as (UploadHistory & { uploadBatchId?: string; rollbackAvailable?: boolean })[]);
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

      const headers = (parsed.meta.fields || []).map(h => h.trim().toLowerCase());
      const missing = EXPECTED_COLUMNS.filter(col => !headers.includes(col));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(', ')}. Expected: ${EXPECTED_COLUMNS.join(', ')}`);
        setLoading(false);
        return;
      }

      const rows: TelemetryPreviewRow[] = parsed.data.map((raw, idx) => {
        const warnings: string[] = [];
        const errors: string[] = [];

        const partner = stripEmoji((raw['partner'] || '').trim());
        const device = stripEmoji((raw['device'] || '').trim());
        const coreVersion = (raw['core_version'] || '').trim();
        const uniqueDevices = parseInt(raw['count_unique_device_id']) || 0;
        const eventCount = parseInt(raw['count']) || 0;

        if (!partner) warnings.push('Missing partner key');
        if (!device) warnings.push('Missing device ID');
        if (uniqueDevices === 0 && eventCount === 0) warnings.push('Zero device count and event count');

        let status: TelemetryPreviewRow['status'] = 'ready';
        if (errors.length > 0) status = 'error';
        else if (warnings.length > 0) status = 'warning';

        return { rowIndex: idx + 1, partner, device, coreVersion, uniqueDevices, eventCount, status, warnings, errors };
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

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setParseError(null);

    try {
      const result = await api.telemetry.upload(file, snapshotDate);
      setUploadResult(result as unknown as typeof uploadResult);
      trackEvent('telemetry_upload', { file_name: file.name, row_count: result.rowCount });
      setStep('result');
      loadHistory();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [file, snapshotDate, loadHistory]);

  const handleRollback = useCallback(async (batch: UploadHistory & { uploadBatchId?: string }) => {
    if (!batch.uploadBatchId) return;
    setRollbackLoading(true);
    try {
      await api.telemetry.rollback(batch.uploadBatchId);
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
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Telemetry Upload</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload Datadog CSV exports to update device telemetry data
          </p>
          <a
            href="https://disney.my.sentry.io/organizations/disney/explore/discover/results/?field=partner&field=device&field=core_version&field=count_unique%28device_id%29&field=count%28%29&name=ADK%20Partner%20-%20Device%20Combinations&project=23&query=%21partner%3Arefapp%20%21partner%3Abroadcom%20%21partner%3Avpe%20title%3Alaunch%20%21partner%3Adss%20%21partner%3Atwdc_microsoft%20%21partner%3Atwdc_amazon&sort=-count_unique_device_id&statsPeriod=24h&yAxis=count_unique%28device_id%29&yAxis=count%28%29"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
          >
            ADK Partner - Device Combinations
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
                  Drop your Datadog CSV here
                </p>
                <p className="mb-4 text-sm text-gray-500">or click to browse</p>
                <label className="cursor-pointer rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                  Select File
                  <input
                    ref={fileInputRef}
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

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <Clock className="mr-1 inline h-3.5 w-3.5" />
              Snapshot Date
            </label>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="mt-4 rounded-md bg-gray-50 p-3">
            <p className="text-xs font-medium text-gray-600">Expected CSV Columns</p>
            <p className="mt-1 font-mono text-xs text-gray-500">
              {EXPECTED_COLUMNS.join(', ')}
            </p>
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
                  <span className="font-medium text-red-700">{summary.errors}</span> errors
                </span>
              </>
            )}
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">
              <Clock className="mr-1 inline h-3.5 w-3.5" /> Snapshot: {snapshotDate}
            </span>
          </div>

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
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-gray-500">Unique Devices</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase text-gray-500">Events</th>
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
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">{row.partner || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.device || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.coreVersion || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-700">{row.uniqueDevices.toLocaleString()}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-700">{row.eventCount.toLocaleString()}</td>
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
              onClick={handleUpload}
              disabled={loading || summary.total === 0}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <LoadingSpinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              Upload {summary.total} records
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
            <p className="mt-2 text-sm text-gray-600">
              {uploadResult.successCount} records uploaded, {uploadResult.errorCount} errors.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Batch ID: {uploadResult.uploadBatchId}
            </p>
          </div>
          {uploadResult.errors.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto rounded-md bg-red-50 p-3">
              <p className="mb-1 text-xs font-medium text-red-700">Error Details</p>
              <ul className="space-y-0.5 text-xs text-red-600">
                {uploadResult.errors.map((err, i) => (
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
            <h3 className="text-sm font-semibold text-gray-900">Upload History</h3>
          </div>
        </div>
        <div className="border-t border-gray-200 px-6 py-4">
          {historyLoading ? (
            <LoadingSpinner />
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500">No upload history yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map(batch => {
                const canRollback = !!(batch as { rollbackAvailable?: boolean }).rollbackAvailable;

                return (
                  <div key={batch.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-gray-900">{batch.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(batch.uploadedAt).toLocaleString()} by {batch.uploadedByEmail}
                      </p>
                      <p className="text-xs text-gray-500">
                        {batch.rowCount} rows, {batch.successCount} succeeded, {batch.errorCount} errors
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {batch.uploadBatchId && (
                        <span className="text-xs text-gray-400">
                          {batch.uploadBatchId.slice(0, 8)}...
                        </span>
                      )}
                      {canRollback ? (
                        <button
                          onClick={() => setRollbackModal(batch)}
                          className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Rollback
                        </button>
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
              {rollbackLoading && <LoadingSpinner className="h-4 w-4" />}
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
              <p><span className="font-medium">Date:</span> {new Date(rollbackModal.uploadedAt).toLocaleString()}</p>
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
