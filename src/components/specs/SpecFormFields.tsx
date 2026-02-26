interface BaseFieldProps {
  label: string;
  helpText?: string;
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  helpText,
}: BaseFieldProps & {
  value: string | null;
  onChange: (val: string | null) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
      {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  integer,
  helpText,
}: BaseFieldProps & {
  value: number | null;
  onChange: (val: number | null) => void;
  min?: number;
  integer?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        step={integer ? 1 : 'any'}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(null);
            return;
          }
          const n = integer ? parseInt(raw, 10) : parseFloat(raw);
          if (!isNaN(n) && (min === undefined || n >= min)) {
            onChange(n);
          }
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
      {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}

export function CheckboxInput({
  label,
  value,
  onChange,
  helpText,
}: BaseFieldProps & {
  value: boolean | null;
  onChange: (val: boolean | null) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <input
        type="checkbox"
        checked={value ?? false}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <div>
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {helpText && <p className="mt-0.5 text-xs text-gray-500">{helpText}</p>}
      </div>
    </div>
  );
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  helpText,
}: BaseFieldProps & {
  value: string | null;
  onChange: (val: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}

export function DateInput({
  label,
  value,
  onChange,
  helpText,
}: BaseFieldProps & {
  value: string | null;
  onChange: (val: string | null) => void;
}) {
  const dateVal = value ? value.split('T')[0] : '';
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="date"
        value={dateVal}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
      {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}
