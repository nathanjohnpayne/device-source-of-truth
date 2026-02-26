import { useState, useCallback } from 'react';
import { Play, RotateCcw, Download, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import DataTable, { type Column } from '../components/shared/DataTable';
import Badge from '../components/shared/Badge';
import type { DeviceWithRelations } from '../lib/types';

const CODEC_OPTIONS = [
  'AVC',
  'HEVC',
  'E-AC-3',
  'Atmos',
  'HDR10',
  'Dolby Vision',
  'Widevine L1',
  'PlayReady SL3000',
];

interface SimRequirements {
  ramMin: string;
  gpuMin: string;
  cpuSpeedMin: string;
  cpuCoresMin: string;
  requiredCodecs: string[];
  require64Bit: boolean;
}

interface IneligibleDevice extends DeviceWithRelations {
  shortfalls: string[];
}

interface SimulationResult {
  eligible: DeviceWithRelations[];
  ineligible: IneligibleDevice[];
  totalDevices: number;
  totalActiveDevices: number;
}

const emptyRequirements = (): SimRequirements => ({
  ramMin: '',
  gpuMin: '',
  cpuSpeedMin: '',
  cpuCoresMin: '',
  requiredCodecs: [],
  require64Bit: false,
});

function exportCsv(eligible: DeviceWithRelations[], ineligible: IneligibleDevice[]) {
  const header = 'Status,Device Name,Partner,Active Devices,Shortfalls\n';
  const rows = [
    ...eligible.map(
      (d) =>
        `Eligible,"${d.displayName}","${d.partnerName ?? ''}",${d.activeDeviceCount},`,
    ),
    ...ineligible.map(
      (d) =>
        `Ineligible,"${d.displayName}","${d.partnerName ?? ''}",${d.activeDeviceCount},"${d.shortfalls.join('; ')}"`,
    ),
  ];
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `simulation-results-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SimulatorPage() {
  const [requirements, setRequirements] = useState<SimRequirements>(emptyRequirements());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);

    try {
      const params: Record<string, unknown> = {};
      if (requirements.ramMin) params.ramMin = parseInt(requirements.ramMin);
      if (requirements.gpuMin) params.gpuMin = parseInt(requirements.gpuMin);
      if (requirements.cpuSpeedMin) params.cpuSpeedMin = parseInt(requirements.cpuSpeedMin);
      if (requirements.cpuCoresMin) params.cpuCoresMin = parseInt(requirements.cpuCoresMin);
      if (requirements.requiredCodecs.length) params.requiredCodecs = requirements.requiredCodecs;
      if (requirements.require64Bit) params.require64Bit = true;

      const res = await api.tiers.simulate(params);
      const simResult = res as unknown as SimulationResult;

      if (!simResult.eligible) {
        const devicesRes = await api.devices.list({ pageSize: 9999 });
        const allDevices = devicesRes.data;
        setResult({
          eligible: allDevices,
          ineligible: [],
          totalDevices: allDevices.length,
          totalActiveDevices: allDevices.reduce((s, d) => s + d.activeDeviceCount, 0),
        });
      } else {
        setResult(simResult);
      }

      trackEvent('simulator_run', { result_tier: (res as { tier?: string }).tier ?? 'custom' });
    } catch {
      setError('Simulation failed. Please try again.');
    } finally {
      setRunning(false);
    }
  }, [requirements]);

  const handleReset = () => {
    setRequirements(emptyRequirements());
    setResult(null);
    setError(null);
  };

  const toggleCodec = (codec: string) => {
    setRequirements((prev) => ({
      ...prev,
      requiredCodecs: prev.requiredCodecs.includes(codec)
        ? prev.requiredCodecs.filter((c) => c !== codec)
        : [...prev.requiredCodecs, codec],
    }));
  };

  const eligibleColumns: Column<DeviceWithRelations>[] = [
    { header: 'Device Name', accessor: 'displayName', sortable: true },
    { header: 'Partner', accessor: 'partnerName', sortable: true },
    {
      header: 'Active Devices',
      accessor: 'activeDeviceCount',
      sortable: true,
      render: (row) => row.activeDeviceCount.toLocaleString(),
    },
  ];

  const ineligibleColumns: Column<IneligibleDevice>[] = [
    { header: 'Device Name', accessor: 'displayName', sortable: true },
    { header: 'Partner', accessor: 'partnerName', sortable: true },
    {
      header: 'Active Devices',
      accessor: 'activeDeviceCount',
      sortable: true,
      render: (row) => row.activeDeviceCount.toLocaleString(),
    },
    {
      header: 'Shortfall',
      accessor: 'shortfalls',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.shortfalls ?? []).map((s, i) => (
            <Badge key={i} variant="danger">
              {s}
            </Badge>
          ))}
        </div>
      ),
    },
  ];

  const totalActive = result
    ? result.totalActiveDevices ||
      result.eligible.reduce((s, d) => s + d.activeDeviceCount, 0) +
        result.ineligible.reduce((s, d) => s + d.activeDeviceCount, 0)
    : 0;
  const eligibleCount = result?.eligible.length ?? 0;
  const ineligibleCount = result?.ineligible.length ?? 0;
  const totalDevices = eligibleCount + ineligibleCount;
  const eligiblePct = totalDevices ? Math.round((eligibleCount / totalDevices) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feature Eligibility Simulator</h1>
        <p className="mt-1 text-sm text-gray-500">
          Define minimum hardware requirements and see which devices qualify
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          Minimum Requirements
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">RAM (MB)</label>
            <input
              type="number"
              value={requirements.ramMin}
              min={0}
              onChange={(e) =>
                setRequirements((r) => ({ ...r, ramMin: e.target.value }))
              }
              placeholder="e.g. 1024"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">GPU Memory (MB)</label>
            <input
              type="number"
              value={requirements.gpuMin}
              min={0}
              onChange={(e) =>
                setRequirements((r) => ({ ...r, gpuMin: e.target.value }))
              }
              placeholder="e.g. 512"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              CPU Speed (MHz)
            </label>
            <input
              type="number"
              value={requirements.cpuSpeedMin}
              min={0}
              onChange={(e) =>
                setRequirements((r) => ({ ...r, cpuSpeedMin: e.target.value }))
              }
              placeholder="e.g. 1500"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">CPU Cores</label>
            <input
              type="number"
              value={requirements.cpuCoresMin}
              min={0}
              step={1}
              onChange={(e) =>
                setRequirements((r) => ({ ...r, cpuCoresMin: e.target.value }))
              }
              placeholder="e.g. 4"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-xs font-medium text-gray-600">
            Codec Requirements
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CODEC_OPTIONS.map((codec) => (
              <label key={codec} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={requirements.requiredCodecs.includes(codec)}
                  onChange={() => toggleCodec(codec)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {codec}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={requirements.require64Bit}
              onChange={(e) =>
                setRequirements((r) => ({ ...r, require64Bit: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            64-bit Required
          </label>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {running ? 'Running…' : 'Run Simulation'}
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Eligible</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {eligibleCount.toLocaleString()}{' '}
                    <span className="text-sm font-normal text-gray-400">
                      ({eligiblePct}%)
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-50 p-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ineligible</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {ineligibleCount.toLocaleString()}{' '}
                    <span className="text-sm font-normal text-gray-400">
                      ({totalDevices ? 100 - eligiblePct : 0}%)
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <Play className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Active</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {totalActive.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => exportCsv(result.eligible, result.ineligible)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export Results
            </button>
          </div>

          {result.eligible.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                Eligible Devices ({eligibleCount.toLocaleString()})
              </h2>
              <DataTable
                columns={eligibleColumns}
                data={result.eligible}
                emptyTitle="No eligible devices"
              />
            </div>
          )}

          {result.ineligible.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                Ineligible Devices ({ineligibleCount.toLocaleString()})
              </h2>
              <DataTable
                columns={ineligibleColumns}
                data={result.ineligible}
                emptyTitle="No ineligible devices"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
