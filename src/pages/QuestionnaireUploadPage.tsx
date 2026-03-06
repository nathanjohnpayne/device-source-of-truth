import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileSpreadsheet,
  Info,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Tooltip from '../components/shared/Tooltip';
import type { PartnerWithStats } from '../lib/types';
import { ApiError } from '../lib/api';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_TYPES = '.xlsx,.xls';

export default function QuestionnaireUploadPage() {
  const navigate = useNavigate();
  const { isAdmin, isEditor } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [submitterPartnerId, setSubmitterPartnerId] = useState<string>('');
  const [useAI, setUseAI] = useState(false);
  const [notes, setNotes] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partners, setPartners] = useState<PartnerWithStats[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(true);

  const [showAICostModal, setShowAICostModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = isAdmin || isEditor;

  const loadPartners = useCallback(async () => {
    try {
      const res = await api.partners.list({ pageSize: 500 });
      setPartners((res.data ?? []) as PartnerWithStats[]);
    } catch {
      // Non-blocking; partner dropdown will be empty
    } finally {
      setPartnersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const validateFile = useCallback((f: File): string | null => {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
    if (ext !== '.xlsx' && ext !== '.xls') {
      return 'Only .xlsx and .xls files are accepted.';
    }
    if (f.size > MAX_FILE_SIZE) {
      return 'File exceeds the 20 MB limit.';
    }
    return null;
  }, []);

  const handleFileSelect = useCallback(
    (f: File) => {
      setError(null);
      const err = validateFile(f);
      if (err) {
        setError(err);
        return;
      }
      setFile(f);
    },
    [validateFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect],
  );

  const handleUpload = useCallback(async () => {
    if (!file || !canUpload) return;
    setLoading(true);
    setError(null);

    try {
      const job = await api.questionnaireIntake.upload(file, {
        submitterPartnerId: submitterPartnerId || undefined,
        aiExtraction: useAI,
        notes: notes.trim() || undefined,
      });
      trackEvent('questionnaire_upload', { device_id: job.id });
      navigate(`/admin/questionnaires/${job.id}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.body as { error?: string })?.error ?? err.message
          : err instanceof Error
            ? err.message
            : 'Upload failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [file, submitterPartnerId, useAI, notes, canUpload, navigate]);

  const handleCancel = useCallback(() => {
    setFile(null);
    setSubmitterPartnerId('');
    setUseAI(false);
    setNotes('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const isAIDisclosed = () =>
    sessionStorage.getItem('dst_questionnaire_ai_disclosed') === 'true';

  const handleAICheckboxChange = (checked: boolean) => {
    if (checked && !isAIDisclosed()) {
      setShowAICostModal(true);
    } else {
      setUseAI(checked);
    }
  };

  const handleAIModalConfirm = () => {
    sessionStorage.setItem('dst_questionnaire_ai_disclosed', 'true');
    setShowAICostModal(false);
    setUseAI(true);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Upload Partner Questionnaire
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a partner questionnaire file (.xlsx or .xls) to extract device
            specifications. The system will parse the file and map answers to
            normalized spec fields for review.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-8">
        {/* Drag-and-drop zone */}
        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
            dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              <FileSpreadsheet className="mb-4 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-lg font-medium text-gray-700">
                {file ? file.name : 'Drop your questionnaire file here'}
              </p>
              <p className="mb-4 text-sm text-gray-500">
                {file ? 'Click to replace' : 'or click to browse'}
              </p>
              <label className="cursor-pointer rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                {file ? 'Change File' : 'Select File'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </label>
              <p className="mt-3 text-xs text-gray-400">
                .xlsx, .xls only, max 20 MB
              </p>
            </>
          )}
        </div>

        {/* Partner dropdown */}
        <div className="mt-6">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Partner
          </label>
          <select
            value={submitterPartnerId}
            onChange={(e) => setSubmitterPartnerId(e.target.value)}
            disabled={partnersLoading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">Auto-detect</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Use AI Extraction checkbox */}
        <div className="mt-4 flex items-center gap-2">
          <input
            id="questionnaire-use-ai"
            type="checkbox"
            checked={useAI}
            onChange={(e) => handleAICheckboxChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="questionnaire-use-ai" className="text-sm text-gray-700">
            Use AI Extraction?
          </label>
          <Tooltip content="Enabling AI Extraction runs questionnaire answers through Claude to automatically map them to normalized spec fields. Only ambiguous values are sent to the API. This uses the Anthropic API and may incur additional usage costs.">
            <Info className="h-4 w-4 cursor-help text-gray-400 hover:text-gray-600" />
          </Tooltip>
        </div>

        {/* Notes textarea */}
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any notes about this upload..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-red-50 p-4">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading || !canUpload}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <LoadingSpinner inline className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload
          </button>
        </div>
      </div>

      {/* AI Cost Disclosure Modal (DST-050) */}
      <Modal
        open={showAICostModal}
        onClose={() => {}}
        dismissable={false}
        title="AI Extraction Required"
        footer={
          <button
            onClick={handleAIModalConfirm}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Got It — Continue Upload
          </button>
        }
      >
        <p className="text-sm text-gray-700">
          Questionnaire extraction uses Claude to map each question-answer pair to a normalized
          spec field. This step is required to produce reliable structured data from partner
          questionnaires and cannot be skipped. It uses the Anthropic API and will incur usage
          costs billed to your organization's API account. Costs scale with the number of devices
          in the file — most questionnaires are a few cents or less.
        </p>
      </Modal>
    </div>
  );
}
