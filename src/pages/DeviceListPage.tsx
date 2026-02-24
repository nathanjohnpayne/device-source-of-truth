import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDevices, deleteDeviceById } from '../lib/hooks';
import { ScoreBadge } from '../components/devices/ScoreBadge';
import { SearchBar } from '../components/filters/SearchBar';
import { FilterPanel, defaultFilters, type Filters } from '../components/filters/FilterPanel';
import { ArrowUpDown, Check, X, AlertTriangle, Trash2 } from 'lucide-react';
import type { Device } from '../lib/types';
import { logEvent } from '../lib/firebase';

type SortField = 'modelName' | 'operator' | 'deviceScore' | 'platform' | 'maxVideoResolution';

function matchesCapability(device: Device, cap: string): boolean {
  switch (cap) {
    case '4k': return device.maxVideoResolution?.includes('2160') ?? false;
    case 'hdr10': return device.supportsHDR10;
    case 'dolbyVision': return device.supportsDolbyVision;
    case 'dolbyAtmos': return device.supportsDolbyAtmos;
    case 'h265': return device.supportsH265;
    case 'widevineL1': return device.widevineSecurityLevel?.toUpperCase().includes('L1') ?? false;
    default: return true;
  }
}

function BoolIcon({ value }: { value: boolean }) {
  return value
    ? <Check size={14} className="text-green-600" />
    : <X size={14} className="text-slate-300" />;
}

export function DeviceListPage() {
  const { devices, loading } = useDevices();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sortField, setSortField] = useState<SortField>('deviceScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let result = devices.filter(d => !deletedIds.has(d.id));

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.modelName.toLowerCase().includes(q) ||
        d.operator.toLowerCase().includes(q) ||
        d.manufacturer.toLowerCase().includes(q) ||
        d.modelNumber.toLowerCase().includes(q)
      );
    }

    if (filters.operators.length > 0) {
      result = result.filter(d => filters.operators.includes(d.operator));
    }
    if (filters.deviceTypes.length > 0) {
      result = result.filter(d => filters.deviceTypes.includes(d.deviceType));
    }
    if (filters.platforms.length > 0) {
      result = result.filter(d => filters.platforms.includes(d.platform));
    }
    if (filters.hardwareOs.length > 0) {
      result = result.filter(d => d.hardwareOs && filters.hardwareOs.includes(d.hardwareOs));
    }
    if (filters.regions.length > 0) {
      result = result.filter(d => d.region && filters.regions.includes(d.region));
    }
    if (filters.scoreMin > 0 || filters.scoreMax < 100) {
      result = result.filter(d => d.deviceScore >= filters.scoreMin && d.deviceScore <= filters.scoreMax);
    }
    if (filters.capabilities.length > 0) {
      result = result.filter(d => filters.capabilities.every(cap => matchesCapability(d, cap)));
    }

    result.sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [devices, search, filters, sortField, sortAsc, deletedIds]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
    logEvent('sort_changed', { field });
  }

  function toggleCompare(id: string) {
    setCompareList(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (value.length > 2) logEvent('search', { query: value });
  }

  function handleFilterChange(newFilters: Filters) {
    setFilters(newFilters);
    logEvent('filter_applied');
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDeviceById(deleteTarget.id);
      logEvent('device_deleted', { device_id: deleteTarget.id, model: deleteTarget.modelName });
      setDeletedIds(prev => new Set(prev).add(deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting device:', err);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-slate-400">Loading devices...</p></div>;
  }

  return (
    <div className="p-8 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Devices</h1>
        {compareList.length > 0 && (
          <Link
            to={`/compare?ids=${compareList.join(',')}`}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Compare ({compareList.length})
          </Link>
        )}
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          <SearchBar value={search} onChange={handleSearchChange} />
          <FilterPanel devices={devices} filters={filters} onChange={handleFilterChange} />
          <p className="text-xs text-slate-400">{filtered.length} of {devices.length} devices</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-3 text-left w-8">
                    <span className="text-xs text-slate-400" title="Select to compare">Cmp</span>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <button onClick={() => handleSort('modelName')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700">
                      Device <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <button onClick={() => handleSort('operator')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700">
                      Operator <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center">
                    <button onClick={() => handleSort('deviceScore')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700">
                      Score <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Region</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">OS</th>
                  <th className="px-3 py-3 text-left">
                    <button onClick={() => handleSort('platform')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700">
                      Platform <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">4K</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">HDR10</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">DV</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Atmos</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Conflicts</th>
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(device => (
                  <tr key={device.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={compareList.includes(device.id)}
                        onChange={() => toggleCompare(device.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Link to={`/devices/${device.id}`} className="hover:text-blue-600 transition-colors">
                        <p className="font-medium text-slate-800">{device.modelName}</p>
                        <p className="text-xs text-slate-400">{device.modelNumber || device.manufacturer}</p>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{device.operator}</td>
                    <td className="px-3 py-2 text-center">
                      <ScoreBadge score={device.deviceScore} size="sm" />
                    </td>
                    <td className="px-3 py-2">
                      {device.region && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                          {device.region}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {device.hardwareOs && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500">
                          {device.hardwareOs}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                        {device.platform}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center"><BoolIcon value={device.maxVideoResolution?.includes('2160') ?? false} /></td>
                    <td className="px-3 py-2 text-center"><BoolIcon value={device.supportsHDR10} /></td>
                    <td className="px-3 py-2 text-center"><BoolIcon value={device.supportsDolbyVision} /></td>
                    <td className="px-3 py-2 text-center"><BoolIcon value={device.supportsDolbyAtmos} /></td>
                    <td className="px-3 py-2 text-center">
                      {device.conflicts.length > 0 && (
                        <span title={`${device.conflicts.length} conflicts`}><AlertTriangle size={14} className="text-amber-500 inline" /></span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => setDeleteTarget(device)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                        title="Delete device"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-400">No devices match your search and filters.</div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Device</h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete <strong>{deleteTarget.modelName}</strong> ({deleteTarget.operator})? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
