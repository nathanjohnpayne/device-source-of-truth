import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import DataTable, { type Column } from '../components/shared/DataTable';
import Badge from '../components/shared/Badge';
import type { AuditLogEntry, AuditEntityType } from '../lib/types';

const ENTITY_TYPES: AuditEntityType[] = [
  'partner',
  'partnerKey',
  'device',
  'deviceSpec',
  'deployment',
  'hardwareTier',
  'alert',
  'user',
  'fieldOption',
  'intakeRequest',
  'partnerAlias',
  'system',
];

const ENTITY_TYPE_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  partner: 'info',
  partnerKey: 'info',
  device: 'success',
  deviceSpec: 'success',
  deployment: 'warning',
  hardwareTier: 'default',
  alert: 'danger',
  user: 'default',
  fieldOption: 'info',
  intakeRequest: 'warning',
  partnerAlias: 'info',
  system: 'danger',
};

const PAGE_SIZE = 25;

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [entityType, setEntityType] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    trackEvent('audit_log_view', { entity_type: entityType || undefined });
  }, [entityType]);

  const fetchEntries = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = {
      page,
      pageSize: PAGE_SIZE,
      sort: 'timestamp',
      order: 'desc',
    };
    if (entityType) params.entityType = entityType;
    if (userEmail) params.userEmail = userEmail;
    if (dateStart) params.startDate = dateStart;
    if (dateEnd) params.endDate = dateEnd;

    api.audit
      .list(params)
      .then((res) => {
        setEntries(res.data);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, entityType, userEmail, dateStart, dateEnd]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    setPage(1);
  }, [entityType, userEmail, dateStart, dateEnd]);

  const columns: Column<AuditLogEntry>[] = [
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      sortable: true,
      render: (row) => (
        <span className="whitespace-nowrap text-gray-600">
          {formatTimestamp(row.timestamp)}
        </span>
      ),
    },
    {
      header: 'User',
      accessor: 'userEmail',
      render: (row) => (
        <span className="text-gray-700">{row.userEmail}</span>
      ),
    },
    {
      header: 'Entity Type',
      accessor: 'entityType',
      render: (row) => (
        <Badge variant={ENTITY_TYPE_VARIANT[row.entityType] ?? 'default'}>
          {row.entityType}
        </Badge>
      ),
    },
    {
      header: 'Entity ID',
      accessor: 'entityId',
      render: (row) => (
        <span className="font-mono text-xs text-gray-500">{row.entityId}</span>
      ),
    },
    { header: 'Field', accessor: 'field' },
    {
      header: 'Old Value',
      accessor: 'oldValue',
      render: (row) => (
        <span className="max-w-[120px] truncate text-xs text-gray-500" title={row.oldValue ?? ''}>
          {row.oldValue ?? '—'}
        </span>
      ),
    },
    {
      header: 'New Value',
      accessor: 'newValue',
      render: (row) => (
        <span className="max-w-[120px] truncate text-xs text-gray-700" title={row.newValue ?? ''}>
          {row.newValue ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track all data changes across the system
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Entity Type
            </label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              User Email
            </label>
            <input
              type="text"
              placeholder="Search by email..."
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Start Date
            </label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              End Date
            </label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {(entityType || userEmail || dateStart || dateEnd) && (
            <button
              onClick={() => {
                setEntityType('');
                setUserEmail('');
                setDateStart('');
                setDateEnd('');
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={entries}
        loading={loading}
        emptyTitle="No audit entries found"
        emptyDescription="Try adjusting your filters."
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
