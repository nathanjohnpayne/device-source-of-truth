import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  ChevronRight,
  Monitor,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Cpu,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import Badge from '../components/shared/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Modal from '../components/shared/Modal';
import ExtractionStatusPanel from '../components/shared/ExtractionStatusPanel';
import type {
  QuestionnaireIntakeJobDetail,
  QuestionnaireIntakeJobStatus,
  QuestionnaireFormat,
  QuestionnaireStagedDevice,
  PlatformType,
  Partner,
} from '../lib/types';

const POLL_INTERVAL_MS = 3000;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatStatusLabel(status: QuestionnaireIntakeJobStatus): string {
  return status
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function formatQuestionnaireFormat(format: QuestionnaireFormat): string {
  return format === 'unknown'
    ? '—'
    : format.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadgeVariant(
  status: QuestionnaireIntakeJobStatus,
): 'info' | 'warning' | 'danger' | 'success' | 'default' {
  switch (status) {
    case 'uploading':
    case 'parsing':
    case 'extracting':
      return 'info';
    case 'awaiting_extraction':
    case 'pending_review':
      return 'warning';
    case 'parse_failed':
    case 'extraction_failed':
      return 'danger';
    case 'approved':
    case 'partially_approved':
      return 'success';
    case 'rejected':
      return 'default';
    default:
      return 'default';
  }
}

function StatusIndicator({ status }: { status: QuestionnaireIntakeJobStatus }) {
  switch (status) {
    case 'extracting':
      return (
        <span className="flex items-center gap-1.5 text-amber-600">
          <Clock className="h-4 w-4 animate-pulse" />
          Extracting
        </span>
      );
    case 'approved':
    case 'partially_approved':
    case 'pending_review':
      return (
        <span className="flex items-center gap-1.5 text-emerald-600">
          <CheckCircle className="h-4 w-4" />
          Complete
        </span>
      );
    case 'parse_failed':
    case 'extraction_failed':
      return (
        <span className="flex items-center gap-1.5 text-red-600">
          <XCircle className="h-4 w-4" />
          Failed
        </span>
      );
    case 'awaiting_extraction':
      return (
        <span className="flex items-center gap-1.5 text-amber-600">
          <Clock className="h-4 w-4" />
          Awaiting extraction
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1.5 text-gray-500">
          <Clock className="h-4 w-4" />
          {formatStatusLabel(status)}
        </span>
      );
  }
}

function platformBadgeVariant(platform: PlatformType): 'success' | 'warning' | 'default' {
  switch (platform) {
    case 'ncp_linux':
      return 'success';
    case 'android_tv':
    case 'android_aosp':
      return 'warning';
    default:
      return 'default';
  }
}

function platformLabel(platform: PlatformType): string {
  return platform === 'unknown'
    ? 'Unknown'
    : platform.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function DeviceCard({
  device,
  jobStatus,
  matchedDeviceName,
  isActiveDevice,
  onRetry,
  isRetrying,
}: {
  device: QuestionnaireStagedDevice & {
    fieldSummary: {
      totalFields: number;
      extractedFields: number;
      conflictCount: number;
      newFieldCount: number;
    };
    extractionError?: string | null;
  };
  jobStatus: QuestionnaireIntakeJobStatus;
  matchedDeviceName: string | null;
  isActiveDevice: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  const { rawHeaderLabel, platformType, isOutOfScope, matchedDeviceId, fieldSummary } = device;
  const deviceError = device.extractionError;
  const extractionStatus = device.extractionStatus;
  const isDeviceProcessing = extractionStatus === 'processing';
  const isDevicePending = extractionStatus === 'pending' && jobStatus === 'extracting';
  const isExtracting = (isDeviceProcessing || isDevicePending) && !deviceError;
  const isComplete = fieldSummary.extractedFields > 0;
  const hasConflicts = fieldSummary.conflictCount > 0;
  const isDeviceFailed = !!deviceError;

  let borderClass = 'border-gray-200 bg-white';
  if (isDeviceFailed) {
    borderClass = 'border-red-200 bg-red-50/30';
  } else if (isActiveDevice) {
    borderClass = 'border-indigo-300 bg-indigo-50/30 ring-2 ring-indigo-200 ring-offset-1';
  }

  return (
    <div className={`rounded-lg border p-4 shadow-sm transition-all ${borderClass} ${
      isActiveDevice ? 'animate-pulse-subtle' : 'hover:shadow-md'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">{rawHeaderLabel}</h3>
            <Badge variant={platformBadgeVariant(platformType)}>
              {platformLabel(platformType)}
            </Badge>
            {isActiveDevice && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                </span>
                Extracting
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              {isOutOfScope ? (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Out of scope (Phase 2)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="h-3.5 w-3.5" />
                  In scope
                </span>
              )}
            </div>
            <div>
              {matchedDeviceId ? (
                <span>
                  Matched to:{' '}
                  <span className="font-medium text-gray-900">
                    {matchedDeviceName ?? `Device ${matchedDeviceId}`}
                  </span>
                </span>
              ) : (
                <span className="text-amber-600">No match — New device</span>
              )}
            </div>
            <div>
              {isDeviceProcessing && fieldSummary.extractedFields === 0 ? (
                <span className="flex items-center gap-1 text-indigo-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Extracting fields…
                </span>
              ) : isDevicePending && fieldSummary.extractedFields === 0 ? (
                <span className="text-gray-400">Waiting in queue…</span>
              ) : fieldSummary.totalFields > 0 ? (
                <span>
                  {fieldSummary.extractedFields} / {fieldSummary.totalFields} fields extracted
                  {hasConflicts && (
                    <span className="text-amber-600"> · {fieldSummary.conflictCount} conflicts</span>
                  )}
                </span>
              ) : (
                <span className="text-gray-400">No fields</span>
              )}
            </div>
            {isDeviceFailed && (
              <div className="flex items-center gap-2">
                <div className="flex items-start gap-1 text-red-600">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs">
                    {deviceError === 'AI extraction returned no results after retries'
                      ? 'Extraction failed'
                      : deviceError}
                  </span>
                </div>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          {isRetrying ? (
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          ) : isActiveDevice || isDeviceProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          ) : isComplete ? (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          ) : isDeviceFailed ? (
            <XCircle className="h-5 w-5 text-red-500" />
          ) : isDevicePending ? (
            <Clock className="h-5 w-5 text-gray-400" />
          ) : isExtracting ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : (
            <Clock className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuestionnaireDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [job, setJob] = useState<QuestionnaireIntakeJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showAICostModal, setShowAICostModal] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [savingPartner, setSavingPartner] = useState(false);
  const [matchedDeviceNames, setMatchedDeviceNames] = useState<Record<string, string>>({});
  const [retryingDeviceId, setRetryingDeviceId] = useState<string | null>(null);
  const [statusPanelVisible, setStatusPanelVisible] = useState(true);
  const prevStatusRef = useRef<string | null>(null);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.questionnaireIntake.get(id);
      setJob(data);
      setError(null);

      // Fetch display names for matched devices
      const matchedIds = [
        ...new Set(
          (data.stagedDevices ?? [])
            .map((d) => d.matchedDeviceId)
            .filter((x): x is string => !!x),
        ),
      ];
      if (matchedIds.length > 0) {
        const names: Record<string, string> = {};
        await Promise.all(
          matchedIds.map(async (deviceId) => {
            try {
              const device = await api.devices.get(deviceId);
              names[deviceId] = device.displayName ?? device.deviceId ?? deviceId;
            } catch {
              names[deviceId] = deviceId;
            }
          }),
        );
        setMatchedDeviceNames(names);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Poll when extracting or retrying a device
  useEffect(() => {
    if (!id || !job) return;
    const shouldPoll = job.status === 'extracting' || retryingDeviceId != null;
    if (!shouldPoll) return;
    const interval = setInterval(fetchJob, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [id, job?.status, retryingDeviceId, fetchJob]);

  // Auto-collapse status panel 2s after extraction completes successfully
  useEffect(() => {
    if (!job) return;
    const wasExtracting = prevStatusRef.current === 'extracting';
    const nowComplete = ['pending_review', 'approved', 'partially_approved'].includes(job.status);
    if (wasExtracting && nowComplete && !job.extractionError) {
      setStatusPanelVisible(true);
      const timer = setTimeout(() => setStatusPanelVisible(false), 2000);
      return () => clearTimeout(timer);
    }
    if (job.status === 'extracting' || job.status === 'extraction_failed') {
      setStatusPanelVisible(true);
    }
    prevStatusRef.current = job.status;
  }, [job?.status, job?.extractionError]);

  // Clear retrying state when the device error is resolved
  useEffect(() => {
    if (!retryingDeviceId || !job) return;
    const device = job.stagedDevices?.find(d => d.id === retryingDeviceId);
    if (device && !device.extractionError && job.status !== 'extracting') {
      setRetryingDeviceId(null);
    }
  }, [retryingDeviceId, job]);

  const runExtraction = async () => {
    if (!id) return;
    setExtracting(true);
    try {
      await api.questionnaireIntake.triggerExtraction(id);
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger extraction');
    } finally {
      setExtracting(false);
    }
  };

  const handleRetryDevice = async (deviceId: string) => {
    if (!id) return;
    setRetryingDeviceId(deviceId);
    try {
      await api.questionnaireIntake.retryDevice(id, deviceId);
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry device extraction');
      setRetryingDeviceId(null);
    }
  };

  const handleTriggerExtraction = () => {
    if (sessionStorage.getItem('dst_questionnaire_ai_disclosed') === 'true') {
      runExtraction();
    } else {
      setShowAICostModal(true);
    }
  };

  const handleAICostConfirm = () => {
    sessionStorage.setItem('dst_questionnaire_ai_disclosed', 'true');
    setShowAICostModal(false);
    runExtraction();
  };

  const handleDownload = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const { url, fileName } = await api.questionnaireIntake.download(id);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const handleBeginReview = () => {
    if (id) navigate(`/admin/questionnaires/${id}/review`);
  };

  const handleOpenPartnerModal = async () => {
    setShowPartnerModal(true);
    setSelectedPartnerId(job?.submitterPartnerId ?? '');
    try {
      const res = await api.partners.listAll();
      setPartners(res ?? []);
    } catch {
      setPartners([]);
    }
  };

  const handleSavePartner = async () => {
    if (!id) return;
    setSavingPartner(true);
    try {
      await api.questionnaireIntake.updateJob(id, {
        submitterPartnerId: selectedPartnerId || undefined,
      });
      await fetchJob();
      setShowPartnerModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update partner');
    } finally {
      setSavingPartner(false);
    }
  };

  const extractionComplete =
    job &&
    ['pending_review', 'approved', 'partially_approved'].includes(job.status);

  if (loading && !job) {
    return <LoadingSpinner className="min-h-[50vh]" />;
  }

  if (error && !job) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link
          to="/admin/questionnaires"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to questionnaires
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Error</span>
          </div>
          <p className="mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/admin/questionnaires"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to questionnaires
      </Link>

      {/* Header section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{job.fileName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-600">
              <span>Uploaded by {job.uploadedByEmail}</span>
              <span>{formatDate(job.uploadedAt)}</span>
              <span className="flex items-center gap-1">
                Submitter:{' '}
                {job.submitterPartner ? (
                  <>
                    <span className="font-medium text-gray-900">{job.submitterPartner.displayName}</span>
                    {isAdmin && (
                      <button
                        onClick={handleOpenPartnerModal}
                        className="text-indigo-600 hover:underline"
                      >
                        Change
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-gray-400">Not assigned</span>
                    {isAdmin && (
                      <button
                        onClick={handleOpenPartnerModal}
                        className="text-indigo-600 hover:underline"
                      >
                        Assign
                      </button>
                    )}
                  </>
                )}
              </span>
              <span>Format: {formatQuestionnaireFormat(job.questionnaireFormat)}</span>
              <span>
                {job.deviceCountDetected ?? 0} device
                {(job.deviceCountDetected ?? 0) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusBadgeVariant(job.status)}>{formatStatusLabel(job.status)}</Badge>
            <StatusIndicator status={job.status} />
          </div>
        </div>

        {job.extractionError && !statusPanelVisible && (
          <div className={`mt-4 rounded-lg border p-4 text-sm ${
            job.status === 'extraction_failed'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}>
            <div className="flex items-start gap-2">
              {job.status === 'extraction_failed' ? (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <div>
                <span className="font-medium">
                  {job.status === 'extraction_failed' ? 'Extraction failed' : 'Extraction completed with issues'}
                </span>
                <p className="mt-1">{typeof job.extractionError === 'string' ? job.extractionError : 'An unknown error occurred during extraction.'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DST-052: Extraction Status Panel */}
      {statusPanelVisible && (
        <ExtractionStatusPanel
          status={job.status}
          progress={job.extractionProgress ?? null}
          failedDevices={
            (job.stagedDevices ?? [])
              .filter(d => !!d.extractionError)
              .map(d => ({ id: d.id, rawHeaderLabel: d.rawHeaderLabel }))
          }
          onRestart={handleTriggerExtraction}
          onRetryDevice={handleRetryDevice}
          retryingDeviceId={retryingDeviceId}
        />
      )}

      {/* Device cards */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
          <Monitor className="h-4 w-4" />
          Staged devices
        </h2>
        {job.stagedDevices && job.stagedDevices.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {job.stagedDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                jobStatus={job.status}
                matchedDeviceName={device.matchedDeviceId ? matchedDeviceNames[device.matchedDeviceId] ?? null : null}
                isActiveDevice={
                  job.status === 'extracting' &&
                  job.extractionProgress?.currentDevice === device.rawHeaderLabel
                }
                onRetry={device.extractionError ? () => handleRetryDevice(device.id) : undefined}
                isRetrying={retryingDeviceId === device.id}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
            No staged devices
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-6">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? 'Downloading…' : 'Download Source File'}
        </button>

        {(job.status === 'awaiting_extraction' || job.status === 'extraction_failed') && (
          <>
            <button
              onClick={handleTriggerExtraction}
              disabled={extracting}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Cpu className="h-4 w-4" />
              {extracting ? 'Starting…' : job.status === 'extraction_failed' ? 'Retry AI Extraction' : 'Run AI Extraction'}
            </button>
            <button
              onClick={() => id && navigate(`/admin/questionnaires/${id}/review`)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
              Review with Rule-Based Data Only
            </button>
          </>
        )}

        {extractionComplete && (
          <button
            onClick={handleBeginReview}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <ChevronRight className="h-4 w-4" />
            Begin Review
          </button>
        )}
      </div>

      {/* AI Cost Disclosure Modal (DST-050) */}
      <Modal
        open={showAICostModal}
        onClose={() => {}}
        dismissable={false}
        title="AI Extraction Required"
        footer={
          <button
            onClick={handleAICostConfirm}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Got It — Run Extraction
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

      {/* Partner change modal */}
      <Modal
        open={showPartnerModal}
        onClose={() => setShowPartnerModal(false)}
        title="Change partner"
        footer={
          <>
            <button
              onClick={() => setShowPartnerModal(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePartner}
              disabled={savingPartner}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingPartner ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <label htmlFor="partner-select" className="block text-sm font-medium text-gray-700">
            Partner
          </label>
          <select
            id="partner-select"
            value={selectedPartnerId}
            onChange={(e) => setSelectedPartnerId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">— No partner —</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
