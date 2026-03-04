import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from './useAuth';

export interface ImportPrerequisiteStatus {
  fieldOptionsSeeded: boolean;
  partnerKeysLoaded: boolean;
  devicesRegistered: boolean;
  partnersExist: boolean;
  versionRegistrySeeded: boolean;
  counts: {
    fieldOptions: number;
    partnerKeys: number;
    devices: number;
    partners: number;
    versionMappings: number;
  };
  loading: boolean;
  refresh: () => void;
}

const ImportPrerequisiteContext = createContext<ImportPrerequisiteStatus | null>(null);

export function ImportPrerequisiteProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    fieldOptions: 0,
    partnerKeys: 0,
    devices: 0,
    partners: 0,
    versionMappings: 0,
  });

  const fetchStatus = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        api.fieldOptions.listKeys(),
        api.partnerKeys.list({ pageSize: 1 }),
        api.devices.list({ pageSize: 1 }),
        api.partners.list({ pageSize: 1 }),
        api.versionMappings.list(),
      ]);

      const fieldOptsRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const partnerKeysRes = results[1].status === 'fulfilled' ? results[1].value : null;
      const devicesRes = results[2].status === 'fulfilled' ? results[2].value : null;
      const partnersRes = results[3].status === 'fulfilled' ? results[3].value : null;
      const versionRes = results[4].status === 'fulfilled' ? results[4].value : null;

      setCounts({
        fieldOptions: fieldOptsRes?.data?.length ?? 0,
        partnerKeys: partnerKeysRes?.total ?? 0,
        devices: devicesRes?.total ?? 0,
        partners: partnersRes?.total ?? 0,
        versionMappings: versionRes?.data?.length ?? 0,
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus, pathname]);

  const value: ImportPrerequisiteStatus = {
    fieldOptionsSeeded: counts.fieldOptions > 0,
    partnerKeysLoaded: counts.partnerKeys > 0,
    devicesRegistered: counts.devices > 0,
    partnersExist: counts.partners > 0,
    versionRegistrySeeded: counts.versionMappings > 0,
    counts,
    loading,
    refresh: fetchStatus,
  };

  return (
    <ImportPrerequisiteContext.Provider value={value}>
      {children}
    </ImportPrerequisiteContext.Provider>
  );
}

export function useImportPrerequisites(): ImportPrerequisiteStatus {
  const ctx = useContext(ImportPrerequisiteContext);
  if (!ctx) {
    return {
      fieldOptionsSeeded: false,
      partnerKeysLoaded: false,
      devicesRegistered: false,
      partnersExist: false,
      versionRegistrySeeded: false,
      counts: { fieldOptions: 0, partnerKeys: 0, devices: 0, partners: 0, versionMappings: 0 },
      loading: true,
      refresh: () => {},
    };
  }
  return ctx;
}
