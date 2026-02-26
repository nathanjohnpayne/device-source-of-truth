import { auth } from './firebase';
import type {
  Partner,
  PartnerKey,
  DeviceSpec,
  DeviceDetail,
  DeviceWithRelations,
  PartnerWithStats,
  HardwareTier,
  Alert,
  AuditLogEntry,
  UploadHistory,
  PaginatedResponse,
} from './types';

class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const isFormData = options.body instanceof FormData;
  if (isFormData) {
    delete headers['Content-Type'];
  }

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error || res.statusText, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

type QueryParams = Record<string, string | number | boolean | undefined>;

function qs(params?: QueryParams): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (!entries.length) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

function crudEndpoints<T>(base: string) {
  return {
    list: (params?: QueryParams) => apiFetch<PaginatedResponse<T>>(`${base}${qs(params)}`),
    get: (id: string) => apiFetch<T>(`${base}/${id}`),
    create: (data: Partial<T>) =>
      apiFetch<T>(base, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<T>) =>
      apiFetch<T>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<void>(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export const api = {
  partners: crudEndpoints<Partner>('/partners'),
  partnerKeys: crudEndpoints<PartnerKey>('/partner-keys'),
  devices: {
    ...crudEndpoints<DeviceWithRelations>('/devices'),
    get: (id: string) => apiFetch<DeviceDetail>(`/devices/${id}`),
  },
  deviceSpecs: crudEndpoints<DeviceSpec>('/device-specs'),
  tiers: {
    ...crudEndpoints<HardwareTier>('/tiers'),
    preview: (thresholds: Partial<HardwareTier>) =>
      apiFetch<{ devices: DeviceWithRelations[]; counts: Record<string, number> }>(
        '/tiers/preview',
        { method: 'POST', body: JSON.stringify(thresholds) },
      ),
    simulate: (requirements: Record<string, unknown>) =>
      apiFetch<{ tier: string; matches: number }>('/tiers/simulate', {
        method: 'POST',
        body: JSON.stringify(requirements),
      }),
  },
  alerts: crudEndpoints<Alert>('/alerts'),
  audit: {
    list: (params?: QueryParams) =>
      apiFetch<PaginatedResponse<AuditLogEntry>>(`/audit${qs(params)}`),
    get: (id: string) => apiFetch<AuditLogEntry>(`/audit/${id}`),
  },

  telemetry: {
    upload: (file: File, snapshotDate?: string) => {
      const form = new FormData();
      form.append('file', file);
      if (snapshotDate) form.append('snapshotDate', snapshotDate);
      return apiFetch<UploadHistory>('/telemetry/upload', { method: 'POST', body: form });
    },
    history: (params?: QueryParams) =>
      apiFetch<PaginatedResponse<UploadHistory>>(`/telemetry/history${qs(params)}`),
  },

  search: (query: string) =>
    apiFetch<{ devices: DeviceWithRelations[]; partners: PartnerWithStats[] }>(
      `/search${qs({ q: query })}`,
    ),

  reports: {
    dashboard: () => apiFetch<Record<string, unknown>>('/reports/dashboard'),
    partner: (id: string) => apiFetch<Record<string, unknown>>(`/reports/partner/${id}`),
    specCoverage: (params?: QueryParams) =>
      apiFetch<Record<string, unknown>>(`/reports/spec-coverage${qs(params)}`),
  },

  upload: {
    migration: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiFetch<{ success: number; errors: string[] }>('/upload/migration', {
        method: 'POST',
        body: form,
      });
    },
    bulkSpecs: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiFetch<{ success: number; errors: string[] }>('/upload/bulk-specs', {
        method: 'POST',
        body: form,
      });
    },
  },

  export: (type: string, format: string, params?: QueryParams) =>
    apiFetch<Blob>(`/export/${type}${qs({ format, ...params })}`),
};

export { ApiError };
