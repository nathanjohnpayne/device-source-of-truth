import { useState, useEffect, useMemo } from 'react';
import { Bell, AlertTriangle, Key, Monitor } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import DataTable, { type Column } from '../components/shared/DataTable';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import type { Alert, AlertType, AlertStatus, AlertDismissReason } from '../lib/types';
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

const STATUS_TABS: { label: string; value: AlertStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Dismissed', value: 'dismissed' },
];

const ALERT_TYPES: AlertType[] = ['unregistered_device', 'new_partner_key', 'inactive_key'];


export default function AlertsPage() {
  const { isAdmin } = useAuth();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AlertType | ''>('');

  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [dismissTarget, setDismissTarget] = useState<Alert | null>(null);
  const [dismissReason, setDismissReason] = useState<AlertDismissReason>('Test Device');
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.alerts
      .list({ pageSize: 500 })
      .then((res) => setAlerts(res.data))
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openDismiss(row);
                  }}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Dismiss
                </button>
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
              {dismissing ? 'Dismissing...' : 'Dismiss'}
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
    </div>
  );
}
