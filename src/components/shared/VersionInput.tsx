import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { Link } from 'react-router-dom';

interface VersionInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export default function VersionInput({ value, onChange, label = 'Live ADK Version', placeholder = 'e.g. ADK 3.1.1', className }: VersionInputProps) {
  const [friendlyVersions, setFriendlyVersions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [touched, setTouched] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.versionMappings.friendlyVersions().then(res => setFriendlyVersions(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedValue = value.toLowerCase().replace(/\s+/g, ' ').trim();
  const isRecognized = !normalizedValue || friendlyVersions.some(
    fv => fv.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedValue,
  );

  const suggestions = useMemo(() => {
    if (!value.trim()) return friendlyVersions.slice(0, 10);
    const q = value.toLowerCase();
    return friendlyVersions.filter(fv => fv.toLowerCase().includes(q)).slice(0, 10);
  }, [value, friendlyVersions]);

  return (
    <div ref={wrapperRef} className={className}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="relative">
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-auto">
            {suggestions.map(fv => (
              <button
                key={fv}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(fv); setShowDropdown(false); setTouched(true); }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50"
              >
                {fv}
              </button>
            ))}
          </div>
        </div>
      )}
      {touched && !isRecognized && value.trim() && (
        <p className="mt-1 flex items-start gap-1 text-xs text-amber-600">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>
            &ldquo;{value}&rdquo; is not a recognized version. If this is a new release, ask your Admin to add it to the{' '}
            <Link to="/admin/version-registry" className="font-medium underline">Version Registry</Link>.
          </span>
        </p>
      )}
    </div>
  );
}
