import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Search,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Monitor,
  Eye,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { formatDate } from '../lib/format';
import { useAuth } from '../hooks/useAuth';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Tooltip from '../components/shared/Tooltip';
import WorkflowStepper from '../components/shared/WorkflowStepper';
import type {
  QuestionnaireIntakeJob,
  QuestionnaireStagedDevice,
  QuestionnaireStagedField,
  PartnerWithStats,
} from '../lib/types';
import { SPEC_CATEGORY_LABELS } from '../lib/types';
import type { SpecCategory, DeviceType } from '@dst/contracts';

type StagedDeviceWithFields = QuestionnaireStagedDevice & {
  fields: QuestionnaireStagedField[];
};

const DEVICE_TYPES: DeviceType[] = [
  'STB',
  'Smart TV',
  'Stick',
  'Console',
  'OTT Box',
  'Other',
];

const PLATFORM_LABELS: Record<string, string> = {
  ncp_linux: 'NCP Linux',
  android_tv: 'Android TV',
  android_aosp: 'Android AOSP',
  unknown: 'Unknown',
};

function errorMessage(err: unknown): string {
  if (err instanceof ApiError)
    return (err.body as { error?: string })?.error ?? err.message;
  return err instanceof Error ? err.message : 'An unexpected error occurred.';
}

// ── Confidence Badge ────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const variant: 'success' | 'warning' | 'danger' =
    value >= 0.9 ? 'success' : value >= 0.75 ? 'warning' : 'danger';
  return <Badge variant={variant}>{pct}%</Badge>;
}

// ── Step 1: Assign Partner ──────────────────────────────────────────────────

function AssignPartnerStep({
  job,
  partner,
  onConfirm,
  actionError,
}: {
  job: QuestionnaireIntakeJob;
  partner: { id: string; displayName: string } | null;
  onConfirm: (partnerId: string, displayName: string) => void;
  actionError: string | null;
}) {
  const [search, setSearch] = useState('');
  const [partners, setPartners] = useState<PartnerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.partners.list({ pageSize: 500 });
        setPartners((res.data ?? []) as PartnerWithStats[]);
      } catch {
        /* non-blocking */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () =>
      search.trim()
        ? partners.filter((p) =>
            p.displayName.toLowerCase().includes(search.toLowerCase()),
          )
        : partners,
    [partners, search],
  );

  const select = (p: PartnerWithStats) => {
    setSelectedId(p.id);
    setSelectedName(p.displayName);
    setSearch(p.displayName);
    setDropdownOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Step 1: Assign Partner
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          DST could not confidently identify the partner for this questionnaire.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
        <p className="font-medium text-gray-700">
          File: <span className="font-normal">{job.fileName}</span>
        </p>
        {job.partnerDetectionMethod && (
          <div className="mt-2 space-y-1 text-gray-600">
            <p className="font-medium text-gray-700">
              Detection signals found:
            </p>
            <ul className="ml-4 list-disc">
              {job.partnerDetectionMethod === 'filename' && (
                <li>Filename pattern detected</li>
              )}
              {job.partnerDetectionMethod === 'content' && (
                <li>Partner name detected in content</li>
              )}
              {job.partnerDetectionMethod === 'ai' &&
                job.partnerConfidence != null && (
                  <li>
                    AI suggestion (confidence:{' '}
                    {Math.round(job.partnerConfidence * 100)}%)
                  </li>
                )}
              {!job.partnerDetectionMethod && (
                <li>No recognizable partner pattern</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {partner ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <Check className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-800">
            Partner confirmed: {partner.displayName}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Assign partner
          </label>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDropdownOpen(true);
                  if (!e.target.value) {
                    setSelectedId(null);
                    setSelectedName('');
                  }
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder={loading ? 'Loading partners…' : 'Search partners…'}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {dropdownOpen && !loading && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {filtered.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-500">
                    No partners found
                  </p>
                ) : (
                  filtered.slice(0, 50).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => select(p)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-indigo-50 ${p.id === selectedId ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-700'}`}
                    >
                      {p.displayName}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {!partner && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (selectedId && selectedName) onConfirm(selectedId, selectedName);
            }}
            disabled={!selectedId}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm Partner
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Field Table (inline expansion for a device) ─────────────────────────────

function FieldTable({
  fields,
  jobId,
  deviceId,
  onFieldUpdate,
}: {
  fields: QuestionnaireStagedField[];
  jobId: string;
  deviceId: string;
  onFieldUpdate: (
    fieldId: string,
    patch: Partial<QuestionnaireStagedField>,
  ) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, QuestionnaireStagedField[]>();
    for (const f of fields) {
      const cat = f.dstFieldCategory || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(f);
    }
    return map;
  }, [fields]);

  const saveEdit = async (field: QuestionnaireStagedField) => {
    if (editValue === field.extractedValue) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    try {
      await api.questionnaireIntake.updateField(jobId, deviceId, field.id, {
        extractedValue: editValue,
        extractionMethod: 'admin_override',
      });
      onFieldUpdate(field.id, {
        extractedValue: editValue,
        extractionMethod: 'admin_override',
      });
      setEditingId(null);
    } catch {
      /* keep editing open on error */
    } finally {
      setSaving(false);
    }
  };

  const sortedCategories = [...grouped.entries()].sort(([a], [b]) => {
    const la =
      SPEC_CATEGORY_LABELS[a as SpecCategory] ?? a;
    const lb =
      SPEC_CATEGORY_LABELS[b as SpecCategory] ?? b;
    return la.localeCompare(lb);
  });

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
      {sortedCategories.map(([cat, catFields]) => (
        <div key={cat} className="mb-4 last:mb-0">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {SPEC_CATEGORY_LABELS[cat as SpecCategory] ?? cat}
          </h4>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Field</th>
                  <th className="px-3 py-2 font-medium">Question</th>
                  <th className="px-3 py-2 font-medium">Extracted Value</th>
                  <th className="px-3 py-2 font-medium">Confidence</th>
                  <th className="px-3 py-2 font-medium">Conflict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {catFields.map((f) => (
                  <tr key={f.id} className="group">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-700">
                      {f.dstFieldKey}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-gray-500">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{f.rawQuestionText}</span>
                        {f.aiReasoning && (
                          <Tooltip content={f.aiReasoning}>
                            <Info className="h-3 w-3 shrink-0 cursor-help text-gray-400 hover:text-gray-600" />
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {editingId === f.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(f);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="w-full rounded border border-indigo-300 px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-indigo-500"
                            autoFocus
                            disabled={saving}
                          />
                          <button
                            onClick={() => saveEdit(f)}
                            disabled={saving}
                            className="rounded p-0.5 text-indigo-600 hover:bg-indigo-50"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(f.id);
                            setEditValue(f.extractedValue ?? '');
                          }}
                          className="max-w-[200px] truncate text-left hover:text-indigo-600 hover:underline"
                          title="Click to edit"
                        >
                          {f.extractedValue ?? (
                            <span className="italic text-gray-400">—</span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ConfidenceBadge value={f.aiConfidence} />
                    </td>
                    <td className="px-3 py-2">
                      {f.conflictStatus === 'conflicts_with_existing' && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          Existing: {f.existingValue}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Device Card (Step 2) ────────────────────────────────────────────────────

function DeviceCard({
  device,
  jobId,
  expanded,
  onToggle,
  onApprove,
  onReject,
  onFieldUpdate,
  busy,
}: {
  device: StagedDeviceWithFields;
  jobId: string;
  expanded: boolean;
  onToggle: () => void;
  onApprove: (device: StagedDeviceWithFields, identity?: Record<string, string | null>) => void;
  onReject: (device: StagedDeviceWithFields, reason?: string) => void;
  onFieldUpdate: (
    deviceId: string,
    fieldId: string,
    patch: Partial<QuestionnaireStagedField>,
  ) => void;
  busy: boolean;
}) {
  const [showRejectPopover, setShowRejectPopover] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [identity, setIdentity] = useState({
    displayName: device.confirmedDisplayName ?? device.detectedModelName ?? '',
    modelNumber: device.confirmedModelNumber ?? device.detectedModelNumber ?? '',
    manufacturer: device.confirmedManufacturer ?? device.detectedManufacturer ?? '',
    deviceType: (device.confirmedDeviceType ?? 'STB') as string,
  });

  const conflictCount = device.fields.filter(
    (f) => f.conflictStatus === 'conflicts_with_existing',
  ).length;
  const fieldCount = device.fields.filter(
    (f) => f.extractedValue != null,
  ).length;
  const isNew = !device.matchedDeviceId;
  const isRejected = device.reviewStatus === 'rejected';
  const isApproved = device.reviewStatus === 'approved';

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isRejected
          ? 'border-gray-200 bg-gray-50 opacity-60'
          : isApproved
            ? 'border-emerald-200 bg-emerald-50/30'
            : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Monitor className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="font-semibold text-gray-900">
              {device.rawHeaderLabel}
            </span>
            <Badge variant="info">
              {PLATFORM_LABELS[device.platformType] ?? device.platformType}
            </Badge>
            {device.isOutOfScope && (
              <Badge variant="warning">Out of scope</Badge>
            )}
            {isApproved && <Badge variant="success">Approved</Badge>}
            {isRejected && <Badge variant="danger">Rejected</Badge>}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
            {isNew ? (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                No match — New device
              </span>
            ) : (
              <span>
                Matched: {device.detectedModelName}
                {device.detectedModelNumber && ` / ${device.detectedModelNumber}`}
                {device.matchMethod && (
                  <span className="ml-1 text-gray-400">
                    ({device.matchMethod.replace(/_/g, ' ')})
                  </span>
                )}
              </span>
            )}
            <span>{fieldCount} fields extracted</span>
            {conflictCount > 0 && (
              <span className="text-amber-600">
                {conflictCount} conflicting
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <Eye className="h-3.5 w-3.5" />
            {expanded ? 'Hide' : 'View'} Fields
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {isRejected ? (
            <button
              onClick={() => onApprove(device)}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Undo Reject
            </button>
          ) : (
            <>
              <div className="relative">
                <button
                  onClick={() => setShowRejectPopover(!showRejectPopover)}
                  disabled={busy}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Reject
                </button>
                {showRejectPopover && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-xs font-medium text-gray-700">
                      Reject this device?
                    </p>
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason (optional)"
                      className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowRejectPopover(false)}
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onReject(device, rejectReason || undefined);
                          setShowRejectPopover(false);
                          setRejectReason('');
                        }}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                      >
                        Reject Device
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (isNew) {
                    onApprove(device, {
                      confirmedDisplayName: identity.displayName,
                      confirmedModelNumber: identity.modelNumber,
                      confirmedManufacturer: identity.manufacturer,
                      confirmedDeviceType: identity.deviceType,
                    });
                  } else {
                    onApprove(device);
                  }
                }}
                disabled={busy || isApproved}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                {isApproved ? 'Approved' : 'Approve'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* New device identity form */}
      {isNew && !isRejected && !isApproved && (
        <div className="border-t border-gray-100 bg-amber-50/40 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-gray-700">
            New device details (pre-filled from questionnaire):
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">
                Consumer name
              </label>
              <input
                type="text"
                value={identity.displayName}
                onChange={(e) =>
                  setIdentity((s) => ({ ...s, displayName: e.target.value }))
                }
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">
                Model number
              </label>
              <input
                type="text"
                value={identity.modelNumber}
                onChange={(e) =>
                  setIdentity((s) => ({ ...s, modelNumber: e.target.value }))
                }
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">
                Manufacturer
              </label>
              <input
                type="text"
                value={identity.manufacturer}
                onChange={(e) =>
                  setIdentity((s) => ({ ...s, manufacturer: e.target.value }))
                }
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">
                Device type
              </label>
              <select
                value={identity.deviceType}
                onChange={(e) =>
                  setIdentity((s) => ({ ...s, deviceType: e.target.value }))
                }
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {DEVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {expanded && (
        <FieldTable
          fields={device.fields}
          jobId={jobId}
          deviceId={device.id}
          onFieldUpdate={(fieldId, patch) =>
            onFieldUpdate(device.id, fieldId, patch)
          }
        />
      )}
    </div>
  );
}

// ── Step 2: Review Devices ──────────────────────────────────────────────────

function ReviewDevicesStep({
  devices,
  jobId,
  job,
  onApproveDevice,
  onRejectDevice,
  onFieldUpdate,
  onRefreshJob,
  onNext,
  actionError,
  busy,
}: {
  devices: StagedDeviceWithFields[];
  jobId: string;
  job: QuestionnaireIntakeJob;
  onApproveDevice: (device: StagedDeviceWithFields, identity?: Record<string, string | null>) => void;
  onRejectDevice: (device: StagedDeviceWithFields, reason?: string) => void;
  onFieldUpdate: (
    deviceId: string,
    fieldId: string,
    patch: Partial<QuestionnaireStagedField>,
  ) => void;
  onRefreshJob: () => void;
  onNext: () => void;
  actionError: string | null;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const approved = devices.filter((d) => d.reviewStatus === 'approved').length;
  const rejected = devices.filter((d) => d.reviewStatus === 'rejected').length;
  const allDecided = devices.every((d) => d.reviewStatus !== 'pending');

  const totalExtracted = devices.reduce(
    (sum, d) => sum + d.fields.filter((f) => f.extractedValue != null).length,
    0,
  );
  const canRunExtraction =
    totalExtracted === 0 &&
    (job.status === 'awaiting_extraction' || job.status === 'pending_review' || job.status === 'extraction_failed');

  const handleRunExtraction = async () => {
    setExtracting(true);
    setExtractError(null);
    try {
      await api.questionnaireIntake.triggerExtraction(jobId);
      const poll = async (attempts: number) => {
        if (attempts <= 0) {
          onRefreshJob();
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const detail = await api.questionnaireIntake.get(jobId);
          if (detail.status === 'extracting') {
            await poll(attempts - 1);
          } else {
            onRefreshJob();
          }
        } catch {
          onRefreshJob();
        }
      };
      await poll(20);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to trigger extraction');
    } finally {
      setExtracting(false);
    }
  };

  const sorted = useMemo(() => {
    return [...devices].sort((a, b) => {
      if (a.isOutOfScope !== b.isOutOfScope) return a.isOutOfScope ? 1 : -1;
      const ac = a.fields.filter(
        (f) => f.conflictStatus === 'conflicts_with_existing',
      ).length;
      const bc = b.fields.filter(
        (f) => f.conflictStatus === 'conflicts_with_existing',
      ).length;
      return bc - ac;
    });
  }, [devices]);

  const approveAllInScope = () => {
    devices
      .filter((d) => !d.isOutOfScope && d.reviewStatus === 'pending')
      .forEach((d) => onApproveDevice(d));
  };

  const rejectAll = () => {
    devices
      .filter((d) => d.reviewStatus !== 'rejected')
      .forEach((d) => onRejectDevice(d));
  };

  return (
    <div className="space-y-4">
      {canRunExtraction && !extracting && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800">
              No fields have been extracted. Run AI extraction to automatically populate device specs from the questionnaire.
            </p>
          </div>
          <button
            onClick={handleRunExtraction}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            <Sparkles className="h-4 w-4" />
            Run AI Extraction
          </button>
        </div>
      )}
      {extracting && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
          <Sparkles className="h-5 w-5 animate-pulse text-indigo-500" />
          <p className="text-sm text-indigo-800">
            AI extraction in progress — analyzing questionnaire responses for each device...
          </p>
        </div>
      )}
      {extractError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{extractError}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Step 2: Review Devices
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {devices.length} devices · {approved} approved · {rejected} rejected
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={approveAllInScope}
            disabled={busy}
            className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            Approve All In-Scope
          </button>
          <button
            onClick={rejectAll}
            disabled={busy}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Reject All
          </button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((d) => (
          <DeviceCard
            key={d.id}
            device={d}
            jobId={jobId}
            expanded={expanded.has(d.id)}
            onToggle={() => toggle(d.id)}
            onApprove={onApproveDevice}
            onReject={onRejectDevice}
            onFieldUpdate={onFieldUpdate}
            busy={busy}
          />
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!allDecided}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Resolve Conflicts ───────────────────────────────────────────────

function ResolveConflictsStep({
  devices,
  onResolve,
  onResolveAllDevice,
  onNext,
  actionError,
  busy,
}: {
  devices: StagedDeviceWithFields[];
  onResolve: (deviceId: string, fieldId: string, resolution: 'use_new' | 'keep_existing') => void;
  onResolveAllDevice: (deviceId: string) => void;
  onNext: () => void;
  actionError: string | null;
  busy: boolean;
}) {
  const approvedWithConflicts = useMemo(
    () =>
      devices
        .filter((d) => d.reviewStatus === 'approved')
        .map((d) => ({
          device: d,
          conflicts: d.fields.filter(
            (f) => f.conflictStatus === 'conflicts_with_existing',
          ),
        }))
        .filter((g) => g.conflicts.length > 0),
    [devices],
  );

  const totalConflicts = approvedWithConflicts.reduce(
    (sum, g) => sum + g.conflicts.length,
    0,
  );
  const unresolvedCount = approvedWithConflicts.reduce(
    (sum, g) =>
      sum + g.conflicts.filter((f) => f.resolution === 'pending').length,
    0,
  );

  const acceptAllQuestionnaire = () => {
    for (const { device } of approvedWithConflicts) {
      const hasPending = device.fields.some(
        (f) =>
          f.conflictStatus === 'conflicts_with_existing' &&
          f.resolution === 'pending',
      );
      if (hasPending) onResolveAllDevice(device.id);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Step 3: Resolve Conflicts
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {totalConflicts} conflict{totalConflicts !== 1 ? 's' : ''} across{' '}
            {approvedWithConflicts.length} device
            {approvedWithConflicts.length !== 1 ? 's' : ''}
            {unresolvedCount > 0 && (
              <span className="ml-1 text-amber-600">
                · {unresolvedCount} unresolved
              </span>
            )}
          </p>
        </div>
        <button
          onClick={acceptAllQuestionnaire}
          disabled={busy || unresolvedCount === 0}
          className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
        >
          Accept All Questionnaire Values
        </button>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {approvedWithConflicts.map(({ device, conflicts }) => (
        <div
          key={device.id}
          className="rounded-xl border border-gray-200 bg-white"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-gray-500" />
              <span className="font-semibold text-gray-900">
                {device.rawHeaderLabel}
              </span>
              {device.detectedModelName && (
                <span className="text-sm text-gray-500">
                  / {device.detectedModelName}
                  {device.detectedModelNumber &&
                    ` / ${device.detectedModelNumber}`}
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-50 px-4">
            {conflicts.map((field) => {
              const defaultResolution =
                field.resolution !== 'pending'
                  ? field.resolution
                  : field.aiConfidence != null && field.aiConfidence >= 0.85
                    ? 'use_new'
                    : field.aiConfidence != null && field.aiConfidence < 0.75
                      ? 'keep_existing'
                      : null;

              const currentResolution =
                field.resolution !== 'pending'
                  ? field.resolution
                  : defaultResolution;

              return (
                <div key={field.id} className="py-4">
                  <p className="mb-1 text-sm font-medium text-gray-900">
                    {field.dstFieldKey}
                  </p>
                  <p className="mb-3 text-xs text-gray-500">
                    Source question: &ldquo;{field.rawQuestionText}&rdquo;
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                        currentResolution === 'use_new'
                          ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`conflict-${field.id}`}
                          checked={currentResolution === 'use_new'}
                          onChange={() =>
                            onResolve(device.id, field.id, 'use_new')
                          }
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-medium text-gray-700">
                          From questionnaire
                        </span>
                      </div>
                      <p className="mt-1.5 pl-6 text-sm text-gray-900">
                        {field.extractedValue ?? '—'}
                      </p>
                      {field.aiConfidence != null && (
                        <p className="mt-1 pl-6 text-xs text-gray-500">
                          confidence: {Math.round(field.aiConfidence * 100)}%
                        </p>
                      )}
                    </label>

                    <label
                      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                        currentResolution === 'keep_existing'
                          ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`conflict-${field.id}`}
                          checked={currentResolution === 'keep_existing'}
                          onChange={() =>
                            onResolve(device.id, field.id, 'keep_existing')
                          }
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-medium text-gray-700">
                          Keep existing
                        </span>
                      </div>
                      <p className="mt-1.5 pl-6 text-sm text-gray-900">
                        {field.existingValue ?? '—'}
                      </p>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={unresolvedCount > 0}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next: Sign Off
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Sign Off ────────────────────────────────────────────────────────

function SignOffStep({
  job,
  devices,
  partner,
  onConfirm,
  onBack,
  actionError,
  busy,
}: {
  job: QuestionnaireIntakeJob;
  devices: StagedDeviceWithFields[];
  partner: { id: string; displayName: string } | null;
  onConfirm: () => void;
  onBack: () => void;
  actionError: string | null;
  busy: boolean;
}) {
  const approved = devices.filter((d) => d.reviewStatus === 'approved');
  const rejected = devices.filter((d) => d.reviewStatus === 'rejected');
  const pending = devices.filter((d) => d.reviewStatus === 'pending');

  const hasUnresolvedConflicts = approved.some((d) =>
    d.fields.some(
      (f) =>
        f.conflictStatus === 'conflicts_with_existing' &&
        f.resolution === 'pending',
    ),
  );

  const canCommit =
    pending.length === 0 && !hasUnresolvedConflicts && partner != null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Step 4: Sign Off
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Review the summary below and confirm the import.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {approved.map((d) => {
          const isNew = !d.matchedDeviceId;
          const fieldCount = d.fields.filter(
            (f) => f.extractedValue != null,
          ).length;
          const overwritten = d.fields.filter(
            (f) =>
              f.conflictStatus === 'conflicts_with_existing' &&
              f.resolution === 'use_new',
          ).length;

          return (
            <div key={d.id} className="flex items-start gap-3 px-5 py-4">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium text-gray-900">
                  {d.rawHeaderLabel}
                  {d.detectedModelName && ` / ${d.detectedModelName}`}
                  {d.detectedModelNumber && ` / ${d.detectedModelNumber}`}
                  {isNew && (
                    <span className="ml-1 text-sm text-gray-500">
                      (new device)
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {isNew ? 'Creating new device record' : 'Updating existing device'}{' '}
                  · {fieldCount} fields
                  {overwritten > 0 && ` · ${overwritten} overwritten`}
                </p>
              </div>
            </div>
          );
        })}
        {rejected.map((d) => (
          <div key={d.id} className="flex items-start gap-3 px-5 py-4 opacity-50">
            <X className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="font-medium text-gray-900">
                {d.rawHeaderLabel}
                {d.detectedModelName && ` / ${d.detectedModelName}`}
              </p>
              <p className="text-xs text-gray-500">
                Rejected
                {d.rejectionReason && ` — ${d.rejectionReason}`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {approved.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <p>
            Source file will be attached to {approved.length} device record
            {approved.length !== 1 ? 's' : ''}.
          </p>
          {partner && (
            <p className="mt-1">
              Partner:{' '}
              <span className="font-medium text-gray-900">
                {partner.displayName}
              </span>
            </p>
          )}
          <p className="mt-1">
            Uploaded by:{' '}
            <span className="font-medium text-gray-900">
              {job.uploadedByEmail}
            </span>{' '}
            ·{' '}
            {formatDate(job.uploadedAt)}
          </p>
        </div>
      )}

      {!canCommit && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {pending.length > 0
            ? `${pending.length} device${pending.length !== 1 ? 's' : ''} still pending review.`
            : hasUnresolvedConflicts
              ? 'Some conflicts are still unresolved.'
              : 'A partner must be assigned before importing.'}
        </div>
      )}

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={!canCommit || busy}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Importing…' : 'Confirm Import'}
          {!busy && <Check className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function QuestionnaireReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useAuth();

  const [job, setJob] = useState<QuestionnaireIntakeJob | null>(null);
  const [devices, setDevices] = useState<StagedDeviceWithFields[]>([]);
  const [partner, setPartner] = useState<{
    id: string;
    displayName: string;
  } | null>(null);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  const partnerAssigned = partner != null;

  const hasConflicts = useMemo(
    () =>
      devices.some(
        (d) =>
          d.reviewStatus === 'approved' &&
          d.fields.some(
            (f) =>
              f.conflictStatus === 'conflicts_with_existing' &&
              f.resolution === 'pending',
          ),
      ),
    [devices],
  );

  const loadReview = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.questionnaireIntake.getReview(id);
      setJob(data.job);
      setDevices(data.devices);
      setPartner(data.partner);

      if (data.partner) {
        setStep(2);
      } else {
        setStep(1);
      }
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  // ── Partner assignment ──

  const handleConfirmPartner = useCallback(
    async (partnerId: string, displayName: string) => {
      if (!id) return;
      setActionError(null);
      setBusy(true);
      try {
        await api.questionnaireIntake.updateJob(id, { partnerId });
        setPartner({ id: partnerId, displayName });
        setJob((prev) =>
          prev
            ? {
                ...prev,
                partnerId,
                partnerDetectionMethod: 'admin' as const,
              }
            : prev,
        );
        setStep(2);
      } catch (err) {
        setActionError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [id],
  );

  // ── Device approve / reject ──

  const handleApproveDevice = useCallback(
    async (
      device: StagedDeviceWithFields,
      identity?: Record<string, string | null>,
    ) => {
      if (!id) return;
      setActionError(null);
      setBusy(true);
      try {
        const payload: Record<string, unknown> = { reviewStatus: 'approved' };
        if (identity) Object.assign(payload, identity);

        await api.questionnaireIntake.updateStagedDevice(
          id,
          device.id,
          payload,
        );
        setDevices((prev) =>
          prev.map((d) =>
            d.id === device.id
              ? {
                  ...d,
                  reviewStatus: 'approved' as const,
                  ...(identity as Partial<QuestionnaireStagedDevice>),
                }
              : d,
          ),
        );
      } catch (err) {
        setActionError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [id],
  );

  const handleRejectDevice = useCallback(
    async (device: StagedDeviceWithFields, reason?: string) => {
      if (!id) return;
      setActionError(null);
      setBusy(true);
      try {
        await api.questionnaireIntake.updateStagedDevice(id, device.id, {
          reviewStatus: 'rejected',
          rejectionReason: reason ?? null,
        });
        setDevices((prev) =>
          prev.map((d) =>
            d.id === device.id
              ? {
                  ...d,
                  reviewStatus: 'rejected' as const,
                  rejectionReason: reason ?? null,
                }
              : d,
          ),
        );
      } catch (err) {
        setActionError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [id],
  );

  // ── Field updates ──

  const handleFieldUpdate = useCallback(
    (
      deviceId: string,
      fieldId: string,
      patch: Partial<QuestionnaireStagedField>,
    ) => {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                fields: d.fields.map((f) =>
                  f.id === fieldId ? { ...f, ...patch } : f,
                ),
              }
            : d,
        ),
      );
    },
    [],
  );

  // ── Conflict resolution ──

  const handleResolveConflict = useCallback(
    async (
      deviceId: string,
      fieldId: string,
      resolution: 'use_new' | 'keep_existing',
    ) => {
      if (!id) return;
      setActionError(null);
      try {
        await api.questionnaireIntake.updateField(id, deviceId, fieldId, {
          resolution,
        });
        handleFieldUpdate(deviceId, fieldId, { resolution });
      } catch (err) {
        setActionError(errorMessage(err));
      }
    },
    [id, handleFieldUpdate],
  );

  const handleResolveAllDevice = useCallback(
    async (deviceId: string) => {
      if (!id) return;
      setActionError(null);
      setBusy(true);
      try {
        await api.questionnaireIntake.resolveAll(id, deviceId);
        setDevices((prev) =>
          prev.map((d) =>
            d.id === deviceId
              ? {
                  ...d,
                  fields: d.fields.map((f) =>
                    f.conflictStatus === 'conflicts_with_existing' &&
                    f.resolution === 'pending'
                      ? { ...f, resolution: 'use_new' as const }
                      : f,
                  ),
                }
              : d,
          ),
        );
      } catch (err) {
        setActionError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [id],
  );

  // ── Sign off ──

  const handleConfirmImport = useCallback(async () => {
    if (!id) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.questionnaireIntake.approve(id);
      navigate(`/admin/questionnaires/${id}`, {
        state: { importSuccess: true },
      });
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [id, navigate]);

  // ── Global reject ──

  const handleRejectAll = useCallback(async () => {
    if (!id) return;
    setRejectBusy(true);
    try {
      await api.questionnaireIntake.reject(id, rejectReason || undefined);
      setShowRejectModal(false);
      navigate(`/admin/questionnaires/${id}`, {
        state: { rejected: true },
      });
    } catch (err) {
      setActionError(errorMessage(err));
      setShowRejectModal(false);
    } finally {
      setRejectBusy(false);
    }
  }, [id, rejectReason, navigate]);

  // ── Step navigation ──

  const advanceFromStep2 = () => {
    const approvedDevices = devices.filter(
      (d) => d.reviewStatus === 'approved',
    );
    const anyConflicts = approvedDevices.some((d) =>
      d.fields.some(
        (f) =>
          f.conflictStatus === 'conflicts_with_existing' &&
          f.resolution === 'pending',
      ),
    );
    setStep(anyConflicts ? 3 : 4);
  };

  const goBackFromStep4 = () => {
    setStep(hasConflicts ? 3 : 2);
  };

  const currentStepKey =
    step === 1
      ? 'assign_partner'
      : step === 2
        ? 'review_devices'
        : step === 3
          ? 'resolve_conflicts'
          : 'sign_off';

  const skippedSteps = [
    ...(partnerAssigned && step !== 1 ? ['assign_partner'] : []),
    ...(!hasConflicts && step > 3 ? ['resolve_conflicts'] : []),
  ];

  const explicitCompletedSteps = [
    ...(partnerAssigned && step !== 1 ? ['assign_partner'] : []),
    ...(!hasConflicts && step > 3 ? ['resolve_conflicts'] : []),
  ];

  // ── Render ──

  if (loading) return <LoadingSpinner />;

  if (loadError || !job) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-400" />
        <p className="text-lg font-medium text-gray-900">
          {loadError ?? 'Review data not found.'}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-sm font-medium text-indigo-600 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Review Questionnaire Import
            </h1>
            <p className="text-sm text-gray-500">{job.fileName}</p>
          </div>
        </div>

        <button
          onClick={() => setShowRejectModal(true)}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Reject All
        </button>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <WorkflowStepper
          mode="wizard4"
          currentStep={currentStepKey}
          completedSteps={explicitCompletedSteps}
          skippedSteps={skippedSteps}
          steps={[
            { key: 'assign_partner', label: 'Assign Partner' },
            { key: 'review_devices', label: 'Review Devices' },
            { key: 'resolve_conflicts', label: 'Resolve Conflicts' },
            { key: 'sign_off', label: 'Sign Off' },
          ]}
        />
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {step === 1 && (
          <AssignPartnerStep
            job={job}
            partner={partner}
            onConfirm={handleConfirmPartner}
            actionError={actionError}
          />
        )}

        {step === 2 && (
          <ReviewDevicesStep
            devices={devices}
            jobId={id!}
            job={job}
            onApproveDevice={handleApproveDevice}
            onRejectDevice={handleRejectDevice}
            onFieldUpdate={handleFieldUpdate}
            onRefreshJob={loadReview}
            onNext={advanceFromStep2}
            actionError={actionError}
            busy={busy}
          />
        )}

        {step === 3 && (
          <ResolveConflictsStep
            devices={devices}
            onResolve={handleResolveConflict}
            onResolveAllDevice={handleResolveAllDevice}
            onNext={() => setStep(4)}
            actionError={actionError}
            busy={busy}
          />
        )}

        {step === 4 && (
          <SignOffStep
            job={job}
            devices={devices}
            partner={partner}
            onConfirm={handleConfirmImport}
            onBack={goBackFromStep4}
            actionError={actionError}
            busy={busy}
          />
        )}
      </div>

      {/* Reject All Modal */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Entire Questionnaire Import"
        footer={
          <>
            <button
              onClick={() => setShowRejectModal(false)}
              disabled={rejectBusy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectAll}
              disabled={rejectBusy}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {rejectBusy ? 'Rejecting…' : 'Confirm Reject All'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            This will reject all detected devices and mark the file as rejected.
            No data will be written to the registry.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Reason (optional)
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter a reason for rejection…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
