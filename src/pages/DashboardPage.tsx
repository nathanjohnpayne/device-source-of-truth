import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Cpu, BarChart3, Shield, Bell } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import Badge from '../components/shared/Badge';
import FreshnessBadge from '../components/shared/FreshnessBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';

interface DashboardData {
  totalActiveDevices: number;
  totalDevices: number;
  lastTelemetryAt: string | null;
  specCoverageWeighted: number;
  certifiedCount: number;
  pendingCount: number;
  uncertifiedCount: number;
  openAlertCount: number;
  top20Devices: {
    id: string;
    displayName: string;
    partnerName: string;
    activeDeviceCount: number;
    tierName: string | null;
  }[];
  adkVersions: { version: string; count: number }[];
  regionBreakdown: {
    region: string;
    activeDevices: number;
    deviceCount: number;
  }[];
}

const REGION_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  NA: { border: 'border-l-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  EMEA: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  LATAM: { border: 'border-l-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' },
  APAC: { border: 'border-l-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' },
};

function KpiCard({
  icon,
  label,
  value,
  sub,
  badge,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  badge?: { text: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' };
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-gray-50 p-2 text-gray-500">{icon}</div>
        {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="mt-0.5 text-sm text-gray-500">{label}</p>
        {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

function specCoverageVariant(pct: number): 'success' | 'warning' | 'danger' {
  if (pct >= 80) return 'success';
  if (pct >= 50) return 'warning';
  return 'danger';
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll20, setShowAll20] = useState(false);

  useEffect(() => {
    trackEvent('report_view', { report_type: 'dashboard' });
    api.reports
      .dashboard()
      .then((res) => {
        setData({
          totalActiveDevices: res.totalActiveDevices ?? 0,
          totalDevices: res.totalDevices ?? 0,
          lastTelemetryAt: res.lastTelemetryAt ?? null,
          specCoverageWeighted: res.specCoverageWeighted ?? 0,
          certifiedCount: res.certifiedCount ?? 0,
          pendingCount: res.pendingCount ?? 0,
          uncertifiedCount: res.uncertifiedCount ?? 0,
          openAlertCount: res.openAlertCount ?? 0,
          top20Devices: res.top20Devices ?? [],
          adkVersions: res.adkVersions ?? [],
          regionBreakdown: res.regionBreakdown ?? [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) {
    return (
      <div className="text-center text-sm text-gray-500 py-12">
        Unable to load dashboard data.
      </div>
    );
  }

  const displayedDevices = showAll20
    ? data.top20Devices
    : data.top20Devices?.slice(0, 10);

  const adkChartData = data.adkVersions?.slice(0, 10).map((v) => ({
    name: v.version,
    devices: v.count,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ecosystem Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Real-time summary of the Disney Streaming device ecosystem
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={<Monitor className="h-5 w-5" />}
          label="Total Active Devices"
          value={data.totalActiveDevices ?? 0}
        >
          <FreshnessBadge lastTelemetryAt={data.lastTelemetryAt} />
        </KpiCard>
        <KpiCard
          icon={<Cpu className="h-5 w-5" />}
          label="Total Devices in Registry"
          value={data.totalDevices ?? 0}
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Spec Coverage (weighted)"
          value={`${data.specCoverageWeighted ?? 0}%`}
          badge={{
            text: `${data.specCoverageWeighted ?? 0}%`,
            variant: specCoverageVariant(data.specCoverageWeighted ?? 0),
          }}
        />
        <KpiCard
          icon={<Shield className="h-5 w-5" />}
          label="Certification Status"
          value={data.certifiedCount ?? 0}
          sub={`${data.pendingCount ?? 0} pending · ${data.uncertifiedCount ?? 0} uncertified`}
        />
        <KpiCard
          icon={<Bell className="h-5 w-5" />}
          label="Unregistered Alerts"
          value={data.openAlertCount ?? 0}
          badge={
            (data.openAlertCount ?? 0) > 0
              ? { text: `${data.openAlertCount} open`, variant: 'danger' }
              : undefined
          }
        />
      </div>

      {data.top20Devices && data.top20Devices.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Top 20 Devices by Active Count
            </h2>
            {data.top20Devices.length > 10 && (
              <button
                onClick={() => setShowAll20(!showAll20)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                {showAll20 ? 'Show top 10' : 'Show all 20'}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Device Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Partner
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Active Devices
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Tier
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedDevices?.map((d, i) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {i + 1}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <Link
                        to={`/devices/${d.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        {d.displayName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {d.partnerName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {(d.activeDeviceCount ?? 0).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {d.tierName ? (
                        <Badge variant="info">{d.tierName}</Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adkChartData && adkChartData.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            ADK Version Adoption
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={adkChartData}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={70}
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [Number(value).toLocaleString(), 'Devices']}
                />
                <Bar dataKey="devices" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.regionBreakdown && data.regionBreakdown.length > 0 && (
        <div>
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Region Breakdown
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.regionBreakdown.map((r) => {
              const colors = REGION_COLORS[r.region] ?? REGION_COLORS.NA;
              return (
                <div
                  key={r.region}
                  className={`rounded-lg border border-gray-200 border-l-4 ${colors.border} bg-white p-5`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}
                    >
                      {r.region}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-xl font-bold text-gray-900">
                      {(r.activeDevices ?? 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">active devices</p>
                    <p className="text-xs text-gray-400">
                      {(r.deviceCount ?? 0).toLocaleString()} devices registered
                    </p>
                    <FreshnessBadge lastTelemetryAt={data.lastTelemetryAt} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
