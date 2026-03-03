import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { FieldOption } from '../lib/types';

interface FieldOptionsContextValue {
  optionsByKey: Record<string, FieldOption[]>;
  loading: boolean;
  getOptions: (dropdownKey: string) => FieldOption[];
  getActiveOptions: (dropdownKey: string) => FieldOption[];
  isOtherTrigger: (dropdownKey: string, value: string | null) => boolean;
  refresh: () => Promise<void>;
}

const FieldOptionsContext = createContext<FieldOptionsContextValue | null>(null);

export function FieldOptionsProvider({ children }: { children: ReactNode }) {
  const [optionsByKey, setOptionsByKey] = useState<Record<string, FieldOption[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.fieldOptions.getAll();
      setOptionsByKey(res.data);
    } catch {
      // Silently handle — options may not be seeded yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getOptions = useCallback(
    (dropdownKey: string): FieldOption[] => optionsByKey[dropdownKey] ?? [],
    [optionsByKey],
  );

  const getActiveOptions = useCallback(
    (dropdownKey: string): FieldOption[] =>
      (optionsByKey[dropdownKey] ?? []).filter((o) => o.isActive),
    [optionsByKey],
  );

  const isOtherTrigger = useCallback(
    (dropdownKey: string, value: string | null): boolean => {
      if (!value) return false;
      const options = optionsByKey[dropdownKey] ?? [];
      const match = options.find((o) => o.displayValue === value);
      return match?.isOtherTrigger ?? false;
    },
    [optionsByKey],
  );

  return (
    <FieldOptionsContext.Provider
      value={{ optionsByKey, loading, getOptions, getActiveOptions, isOtherTrigger, refresh: fetchAll }}
    >
      {children}
    </FieldOptionsContext.Provider>
  );
}

export function useFieldOptions(): FieldOptionsContextValue {
  const ctx = useContext(FieldOptionsContext);
  if (!ctx) {
    throw new Error('useFieldOptions must be used within a FieldOptionsProvider');
  }
  return ctx;
}
