import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  FileText,
  ChevronDown,
  ChevronRight,
  Check,
  Minus,
  AlertTriangle,
  ExternalLink,
  Plus,
  Activity,
  History,
  Layers,
  Globe,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import Badge from '../components/shared/Badge';
import DataTable, { type Column } from '../components/shared/DataTable';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import type {
  DeviceDetail,
  DeviceDeployment,
  AuditLogEntry,
  CertificationStatus,
  SpecCategory,
  DeploymentStatus,
} from '../lib/types';
import { SPEC_CATEGORIES, SPEC_CATEGORY_LABELS } from '../lib/types';
import { QUESTIONNAIRE_SECTIONS, SPEC_FIELD_UNITS } from '../lib/questionnaireFields';

const CERT_VARIANT: Record<CertificationStatus, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
  Certified: 'success',
  Pending: 'warning',
  'In Review': 'info',
  'Not Submitted': 'default',
  Deprecated: 'danger',
};

function countryFlag(iso2: string): string {
  if (iso2.length !== 2) return '\u{1F3F3}';
  const cp1 = 0x1f1e6 + iso2.toUpperCase().charCodeAt(0) - 65;
  const cp2 = 0x1f1e6 + iso2.toUpperCase().charCodeAt(1) - 65;
  return String.fromCodePoint(cp1, cp2);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getSpecFieldLabel(field: string): string {
  const sectionDef = QUESTIONNAIRE_SECTIONS.find((s) =>
    s.fields.some((f) => f.key === field),
  );
  if (sectionDef) {
    const fieldDef = sectionDef.fields.find((f) => f.key === field);
    if (fieldDef) return fieldDef.label;
  }
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase());
}

function SpecCategorySection({
  category,
  data,
}: {
  category: SpecCategory;
  data: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);

  const fields = data ? Object.entries(data) : [];
  const totalFields = fields.length;
  const completedFields = fields.filter(([, v]) => v !== null && v !== undefined && v !== '').length;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-900">
            {SPEC_CATEGORY_LABELS[category]}
          </span>
        </div>
        <Badge
          variant={
            completedFields === totalFields
              ? 'success'
              : completedFields > 0
                ? 'warning'
                : 'danger'
          }
        >
          {completedFields}/{totalFields} fields complete
        </Badge>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-px bg-gray-100 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([key, value]) => (
            <div
              key={key}
              className={`bg-white px-3 py-2 ${value === null ? 'bg-amber-50/50' : ''}`}
            >
              <p className="text-xs font-medium text-gray-500">
                {getSpecFieldLabel(key)}
              </p>
              <div className="mt-0.5">
                {value === null || value === undefined || value === '' ? (
                  <span className="text-sm text-amber-500">—</span>
                ) : typeof value === 'boolean' ? (
                  value ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Minus className="h-4 w-4 text-gray-300" />
                  )
                ) : (
                  <span className="text-sm font-medium text-gray-900">
                    {String(value)}
                    {SPEC_FIELD_UNITS[key] ? (
                      <span className="ml-1 text-xs text-gray-400">
                        {SPEC_FIELD_UNITS[key]}
                      </span>
                    ) : null}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const deploymentColumns: Column<DeviceDeployment>[] = [
  {
    header: 'Country',
    accessor: 'countryIso2',
    render: (row) => (
      <span>
        {countryFlag(row.countryIso2)} {row.countryIso2}
      </span>
    ),
  },
  {
    header: 'Status',
    accessor: 'deploymentStatus',
    render: (row) => (
      <Badge variant={row.deploymentStatus === 'Active' ? 'success' : 'danger'}>
        {row.deploymentStatus}
      </Badge>
    ),
  },
  { header: 'ADK Version', accessor: 'deployedAdkVersion' },
];

const auditColumns: Column<AuditLogEntry>[] = [
  {
    header: 'Date',
    accessor: 'timestamp',
    sortable: true,
    render: (row) => formatDate(row.timestamp),
  },
  { header: 'User', accessor: 'userEmail' },
  { header: 'Field', accessor: 'field' },
  {
    header: 'Old Value',
    accessor: 'oldValue',
    render: (row) => (
      <span className="text-xs text-gray-500">{row.oldValue ?? '—'}</span>
    ),
  },
  {
    header: 'New Value',
    accessor: 'newValue',
    render: (row) => (
      <span className="text-xs font-medium text-gray-900">{row.newValue ?? '—'}</span>
    ),
  },
];

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isEditor } = useAuth();

  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    liveAdkVersion: '',
    certificationStatus: '' as CertificationStatus | '',
    certificationNotes: '',
  });
  const [saving, setSaving] = useState(false);

  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployForm, setDeployForm] = useState({
    countryIso2: '',
    deploymentStatus: 'Active' as DeploymentStatus,
    deployedAdkVersion: '',
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.devices
      .get(id)
      .then((d) => {
        setDevice(d);
        setEditForm({
          displayName: d.displayName,
          liveAdkVersion: d.liveAdkVersion || '',
          certificationStatus: d.certificationStatus,
          certificationNotes: d.certificationNotes || '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await api.devices.update(id, {
        displayName: editForm.displayName,
        liveAdkVersion: editForm.liveAdkVersion || null,
        certificationStatus: editForm.certificationStatus as CertificationStatus,
        certificationNotes: editForm.certificationNotes || null,
      } as Record<string, unknown>);
      setDevice((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDeployment = async () => {
    if (!id || !deployForm.countryIso2) return;
    // TODO: add a backend POST /device-deployments endpoint
    setError('Deployment creation is not yet supported by the API');
    void deployForm;
  };

  if (loading) return <LoadingSpinner />;
  if (error && !device) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!device) return <EmptyState title="Device not found" />;

  const spec = device.spec;
  const telemetry = device.telemetrySnapshots || [];
  const deployments = device.deployments || [];
  const auditHistory = (device.auditHistory || []).slice(0, 20);

  const totalUniqueDevices = telemetry.reduce((sum, t) => sum + t.uniqueDevices, 0);
  const lastUpload = telemetry.length
    ? telemetry.reduce((latest, t) =>
        t.snapshotDate > latest.snapshotDate ? t : latest,
      ).snapshotDate
    : null;

  const versionBreakdown = telemetry.reduce<Record<string, number>>((acc, t) => {
    acc[t.coreVersion] = (acc[t.coreVersion] || 0) + t.uniqueDevices;
    return acc;
  }, {});

  const versionChartData = Object.entries(versionBreakdown)
    .map(([version, count]) => ({
      version,
      count,
      pct: totalUniqueDevices > 0 ? Math.round((count / totalUniqueDevices) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8">
      {/* Back nav */}
      <button
        onClick={() => navigate('/devices')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Devices
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{device.displayName}</h1>
          <p className="mt-1 font-mono text-sm text-gray-500">{device.deviceId}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {device.tier && (
              <Badge variant="info">{device.tier.tierName}</Badge>
            )}
            <Badge variant={CERT_VARIANT[device.certificationStatus]}>
              {device.certificationStatus}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-3xl font-bold text-gray-900">
            {(device.activeDeviceCount ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Active Devices</p>
          {isEditor && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => navigate(`/devices/${id}/specs/edit`)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <FileText className="h-3.5 w-3.5" /> Edit Specs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Device Metadata</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-gray-500">Partner</dt>
            <dd className="mt-0.5 text-sm text-gray-900">
              {device.partner ? (
                <Link
                  to={`/partners/${device.partner.id}`}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  {device.partner.displayName}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Partner Key</dt>
            <dd className="mt-0.5 font-mono text-sm text-gray-900">
              {device.partnerKey?.key ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Device Type</dt>
            <dd className="mt-0.5 text-sm text-gray-900">{device.deviceType}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Region</dt>
            <dd className="mt-0.5 text-sm text-gray-900">
              {device.partnerKey?.regions?.join(', ') || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Countries</dt>
            <dd className="mt-0.5 flex flex-wrap gap-1 text-sm text-gray-900">
              {device.partnerKey?.countries?.length
                ? device.partnerKey.countries.map((c) => (
                    <span key={c}>{countryFlag(c)} {c}</span>
                  ))
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">ADK Version</dt>
            <dd className="mt-0.5 text-sm text-gray-900">
              {device.liveAdkVersion ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Certification Status</dt>
            <dd className="mt-0.5">
              <Badge variant={CERT_VARIANT[device.certificationStatus]}>
                {device.certificationStatus}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Last Certified</dt>
            <dd className="mt-0.5 text-sm text-gray-900">
              {formatDate(device.lastCertifiedDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Source Questionnaire</dt>
            <dd className="mt-0.5 text-sm">
              {device.questionnaireUrl ? (
                <a
                  href={device.questionnaireUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                >
                  View Questionnaire <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <Badge variant="warning">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  No questionnaire on file
                </Badge>
              )}
            </dd>
          </div>
          {device.certificationNotes && (
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs font-medium text-gray-500">Certification Notes</dt>
              <dd className="mt-0.5 text-sm text-gray-700">{device.certificationNotes}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Specs */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Specifications</h2>
          </div>
          {isEditor && spec && (
            <button
              onClick={() => navigate(`/devices/${id}/specs/edit`)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Edit Specs
            </button>
          )}
        </div>
        {spec ? (
          <div>
            {SPEC_CATEGORIES.map((cat) => (
              <SpecCategorySection
                key={cat}
                category={cat}
                data={spec[cat] as unknown as Record<string, unknown> | null}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No specifications recorded"
            description="Add device specs to enable tier classification and reporting."
            action={
              isEditor ? (
                <button
                  onClick={() => navigate(`/devices/${id}/specs/edit`)}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" /> Add Specs
                </button>
              ) : undefined
            }
          />
        )}
      </section>

      {/* Deployments */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Deployments</h2>
            <span className="text-sm text-gray-500">({deployments.length})</span>
          </div>
          {isEditor && (
            <button
              onClick={() => setDeployModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Plus className="h-4 w-4" /> Add Deployment
            </button>
          )}
        </div>
        <div className="p-4">
          <DataTable
            columns={deploymentColumns}
            data={deployments}
            emptyTitle="No deployments"
            emptyDescription="No deployment records for this device."
          />
        </div>
      </section>

      {/* Telemetry */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Activity className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Telemetry</h2>
        </div>
        <div className="p-4">
          {telemetry.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-500">Total Unique Devices</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {(totalUniqueDevices ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-500">Last Upload</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {formatDate(lastUpload)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Version Breakdown
                </h3>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                          ADK Version
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                          Unique Devices
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                          % of Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {versionChartData.map((v) => (
                        <tr key={v.version}>
                          <td className="px-4 py-2 text-sm font-mono text-gray-900">
                            {v.version}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {(v.count ?? 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">{v.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {versionChartData.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-medium text-gray-700">
                    Version Adoption
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={versionChartData}
                        layout="vertical"
                        margin={{ top: 0, right: 20, bottom: 0, left: 80 }}
                      >
                        <XAxis type="number" />
                        <YAxis
                          type="category"
                          dataKey="version"
                          width={70}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number | undefined) => [
                            (value ?? 0).toLocaleString(),
                            'Devices',
                          ]}
                        />
                        <Bar
                          dataKey="count"
                          fill="#6366f1"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No telemetry data uploaded yet"
              description="Telemetry data will appear here after the first upload."
            />
          )}
        </div>
      </section>

      {/* Audit History */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <History className="h-5 w-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Audit History</h2>
        </div>
        <div className="p-4">
          <DataTable
            columns={auditColumns}
            data={auditHistory}
            emptyTitle="No audit history"
            emptyDescription="Changes to this device will appear here."
          />
        </div>
      </section>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Device"
        wide
        footer={
          <>
            <button
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Display Name</label>
            <input
              type="text"
              value={editForm.displayName}
              onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ADK Version</label>
            <input
              type="text"
              value={editForm.liveAdkVersion}
              onChange={(e) => setEditForm((p) => ({ ...p, liveAdkVersion: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Certification Status
            </label>
            <select
              value={editForm.certificationStatus}
              onChange={(e) =>
                setEditForm((p) => ({
                  ...p,
                  certificationStatus: e.target.value as CertificationStatus,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {(['Certified', 'Pending', 'In Review', 'Not Submitted', 'Deprecated'] as CertificationStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Certification Notes
            </label>
            <textarea
              value={editForm.certificationNotes}
              onChange={(e) =>
                setEditForm((p) => ({ ...p, certificationNotes: e.target.value }))
              }
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Modal>

      {/* Add Deployment Modal */}
      <Modal
        open={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        title="Add Deployment"
        footer={
          <>
            <button
              onClick={() => setDeployModalOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddDeployment}
              disabled={!deployForm.countryIso2}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Add
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Country (ISO 3166-1 alpha-2)
            </label>
            <input
              type="text"
              value={deployForm.countryIso2}
              onChange={(e) =>
                setDeployForm((p) => ({ ...p, countryIso2: e.target.value }))
              }
              placeholder="US"
              maxLength={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={deployForm.deploymentStatus}
              onChange={(e) =>
                setDeployForm((p) => ({
                  ...p,
                  deploymentStatus: e.target.value as DeploymentStatus,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Active">Active</option>
              <option value="Deprecated">Deprecated</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">ADK Version</label>
            <input
              type="text"
              value={deployForm.deployedAdkVersion}
              onChange={(e) =>
                setDeployForm((p) => ({ ...p, deployedAdkVersion: e.target.value }))
              }
              placeholder="e.g. 7.3.1"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
