import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { Device } from '../../lib/types';

export interface Filters {
  operators: string[];
  deviceTypes: string[];
  platforms: string[];
  hardwareOs: string[];
  regions: string[];
  scoreMin: number;
  scoreMax: number;
  capabilities: string[];
}

export const defaultFilters: Filters = {
  operators: [],
  deviceTypes: [],
  platforms: [],
  hardwareOs: [],
  regions: [],
  scoreMin: 0,
  scoreMax: 100,
  capabilities: [],
};

interface FilterPanelProps {
  devices: Device[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const capabilityOptions = [
  { key: '4k', label: '4K/UHD' },
  { key: 'hdr10', label: 'HDR10' },
  { key: 'dolbyVision', label: 'Dolby Vision' },
  { key: 'dolbyAtmos', label: 'Dolby Atmos' },
  { key: 'h265', label: 'H.265' },
  { key: 'widevineL1', label: 'Widevine L1' },
];

export function FilterPanel({ devices, filters, onChange }: FilterPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const operators = [...new Set(devices.map(d => d.operator))].sort();
  const deviceTypes = [...new Set(devices.map(d => d.deviceType))].sort();
  const platforms = [...new Set(devices.map(d => d.platform))].sort();

  const regions = [...new Set(devices.map(d => d.region).filter(Boolean) as string[])].sort();

  const hardwareOsList = [...new Set(devices.map(d => d.hardwareOs).filter(Boolean) as string[])].sort();

  const hasActiveFilters = filters.operators.length > 0 || filters.deviceTypes.length > 0 ||
    filters.platforms.length > 0 || filters.hardwareOs.length > 0 || filters.regions.length > 0 ||
    filters.capabilities.length > 0 || filters.scoreMin > 0 || filters.scoreMax < 100;

  function toggleArray(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700"
      >
        <span>Filters {hasActiveFilters && <span className="text-blue-500 text-xs ml-1">(active)</span>}</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
          {hasActiveFilters && (
            <button
              onClick={() => onChange(defaultFilters)}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
            >
              <X size={12} /> Clear all filters
            </button>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Operator</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {operators.map(op => (
                <button
                  key={op}
                  onClick={() => onChange({ ...filters, operators: toggleArray(filters.operators, op) })}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    filters.operators.includes(op)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Device Type</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {deviceTypes.map(dt => (
                <button
                  key={dt}
                  onClick={() => onChange({ ...filters, deviceTypes: toggleArray(filters.deviceTypes, dt) })}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    filters.deviceTypes.includes(dt)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {dt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Platform</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {platforms.map(p => (
                <button
                  key={p}
                  onClick={() => onChange({ ...filters, platforms: toggleArray(filters.platforms, p) })}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    filters.platforms.includes(p)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {hardwareOsList.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Hardware OS</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {hardwareOsList.map(os => (
                  <button
                    key={os}
                    onClick={() => onChange({ ...filters, hardwareOs: toggleArray(filters.hardwareOs, os) })}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      filters.hardwareOs.includes(os)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {os}
                  </button>
                ))}
              </div>
            </div>
          )}

          {regions.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Region</label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {regions.map(r => (
                  <button
                    key={r}
                    onClick={() => onChange({ ...filters, regions: toggleArray(filters.regions, r) })}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      filters.regions.includes(r)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Score Range</label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="number"
                min={0} max={100}
                value={filters.scoreMin}
                onChange={e => onChange({ ...filters, scoreMin: Number(e.target.value) })}
                className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center"
              />
              <span className="text-slate-400">to</span>
              <input
                type="number"
                min={0} max={100}
                value={filters.scoreMax}
                onChange={e => onChange({ ...filters, scoreMax: Number(e.target.value) })}
                className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Capabilities</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {capabilityOptions.map(cap => (
                <button
                  key={cap.key}
                  onClick={() => onChange({ ...filters, capabilities: toggleArray(filters.capabilities, cap.key) })}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    filters.capabilities.includes(cap.key)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {cap.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
