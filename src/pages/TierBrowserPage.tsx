import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  ChevronDown,
  ChevronRight,
  Settings,
  Layers,
  Cpu,
  HardDrive,
  MonitorSmartphone,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import Badge from '../components/shared/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import { formatNumber } from '../lib/format';
import type { HardwareTier, DeviceWithRelations } from '../lib/types';

const CODEC_OPTIONS = [
  { value: 'avc', label: 'AVC (H.264)' },
  { value: 'hevc', label: 'HEVC (H.265)' },
  { value: 'av1', label: 'AV1' },
  { value: 'vp9', label: 'VP9' },
  { value: 'eac3', label: 'E-AC-3' },
  { value: 'ac4', label: 'AC-4' },
  { value: 'dolbyAtmos', label: 'Dolby Atmos' },
  { value: 'aac', label: 'AAC' },
  { value: 'opus', label: 'Opus' },
];

const CODEC_LABEL_MAP: Record<string, string> = Object.fromEntries(
  CODEC_OPTIONS.map((c) => [c.value, c.label]),
);

const TIER_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#64748b',
];

interface TierWithDevices extends HardwareTier {
  devices: DeviceWithRelations[];
  activeDeviceCount: number;
}

function TierCard({
  tier,
  color,
  expanded,
  onToggle,
}: {
  tier: TierWithDevices;
  color: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-4 p-5 text-left hover:bg-gray-50"
      >
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: color }}
        >
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{tier.tierName}</h3>
            <Badge variant="info">Rank {tier.tierRank}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {tier.ramMin != null && (
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" /> RAM ≥ {tier.ramMin.toLocaleString()} MB
              </span>
            )}
            {tier.gpuMin != null && (
              <span className="flex items-center gap-1">
                <MonitorSmartphone className="h-3 w-3" /> GPU ≥ {tier.gpuMin.toLocaleString()} MB
              </span>
            )}
            {tier.cpuSpeedMin != null && (
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3" /> CPU ≥ {tier.cpuSpeedMin.toLocaleString()} MHz
              </span>
            )}
            {tier.cpuCoresMin != null && (
              <span>Cores ≥ {tier.cpuCoresMin}</span>
            )}
            {tier.require64Bit && <span>64-bit required</span>}
          </div>
          {tier.requiredCodecs.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tier.requiredCodecs.map((c) => (
                <span
                  key={c}
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                >
                  {CODEC_LABEL_MAP[c] ?? c}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-4 text-xs">
            <span className="font-medium text-gray-700">
              {tier.devices.length.toLocaleString()} devices
            </span>
            <span className="text-gray-500">
              {(tier.activeDeviceCount ?? 0).toLocaleString()} active
            </span>
          </div>
        </div>
        <div className="mt-1 text-gray-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {expanded && tier.devices.length > 0 && (
        <div className="border-t border-gray-100">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Device</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Partner</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Active</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">RAM</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">GPU</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SoC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tier.devices.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{d.displayName}</td>
                  <td className="px-4 py-2 text-gray-600">{d.partnerName ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-600">
                    {(d.activeDeviceCount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">—</td>
                  <td className="px-4 py-2 text-right text-gray-600">—</td>
                  <td className="px-4 py-2 text-gray-600">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TierQualifier() {
  const [open, setOpen] = useState(false);
  const [ram, setRam] = useState('');
  const [gpu, setGpu] = useState('');
  const [cpuSpeed, setCpuSpeed] = useState('');
  const [cpuCores, setCpuCores] = useState('');
  const [codecs, setCodecs] = useState<Record<string, boolean>>({
    avc: false,
    hevc: false,
    av1: false,
    vp9: false,
    eac3: false,
    ac4: false,
    dolbyAtmos: false,
    aac: false,
    opus: false,
  });
  const [result, setResult] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const requirements: Record<string, unknown> = {};
      if (ram) requirements.ramMin = parseInt(ram);
      if (gpu) requirements.gpuMin = parseInt(gpu);
      if (cpuSpeed) requirements.cpuSpeedMin = parseInt(cpuSpeed);
      if (cpuCores) requirements.cpuCoresMin = parseInt(cpuCores);
      const selectedCodecs = Object.entries(codecs)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (selectedCodecs.length) requirements.requiredCodecs = selectedCodecs;

      const res = await api.tiers.simulate(requirements);
      setResult(res.eligibleCount > 0 ? `${res.eligibleCount} eligible devices` : 'No eligible devices');
    } catch {
      setResult('Unable to determine tier');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-5 py-4 text-left hover:bg-gray-50"
      >
        <Search className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-900">
          What tier does a device meet?
        </span>
        {open ? (
          <ChevronDown className="ml-auto h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">RAM (MB)</label>
              <input
                type="number"
                value={ram}
                onChange={(e) => setRam(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">GPU (MB)</label>
              <input
                type="number"
                value={gpu}
                onChange={(e) => setGpu(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">CPU Speed (MHz)</label>
              <input
                type="number"
                value={cpuSpeed}
                onChange={(e) => setCpuSpeed(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">CPU Cores</label>
              <input
                type="number"
                value={cpuCores}
                onChange={(e) => setCpuCores(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-xs font-medium text-gray-600">Codecs</label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {CODEC_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={codecs[value] ?? false}
                    onChange={(e) =>
                      setCodecs((prev) => ({ ...prev, [value]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleCheck}
              disabled={checking}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {checking ? 'Checking…' : 'Check Tier'}
            </button>
            {result && (
              <p className="text-sm text-gray-700">
                Qualifies for: <span className="font-semibold text-indigo-700">{result}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TierBrowserPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tiers, setTiers] = useState<TierWithDevices[]>([]);
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [tiersRes, devicesRes] = await Promise.all([
          api.tiers.listAll(),
          api.devices.listAll(),
        ]);

        const devicesByTier = new Map<string, DeviceWithRelations[]>();
        for (const d of devicesRes) {
          const key = d.tierId ?? '__uncategorized';
          if (!devicesByTier.has(key)) devicesByTier.set(key, []);
          devicesByTier.get(key)!.push(d);
        }

        const enriched: TierWithDevices[] = tiersRes
          .sort((a, b) => a.tierRank - b.tierRank)
          .map((t) => {
            const devices = devicesByTier.get(t.id) ?? [];
            return {
              ...t,
              devices,
              activeDeviceCount: devices.reduce((s, d) => s + d.activeDeviceCount, 0),
            };
          });

        const uncatDevices = devicesByTier.get('__uncategorized') ?? [];
        if (uncatDevices.length > 0) {
          enriched.push({
            id: '__uncategorized',
            tierName: 'Uncategorized',
            tierRank: 9999,
            ramMin: null,
            gpuMin: null,
            cpuSpeedMin: null,
            cpuCoresMin: null,
            requiredCodecs: [],
            require64Bit: false,
            version: 0,
            createdAt: '',
            updatedAt: '',
            devices: uncatDevices,
            activeDeviceCount: uncatDevices.reduce((s, d) => s + d.activeDeviceCount, 0),
          });
        }

        setTiers(enriched);
      } catch {
        setError('Failed to load tier data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const chartData = useMemo(() => {
    const totalActive = tiers.reduce((s, t) => s + t.activeDeviceCount, 0);
    if (!totalActive) return [];
    return tiers
      .filter((t) => t.activeDeviceCount > 0)
      .map((t) => ({
        name: t.tierName,
        value: t.activeDeviceCount,
        pct: Math.round((t.activeDeviceCount / totalActive) * 100),
      }));
  }, [tiers]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!tiers.length) {
    return (
      <EmptyState
        icon={<Layers className="h-12 w-12" />}
        title="No tiers defined"
        description="Create hardware tiers to categorize devices by capability."
        action={
          isAdmin ? (
            <Link
              to="/tiers/configure"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Configure Tiers
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hardware Tiers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Device capability tiers and distribution
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/tiers/configure"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Settings className="h-4 w-4" />
            Configure Tiers
          </Link>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            Active Device Distribution
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  label={(props: { payload?: { name: string; pct: number } }) =>
                    props.payload ? `${props.payload.name} (${props.payload.pct}%)` : ''
                  }
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={TIER_COLORS[i % TIER_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), 'Active']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(() => {
        const uncatTier = tiers.find((t) => t.id === '__uncategorized');
        if (!uncatTier || uncatTier.devices.length === 0) return null;
        const topUncat = [...uncatTier.devices]
          .sort((a, b) => b.activeDeviceCount - a.activeDeviceCount)
          .slice(0, 10);
        return (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-amber-900">
                Devices Missing Tier Classification
              </h2>
              <span className="text-xs text-amber-700">
                {uncatTier.devices.length} device{uncatTier.devices.length !== 1 ? 's' : ''} unclassified
              </span>
            </div>
            <div className="space-y-1.5">
              {topUncat.map((d) => (
                <Link
                  key={d.id}
                  to={`/devices/${d.id}`}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-amber-100"
                >
                  <span className="font-medium text-gray-900">{d.displayName}</span>
                  <span className="text-xs text-gray-500">
                    {formatNumber(d.activeDeviceCount)} active devices
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 gap-4">
        {tiers.map((tier, i) => (
          <TierCard
            key={tier.id}
            tier={tier}
            color={TIER_COLORS[i % TIER_COLORS.length]}
            expanded={expandedTier === tier.id}
            onToggle={() =>
              setExpandedTier((prev) => (prev === tier.id ? null : tier.id))
            }
          />
        ))}
      </div>

      <TierQualifier />
    </div>
  );
}
