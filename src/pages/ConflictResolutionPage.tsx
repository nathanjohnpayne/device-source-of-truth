import { useState, useMemo, useEffect, useCallback } from 'react';
import { useDevices, resolveConflictsBatch, type ConflictResolution } from '../lib/hooks';
import { logEvent } from '../lib/firebase';
import type { Device } from '../lib/types';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Filter } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedConflict {
  deviceId: string;
  deviceName: string;
  operator: string;
  field: string;
  valueA: string;
  valueB: string;
  raw: string;
}

interface Selection {
  value: unknown;
  conflictString: string;
}

// Fields whose underlying values are booleans – displayed as "Yes" / "No".
const BOOLEAN_FIELDS = new Set([
  'supportsH264',
  'supportsH265',
  'supportsEAC3',
  'supportsDolbyAtmos',
  'supportsHDR10',
  'supportsDolbyVision',
  'supportsHLG',
  'supportsHDR10Plus',
  'supportsSecureBoot',
  'supportsTEE',
  'supportsSecureVideoPath',
  'is64Bit',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseConflicts(devices: Device[]): ParsedConflict[] {
  const parsed: ParsedConflict[] = [];
  for (const device of devices) {
    for (const conflict of device.conflicts) {
      const match = conflict.match(/^(\w+):\s*"(.+?)"\s*vs\s*"(.+?)"$/);
      if (match) {
        parsed.push({
          deviceId: device.id,
          deviceName: device.modelName,
          operator: device.operator,
          field: match[1],
          valueA: match[2],
          valueB: match[3],
          raw: conflict,
        });
      }
    }
  }
  return parsed;
}

function conflictKey(c: ParsedConflict): string {
  return `${c.deviceId}__${c.field}`;
}

/** Convert a raw conflict value string to the proper typed value for Firestore. */
function coerceValue(field: string, rawValue: string): unknown {
  if (BOOLEAN_FIELDS.has(field)) {
    return rawValue === 'true' || rawValue === 'Yes';
  }
  const asNumber = Number(rawValue);
  if (!Number.isNaN(asNumber) && rawValue.trim() !== '') {
    return asNumber;
  }
  return rawValue;
}

/** Friendly label for a boolean-field value. */
function boolLabel(raw: string): string {
  return raw === 'true' ? 'Yes' : raw === 'false' ? 'No' : raw;
}

/** Human-readable field name: insert spaces before capitals, e.g. "socVendor" -> "Soc Vendor". */
function humanFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConflictCard({
  conflict,
  selection,
  onSelect,
}: {
  conflict: ParsedConflict;
  selection: Selection | undefined;
  onSelect: (value: unknown, conflictString: string) => void;
}) {
  const [customValue, setCustomValue] = useState('');
  const isBoolean = BOOLEAN_FIELDS.has(conflict.field);

  const labelA = isBoolean ? boolLabel(conflict.valueA) : conflict.valueA;
  const labelB = isBoolean ? boolLabel(conflict.valueB) : conflict.valueB;

  const selectedRaw =
    selection !== undefined ? String(selection.value) : null;

  // Determine which radio is active
  const isA = selectedRaw === conflict.valueA || (isBoolean && selectedRaw === String(conflict.valueA === 'true'));
  const isB = selectedRaw === conflict.valueB || (isBoolean && selectedRaw === String(conflict.valueB === 'true'));
  const isCustom = selection !== undefined && !isA && !isB;

  const handleCustomChange = useCallback(
    (text: string) => {
      setCustomValue(text);
      onSelect(coerceValue(conflict.field, text), conflict.raw);
    },
    [conflict.field, conflict.raw, onSelect],
  );

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 py-3 px-4 rounded-md bg-slate-50 border border-slate-100">
      {/* Device info */}
      <div className="sm:w-56 shrink-0">
        <p className="text-sm font-medium text-slate-800">{conflict.deviceName}</p>
        <p className="text-xs text-slate-400">{conflict.operator}</p>
      </div>

      {/* Options */}
      <div className="flex flex-wrap items-center gap-4 flex-1">
        {/* Value A */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={conflictKey(conflict)}
            className="accent-blue-600"
            checked={isA}
            onChange={() => onSelect(coerceValue(conflict.field, conflict.valueA), conflict.raw)}
          />
          <span className="text-sm text-slate-700">{labelA}</span>
        </label>

        {/* Value B */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={conflictKey(conflict)}
            className="accent-blue-600"
            checked={isB}
            onChange={() => onSelect(coerceValue(conflict.field, conflict.valueB), conflict.raw)}
          />
          <span className="text-sm text-slate-700">{labelB}</span>
        </label>

        {/* Custom */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name={conflictKey(conflict)}
            className="accent-blue-600"
            checked={isCustom}
            onChange={() => handleCustomChange(customValue)}
          />
          <span className="text-sm text-slate-700">Custom</span>
        </label>

        {isCustom && (
          <input
            type="text"
            value={customValue}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Enter value..."
            className="ml-1 px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-40"
            autoFocus
          />
        )}
      </div>

      {/* Resolved indicator */}
      {selection !== undefined && (
        <div className="flex items-center gap-1 text-green-600 shrink-0">
          <Check size={14} />
          <span className="text-xs font-medium">Selected</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function ConflictResolutionPage() {
  const { devices, loading } = useDevices();

  // Selections: keyed by `${deviceId}__${field}`
  const [selections, setSelections] = useState<Map<string, Selection>>(new Map());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [fieldFilter, setFieldFilter] = useState<string | null>(null);
  const [operatorFilter, setOperatorFilter] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  // Analytics: track page view once on mount
  useEffect(() => {
    logEvent('view_conflicts');
  }, []);

  // Parse all conflicts across devices
  const allConflicts = useMemo(() => parseConflicts(devices), [devices]);

  // Unique field names and operators for filter dropdowns
  const uniqueFields = useMemo(
    () => [...new Set(allConflicts.map((c) => c.field))].sort(),
    [allConflicts],
  );
  const uniqueOperators = useMemo(
    () => [...new Set(allConflicts.map((c) => c.operator))].sort(),
    [allConflicts],
  );

  // Filtered conflicts
  const filteredConflicts = useMemo(() => {
    let result = allConflicts;
    if (fieldFilter) {
      result = result.filter((c) => c.field === fieldFilter);
    }
    if (operatorFilter) {
      result = result.filter((c) => c.operator === operatorFilter);
    }
    return result;
  }, [allConflicts, fieldFilter, operatorFilter]);

  // Group filtered conflicts by field name
  const groupedConflicts = useMemo(() => {
    const groups = new Map<string, ParsedConflict[]>();
    for (const c of filteredConflicts) {
      const arr = groups.get(c.field) || [];
      arr.push(c);
      groups.set(c.field, arr);
    }
    // Sort groups alphabetically by field name
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredConflicts]);

  // Count of devices that have at least one conflict
  const devicesWithConflicts = useMemo(
    () => new Set(allConflicts.map((c) => c.deviceId)).size,
    [allConflicts],
  );

  // Selection handler
  const handleSelect = useCallback(
    (conflict: ParsedConflict, value: unknown, conflictString: string) => {
      setSelections((prev) => {
        const next = new Map(prev);
        next.set(conflictKey(conflict), { value, conflictString });
        return next;
      });
    },
    [],
  );

  // Toggle group collapse
  const toggleGroup = useCallback((field: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }, []);

  // Check whether every conflict in a group has been resolved
  const isGroupResolved = useCallback(
    (conflicts: ParsedConflict[]) =>
      conflicts.every((c) => selections.has(conflictKey(c))),
    [selections],
  );

  // Build resolutions array from selections
  const resolutions: ConflictResolution[] = useMemo(() => {
    const result: ConflictResolution[] = [];
    for (const [key, sel] of selections) {
      const [deviceId, field] = key.split('__');
      result.push({
        deviceId,
        field,
        value: sel.value,
        conflictString: sel.conflictString,
      });
    }
    return result;
  }, [selections]);

  // Apply resolutions
  const handleApply = useCallback(async () => {
    if (resolutions.length === 0) return;
    setApplying(true);
    try {
      await resolveConflictsBatch(resolutions, devices);
      logEvent('batch_resolve', { count: String(resolutions.length) });
      setSuccessCount(resolutions.length);
      setSelections(new Map());
      // Reload the page after a short delay so the hook re-fetches devices
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Error resolving conflicts:', err);
    } finally {
      setApplying(false);
    }
  }, [resolutions, devices]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Loading conflicts...</p>
      </div>
    );
  }

  if (allConflicts.length === 0) {
    return (
      <div className="p-8 max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Conflict Resolution</h1>
        <div className="bg-white rounded-lg border border-slate-200 p-10 text-center">
          <Check size={40} className="mx-auto text-green-500 mb-3" />
          <p className="text-slate-600 font-medium">No conflicts found</p>
          <p className="text-sm text-slate-400 mt-1">All device data is consistent across sources.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl pb-28">
      {/* Success banner */}
      {successCount > 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <Check size={18} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-800 font-medium">
            Successfully resolved {successCount} conflict{successCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Conflict Resolution</h1>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
          <AlertTriangle size={12} />
          {allConflicts.length}
        </span>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <p className="text-sm text-slate-500">
          {devicesWithConflicts} device{devicesWithConflicts !== 1 ? 's' : ''} with{' '}
          {allConflicts.length} total conflict{allConflicts.length !== 1 ? 's' : ''}
        </p>

        {/* Field filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-slate-400" />
          <select
            value={fieldFilter ?? ''}
            onChange={(e) => setFieldFilter(e.target.value || null)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All fields</option>
            {uniqueFields.map((f) => (
              <option key={f} value={f}>
                {humanFieldName(f)}
              </option>
            ))}
          </select>
        </div>

        {/* Operator filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-slate-400" />
          <select
            value={operatorFilter ?? ''}
            onChange={(e) => setOperatorFilter(e.target.value || null)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All operators</option>
            {uniqueOperators.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conflict groups */}
      <div className="space-y-4">
        {groupedConflicts.map(([field, conflicts]) => {
          const collapsed = collapsedGroups.has(field);
          const groupResolved = isGroupResolved(conflicts);
          const resolvedCount = conflicts.filter((c) => selections.has(conflictKey(c))).length;

          return (
            <div
              key={field}
              className="bg-white rounded-lg border border-slate-200 overflow-hidden"
            >
              {/* Group header */}
              <button
                onClick={() => toggleGroup(field)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {collapsed ? (
                    <ChevronRight size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                  <span className="text-sm font-semibold text-slate-800">
                    {humanFieldName(field)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {resolvedCount > 0 && (
                    <span className="text-xs text-blue-600 font-medium">
                      {resolvedCount}/{conflicts.length} selected
                    </span>
                  )}
                  {groupResolved && (
                    <Check size={16} className="text-green-500" />
                  )}
                </div>
              </button>

              {/* Conflict cards */}
              {!collapsed && (
                <div className="px-5 pb-4 space-y-2">
                  {conflicts.map((conflict) => (
                    <ConflictCard
                      key={conflictKey(conflict)}
                      conflict={conflict}
                      selection={selections.get(conflictKey(conflict))}
                      onSelect={(value, conflictString) =>
                        handleSelect(conflict, value, conflictString)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty filtered state */}
      {filteredConflicts.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-400">No conflicts match the selected filters.</p>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-30">
        <div className="max-w-5xl mx-auto px-8 py-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {resolutions.length} resolution{resolutions.length !== 1 ? 's' : ''} selected
          </p>
          <button
            onClick={handleApply}
            disabled={resolutions.length === 0 || applying}
            className={
              'px-5 py-2 text-sm font-medium rounded-lg transition-colors ' +
              (resolutions.length === 0 || applying
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700')
            }
          >
            {applying
              ? 'Applying...'
              : `Apply ${resolutions.length} Resolution${resolutions.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
