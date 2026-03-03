import { useState } from 'react';
import type { FieldOption } from '../../lib/types';
import type { QuestionnaireFieldDef } from '../../lib/questionnaireFields';

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

export function NumberInputWithUnit({
  label,
  value,
  onChange,
  unit,
  helpText,
}: BaseFieldProps & {
  value: number | null;
  onChange: (val: number | null) => void;
  unit: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value ?? ''}
          step="any"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(null);
              return;
            }
            const n = parseFloat(raw);
            if (!isNaN(n)) onChange(n);
          }}
          className="w-full rounded-md border border-gray-300 py-2 pl-3 pr-12 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-gray-400">
          {unit}
        </span>
      </div>
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

export function DropdownInput({
  label,
  value,
  onChange,
  fieldOptions,
  helpText,
}: BaseFieldProps & {
  value: string | null;
  onChange: (val: string | null) => void;
  fieldOptions: FieldOption[];
}) {
  const activeOptions = fieldOptions.filter((o) => o.isActive);
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">— Select —</option>
        {activeOptions.map((opt) => (
          <option key={opt.id} value={opt.displayValue}>
            {opt.displayValue}
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

export function DateOrTextInput({
  label,
  value,
  onChange,
  helpText,
}: BaseFieldProps & {
  value: string | null;
  onChange: (val: string | null) => void;
}) {
  const [isNA, setIsNA] = useState(value === 'N/A');
  const dateVal = !isNA && value ? value.split('T')[0] : '';

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="space-y-2">
        {isNA ? (
          <input
            type="text"
            value="N/A"
            disabled
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
        ) : (
          <input
            type="date"
            value={dateVal}
            onChange={(e) =>
              onChange(e.target.value ? new Date(e.target.value).toISOString() : null)
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        )}
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={isNA}
            onChange={(e) => {
              setIsNA(e.target.checked);
              onChange(e.target.checked ? 'N/A' : null);
            }}
            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
          />
          N/A / Not applicable
        </label>
      </div>
      {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}

export function CodecGrid({
  fields,
  data,
  fieldOptions,
  onChange,
}: {
  fields: QuestionnaireFieldDef[];
  data: Record<string, unknown>;
  fieldOptions: FieldOption[];
  onChange: (key: string, value: string | null) => void;
}) {
  const activeOptions = fieldOptions.filter((o) => o.isActive);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Codec</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Support Level</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {fields.map((field) => (
            <tr key={field.key}>
              <td className="whitespace-nowrap px-3 py-2 text-gray-700">{field.label}</td>
              <td className="px-3 py-2">
                <select
                  value={(data[field.key] as string) ?? ''}
                  onChange={(e) => onChange(field.key, e.target.value || null)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">— Select —</option>
                  {activeOptions.map((opt) => (
                    <option key={opt.id} value={opt.displayValue}>
                      {opt.displayValue}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SecurityChecklist({
  fields,
  data,
  fieldOptions,
  onChange,
}: {
  fields: QuestionnaireFieldDef[];
  data: Record<string, unknown>;
  fieldOptions: FieldOption[];
  onChange: (key: string, value: string | null) => void;
}) {
  const activeOptions = fieldOptions.filter((o) => o.isActive);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Security Feature</th>
            {activeOptions.map((opt) => (
              <th key={opt.id} className="px-3 py-2 text-center font-medium text-gray-500">
                {opt.displayValue}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {fields.map((field) => {
            const currentVal = (data[field.key] as string) ?? '';
            return (
              <tr key={field.key}>
                <td className="whitespace-nowrap px-3 py-2 text-gray-700">{field.label}</td>
                {activeOptions.map((opt) => (
                  <td key={opt.id} className="px-3 py-2 text-center">
                    <input
                      type="radio"
                      name={`sec-${field.key}`}
                      checked={currentVal === opt.displayValue}
                      onChange={() => onChange(field.key, opt.displayValue)}
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
