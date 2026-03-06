import { useState, useEffect, useMemo, useCallback } from 'react';
import { Bell, AlertTriangle, Key, Monitor, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import DataTable, { type Column } from '../components/shared/DataTable';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import type {
  Alert,
  AlertType,
  AlertStatus,
  AlertDismissReason,
  Partner,
  PartnerKeyWithDisplay,
  DeviceType,
} from '../lib/types';
import { formatDate } from '../lib/format';

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  unregistered_device: 'Unregistered Device',
  new_partner_key: 'New Partner Key',
  inactive_key: 'Inactive Key',
};

const ALERT_TYPE_VARIANT: Record<AlertType, 'danger' | 'warning' | 'info'> = {
  unregistered_device: 'danger',
  new_partner_key: 'warning',
  inactive_key: 'info',
};

const ALERT_TYPE_ICON: Record<AlertType, typeof AlertTriangle> = {
  unregistered_device: Monitor,
  new_partner_key: Key,
  inactive_key: AlertTriangle,
};

const DISMISS_REASONS: AlertDismissReason[] = [
  'Test Device',
  'Duplicate Key',
  'Will Register',
  'Internal / Deprecated',
];

const RESOLVED_REASONS: AlertDismissReason[] = ['Device Registered', 'Key Created'];

const STATUS_TABS: { label: string; value: AlertStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Dismissed', value: 'dismissed' },
];

const ALERT_TYPES: AlertType[] = ['unregistered_device', 'new_partner_key', 'inactive_key'];

const DEVICE_TYPES: DeviceType[] = ['STB', 'Smart TV', 'Stick', 'Console', 'OTT Box', 'Other'];

// ── Create Key Modal ──────────────────────────────────────────────

interface CreateKeyModalProps {
  open: boolean;
  onClose: () => void;
  alert: Alert | null;
  partners: Partner[];
  onResolved: (alertId: string, updated: Partial<Alert>) => void;
}

function CreateKeyModal({ open, onClose, alert, partners, onResolved }: CreateKeyModalProps) {
  const [partnerId, setPartnerId] = useState('');
  const [chipset, setChipset] = useState('');
  const [oem, setOem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPartnerId('');
      setChipset('');
      setOem('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!alert) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.partnerKeys.create({
        key: alert.partnerKey,
        partnerId: partnerId || null,
        chipset: chipset || null,
        oem: oem || null,
      });
      const updated = await api.alerts.dismiss(alert.id, 'Key Created');
      onResolved(alert.id, updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create partner key');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Partner Key"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? <><LoadingSpinner inline /> Creating…</> : 'Create Key'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {alert && (
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Partner Key:</span>{' '}
              <span className="font-mono">{alert.partnerKey}</span>
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Partner Key</label>
          <input
            type="text"
            value={alert?.partnerKey ?? ''}
            disabled
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Partner <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">— None —</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Chipset <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={chipset}
              onChange={(e) => setChipset(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. BCM72180"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              OEM <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={oem}
              onChange={(e) => setOem(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Arris"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Register Device Modal ─────────────────────────────────────────

interface PartnerKeyMatch {
  id: string;
  key: string;
  partnerDisplayName: string | null;
}

interface RegisterDeviceModalProps {
  open: boolean;
  onClose: () => void;
  alert: Alert | null;
  alerts: Alert[];
  partners: Partner[];
  onResolved: (alertId: string, updated: Partial<Alert>) => void;
}

function RegisterDeviceModal({
  open,
  onClose,
  alert,
  alerts,
  partners,
  onResolved,
}: RegisterDeviceModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType>('Other');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [keyMatch, setKeyMatch] = useState<PartnerKeyMatch | null>(null);
  const [keyMissing, setKeyMissing] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);

  const [keyPartnerId, setKeyPartnerId] = useState('');
  const [keyChipset, setKeyChipset] = useState('');
  const [keyOem, setKeyOem] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    if (!open || !alert) return;
    setDisplayName('');
    setDeviceType('Other');
    setError(null);
    setKeyMatch(null);
    setKeyMissing(false);
    setKeyPartnerId('');
    setKeyChipset('');
    setKeyOem('');

    setKeyLoading(true);
    api.partnerKeys
      .list({ pageSize: 500 })
      .then((res) => {
        const match = res.data.find(
          (pk: PartnerKeyWithDisplay) => pk.key === alert.partnerKey,
        );
        if (match) {
          setKeyMatch({
            id: match.id,
            key: match.key,
            partnerDisplayName: match.partnerDisplayName,
          });
        } else {
          setKeyMissing(true);
        }
      })
      .catch(() => setError('Failed to look up partner key'))
      .finally(() => setKeyLoading(false));
  }, [open, alert]);

  const handleCreateKey = async () => {
    if (!alert) return;
    setCreatingKey(true);
    setError(null);
    try {
      const created = await api.partnerKeys.create({
        key: alert.partnerKey,
        partnerId: keyPartnerId || null,
        chipset: keyChipset || null,
        oem: keyOem || null,
      });
      const partnerName =
        created.partnerDisplayName ??
        partners.find((p) => p.id === keyPartnerId)?.displayName ??
        null;
      setKeyMatch({ id: created.id, key: created.key, partnerDisplayName: partnerName });
      setKeyMissing(false);

      const matchingKeyAlert = alerts.find(
        (a) =>
          a.type === 'new_partner_key' &&
          a.partnerKey === alert.partnerKey &&
          a.status === 'open',
      );
      if (matchingKeyAlert) {
        const updated = await api.alerts.dismiss(matchingKeyAlert.id, 'Key Created');
        onResolved(matchingKeyAlert.id, updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create partner key');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleSubmit = async () => {
    if (!alert || !keyMatch || !displayName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.devices.create({
        deviceId: alert.deviceId!,
        displayName: displayName.trim(),
        partnerKeyId: keyMatch.id,
        deviceType,
      });
      const updated = await api.alerts.dismiss(alert.id, 'Device Registered');
      onResolved(alert.id, updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register device');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!keyMatch && displayName.trim().length > 0 && !submitting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register Device"
      wide
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? <><LoadingSpinner inline /> Registering…</> : 'Register Device'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {alert && (
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Device ID:</span>{' '}
                <span className="font-mono">{alert.deviceId}</span>
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Partner Key:</span>{' '}
                <span className="font-mono">{alert.partnerKey}</span>
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Unique Devices:</span>{' '}
                {(alert.uniqueDeviceCount ?? 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">First Seen:</span> {formatDate(alert.firstSeen)}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Partner key status / inline creation */}
        {keyLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <LoadingSpinner inline />
            <span className="text-sm text-gray-500">Looking up partner key…</span>
          </div>
        ) : keyMatch ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="text-sm text-emerald-700">
              Partner key <span className="font-mono font-medium">{keyMatch.key}</span> found
              {keyMatch.partnerDisplayName && (
                <>
                  {' — linked to '}
                  <span className="font-medium">{keyMatch.partnerDisplayName}</span>
                </>
              )}
            </span>
          </div>
        ) : keyMissing ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-700">
                Partner key{' '}
                <span className="font-mono font-medium">{alert?.partnerKey}</span>{' '}
                doesn&apos;t exist yet. Create it below to register this device.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-900">Create Partner Key</h4>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Partner <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <select
                    value={keyPartnerId}
                    onChange={(e) => setKeyPartnerId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">— None —</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Chipset <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={keyChipset}
                      onChange={(e) => setKeyChipset(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. BCM72180"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      OEM <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={keyOem}
                      onChange={(e) => setKeyOem(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="e.g. Arris"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateKey}
                  disabled={creatingKey}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creatingKey ? <><LoadingSpinner inline /> Creating…</> : 'Create Key'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Device registration form */}
        <div className={!keyMatch ? 'pointer-events-none opacity-40' : ''}>
          <h4 className="mb-3 text-sm font-semibold text-gray-900">Device Details</h4>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Device ID</label>
              <input
                type="text"
                value={alert?.deviceId ?? ''}
                disabled
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!keyMatch}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="e.g. Xbox Series X"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Device Type</label>
              <select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                disabled={!keyMatch}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
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
      </div>
    </Modal>
  );
}

// ── Alerts Page ───────────────────────────────────────────────────

export default function AlertsPage() {
  const { isAdmin } = useAuth();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AlertType | ''>('');

  const [partners, setPartners] = useState<Partner[]>([]);

  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [dismissTarget, setDismissTarget] = useState<Alert | null>(null);
  const [dismissReason, setDismissReason] = useState<AlertDismissReason>('Test Device');
  const [dismissing, setDismissing] = useState(false);

  const [createKeyModalOpen, setCreateKeyModalOpen] = useState(false);
  const [createKeyTarget, setCreateKeyTarget] = useState<Alert | null>(null);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registerTarget, setRegisterTarget] = useState<Alert | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.alerts.list({ pageSize: 500 }),
      api.partners.list({ pageSize: 500 }),
    ])
      .then(([alertsRes, partnersRes]) => {
        setAlerts(alertsRes.data);
        setPartners(partnersRes.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = alerts;
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (typeFilter) {
      result = result.filter((a) => a.type === typeFilter);
    }
    return result;
  }, [alerts, statusFilter, typeFilter]);

  const openDismiss = (alert: Alert) => {
    setDismissTarget(alert);
    setDismissReason('Test Device');
    setDismissModalOpen(true);
  };

  const handleDismiss = async () => {
    if (!dismissTarget) return;
    setDismissing(true);
    try {
      const updated = await api.alerts.dismiss(dismissTarget.id, dismissReason);
      setAlerts((prev) =>
        prev.map((a) => (a.id === dismissTarget.id ? { ...a, ...updated } : a)),
      );
      setDismissModalOpen(false);
      setDismissTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss');
    } finally {
      setDismissing(false);
    }
  };

  const handleAlertResolved = useCallback(
    (alertId: string, updated: Partial<Alert>) => {
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, ...updated } : a)));
    },
    [],
  );

  const openCreateKey = (alert: Alert) => {
    setCreateKeyTarget(alert);
    setCreateKeyModalOpen(true);
  };

  const openRegisterDevice = (alert: Alert) => {
    setRegisterTarget(alert);
    setRegisterModalOpen(true);
  };

  const isResolved = (row: Alert) =>
    row.status === 'dismissed' &&
    RESOLVED_REASONS.includes(row.dismissReason as AlertDismissReason);

  const columns: Column<Alert>[] = [
    {
      header: 'Type',
      accessor: 'type',
      render: (row) => {
        const Icon = ALERT_TYPE_ICON[row.type];
        return (
          <Badge variant={ALERT_TYPE_VARIANT[row.type]}>
            <Icon className="mr-1 h-3 w-3" />
            {ALERT_TYPE_LABELS[row.type]}
          </Badge>
        );
      },
    },
    {
      header: 'Partner Key',
      accessor: 'partnerKey',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs">{row.partnerKey}</span>
      ),
    },
    {
      header: 'Device ID',
      accessor: 'deviceId',
      render: (row) =>
        row.deviceId ? (
          <span className="font-mono text-xs">{row.deviceId}</span>
        ) : (
          '—'
        ),
    },
    {
      header: 'First Seen',
      accessor: 'firstSeen',
      sortable: true,
      render: (row) => formatDate(row.firstSeen),
    },
    {
      header: 'Unique Devices',
      accessor: 'uniqueDeviceCount',
      sortable: true,
      render: (row) => (row.uniqueDeviceCount ?? 0).toLocaleString(),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        if (row.status === 'open') {
          return (
            <div className="flex items-center gap-2">
              <Badge variant="warning">Open</Badge>
              {isAdmin && (
                <>
                  {row.type === 'unregistered_device' && row.deviceId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRegisterDevice(row);
                      }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Register
                    </button>
                  )}
                  {row.type === 'new_partner_key' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreateKey(row);
                      }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Create Key
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDismiss(row);
                    }}
                    className="text-xs font-medium text-gray-400 hover:text-gray-600"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          );
        }

        if (isResolved(row)) {
          return (
            <div className="space-y-0.5">
              <Badge variant="success">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Resolved
              </Badge>
              {row.dismissReason && (
                <p className="text-xs text-gray-500">{row.dismissReason}</p>
              )}
              {row.dismissedBy && (
                <p className="text-xs text-gray-400">by {row.dismissedBy}</p>
              )}
            </div>
          );
        }

        return (
          <div className="space-y-0.5">
            <Badge variant="default">Dismissed</Badge>
            {row.dismissReason && (
              <p className="text-xs text-gray-500">{row.dismissReason}</p>
            )}
            {row.dismissedBy && (
              <p className="text-xs text-gray-400">by {row.dismissedBy}</p>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {filtered.length.toLocaleString()} alert{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.value === 'open' && (
                <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
                  {alerts.filter((a) => a.status === 'open').length}
                </span>
              )}
            </button>
          ))}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AlertType | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          {ALERT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ALERT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle="No alerts"
        emptyDescription="No alerts match the current filters."
      />

      {/* Dismiss modal */}
      <Modal
        open={dismissModalOpen}
        onClose={() => setDismissModalOpen(false)}
        title="Dismiss Alert"
        footer={
          <>
            <button
              onClick={() => setDismissModalOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {dismissing ? 'Dismissing…' : 'Dismiss'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {dismissTarget && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Type:</span>{' '}
                {ALERT_TYPE_LABELS[dismissTarget.type]}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Partner Key:</span>{' '}
                <span className="font-mono">{dismissTarget.partnerKey}</span>
              </p>
              {dismissTarget.deviceId && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Device ID:</span>{' '}
                  <span className="font-mono">{dismissTarget.deviceId}</span>
                </p>
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Dismiss Reason
            </label>
            <select
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value as AlertDismissReason)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {DISMISS_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Create Key modal */}
      <CreateKeyModal
        open={createKeyModalOpen}
        onClose={() => setCreateKeyModalOpen(false)}
        alert={createKeyTarget}
        partners={partners}
        onResolved={handleAlertResolved}
      />

      {/* Register Device modal */}
      <RegisterDeviceModal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        alert={registerTarget}
        alerts={alerts}
        partners={partners}
        onResolved={handleAlertResolved}
      />
    </div>
  );
}
