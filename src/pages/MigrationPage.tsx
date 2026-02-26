import { useState, useRef, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import Badge from '../components/shared/Badge';

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

interface MigrationResult {
  success: number;
  errors: string[];
}

export default function MigrationPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv')) {
      setError('Please select a .csv file');
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const runMigration = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.upload.migration(file);
      setResult(res);
      trackEvent('migration_run', { row_count: res.success });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setLoading(false);
    }
  };

  const flaggedErrors = result?.errors.filter((e) => e.toLowerCase().includes('missing deviceid')) ?? [];
  const skippedErrors = result?.errors.filter((e) => !e.toLowerCase().includes('missing deviceid')) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AllModels Migration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import devices from the AllModels CSV export into DST.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Idempotent operation</p>
            <p className="mt-1">
              This migration is idempotent — re-running will not create duplicates. Existing
              devices matched by Device ID will be updated with the latest data.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">Column Mappings</h2>
        <p className="mt-1 text-sm text-gray-500">
          The CSV file should contain the following columns. They will be mapped to DST fields automatically.
        </p>
        <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">CSV Column</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">DST Field</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {COLUMN_MAPPINGS.map((m) => (
                <tr key={m.csv}>
                  <td className="px-4 py-2 text-gray-700">{m.csv}</td>
                  <td className="px-4 py-2">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-indigo-700">
                      {m.field}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Upload CSV</h2>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
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
                Drop your AllModels CSV here, or click to browse
              </p>
              <p className="mt-1 text-xs text-gray-500">Accepts .csv files</p>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={runMigration}
          disabled={!file || loading}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Running Migration…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Run Migration
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Migration Results</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">Records Imported</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-900">{result.success}</p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Records Flagged</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-900">{flaggedErrors.length}</p>
              <p className="mt-1 text-xs text-amber-600">Missing deviceId</p>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-800">Records Skipped</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-red-900">{skippedErrors.length}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Errors &amp; Warnings
                <Badge variant="danger" className="ml-2">{result.errors.length}</Badge>
              </h3>
              <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-gray-50">
                <ul className="divide-y divide-gray-200 text-sm">
                  {result.errors.map((err, i) => (
                    <li key={i} className="flex items-start gap-2 px-4 py-2">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                      <span className="text-gray-700">{err}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
