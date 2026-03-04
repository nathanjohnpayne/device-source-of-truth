import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import type {
  PartnerKey,
  PartnerKeyImportRow,
  PartnerKeyImportPreview,
  PartnerKeyImportBatch,
} from '../lib/types';

type Tab = 'registry' | 'import';

export default function PartnerKeyRegistryPage() {
  const [tab, setTab] = useState<Tab>('registry');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partner Key Registry</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the mapping between Datadog partner keys and canonical partner records.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {(['registry', 'import'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {t === 'registry' ? 'All Keys' : 'CSV Import'}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'registry' ? <RegistryTab /> : <ImportTab />}
    </div>
  );
}

// ── Registry Tab ──

function RegistryTab() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<(PartnerKey & { partnerDisplayName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const load = useCallback(() => {
    setLoading(true);
    api.partnerKeys
      .list({ search: search || undefined, page, pageSize })
      .then((res) => {
        setKeys(res.data as (PartnerKey & { partnerDisplayName?: string })[]);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by key name or partner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <span className="text-sm text-gray-500">{total} keys</span>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : keys.length === 0 ? (
        <EmptyState
          title="No partner keys found"
          description={search ? 'Try a different search term.' : 'Import keys via the CSV Import tab.'}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Partner</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Countries</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Region</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Chipset</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">OEM</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">OS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Active</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keys.map((k) => (
                  <tr
                    key={k.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      if (k.partnerId) navigate(`/partners/${k.partnerId}`);
                    }}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-indigo-600">
                      {k.key}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {k.partnerDisplayName ?? <span className="italic text-gray-400">Unlinked</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {(k.countries ?? []).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {(k.regions ?? []).map((r) => (
                        <Badge key={r} variant="info" className="mr-1">{r}</Badge>
                      ))}
                      {!(k.regions?.length) && '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{k.chipset ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{k.oem ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{k.os ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {k.isActive !== false ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="danger">Inactive</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {k.source === 'csv_import' ? 'CSV' : 'Manual'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex gap-1">
                <button
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Import Tab ──

type ImportStep = 'upload' | 'preview' | 'done';

function ImportTab() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PartnerKeyImportPreview | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; batchId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<PartnerKeyImportBatch[]>([]);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.partnerKeys.importBatches()
      .then((res) => setBatches(res.data))
      .catch(() => {});
  }, [result]);

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) {
      setError('Please select a .csv file');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10 MB limit');
      return;
    }
    setFile(f);
    setError(null);
    setPreview(null);
    setResult(null);
    setStep('upload');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const runPreview = async () => {
    if (!file) return;
    setParsing(true);
    setError(null);
    try {
      const res = await api.partnerKeys.importPreview(file);
      setPreview(res);
      setStep('preview');
      trackEvent('partner_key_import_preview', { row_count: res.totalRows });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setParsing(false);
    }
  };

  const runImport = async () => {
    if (!preview || !file) return;
    setImporting(true);
    setError(null);
    try {
      const importable = preview.rows.filter((r) => r.status !== 'error' && r.status !== 'skipped');
      const res = await api.partnerKeys.importConfirm(importable as PartnerKeyImportPreview['rows'], file.name);
      setResult(res);
      setStep('done');
      trackEvent('partner_key_import_complete', { imported: res.imported });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleRollback = async (batchId: string) => {
    setRollingBack(batchId);
    try {
      await api.partnerKeys.rollbackBatch(batchId);
      setBatches((prev) => prev.filter((b) => b.id !== batchId));
      setRollbackConfirm(null);
      trackEvent('partner_key_import_rollback', { batch_id: batchId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setRollingBack(null);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStep('upload');
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'preview', 'done'] as ImportStep[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-4 w-4 text-gray-300" />}
            <span
              className={`rounded-full px-3 py-1 font-medium ${
                step === s
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-400'
              }`}
            >
              {i + 1}. {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview' : 'Complete'}
            </span>
          </span>
        ))}
      </div>

      {/* Upload step */}
      {step === 'upload' && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Upload Partner Key CSV</h2>
          <p className="mb-4 text-sm text-gray-500">
            Upload the <code className="rounded bg-gray-100 px-1 text-xs">partner_key_mapping_enriched_2.csv</code> file
            or any CSV with columns: partner_key, friendly_partner_name, countries_operate_iso2,
            regions_operate, chipset, oem, kernal, os.
          </p>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
              dragging
                ? 'border-indigo-400 bg-indigo-50'
                : file
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
            }`}
          >
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
            {file ? (
              <>
                <FileSpreadsheet className="mb-3 h-10 w-10 text-emerald-500" />
                <p className="text-sm font-medium text-emerald-700">{file.name}</p>
                <p className="mt-1 text-xs text-emerald-600">
                  {(file.size / 1024).toFixed(1)} KB — Click or drop to replace
                </p>
              </>
            ) : (
              <>
                <Upload className="mb-3 h-10 w-10 text-gray-400" />
                <p className="text-sm font-medium text-gray-700">
                  Drop your partner key CSV here, or click to browse
                </p>
                <p className="mt-1 text-xs text-gray-500">Accepts .csv files up to 10 MB</p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <XCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={runPreview}
            disabled={!file || parsing}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {parsing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Parsing...
              </>
            ) : (
              'Parse & Preview'
            )}
          </button>
        </div>
      )}

      {/* Preview step */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-gray-900">{preview.totalRows} rows parsed</span>
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {preview.readyCount} ready
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-4 w-4" /> {preview.warningCount} warnings
              </span>
              <span className="flex items-center gap-1 text-red-700">
                <XCircle className="h-4 w-4" /> {preview.errorCount} errors (will skip)
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="max-h-[500px] overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Key</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Partner</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Match</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Countries</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Region</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Chipset</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">OEM</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">OS</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.rows.map((row, i) => (
                    <PreviewRow key={i} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <XCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('upload')}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={runImport}
              disabled={importing || (preview.readyCount + preview.warningCount) === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Importing...
                </>
              ) : (
                `Import ${preview.readyCount + preview.warningCount} Records`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Done step */}
      {step === 'done' && result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <h3 className="font-semibold text-emerald-900">Import Complete</h3>
              <p className="mt-1 text-sm text-emerald-800">
                {result.imported} partner keys imported, {result.skipped} skipped.
              </p>
              <p className="mt-1 text-xs text-emerald-700">Batch ID: {result.batchId}</p>
              <button
                onClick={reset}
                className="mt-3 rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Import Another File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import history */}
      {batches.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Import History</h2>
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">File</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Records</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Imported By</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-2 text-gray-700">{b.fileName}</td>
                    <td className="px-4 py-2 text-gray-700">{b.importedCount}</td>
                    <td className="px-4 py-2 text-gray-500">{b.importedByEmail}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(b.importedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      {b.rollbackAvailable ? (
                        <button
                          onClick={() => setRollbackConfirm(b.id)}
                          disabled={rollingBack === b.id}
                          className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {rollingBack === b.id ? 'Rolling back...' : 'Rollback'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Expired</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!rollbackConfirm}
        onClose={() => setRollbackConfirm(null)}
        title="Confirm Rollback"
        footer={
          <>
            <button
              onClick={() => setRollbackConfirm(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => rollbackConfirm && handleRollback(rollbackConfirm)}
              disabled={!!rollingBack}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {rollingBack ? 'Rolling back...' : 'Confirm Rollback'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          This will delete all partner keys imported in this batch. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

function PreviewRow({ row }: { row: PartnerKeyImportRow }) {
  const bgClass =
    row.status === 'error'
      ? 'bg-red-50'
      : row.status === 'warning'
        ? 'bg-amber-50'
        : '';

  const statusBadge =
    row.status === 'error' ? (
      <Badge variant="danger">Skip</Badge>
    ) : row.status === 'warning' ? (
      <Badge variant="warning">Warning</Badge>
    ) : (
      <Badge variant="success">Ready</Badge>
    );

  const matchBadge =
    row.matchConfidence === 'exact' ? (
      <Badge variant="success">Exact</Badge>
    ) : row.matchConfidence === 'fuzzy' ? (
      <Badge variant="warning">Fuzzy</Badge>
    ) : (
      <Badge variant="danger">None</Badge>
    );

  return (
    <tr className={bgClass}>
      <td className="whitespace-nowrap px-3 py-2 text-sm">{statusBadge}</td>
      <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">{row.key || '—'}</td>
      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">
        {row.partnerDisplayName ?? row.friendlyPartnerName ?? '—'}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-sm">{matchBadge}</td>
      <td className="px-3 py-2 text-sm text-gray-700">{(row.countries ?? []).join(', ') || '—'}</td>
      <td className="px-3 py-2 text-sm text-gray-700">{(row.regions ?? []).join(', ') || '—'}</td>
      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.chipset ?? '—'}</td>
      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.oem ?? '—'}</td>
      <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.os ?? '—'}</td>
      <td className="px-3 py-2 text-sm">
        {[...row.warnings, ...row.errors].map((note, i) => (
          <p key={i} className={`text-xs ${row.errors.includes(note) ? 'text-red-600' : 'text-amber-600'}`}>
            {note}
          </p>
        ))}
      </td>
    </tr>
  );
}
