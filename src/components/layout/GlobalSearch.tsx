import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../../lib/api';
import { trackEvent } from '../../lib/analytics';
import type { DeviceWithRelations, PartnerWithStats } from '../../lib/types';

interface SearchResults {
  devices: DeviceWithRelations[];
  partners: PartnerWithStats[];
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.search(q);
      setResults(res);
      setOpen(true);
      trackEvent('global_search', {
        query: q,
        result_count: res.devices.length + res.partners.length,
      });
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 200);
  };

  const selectResult = (path: string) => {
    setQuery('');
    setResults(null);
    setOpen(false);
    inputRef.current?.blur();
    navigate(path);
  };

  const firstResultPath = (): string | null => {
    if (!results) return null;
    if (results.devices.length) return `/devices/${results.devices[0].id}`;
    if (results.partners.length) return `/partners/${results.partners[0].id}`;
    return null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === 'Enter') {
      const path = firstResultPath();
      if (path) selectResult(path);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const showDropdown = open && focused && query.length >= 2;
  const hasResults = results && (results.devices.length > 0 || results.partners.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search devices, partners..."
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          setFocused(true);
          if (results && query.length >= 2) setOpen(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        className="w-72 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      {showDropdown && (
        <div className="absolute right-0 top-full z-50 mt-1 w-96 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
          )}

          {!loading && !hasResults && (
            <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
          )}

          {!loading && hasResults && (
            <>
              {results!.devices.length > 0 && (
                <div>
                  <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Devices
                  </div>
                  {results!.devices.slice(0, 5).map((d) => (
                    <button
                      key={d.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectResult(`/devices/${d.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-gray-900">
                          {d.displayName}
                        </div>
                        <div className="truncate text-xs text-gray-500">
                          {d.deviceId}
                          {d.partnerName && ` · ${d.partnerName}`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results!.partners.length > 0 && (
                <div>
                  <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Partners
                  </div>
                  {results!.partners.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectResult(`/partners/${p.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-gray-900">
                          {p.displayName}
                        </div>
                        <div className="truncate text-xs text-gray-500">
                          {p.regions?.join(', ') || 'No regions'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
