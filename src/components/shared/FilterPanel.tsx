import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

export interface FilterGroup {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'boolean';
  options?: { value: string; label: string }[];
}

export type FilterValues = Record<string, string | string[] | boolean | undefined>;

interface FilterPanelProps {
  groups: FilterGroup[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  children?: ReactNode;
}

export default function FilterPanel({
  groups,
  values,
  onChange,
}: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const activeCount = Object.values(values).filter(
    (v) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
  ).length;

  const clearAll = () => {
    const cleared: FilterValues = {};
    groups.forEach((g) => (cleared[g.key] = undefined));
    onChange(cleared);
  };

  const setValue = (key: string, val: string | string[] | boolean | undefined) => {
    onChange({ ...values, [key]: val });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          className="flex items-center gap-2 text-sm font-medium text-gray-700"
          onClick={() => setCollapsed(!collapsed)}
        >
          Filters
          {activeCount > 0 && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              {activeCount}
            </span>
          )}
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            Clear all
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex flex-wrap gap-4">
            {groups.map((group) => (
              <div key={group.key} className="min-w-[160px]">
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  {group.label}
                </label>
                {group.type === 'boolean' ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!values[group.key]}
                      onChange={(e) => setValue(group.key, e.target.checked || undefined)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {group.label}
                  </label>
                ) : group.type === 'select' ? (
                  <select
                    value={(values[group.key] as string) || ''}
                    onChange={(e) =>
                      setValue(group.key, e.target.value || undefined)
                    }
                    className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">All</option>
                    {group.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    multiple
                    value={(values[group.key] as string[]) || []}
                    onChange={(e) => {
                      const selected = Array.from(
                        e.target.selectedOptions,
                        (o) => o.value,
                      );
                      setValue(group.key, selected.length ? selected : undefined);
                    }}
                    className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    {group.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>

          {activeCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {groups.map((group) => {
                const val = values[group.key];
                if (val === undefined || val === '' || val === false) return null;
                if (Array.isArray(val) && val.length === 0) return null;

                const display = Array.isArray(val) ? val.join(', ') : String(val);
                return (
                  <span
                    key={group.key}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
                  >
                    {group.label}: {display}
                    <button
                      onClick={() => setValue(group.key, undefined)}
                      className="ml-0.5 hover:text-indigo-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
