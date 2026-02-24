import { useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useDevices } from '../lib/hooks';
import { logEvent } from '../lib/firebase';
import { getScoreTier, getScoreColor } from '../lib/types';
import type { Device } from '../lib/types';
import { ScoreBadge } from '../components/devices/ScoreBadge';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function CapabilityBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-600 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm text-slate-500 w-16 text-right">{pct}%</span>
    </div>
  );
}

const REGION_COLORS: Record<string, string> = {
  GLOBAL: '#3b82f6',
  LATAM: '#f59e0b',
  EMEA: '#8b5cf6',
  APAC: '#06b6d4',
  DOMESTIC: '#10b981',
};

export function DashboardPage() {
  const { devices, loading } = useDevices();

  useEffect(() => {
    logEvent('view_dashboard');
  }, []);

  const stats = useMemo(() => {
    if (devices.length === 0) return null;

    const avgScore = Math.round(devices.reduce((s, d) => s + d.deviceScore, 0) / devices.length);
    const operators = [...new Set(devices.map(d => d.operator))];
    const regions = [...new Set(devices.flatMap(d => d.countries))];

    const tierCounts = { excellent: 0, good: 0, adequate: 0, limited: 0, poor: 0 };
    for (const d of devices) {
      tierCounts[getScoreTier(d.deviceScore)]++;
    }

    const scoreData = [
      { name: 'Poor (0-19)', count: tierCounts.poor, color: '#dc2626' },
      { name: 'Limited (20-39)', count: tierCounts.limited, color: '#ea580c' },
      { name: 'Adequate (40-59)', count: tierCounts.adequate, color: '#ca8a04' },
      { name: 'Good (60-79)', count: tierCounts.good, color: '#2563eb' },
      { name: 'Excellent (80-100)', count: tierCounts.excellent, color: '#16a34a' },
    ];

    const caps = {
      '4K / UHD': devices.filter(d => d.maxVideoResolution?.includes('2160')).length,
      'H.265/HEVC': devices.filter(d => d.supportsH265).length,
      'HDR10': devices.filter(d => d.supportsHDR10).length,
      'Dolby Vision': devices.filter(d => d.supportsDolbyVision).length,
      'Dolby Atmos': devices.filter(d => d.supportsDolbyAtmos).length,
      'Widevine L1': devices.filter(d => d.widevineSecurityLevel?.toUpperCase().includes('L1')).length,
      'PlayReady SL3000': devices.filter(d => d.playReadySecurityLevel?.includes('3000')).length,
      'Secure Boot': devices.filter(d => d.supportsSecureBoot).length,
    };

    const byOperator = operators.map(op => ({
      name: op,
      count: devices.filter(d => d.operator === op).length,
      avgScore: Math.round(
        devices.filter(d => d.operator === op).reduce((s, d) => s + d.deviceScore, 0) /
        devices.filter(d => d.operator === op).length
      ),
    })).sort((a, b) => b.count - a.count);

    const topDevices = [...devices].sort((a, b) => b.deviceScore - a.deviceScore).slice(0, 5);

    // Region distribution
    const regionCounts: Record<string, number> = {};
    for (const d of devices) {
      const r = d.region || 'Unknown';
      regionCounts[r] = (regionCounts[r] || 0) + 1;
    }
    const regionData = Object.entries(regionCounts)
      .map(([name, value]) => ({ name, value, color: REGION_COLORS[name] || '#94a3b8' }))
      .sort((a, b) => b.value - a.value);

    // Hardware OS distribution
    const osCounts: Record<string, number> = {};
    for (const d of devices) {
      const os = d.hardwareOs || 'Unknown';
      osCounts[os] = (osCounts[os] || 0) + 1;
    }
    const osData = Object.entries(osCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { avgScore, operators, regions, scoreData, caps, byOperator, topDevices, regionData, osData };
  }, [devices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Loading dashboard...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <p className="text-slate-500">No device data found. Run the import script first.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Devices" value={devices.length} />
        <StatCard label="Average Score" value={stats.avgScore} sub="out of 100" />
        <StatCard label="Operators" value={stats.operators.length} />
        <StatCard label="Countries" value={stats.regions.length} />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Score Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.scoreData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {stats.scoreData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Capability Coverage</h2>
          <div className="space-y-3">
            {Object.entries(stats.caps).map(([label, count]) => (
              <CapabilityBar key={label} label={label} count={count} total={devices.length} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Devices by Region</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie
                  data={stats.regionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={35}
                >
                  {stats.regionData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {stats.regionData.map(r => (
                <div key={r.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="text-sm text-slate-600">{r.name}</span>
                  <span className="text-xs text-slate-400">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Performance Categories</h2>
          <div className="space-y-3">
            {(() => {
              const perfCounts = { High: 0, Medium: 0, Low: 0, Unknown: 0 };
              for (const d of devices) {
                const cat = d.performanceCategory || 'Unknown';
                if (cat in perfCounts) perfCounts[cat as keyof typeof perfCounts]++;
              }
              return Object.entries(perfCounts).map(([label, count]) => (
                <CapabilityBar key={label} label={label} count={count} total={devices.length} />
              ));
            })()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Devices by Hardware OS</h2>
          <div className="space-y-3">
            {stats.osData.map(os => (
              <CapabilityBar key={os.name} label={os.name} count={os.count} total={devices.length} />
            ))}
          </div>
        </div>
        <div /> {/* Empty cell for alignment */}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Devices by Operator</h2>
          <div className="space-y-2">
            {stats.byOperator.slice(0, 10).map(op => (
              <div key={op.name} className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-600">{op.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{op.count} devices</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
                    backgroundColor: getScoreColor(op.avgScore) + '15',
                    color: getScoreColor(op.avgScore),
                  }}>
                    avg {op.avgScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Top Rated Devices</h2>
          <div className="space-y-3">
            {stats.topDevices.map((device: Device) => (
              <Link
                key={device.id}
                to={`/devices/${device.id}`}
                className="flex items-center justify-between py-1 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">{device.modelName}</p>
                  <p className="text-xs text-slate-400">{device.operator}</p>
                </div>
                <ScoreBadge score={device.deviceScore} size="sm" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
