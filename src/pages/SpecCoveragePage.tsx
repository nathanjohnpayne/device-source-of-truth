import { useState, useEffect, useMemo } from 'react';
import { BarChart3, CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { api } from '../lib/api';
import DataTable, { type Column } from '../components/shared/DataTable';
import Badge from '../components/shared/Badge';
import FilterPanel, { type FilterGroup, type FilterValues } from '../components/shared/FilterPanel';
import LoadingSpinner from '../components/shared/LoadingSpinner';

interface SpecCoverageDevice {
  id: string;
  displayName: string;
  partnerName: string;
  activeDeviceCount: number;
  specCompleteness: number;
  questionnaireStatus: 'linked' | 'received' | 'none';
  region: string;
}

interface SpecCoverageResponse {
  summary: {
    totalDevices: number;
    fullSpecs: number;
    partialSpecs: number;
    noSpecs: number;
    weightedCoverage: number;
  };
  devices: SpecCoverageDevice[];
}

const QUESTIONNAIRE_BADGES: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  linked: { label: 'Linked', variant: 'success' },
  received: { label: 'Received — Not Entered', variant: 'warning' },
  none: { label: 'Missing', variant: 'danger' },
};

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${color}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
}

function CompletenessBar({ pct }: { pct: number }) {
  const color =
    pct === 100
      ? 'bg-emerald-500'
      : pct >= 75
        ? 'bg-blue-500'
        : pct >= 25
          ? 'bg-amber-500'
          : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600">{pct}%</span>
    </div>
  );
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'partner',
    label: 'Partner',
    type: 'select',
    options: [],
  },
  {
    key: 'region',
    label: 'Region',
    type: 'select',
    options: [
      { value: 'NA', label: 'NA' },
      { value: 'EMEA', label: 'EMEA' },
      { value: 'LATAM', label: 'LATAM' },
      { value: 'APAC', label: 'APAC' },
    ],
  },
  {
    key: 'specStatus',
    label: 'Spec Status',
    type: 'select',
    options: [
      { value: 'full', label: 'Full' },
      { value: 'partial', label: 'Partial' },
      { value: 'none', label: 'None' },
    ],
  },
  {
    key: 'questionnaireStatus',
    label: 'Questionnaire',
    type: 'select',
    options: [
      { value: 'linked', label: 'Linked' },
      { value: 'received', label: 'Received — Not Entered' },
      { value: 'none', label: 'Missing' },
    ],
  },
];

export default function SpecCoveragePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SpecCoverageResponse | null>(null);
  const [filters, setFilters] = useState<FilterValues>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await api.reports.specCoverage() as SpecCoverageResponse;
        setData(res);
      } catch {
        setError('Failed to load spec coverage data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filterGroups = useMemo(() => {
    if (!data) return FILTER_GROUPS;
    const partners = [...new Set(data.devices.map((d) => d.partnerName))].sort();
    return FILTER_GROUPS.map((g) =>
      g.key === 'partner'
        ? { ...g, options: partners.map((p) => ({ value: p, label: p })) }
        : g,
    );
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.devices.filter((d) => {
      if (filters.partner && d.partnerName !== filters.partner) return false;
      if (filters.region && d.region !== filters.region) return false;
      if (filters.specStatus) {
        const status =
          d.specCompleteness === 100 ? 'full' : d.specCompleteness > 0 ? 'partial' : 'none';
        if (status !== filters.specStatus) return false;
      }
      if (filters.questionnaireStatus && d.questionnaireStatus !== filters.questionnaireStatus)
        return false;
      return true;
    });
  }, [data, filters]);

  const columns: Column<SpecCoverageDevice>[] = [
    { header: 'Device Name', accessor: 'displayName', sortable: true },
    { header: 'Partner', accessor: 'partnerName', sortable: true },
    {
      header: 'Active Devices',
      accessor: 'activeDeviceCount',
      sortable: true,
      render: (row) => (row.activeDeviceCount ?? 0).toLocaleString(),
    },
    {
      header: 'Spec Completeness',
      accessor: 'specCompleteness',
      sortable: true,
      render: (row) => <CompletenessBar pct={row.specCompleteness} />,
    },
    {
      header: 'Questionnaire',
      accessor: 'questionnaireStatus',
      sortable: true,
      render: (row) => {
        const badge = QUESTIONNAIRE_BADGES[row.questionnaireStatus];
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
    { header: 'Region', accessor: 'region', sortable: true },
  ];

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const summary = data?.summary ?? {
    totalDevices: 0,
    fullSpecs: 0,
    partialSpecs: 0,
    noSpecs: 0,
    weightedCoverage: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Spec Coverage</h1>
        <p className="mt-1 text-sm text-gray-500">
          Device specification completeness across the fleet
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          icon={<BarChart3 className="h-5 w-5 text-indigo-600" />}
          label="Total Devices"
          value={summary.totalDevices}
          color="bg-indigo-50"
        />
        <SummaryCard
          icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
          label="Full Specs"
          value={summary.fullSpecs}
          color="bg-emerald-50"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          label="Partial Specs"
          value={summary.partialSpecs}
          color="bg-amber-50"
        />
        <SummaryCard
          icon={<XCircle className="h-5 w-5 text-red-600" />}
          label="No Specs"
          value={summary.noSpecs}
          color="bg-red-50"
        />
        <SummaryCard
          icon={<Activity className="h-5 w-5 text-blue-600" />}
          label="Weighted Coverage"
          value={`${summary.weightedCoverage}%`}
          color="bg-blue-50"
        />
      </div>

      <FilterPanel groups={filterGroups} values={filters} onChange={setFilters} />

      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle="No devices match your filters"
        emptyDescription="Try adjusting or clearing the filters above."
      />
    </div>
  );
}
