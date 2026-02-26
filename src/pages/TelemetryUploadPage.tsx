import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Clock,
  CloudUpload,
} from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import DataTable, { type Column } from '../components/shared/DataTable';
import Badge from '../components/shared/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import type { UploadHistory } from '../lib/types';

export default function TelemetryUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [snapshotDate, setSnapshotDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadHistory | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<UploadHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith('.csv')) {
      setFile(dropped);
      setUploadResult(null);
      setUploadError(null);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setUploadResult(null);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const result = await api.telemetry.upload(file, snapshotDate);
      setUploadResult(result);
      trackEvent('telemetry_upload', {
        file_name: file.name,
        row_count: result.rowCount,
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadHistory();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Upload failed. Please try again.',
      );
    } finally {
      setUploading(false);
    }
  };

  const historyColumns: Column<UploadHistory>[] = [
    {
      header: 'Date',
      accessor: 'uploadedAt',
      sortable: true,
      render: (row) => new Date(row.uploadedAt).toLocaleDateString(),
    },
    { header: 'Uploaded By', accessor: 'uploadedByEmail', sortable: true },
    { header: 'File Name', accessor: 'fileName', sortable: true },
    {
      header: 'Rows',
      accessor: 'rowCount',
      sortable: true,
      render: (row) => row.rowCount.toLocaleString(),
    },
    {
      header: 'Successes',
      accessor: 'successCount',
      sortable: true,
      render: (row) => (
        <Badge variant="success">{row.successCount.toLocaleString()}</Badge>
      ),
    },
    {
      header: 'Errors',
      accessor: 'errorCount',
      sortable: true,
      render: (row) =>
        row.errorCount > 0 ? (
          <Badge variant="danger">{row.errorCount.toLocaleString()}</Badge>
        ) : (
          <Badge variant="default">0</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Telemetry Upload</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload Datadog CSV exports to update device telemetry data
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
            dragOver
              ? 'border-indigo-400 bg-indigo-50'
              : file
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)} KB — Click or drop to replace
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <CloudUpload className="h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">
                Drag & drop a CSV file, or click to browse
              </p>
              <p className="text-xs text-gray-500">Accepts .csv files only</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <Clock className="mr-1 inline h-3.5 w-3.5" />
              Snapshot Date
            </label>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-md bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-600">Expected CSV Columns</p>
          <p className="mt-1 font-mono text-xs text-gray-500">
            partner, device, core_version, count_unique_device_id, count
          </p>
        </div>
      </div>

      {uploadError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{uploadError}</p>
        </div>
      )}

      {uploadResult && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-semibold text-emerald-900">Upload Complete</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Rows Processed</p>
              <p className="text-lg font-semibold text-gray-900">
                {uploadResult.rowCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Records Updated</p>
              <p className="text-lg font-semibold text-emerald-700">
                {uploadResult.successCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Errors</p>
              <p
                className={`text-lg font-semibold ${uploadResult.errorCount > 0 ? 'text-red-600' : 'text-gray-900'}`}
              >
                {uploadResult.errorCount.toLocaleString()}
              </p>
            </div>
          </div>
          {uploadResult.errors.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-md bg-white p-3">
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

      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Upload History</h2>
        {historyLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            columns={historyColumns}
            data={history}
            emptyTitle="No upload history"
            emptyDescription="Upload a CSV file to see history here."
          />
        )}
      </div>
    </div>
  );
}
