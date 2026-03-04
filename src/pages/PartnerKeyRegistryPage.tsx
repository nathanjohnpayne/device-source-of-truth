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
  Sparkles,
  Info,
  Clock,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Database,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import { useImportPrerequisites } from '../hooks/useImportPrerequisites';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import ClarificationPanel from '../components/shared/ClarificationPanel';
import PrerequisiteBanner from '../components/shared/PrerequisiteBanner';
import type {
  PartnerKeyWithDisplay,
  PartnerKeyImportRow,
  PartnerKeyImportPreview,
  PartnerKeyImportBatch,
  DisambiguationResponse,
  DisambiguationFieldResult,
  ClarificationAnswer,
  ConflictResolution,
  PartnerAlias,
  PartnerAliasContextRules,
  PartnerAliasContextRule,
  Partner,
} from '../lib/types';

type Tab = 'import' | 'registry' | 'aliases';

export default function PartnerKeyRegistryPage() {
  const [tab, setTab] = useState<Tab>('import');
  const prereqs = useImportPrerequisites();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partner Key Registry</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the mapping between observability partner keys and canonical partner records.
        </p>
      </div>

      {!prereqs.loading && !prereqs.fieldOptionsSeeded && (
        <PrerequisiteBanner
          severity="amber"
          message="Reference Data has not been seeded. Chipset, OS, and region dropdowns will be empty during import. Seed Reference Data first for best results."
          linkTo="/admin/reference-data"
          linkLabel="Seed Reference Data"
        />
      )}

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {(['import', 'registry', 'aliases'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {t === 'import' ? 'CSV Import' : t === 'registry' ? 'All Keys' : 'Aliases'}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'import' ? <ImportTab /> : tab === 'registry' ? <RegistryTab /> : <AliasesTab />}
    </div>
  );
}

// ── Registry Tab ──

function RegistryTab() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<PartnerKeyWithDisplay[]>([]);
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
        setKeys(res.data);
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
  const prereqs = useImportPrerequisites();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PartnerKeyImportPreview | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; batchId: string; partnersCreated?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<PartnerKeyImportBatch[]>([]);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null);
  const [disambiguation, setDisambiguation] = useState<DisambiguationResponse | null>(null);
  const [disambiguating, setDisambiguating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [rawCsvRows, setRawCsvRows] = useState<Record<string, unknown>[]>([]);
  const [useAI, setUseAI] = useState(false);
  const [showAICostModal, setShowAICostModal] = useState(false);
  const aiModalShownRef = useRef(false);
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
    setDisambiguation(null);
    try {
      const csvText = await file.text();
      const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      const headers = lines[0]?.split(',').map(h => h.trim()) ?? [];
      const csvRows: Record<string, unknown>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(',').map(v => v.trim());
        const row: Record<string, unknown> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
        csvRows.push(row);
      }
      setRawCsvRows(csvRows);

      const res = await api.partnerKeys.importPreview(file);
      setPreview(res);
      setStep('preview');
      trackEvent('partner_key_import_preview', { row_count: res.totalRows });

      if (useAI && res.errorCount > 0) {
        setDisambiguating(true);
        try {
          const aiResult = await api.disambiguation.disambiguate('partner_key', csvRows);
          setDisambiguation(aiResult);
          trackEvent('partner_key_ai_disambiguation', {
            auto_resolved: aiResult.fields.filter(f => !f.needsHuman).length,
            questions: aiResult.questions.length,
            fallback: aiResult.aiFallback,
          });
        } catch {
          setDisambiguation({
            fields: [],
            questions: [],
            aiFallback: true,
            fallbackReason: 'AI disambiguation request failed',
          });
        } finally {
          setDisambiguating(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setParsing(false);
    }
  };

  const handleResolution = useCallback((key: string, resolution: ConflictResolution) => {
    if (!preview) return;
    setPreview({
      ...preview,
      rows: preview.rows.map(r =>
        r.key === key && r.dedupInfo
          ? { ...r, dedupInfo: { ...r.dedupInfo, resolution } }
          : r,
      ),
    });
  }, [preview]);

  const handleApplyToAllConflicts = useCallback((resolution: ConflictResolution) => {
    if (!preview) return;
    setPreview({
      ...preview,
      rows: preview.rows.map(r =>
        r.dedupInfo?.dedupStatus === 'conflict' && !r.dedupInfo.resolution
          ? { ...r, dedupInfo: { ...r.dedupInfo, resolution } }
          : r,
      ),
    });
  }, [preview]);

  const unresolvedConflicts = preview?.rows.filter(r =>
    r.dedupInfo?.dedupStatus === 'conflict' && !r.dedupInfo.resolution,
  ).length ?? 0;

  const runImport = async () => {
    if (!preview || !file || unresolvedConflicts > 0) return;
    setImporting(true);
    setError(null);
    try {
      const importable = preview.rows.filter((r) => {
        if (r.status === 'error' || r.status === 'skipped' || !r.key) return false;
        if (r.dedupInfo?.dedupStatus === 'duplicate_in_file') return false;
        if (r.dedupInfo?.dedupStatus === 'duplicate' && r.dedupInfo.resolution !== 'overwrite') return false;
        if (r.dedupInfo?.dedupStatus === 'conflict' && r.dedupInfo.resolution === 'skip') return false;
        return true;
      });
      const res = await api.partnerKeys.importConfirm(importable as PartnerKeyImportPreview['rows'], file.name);
      setResult(res);
      setStep('done');
      if (res.partnersCreated && res.partnersCreated > 0) {
        prereqs.refresh();
      }
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

  const handleClarificationSubmit = async (answers: ClarificationAnswer[]) => {
    if (!disambiguation) return;
    setResolving(true);
    try {
      const res = await api.disambiguation.resolve(
        'partner_key',
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
      trackEvent('partner_key_clarification_resolved', { answered: answers.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve answers');
    } finally {
      setResolving(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setDisambiguation(null);
    setRawCsvRows([]);
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
            Upload the <code className="rounded bg-gray-100 px-1 text-xs">partner_key_mapping_enriched.csv</code> file
            or any CSV with columns: partner_key, friendly_partner_name, countries_operate_iso2,
            regions_operate, chipset, oem, kernel, os.
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

          {/* AI Import opt-in (DST-040) */}
          <div className="mt-4 flex items-center gap-2">
            <input
              id="pk-use-ai"
              type="checkbox"
              checked={useAI}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked && !aiModalShownRef.current) {
                  setShowAICostModal(true);
                } else {
                  setUseAI(checked);
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="pk-use-ai" className="text-sm text-gray-700">
              Use AI Import?
            </label>
            <div className="group relative">
              <Info className="h-4 w-4 text-gray-400" />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                Runs an AI pass to automatically resolve ambiguous values. May incur additional Anthropic API costs.
              </div>
            </div>
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
      {step === 'preview' && preview && (() => {
        const duplicateCount = preview.rows.filter(r => r.dedupInfo?.dedupStatus === 'duplicate').length;
        const conflictCount = preview.rows.filter(r => r.dedupInfo?.dedupStatus === 'conflict').length;
        const inFileDuplicateCount = preview.rows.filter(r => r.dedupInfo?.dedupStatus === 'duplicate_in_file').length;
        const dedupOrder: Record<string, number> = { conflict: 0, duplicate: 1, duplicate_in_file: 2 };
        const sortedRows = [...preview.rows].sort((a, b) => {
          const aO = a.dedupInfo ? (dedupOrder[a.dedupInfo.dedupStatus] ?? 3) : 3;
          const bO = b.dedupInfo ? (dedupOrder[b.dedupInfo.dedupStatus] ?? 3) : 3;
          return aO !== bO ? aO - bO : 0;
        });

        return (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-gray-900">{preview.totalRows} rows parsed</span>
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {preview.readyCount} ready
              </span>
              {duplicateCount > 0 && (
                <span className="text-blue-700">
                  {duplicateCount} duplicates (will skip)
                </span>
              )}
              {conflictCount > 0 && (
                <span className="flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> {conflictCount} conflicts
                  {unresolvedConflicts > 0 ? ` (${unresolvedConflicts} unresolved)` : ' (all resolved)'}
                </span>
              )}
              {inFileDuplicateCount > 0 && (
                <span className="text-red-700">
                  {inFileDuplicateCount} duplicate in file
                </span>
              )}
              {preview.warningCount > 0 && (
                <span className="flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> {preview.warningCount} warnings
                </span>
              )}
              {preview.errorCount > 0 && (
                <span className="flex items-center gap-1 text-red-700">
                  <XCircle className="h-4 w-4" /> {preview.errorCount} errors
                </span>
              )}
              {disambiguation?.aiStats && disambiguation.aiStats.totalResolved > 0 && (
                <span className="flex items-center gap-1 text-indigo-700">
                  <Sparkles className="h-4 w-4" />
                  {disambiguation.aiStats.totalResolved} values resolved by AI
                  {disambiguation.aiStats.cachedCount > 0 && (
                    <span className="text-indigo-500">
                      ({disambiguation.aiStats.cachedCount} cached)
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {preview.newPartnerCount != null && preview.newPartnerCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
              <Plus className="mt-0.5 h-5 w-5 text-indigo-500" />
              <div>
                <p className="text-sm font-medium text-indigo-800">
                  {preview.newPartnerCount} new partner{preview.newPartnerCount !== 1 ? 's' : ''} will be created on import
                </p>
                <p className="mt-1 text-xs text-indigo-600">
                  {preview.newPartnerNames?.join(', ')}
                </p>
              </div>
            </div>
          )}

          {disambiguation?.fieldTypeFallbacks && disambiguation.fieldTypeFallbacks.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-sm text-amber-800">
                AI disambiguation fell back to rule-based handling for: {disambiguation.fieldTypeFallbacks.join(', ')}.
                Those fields require manual review.
              </p>
            </div>
          )}

          {unresolvedConflicts > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-amber-800">
                {unresolvedConflicts} conflict{unresolvedConflicts !== 1 ? 's' : ''} require resolution.
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
          {disambiguating && (
            <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <Sparkles className="h-5 w-5 animate-pulse text-indigo-500" />
              <p className="text-sm text-indigo-700">Running AI disambiguation on ambiguous fields…</p>
            </div>
          )}

          {disambiguation && !disambiguating && (
            <ClarificationPanel
              questions={disambiguation.questions}
              fields={disambiguation.fields}
              onSubmitAnswers={handleClarificationSubmit}
              loading={resolving}
              aiFallback={disambiguation.aiFallback}
              fallbackReason={disambiguation.fallbackReason}
            />
          )}

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
                  {sortedRows.map((row, i) => {
                    const csvIdx = rawCsvRows.findIndex(r => String(r['partner_key'] ?? '').trim() === row.key);
                    const rowAiResults = csvIdx >= 0 && disambiguation
                      ? disambiguation.fields.filter(f => f.rowIndex === csvIdx)
                      : undefined;
                    return (
                      <PreviewRow key={i} row={row} onResolution={handleResolution} aiResults={rowAiResults} />
                    );
                  })}
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
              disabled={importing || unresolvedConflicts > 0 || (preview.readyCount + preview.warningCount) === 0}
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
        );
      })()}

      {/* Done step */}
      {step === 'done' && result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <h3 className="font-semibold text-emerald-900">Import Complete</h3>
              <p className="mt-1 text-sm text-emerald-800">
                {result.imported} partner keys imported, {result.skipped} skipped.
                {result.partnersCreated != null && result.partnersCreated > 0 && (
                  <span> {result.partnersCreated} new partner{result.partnersCreated !== 1 ? 's' : ''} created.</span>
                )}
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
      <PKImportHistory
        batches={batches}
        loadBatches={() => {
          api.partnerKeys.importBatches()
            .then((res) => setBatches(res.data))
            .catch(() => {});
        }}
        onRollback={(batchId) => setRollbackConfirm(batchId)}
        rollingBack={rollingBack}
      />

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
          This will delete all new partner keys imported in this batch and restore any overwritten or merged records to their pre-import state. This action cannot be undone.
        </p>
      </Modal>

      {/* AI Cost Disclosure Modal (DST-042) */}
      <Modal
        open={showAICostModal}
        onClose={() => {
          setShowAICostModal(false);
          setUseAI(false);
        }}
        title="AI-Assisted Import"
        footer={
          <>
            <button
              onClick={() => {
                setShowAICostModal(false);
                setUseAI(false);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowAICostModal(false);
                setUseAI(true);
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

function PKImportHistory({
  batches,
  loadBatches,
  onRollback,
  rollingBack,
}: {
  batches: PartnerKeyImportBatch[];
  loadBatches: () => void;
  onRollback: (batchId: string) => void;
  rollingBack: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded && batches.length === 0) loadBatches();
        }}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Import History</h3>
          {batches.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {batches.length}
            </span>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-6 py-4">
          {batches.length === 0 ? (
            <p className="text-sm text-gray-500">No import batches yet.</p>
          ) : (
            <div className="space-y-3">
              {batches.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-900">{b.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(b.importedAt).toLocaleString()} by {b.importedByEmail}
                    </p>
                    <p className="text-xs text-gray-500">
                      {b.importedCount} records imported
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {b.id.slice(0, 8)}...
                    </span>
                    {b.rollbackAvailable ? (
                      <button
                        onClick={() => onRollback(b.id)}
                        disabled={rollingBack === b.id}
                        className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {rollingBack === b.id ? 'Rolling back...' : 'Rollback'}
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
      )}
    </div>
  );
}

function AIResolveBadge({ result }: { result: DisambiguationFieldResult }) {
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

function PreviewRow({ row, onResolution, aiResults }: {
  row: PartnerKeyImportRow;
  onResolution: (key: string, resolution: ConflictResolution) => void;
  aiResults?: DisambiguationFieldResult[];
}) {
  const dedup = row.dedupInfo;
  const isDuplicate = dedup?.dedupStatus === 'duplicate';
  const isConflict = dedup?.dedupStatus === 'conflict';
  const isInFileDupe = dedup?.dedupStatus === 'duplicate_in_file';

  const aiByField = (field: string) =>
    aiResults?.find(r => r.field === field && !r.needsHuman);

  const bgClass =
    isInFileDupe
      ? 'bg-red-50 opacity-60'
      : isDuplicate
        ? 'bg-blue-50 opacity-70'
        : isConflict
          ? 'bg-amber-50'
          : row.status === 'error'
            ? 'bg-red-50'
            : row.status === 'warning'
              ? 'bg-amber-50'
              : '';

  const statusBadge =
    isInFileDupe ? (
      <Badge variant="danger">Dup in file</Badge>
    ) : isDuplicate ? (
      <Badge variant="info">Duplicate</Badge>
    ) : isConflict ? (
      <Badge variant="warning">Conflict</Badge>
    ) : row.status === 'error' ? (
      <Badge variant="danger">Skip</Badge>
    ) : row.status === 'warning' ? (
      <Badge variant="warning">Warning</Badge>
    ) : (
      <Badge variant="success">New</Badge>
    );

  const matchBadge =
    row.matchConfidence === 'exact' ? (
      <Badge variant="success">Exact</Badge>
    ) : row.matchConfidence === 'fuzzy' ? (
      <Badge variant="warning">Fuzzy</Badge>
    ) : row.matchConfidence === 'new_partner' ? (
      <Badge variant="info">New Partner</Badge>
    ) : (
      <Badge variant="danger">None</Badge>
    );

  const countryAi = aiByField('countries_operate_iso2');
  const regionAi = aiByField('regions_operate');
  const partnerAi = aiByField('friendly_partner_name');
  const chipsetAi = aiByField('chipset');

  return (
    <>
      <tr className={bgClass}>
        <td className="whitespace-nowrap px-3 py-2 text-sm">{statusBadge}</td>
        <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">{row.key || '—'}</td>
        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">
          {row.partnerDisplayName ?? row.friendlyPartnerName ?? '—'}
          {partnerAi && <AIResolveBadge result={partnerAi} />}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-sm">{matchBadge}</td>
        <td className="px-3 py-2 text-sm text-gray-700">
          {(row.countries ?? []).join(', ') || '—'}
          {countryAi && <AIResolveBadge result={countryAi} />}
        </td>
        <td className="px-3 py-2 text-sm text-gray-700">
          {(row.regions ?? []).join(', ') || '—'}
          {regionAi && <AIResolveBadge result={regionAi} />}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">
          {row.chipset ?? '—'}
          {chipsetAi && <AIResolveBadge result={chipsetAi} />}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.oem ?? '—'}</td>
        <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-700">{row.os ?? '—'}</td>
        <td className="px-3 py-2 text-sm">
          {isInFileDupe && (
            <p className="text-xs text-red-600">Duplicate within file — row {dedup.duplicateOfRow} kept</p>
          )}
          {(isConflict || isDuplicate) && (
            <select
              className="rounded border border-gray-300 px-2 py-1 text-xs"
              value={dedup?.resolution ?? ''}
              onChange={(e) => onResolution(row.key, e.target.value as ConflictResolution)}
            >
              {!dedup?.resolution && <option value="" disabled>Choose…</option>}
              <option value="skip">Skip</option>
              <option value="overwrite">Overwrite</option>
              {isConflict && <option value="merge">Merge</option>}
            </select>
          )}
          {[...row.warnings, ...row.errors].map((note, i) => (
            <p key={i} className={`text-xs ${row.errors.includes(note) ? 'text-red-600' : 'text-amber-600'}`}>
              {note}
            </p>
          ))}
        </td>
      </tr>
      {isConflict && dedup.diffs && dedup.diffs.length > 0 && (
        <tr className="bg-amber-50/50">
          <td />
          <td colSpan={9} className="px-3 py-2">
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

// ── Aliases Tab (DST-046) ──

interface AliasFormState {
  alias: string;
  resolutionType: 'direct' | 'contextual';
  partnerId: string | null;
  contextRules: PartnerAliasContextRules | null;
  notes: string;
}

const EMPTY_FORM: AliasFormState = {
  alias: '',
  resolutionType: 'direct',
  partnerId: null,
  contextRules: null,
  notes: '',
};

function AliasesTab() {
  const [aliases, setAliases] = useState<PartnerAlias[]>([]);
  const [partners, setPartners] = useState<{ id: string; displayName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AliasFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collisionWarning, setCollisionWarning] = useState<string | null>(null);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const partnerDropdownRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aliasRes, partnerRes] = await Promise.all([
        api.partnerAliases.list(),
        api.partners.list(),
      ]);
      setAliases(aliasRes.data);
      const pList = (partnerRes as { data: Partner[] }).data?.map((p: Partner) => ({ id: p.id, displayName: p.displayName })) ?? [];
      setPartners(pList);
    } catch {
      setError('Failed to load aliases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (partnerDropdownRef.current && !partnerDropdownRef.current.contains(e.target as Node)) {
        setShowPartnerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPartners = partnerSearch
    ? partners.filter(p => p.displayName.toLowerCase().includes(partnerSearch.toLowerCase())).slice(0, 10)
    : partners.slice(0, 10);

  const selectedPartnerName = form.partnerId
    ? partners.find(p => p.id === form.partnerId)?.displayName ?? '(unknown)'
    : '';

  async function checkCollision(value: string) {
    if (!value.trim()) { setCollisionWarning(null); return; }
    const lower = value.trim().toLowerCase();
    const match = partners.find(p => p.displayName.toLowerCase() === lower);
    if (match) {
      setCollisionWarning(`"${value.trim()}" matches existing partner "${match.displayName}". Aliases cannot shadow canonical partner names.`);
    } else {
      setCollisionWarning(null);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPartnerSearch('');
    setCollisionWarning(null);
    setError(null);
    setShowModal(true);
  }

  function openEdit(a: PartnerAlias) {
    setEditingId(a.id);
    setForm({
      alias: a.alias,
      resolutionType: a.resolutionType,
      partnerId: a.partnerId,
      contextRules: a.contextRules,
      notes: a.notes ?? '',
    });
    setPartnerSearch(a.partnerDisplayName ?? '');
    setCollisionWarning(null);
    setError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.alias.trim()) return;
    if (collisionWarning) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.partnerAliases.update(editingId, {
          alias: form.alias,
          partnerId: form.partnerId,
          resolutionType: form.resolutionType,
          contextRules: form.contextRules,
          notes: form.notes,
        });
      } else {
        await api.partnerAliases.create({
          alias: form.alias,
          partnerId: form.partnerId,
          resolutionType: form.resolutionType,
          contextRules: form.contextRules,
          notes: form.notes,
        });
      }
      trackEvent('partner_alias_saved', { resolution_type: form.resolutionType });
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alias');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(a: PartnerAlias) {
    try {
      if (a.isActive) {
        await api.partnerAliases.deactivate(a.id);
      } else {
        await api.partnerAliases.update(a.id, { isActive: true });
      }
      loadData();
    } catch {
      setError('Failed to update alias status');
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setError(null);
    try {
      const result = await api.partnerAliases.seed();
      trackEvent('partner_aliases_seeded', { created: result.created });
      if (result.warnings.length > 0) {
        setError(`Seeded ${result.created} aliases. Warnings: ${result.warnings.join('; ')}`);
      }
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed aliases');
    } finally {
      setSeeding(false);
    }
  }

  function addContextRule() {
    const rules = form.contextRules ?? { signals: ['region', 'country_iso'], rules: [], fallback: null };
    setForm({
      ...form,
      contextRules: {
        ...rules,
        rules: [...rules.rules, { conditions: { region: [''] }, partner_id: '' }],
      },
    });
  }

  function updateContextRule(idx: number, updates: Partial<PartnerAliasContextRule>) {
    if (!form.contextRules) return;
    const newRules = [...form.contextRules.rules];
    newRules[idx] = { ...newRules[idx], ...updates };
    setForm({ ...form, contextRules: { ...form.contextRules, rules: newRules } });
  }

  function removeContextRule(idx: number) {
    if (!form.contextRules) return;
    const newRules = form.contextRules.rules.filter((_, i) => i !== idx);
    setForm({ ...form, contextRules: { ...form.contextRules, rules: newRules } });
  }

  function resolvedDisplay(a: PartnerAlias): string {
    if (a.resolutionType === 'direct') return a.partnerDisplayName ?? '(unlinked)';
    return 'Context-dependent';
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{aliases.length} alias{aliases.length !== 1 ? 'es' : ''} registered</p>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Database className="h-4 w-4" />
            {seeding ? 'Seeding...' : 'Seed Defaults'}
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Alias
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Alias</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Resolves To</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Notes</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Active</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {aliases.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No aliases registered. Click &ldquo;Seed Defaults&rdquo; to create the standard aliases.
                </td>
              </tr>
            ) : aliases.map(a => (
              <tr key={a.id} className={a.isActive ? '' : 'opacity-50'}>
                <td className="px-4 py-3 font-medium text-gray-900">{a.alias}</td>
                <td className="px-4 py-3">
                  <Badge variant={a.resolutionType === 'direct' ? 'info' : 'warning'}>
                    {a.resolutionType}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {a.resolutionType === 'direct' ? (
                    <span className="text-gray-700">{resolvedDisplay(a)}</span>
                  ) : (
                    <ContextRulesPopover rules={a.contextRules} partners={partners} />
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{a.notes ?? ''}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggleActive(a)} title={a.isActive ? 'Deactivate' : 'Activate'}>
                    {a.isActive ? (
                      <ToggleRight className="h-5 w-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {a.createdBy === 'system' ? 'system' : a.createdBy?.split('@')[0]}
                  <br />
                  {new Date(a.createdAt as unknown as string).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(a)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={showModal}
        title={editingId ? 'Edit Alias' : 'Add Alias'}
        onClose={() => setShowModal(false)}
      >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Alias</label>
              <input
                type="text"
                value={form.alias}
                onChange={e => setForm({ ...form, alias: e.target.value })}
                onBlur={() => checkCollision(form.alias)}
                placeholder="e.g. Temis"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {collisionWarning && (
                <p className="mt-1 flex items-start gap-1 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  {collisionWarning}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Resolution Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.resolutionType === 'direct'}
                    onChange={() => setForm({ ...form, resolutionType: 'direct', contextRules: null })}
                    className="text-indigo-600"
                  />
                  Direct
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.resolutionType === 'contextual'}
                    onChange={() => setForm({
                      ...form,
                      resolutionType: 'contextual',
                      partnerId: null,
                      contextRules: form.contextRules ?? { signals: ['region', 'country_iso'], rules: [], fallback: null },
                    })}
                    className="text-indigo-600"
                  />
                  Contextual
                </label>
              </div>
            </div>

            {form.resolutionType === 'direct' && (
              <div ref={partnerDropdownRef}>
                <label className="mb-1 block text-sm font-medium text-gray-700">Partner</label>
                <input
                  type="text"
                  value={partnerSearch}
                  onChange={e => { setPartnerSearch(e.target.value); setShowPartnerDropdown(true); }}
                  onFocus={() => setShowPartnerDropdown(true)}
                  placeholder="Search partners..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                {form.partnerId && (
                  <p className="mt-1 text-xs text-green-600">Selected: {selectedPartnerName}</p>
                )}
                {showPartnerDropdown && filteredPartners.length > 0 && (
                  <div className="relative">
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-48 overflow-auto">
                      {filteredPartners.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setForm({ ...form, partnerId: p.id });
                            setPartnerSearch(p.displayName);
                            setShowPartnerDropdown(false);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50"
                        >
                          {p.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.resolutionType === 'contextual' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Context Rules</label>
                  <button
                    type="button"
                    onClick={addContextRule}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    + Add Rule
                  </button>
                </div>
                {(form.contextRules?.rules ?? []).map((rule, idx) => (
                  <ContextRuleEditor
                    key={idx}
                    rule={rule}
                    partners={partners}
                    onChange={updates => updateContextRule(idx, updates)}
                    onRemove={() => removeContextRule(idx)}
                  />
                ))}
                {(form.contextRules?.rules ?? []).length === 0 && (
                  <p className="text-xs text-gray-400">No rules defined. Click &ldquo;+ Add Rule&rdquo; above.</p>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Fallback Partner (optional)</label>
                  <select
                    value={form.contextRules?.fallback ?? ''}
                    onChange={e => setForm({
                      ...form,
                      contextRules: { ...form.contextRules!, fallback: e.target.value || null },
                    })}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">None (flag as unresolved)</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional. Why does this alias exist?"
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.alias.trim() || !!collisionWarning}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
}

function ContextRulesPopover({
  rules,
  partners,
}: {
  rules: PartnerAliasContextRules | null;
  partners: { id: string; displayName: string }[];
}) {
  const [open, setOpen] = useState(false);
  if (!rules) return <span className="text-gray-400">No rules</span>;

  const partnerName = (id: string) => partners.find(p => p.id === id)?.displayName ?? id;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-sm text-indigo-600 underline decoration-dotted hover:text-indigo-700"
      >
        Context-dependent ({rules.rules.length} rule{rules.rules.length !== 1 ? 's' : ''})
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-80 rounded-lg border border-gray-200 bg-white p-3 shadow-xl text-xs">
          <div className="space-y-2">
            {rules.rules.map((r, i) => (
              <div key={i} className="rounded bg-gray-50 p-2">
                <div className="text-gray-500">
                  {Object.entries(r.conditions).map(([k, v]) => (
                    <span key={k} className="mr-2">{k}={v.join(',')}</span>
                  ))}
                </div>
                <div className="font-medium text-gray-800 mt-0.5">&rarr; {partnerName(r.partner_id)}</div>
              </div>
            ))}
            {rules.fallback && (
              <div className="rounded bg-gray-50 p-2 text-gray-500">
                Fallback &rarr; <span className="font-medium text-gray-800">{partnerName(rules.fallback)}</span>
              </div>
            )}
            {!rules.fallback && (
              <div className="text-gray-400 italic">No fallback (unresolved if no rule matches)</div>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="mt-2 text-xs text-gray-400 hover:text-gray-600">Close</button>
        </div>
      )}
    </div>
  );
}

function ContextRuleEditor({
  rule,
  partners,
  onChange,
  onRemove,
}: {
  rule: PartnerAliasContextRule;
  partners: { id: string; displayName: string }[];
  onChange: (updates: Partial<PartnerAliasContextRule>) => void;
  onRemove: () => void;
}) {
  const conditionEntries = Object.entries(rule.conditions);

  function updateCondition(key: string, value: string) {
    const newConditions = { ...rule.conditions, [key]: value.split(',').map(v => v.trim()).filter(Boolean) };
    onChange({ conditions: newConditions });
  }

  function addCondition() {
    const existing = new Set(Object.keys(rule.conditions));
    const available = ['region', 'country_iso', 'device_type', 'vendor'].filter(s => !existing.has(s));
    if (available.length === 0) return;
    onChange({ conditions: { ...rule.conditions, [available[0]]: [''] } });
  }

  function removeCondition(key: string) {
    const newConditions = { ...rule.conditions };
    delete newConditions[key];
    onChange({ conditions: newConditions });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase">Rule</span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {conditionEntries.map(([key, values]) => (
        <div key={key} className="flex items-center gap-2">
          <select
            value={key}
            onChange={e => {
              const newConditions = { ...rule.conditions };
              delete newConditions[key];
              newConditions[e.target.value] = values;
              onChange({ conditions: newConditions });
            }}
            className="rounded border border-gray-300 px-2 py-1 text-xs w-28"
          >
            {['region', 'country_iso', 'device_type', 'vendor'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">=</span>
          <input
            type="text"
            value={values.join(', ')}
            onChange={e => updateCondition(key, e.target.value)}
            placeholder="e.g. EMEA, LATAM"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <button onClick={() => removeCondition(key)} className="text-gray-400 hover:text-red-500">
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button onClick={addCondition} className="text-xs text-indigo-600 hover:text-indigo-700">+ condition</button>
      <div>
        <label className="mb-0.5 block text-xs text-gray-500">Resolves to</label>
        <select
          value={rule.partner_id}
          onChange={e => onChange({ partner_id: e.target.value })}
          className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
        >
          <option value="">Select partner...</option>
          {partners.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        </select>
      </div>
    </div>
  );
}
