import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, Check } from 'lucide-react';

export interface TimeRangeOption {
  value: string;
  label: string;
  shortLabel: string;
}

const PRESET_RANGES: TimeRangeOption[] = [
  { value: '1h', label: 'Last hour', shortLabel: '1H' },
  { value: '24h', label: 'Last 24 hours', shortLabel: '24H' },
  { value: '7d', label: 'Last 7 days', shortLabel: '7D' },
  { value: '14d', label: 'Last 14 days', shortLabel: '14D' },
  { value: '30d', label: 'Last 30 days', shortLabel: '30D' },
  { value: '90d', label: 'Last 90 days', shortLabel: '90D' },
];

const UNIT_LABELS: Record<string, string> = {
  m: 'minute',
  h: 'hour',
  d: 'day',
  w: 'week',
};

function parseCustomRange(input: string): TimeRangeOption | null {
  const match = input.trim().match(/^(\d+)\s*([mhdw])$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  if (num <= 0 || num > 9999) return null;
  const unit = match[2].toLowerCase();
  const unitLabel = UNIT_LABELS[unit];
  if (!unitLabel) return null;
  const plural = num === 1 ? '' : 's';
  return {
    value: `${num}${unit}`,
    label: `Last ${num} ${unitLabel}${plural}`,
    shortLabel: `${num}${unit.toUpperCase()}`,
  };
}

function shortLabelFor(value: string): string {
  const preset = PRESET_RANGES.find(r => r.value === value);
  if (preset) return preset.shortLabel;
  const parsed = parseCustomRange(value);
  return parsed?.shortLabel ?? value.toUpperCase();
}

interface TimeRangeDropdownProps {
  value: string | null;
  onChange: (value: string) => void;
}

export default function TimeRangeDropdown({ value, onChange }: TimeRangeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);

  const handleSelect = useCallback((val: string) => {
    onChange(val);
    setOpen(false);
  }, [onChange]);

  const customOption = search ? parseCustomRange(search) : null;
  const filteredPresets = search
    ? PRESET_RANGES.filter(r =>
        r.label.toLowerCase().includes(search.toLowerCase()) ||
        r.shortLabel.toLowerCase().includes(search.toLowerCase()) ||
        r.value.toLowerCase().includes(search.toLowerCase()),
      )
    : PRESET_RANGES;

  const showCustom = customOption && !PRESET_RANGES.some(r => r.value === customOption.value);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => {
          setOpen((isOpen) => {
            const nextOpen = !isOpen;
            if (nextOpen) {
              setSearch('');
              requestAnimationFrame(() => searchRef.current?.focus());
            }
            return nextOpen;
          });
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
          value
            ? 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
            : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
        }`}
      >
        {value ? shortLabelFor(value) : '—'}
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-xs font-semibold text-gray-700">Import Time Range</p>
          </div>
          <div className="border-b border-gray-100 px-3 py-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
              <svg className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Custom range: 2h, 4d, 8w…"
                className="w-full border-0 bg-transparent p-0 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {showCustom && (
              <button
                type="button"
                onClick={() => handleSelect(customOption.value)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="w-4" />
                <span>{customOption.label}</span>
              </button>
            )}
            {filteredPresets.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  value === option.value ? 'text-indigo-600 font-medium' : 'text-gray-700'
                }`}
              >
                <span className="w-4">
                  {value === option.value && <Check className="h-4 w-4 text-indigo-600" />}
                </span>
                <span>{option.label}</span>
              </button>
            ))}
            {filteredPresets.length === 0 && !showCustom && (
              <p className="px-3 py-3 text-center text-xs text-gray-400">
                No matching range. Try formats like 2h, 4d, 8w.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
