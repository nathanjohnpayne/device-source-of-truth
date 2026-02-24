import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDevices } from '../lib/hooks';
import { logEvent } from '../lib/firebase';
import { ScoreBadge } from '../components/devices/ScoreBadge';
import { SearchBar } from '../components/filters/SearchBar';
import { ArrowLeft, Plus, X as XIcon, Check, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Device } from '../lib/types';

function BoolCell({ value }: { value: boolean }) {
  return value
    ? <Check size={14} className="text-green-600 mx-auto" />
    : <X size={14} className="text-slate-300 mx-auto" />;
}

interface SpecCompareRowProps {
  label: string;
  values: (string | number | React.ReactNode | null)[];
  highlight?: boolean;
}

function SpecCompareRow({ label, values, highlight }: SpecCompareRowProps) {
  const allSame = values.every(v => String(v) === String(values[0]));
  return (
    <tr className={`border-b border-slate-50 ${highlight && !allSame ? 'bg-amber-50' : ''}`}>
      <td className="py-2 px-3 text-sm text-slate-500 font-medium w-48">{label}</td>
      {values.map((val, i) => (
        <td key={i} className="py-2 px-3 text-sm text-slate-800 text-center">
          {val ?? <span className="text-slate-300">N/A</span>}
        </td>
      ))}
    </tr>
  );
}

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { devices, loading } = useDevices();
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const selectedIds = useMemo(() => {
    const ids = searchParams.get('ids');
    return ids ? ids.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const selectedDevices = useMemo(() => {
    return selectedIds.map(id => devices.find(d => d.id === id)).filter(Boolean) as Device[];
  }, [selectedIds, devices]);

  const searchResults = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return devices
      .filter(d => !selectedIds.includes(d.id))
      .filter(d =>
        d.modelName.toLowerCase().includes(q) ||
        d.operator.toLowerCase().includes(q) ||
        d.manufacturer.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [search, devices, selectedIds]);

  function addDevice(id: string) {
    if (selectedIds.length >= 4) return;
    const newIds = [...selectedIds, id];
    setSearchParams({ ids: newIds.join(',') });
    setSearch('');
    setShowPicker(false);
  }

  function removeDevice(id: string) {
    const newIds = selectedIds.filter(x => x !== id);
    setSearchParams(newIds.length > 0 ? { ids: newIds.join(',') } : {});
  }

  useEffect(() => {
    if (selectedDevices.length >= 2) {
      logEvent('compare_devices', { count: selectedDevices.length, ids: selectedIds.join(',') });
    }
  }, [selectedDevices.length]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-slate-400">Loading...</p></div>;
  }

  const scoreChartData = selectedDevices.map(d => ({
    name: d.modelName.substring(0, 15),
    Hardware: d.scoreBreakdown.hardware,
    Codec: d.scoreBreakdown.codec,
    DRM: d.scoreBreakdown.drm,
    Display: d.scoreBreakdown.display,
    Security: d.scoreBreakdown.security,
  }));

  return (
    <div className="p-8 max-w-6xl">
      <Link to="/devices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Back to devices
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Compare Devices</h1>

      {/* Device selector */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {selectedDevices.map(device => (
          <div key={device.id} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg">
            <ScoreBadge score={device.deviceScore} size="sm" />
            <div>
              <p className="text-sm font-medium text-slate-700">{device.modelName}</p>
              <p className="text-xs text-slate-400">{device.operator}</p>
            </div>
            <button onClick={() => removeDevice(device.id)} className="ml-2 text-slate-400 hover:text-red-500">
              <XIcon size={14} />
            </button>
          </div>
        ))}

        {selectedIds.length < 4 && (
          <div className="relative">
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="flex items-center gap-1 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors"
            >
              <Plus size={14} /> Add device
            </button>

            {showPicker && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-10 p-3">
                <SearchBar value={search} onChange={setSearch} placeholder="Search by name or operator..." />
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-60 overflow-auto">
                    {searchResults.map(d => (
                      <button
                        key={d.id}
                        onClick={() => addDevice(d.id)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded text-left"
                      >
                        <div>
                          <p className="text-sm text-slate-700">{d.modelName}</p>
                          <p className="text-xs text-slate-400">{d.operator}</p>
                        </div>
                        <ScoreBadge score={d.deviceScore} size="sm" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedDevices.length < 2 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          Select at least 2 devices to compare. Use the search above to add devices.
        </div>
      )}

      {selectedDevices.length >= 2 && (
        <>
          {/* Score comparison chart */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Score Comparison</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Hardware" stackId="score" fill="#3b82f6" />
                <Bar dataKey="Codec" stackId="score" fill="#8b5cf6" />
                <Bar dataKey="DRM" stackId="score" fill="#06b6d4" />
                <Bar dataKey="Display" stackId="score" fill="#f59e0b" />
                <Bar dataKey="Security" stackId="score" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase w-48">Spec</th>
                    {selectedDevices.map(d => (
                      <th key={d.id} className="py-3 px-3 text-center">
                        <Link to={`/devices/${d.id}`} className="text-sm font-medium text-blue-600 hover:underline">{d.modelName}</Link>
                        <p className="text-xs text-slate-400 font-normal">{d.operator}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-slate-50"><td colSpan={selectedDevices.length + 1} className="py-2 px-3 text-xs font-bold text-slate-500 uppercase">Score</td></tr>
                  <SpecCompareRow label="Total Score" values={selectedDevices.map(d => d.deviceScore)} highlight />
                  <SpecCompareRow label="Hardware" values={selectedDevices.map(d => `${d.scoreBreakdown.hardware}/25`)} highlight />
                  <SpecCompareRow label="Codec" values={selectedDevices.map(d => `${d.scoreBreakdown.codec}/20`)} highlight />
                  <SpecCompareRow label="DRM" values={selectedDevices.map(d => `${d.scoreBreakdown.drm}/20`)} highlight />
                  <SpecCompareRow label="Display" values={selectedDevices.map(d => `${d.scoreBreakdown.display}/20`)} highlight />
                  <SpecCompareRow label="Security" values={selectedDevices.map(d => `${d.scoreBreakdown.security}/15`)} highlight />

                  <tr className="bg-slate-50"><td colSpan={selectedDevices.length + 1} className="py-2 px-3 text-xs font-bold text-slate-500 uppercase">General</td></tr>
                  <SpecCompareRow label="Type" values={selectedDevices.map(d => d.deviceType)} />
                  <SpecCompareRow label="Hardware OS" values={selectedDevices.map(d => d.hardwareOs)} highlight />
                  <SpecCompareRow label="Platform" values={selectedDevices.map(d => d.platform)} highlight />
                  <SpecCompareRow label="Manufacturer" values={selectedDevices.map(d => d.manufacturer)} />
                  <SpecCompareRow label="Deployment" values={selectedDevices.map(d => d.deploymentDate)} />
                  <SpecCompareRow label="Region" values={selectedDevices.map(d => d.region)} highlight />
                  <SpecCompareRow label="ADK Version" values={selectedDevices.map(d => d.liveAdkVersion)} />
                  <SpecCompareRow label="64-bit" values={selectedDevices.map(d => <BoolCell value={d.is64Bit} />)} highlight />
                  <SpecCompareRow label="Performance" values={selectedDevices.map(d => d.performanceCategory)} highlight />

                  <tr className="bg-slate-50"><td colSpan={selectedDevices.length + 1} className="py-2 px-3 text-xs font-bold text-slate-500 uppercase">Hardware</td></tr>
                  <SpecCompareRow label="SoC Vendor" values={selectedDevices.map(d => d.socVendor)} highlight />
                  <SpecCompareRow label="SoC Model" values={selectedDevices.map(d => d.socModel)} />
                  <SpecCompareRow label="CPU (DMIPS)" values={selectedDevices.map(d => d.cpuSpeedDmips?.toLocaleString() ?? null)} highlight />
                  <SpecCompareRow label="RAM" values={selectedDevices.map(d => d.memoryCapacityGb ? `${d.memoryCapacityGb} GB` : null)} highlight />
                  <SpecCompareRow label="RAM for D+" values={selectedDevices.map(d => d.ramForDisneyMb ? `${d.ramForDisneyMb} MB` : null)} highlight />
                  <SpecCompareRow label="Storage" values={selectedDevices.map(d => d.storageCapacityGb ? `${d.storageCapacityGb} GB` : null)} highlight />

                  <tr className="bg-slate-50"><td colSpan={selectedDevices.length + 1} className="py-2 px-3 text-xs font-bold text-slate-500 uppercase">Codecs & Display</td></tr>
                  <SpecCompareRow label="Resolution" values={selectedDevices.map(d => d.maxVideoResolution)} highlight />
                  <SpecCompareRow label="H.265" values={selectedDevices.map(d => <BoolCell value={d.supportsH265} />)} highlight />
                  <SpecCompareRow label="HDR10" values={selectedDevices.map(d => <BoolCell value={d.supportsHDR10} />)} highlight />
                  <SpecCompareRow label="Dolby Vision" values={selectedDevices.map(d => <BoolCell value={d.supportsDolbyVision} />)} highlight />
                  <SpecCompareRow label="Dolby Atmos" values={selectedDevices.map(d => <BoolCell value={d.supportsDolbyAtmos} />)} highlight />
                  <SpecCompareRow label="HLG" values={selectedDevices.map(d => <BoolCell value={d.supportsHLG} />)} />
                  <SpecCompareRow label="HDR10+" values={selectedDevices.map(d => <BoolCell value={d.supportsHDR10Plus} />)} />

                  <tr className="bg-slate-50"><td colSpan={selectedDevices.length + 1} className="py-2 px-3 text-xs font-bold text-slate-500 uppercase">DRM & Security</td></tr>
                  <SpecCompareRow label="Widevine" values={selectedDevices.map(d => d.widevineSecurityLevel)} highlight />
                  <SpecCompareRow label="PlayReady" values={selectedDevices.map(d => d.playReadySecurityLevel)} highlight />
                  <SpecCompareRow label="HDCP" values={selectedDevices.map(d => d.hdcpVersion)} highlight />
                  <SpecCompareRow label="Secure Boot" values={selectedDevices.map(d => <BoolCell value={d.supportsSecureBoot} />)} />
                  <SpecCompareRow label="TEE" values={selectedDevices.map(d => <BoolCell value={d.supportsTEE} />)} />
                  <SpecCompareRow label="SVP" values={selectedDevices.map(d => <BoolCell value={d.supportsSecureVideoPath} />)} />
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
