import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download } from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import { exportToCsv } from '../lib/export';
import { useAuth } from '../hooks/useAuth';
import DataTable, { type Column } from '../components/shared/DataTable';
import FilterPanel, { type FilterGroup, type FilterValues } from '../components/shared/FilterPanel';
import Badge from '../components/shared/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import type {
  DeviceWithRelations,
  PartnerWithStats,
  HardwareTier,
  CertificationStatus,
  DeviceType,
  Region,
} from '../lib/types';

const DEVICE_TYPES: DeviceType[] = ['STB', 'Smart TV', 'Stick', 'Console', 'OTT Box', 'Other'];
const CERT_STATUSES: CertificationStatus[] = ['Certified', 'Pending', 'In Review', 'Not Submitted', 'Deprecated'];
const REGIONS: Region[] = ['NA', 'EMEA', 'LATAM', 'APAC'];

function specColor(pct: number): string {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-600';
}

const PAGE_SIZE = 25;

export default function DeviceListPage() {
  const navigate = useNavigate();
  const { isEditor } = useAuth();

  const [devices, setDevices] = useState<DeviceWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({});

  const [partners, setPartners] = useState<PartnerWithStats[]>([]);
  const [tiers, setTiers] = useState<HardwareTier[]>([]);

  useEffect(() => {
    Promise.all([
      api.partners.listAll(),
      api.tiers.listAll(),
    ]).then(([p, t]) => {
      setPartners(p as PartnerWithStats[]);
      setTiers(t);
    });
  }, []);

  const fetchDevices = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = {
      page,
      pageSize: PAGE_SIZE,
    };
    if (search) params.search = search;
    if (filters.partner) params.partnerId = filters.partner as string;
    if (filters.region) params.region = filters.region as string;
    if (filters.deviceType) params.deviceType = filters.deviceType as string;
    if (filters.certificationStatus) params.certificationStatus = filters.certificationStatus as string;
    if (filters.tier) params.tierId = filters.tier as string;
    if (filters.specStatus === 'has_specs') params.specCompleteness = 'has_specs';
    if (filters.specStatus === 'missing_specs') params.specCompleteness = 'missing_specs';

    api.devices.list(params)
      .then((res) => {
        setDevices(res.data);
        setTotal(res.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, search, filters]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  const filterGroups: FilterGroup[] = [
    {
      key: 'partner',
      label: 'Partner',
      type: 'select',
      options: partners.map((p) => ({ value: p.id, label: p.displayName })),
    },
    {
      key: 'region',
      label: 'Region',
      type: 'select',
      options: REGIONS.map((r) => ({ value: r, label: r })),
    },
    {
      key: 'deviceType',
      label: 'Device Type',
      type: 'select',
      options: DEVICE_TYPES.map((t) => ({ value: t, label: t })),
    },
    {
      key: 'certificationStatus',
      label: 'Certification',
      type: 'select',
      options: CERT_STATUSES.map((s) => ({ value: s, label: s })),
    },
    {
      key: 'tier',
      label: 'Tier',
      type: 'select',
      options: tiers.map((t) => ({ value: t.id, label: t.tierName })),
    },
    {
      key: 'specStatus',
      label: 'Spec Status',
      type: 'select',
      options: [
        { value: 'has_specs', label: 'Has Specs' },
        { value: 'missing_specs', label: 'Missing Specs' },
      ],
    },
  ];

  const columns: Column<DeviceWithRelations>[] = [
    { header: 'Device Name', accessor: 'displayName', sortable: true },
    {
      header: 'Device ID',
      accessor: 'deviceId',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-gray-500">{row.deviceId}</span>
      ),
    },
    { header: 'Partner', accessor: 'partnerName', sortable: true },
    {
      header: 'Region',
      accessor: 'region',
      render: (row) => {
        const pk = row.partnerKeyName;
        return pk || '—';
      },
    },
    { header: 'ADK Version', accessor: 'liveAdkVersion' },
    {
      header: 'SoC / Chipset',
      accessor: 'chipset',
      render: (row) =>
        row.chipset ? (
          <span className="text-sm text-gray-700">{row.chipset}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      header: 'Tier',
      accessor: 'tierName',
      sortable: true,
      render: (row) =>
        row.tierName ? <Badge variant="info">{row.tierName}</Badge> : '—',
    },
    {
      header: 'Active Devices',
      accessor: 'activeDeviceCount',
      sortable: true,
      render: (row) => (row.activeDeviceCount ?? 0).toLocaleString(),
    },
    {
      header: 'Spec %',
      accessor: 'specCompleteness',
      sortable: true,
      render: (row) => (
        <span className={`font-medium ${specColor(row.specCompleteness)}`}>
          {row.specCompleteness}%
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Device Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total.toLocaleString()} device{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const headers = ['Device Name', 'Device ID', 'Partner', 'ADK Version', 'SoC / Chipset', 'Tier', 'Active Devices', 'Spec %'];
              const rows = devices.map((d) => [
                d.displayName,
                d.deviceId,
                d.partnerName ?? '',
                d.liveAdkVersion ?? '',
                d.chipset ?? '',
                d.tierName ?? '',
                String(d.activeDeviceCount),
                `${d.specCompleteness}%`,
              ]);
              exportToCsv('device-catalog', headers, rows);
              trackEvent('export', { type: 'devices', format: 'csv' });
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {isEditor && (
            <button
              onClick={() => navigate('/devices/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Register Device
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by device name or device ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <FilterPanel groups={filterGroups} values={filters} onChange={setFilters} />

      {loading && page === 1 ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns}
          data={devices}
          loading={loading && page > 1}
          onRowClick={(row) => navigate(`/devices/${row.id}`)}
          emptyTitle="No devices found"
          emptyDescription="Try adjusting your search or filters."
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  );
}
