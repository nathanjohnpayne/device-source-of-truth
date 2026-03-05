import { auth } from './firebase';
import type {
  CreateDeviceRequest,
  UpdateDeviceRequest,
  SaveDeviceSpecRequest,
  DashboardReportResponse,
  PartnerReportResponse,
  SpecCoverageReportResponse,
} from '@dst/contracts';
import type {
  Partner,
  PartnerKeyWithDisplay,
  PartnerKeyImportPreview,
  PartnerKeyImportResult,
  PartnerKeyImportBatch,
  DeviceSpec,
  DeviceDetail,
  DeviceWithRelations,
  PartnerWithStats,
  HardwareTier,
  Alert,
  AuditLogEntry,
  UploadHistoryWithRollback,
  PaginatedResponse,
  FieldOption,
  FieldOptionKeyInfo,
  IntakeRequest,
  IntakePreviewRow,
  IntakeImportResult,
  IntakeImportBatch,
  MigrationBatch,
  CoreVersionMapping,
  UnmappedVersion,
  ImportType,
  DisambiguationResponse,
  DisambiguationFieldResult,
  ClarificationAnswer,
  PartnerAlias,
  QuestionnaireIntakeJob,
  QuestionnaireIntakeJobDetail,
  QuestionnaireStagedDevice,
  QuestionnaireStagedField,
  User,
  UserRole,
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

const isDev = import.meta.env.DEV;

function apiLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  if (isDev) {
    const prefix = `[API ${level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, data ?? '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data ?? '');
    } else {
      console.log(prefix, message, data ?? '');
    }
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const startTime = performance.now();
  apiLog('debug', `${method} /api${path}`, { method, path });

  const user = auth.currentUser;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    apiLog('warn', 'No authenticated user for API request', { path });
  }

  const isFormData = options.body instanceof FormData;
  if (isFormData) {
    delete headers['Content-Type'];
  }

  try {
    const res = await fetch(`/api${path}`, { ...options, headers });
    const elapsed = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      apiLog('error', `${method} /api${path} failed`, {
        status: res.status,
        statusText: res.statusText,
        error: body?.error,
        detail: body?.detail,
        elapsedMs: elapsed,
      });
      throw new ApiError(res.status, body?.error || res.statusText, body);
    }

    apiLog('info', `${method} /api${path} completed`, { status: res.status, elapsedMs: elapsed });

    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;

    const elapsed = Math.round(performance.now() - startTime);
    apiLog('error', `${method} /api${path} network error`, {
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: elapsed,
    });
    throw err;
  }
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
    create: (data: Record<string, unknown>) =>
      apiFetch<T>(base, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      apiFetch<T>(`${base}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<void>(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export const api = {
  partners: crudEndpoints<Partner>('/partners'),
  partnerKeys: {
    ...crudEndpoints<PartnerKeyWithDisplay>('/partner-keys'),
    importPreview: async (file: File) => {
      const csvData = await file.text();
      return apiFetch<PartnerKeyImportPreview>('/partner-keys/import/preview', {
        method: 'POST',
        body: JSON.stringify({ csvData }),
      });
    },
    importConfirm: (rows: PartnerKeyImportPreview['rows'], fileName: string) =>
      apiFetch<PartnerKeyImportResult>('/partner-keys/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ rows, fileName }),
      }),
    importBatches: () =>
      apiFetch<{ data: PartnerKeyImportBatch[] }>('/partner-keys/import-batches'),
    rollbackBatch: (batchId: string) =>
      apiFetch<{ success: boolean; deleted: number; restored?: number }>(`/partner-keys/import-batches/${batchId}/rollback`, {
        method: 'POST',
      }),
  },
  devices: {
    list: (params?: QueryParams) => apiFetch<PaginatedResponse<DeviceWithRelations>>(`/devices${qs(params)}`),
    get: (id: string) => apiFetch<DeviceDetail>(`/devices/${id}`),
    create: (data: CreateDeviceRequest) =>
      apiFetch<DeviceWithRelations>('/devices', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: UpdateDeviceRequest) =>
      apiFetch<DeviceWithRelations>(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<void>(`/devices/${id}`, { method: 'DELETE' }),
  },
  deviceSpecs: {
    get: (deviceId: string) => apiFetch<DeviceSpec>(`/device-specs/${deviceId}`),
    save: (deviceId: string, data: SaveDeviceSpecRequest) =>
      apiFetch<DeviceSpec>(`/device-specs/${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },
  tiers: {
    ...crudEndpoints<HardwareTier>('/tiers'),
    preview: (tiers: HardwareTier[]) =>
      apiFetch<Record<string, { tierName: string; count: number; devices: string[] }>>(
        '/tiers/preview',
        { method: 'POST', body: JSON.stringify({ tiers }) },
      ),
    simulate: (requirements: Record<string, unknown>) =>
      apiFetch<{
        eligibleCount: number;
        ineligibleCount: number;
        eligible: string[];
        ineligible: string[];
      }>('/tiers/simulate', {
        method: 'POST',
        body: JSON.stringify(requirements),
      }),
  },
  alerts: {
    list: (params?: QueryParams) => apiFetch<PaginatedResponse<Alert>>(`/alerts${qs(params)}`),
    dismiss: (id: string, dismissReason: string) =>
      apiFetch<Alert>(`/alerts/${id}/dismiss`, {
        method: 'PUT',
        body: JSON.stringify({ dismissReason }),
      }),
  },
  audit: {
    list: (params?: QueryParams) =>
      apiFetch<PaginatedResponse<AuditLogEntry>>(`/audit${qs(params)}`),
    get: (id: string) => apiFetch<AuditLogEntry>(`/audit/${id}`),
  },

  telemetry: {
    preview: async (file: File, snapshotDate: string) => {
      const csvData = await file.text();
      return apiFetch<{
        rows: import('./types').TelemetryPreviewRow[];
        summary: { total: number; new: number; update: number; noChange: number; stale: number };
      }>('/telemetry/preview', {
        method: 'POST',
        body: JSON.stringify({ csvData, snapshotDate }),
      });
    },
    upload: async (file: File, snapshotDate: string, staleOverrides?: number[], importTimeRange?: string) => {
      const csvData = await file.text();
      return apiFetch<{
        success: boolean;
        uploadBatchId: string;
        rowCount: number;
        successCount: number;
        newCount: number;
        updatedCount: number;
        noChangeCount: number;
        staleOverwrittenCount: number;
        errorCount: number;
        errors: string[];
        devicesUpdated: number;
      }>('/telemetry/upload', {
        method: 'POST',
        body: JSON.stringify({ csvData, snapshotDate, fileName: file.name, staleOverrides, importTimeRange }),
      });
    },
    history: (params?: QueryParams) =>
      apiFetch<PaginatedResponse<UploadHistoryWithRollback>>(`/telemetry/history${qs(params)}`),
    rollback: (uploadBatchId: string) =>
      apiFetch<{ success: boolean; deletedSnapshots: number }>(`/telemetry/rollback/${uploadBatchId}`, {
        method: 'DELETE',
      }),
  },

  search: (query: string) =>
    apiFetch<{ devices: DeviceWithRelations[]; partners: PartnerWithStats[] }>(
      `/search${qs({ q: query })}`,
    ),

  reports: {
    dashboard: () => apiFetch<DashboardReportResponse>('/reports/dashboard'),
    partner: (id: string) => apiFetch<PartnerReportResponse>(`/reports/partner/${id}`),
    specCoverage: (params?: QueryParams) =>
      apiFetch<SpecCoverageReportResponse>(`/reports/spec-coverage${qs(params)}`),
  },

  fieldOptions: {
    listKeys: () => apiFetch<{ data: FieldOptionKeyInfo[] }>('/field-options'),
    getOptions: (dropdownKey: string) =>
      apiFetch<{ data: FieldOption[] }>(`/field-options/key/${dropdownKey}`),
    getAll: () => apiFetch<{ data: Record<string, FieldOption[]> }>('/field-options/all'),
    createOption: (data: { dropdownKey: string; displayLabel?: string; displayValue: string; isOtherTrigger?: boolean }) =>
      apiFetch<FieldOption>('/field-options', { method: 'POST', body: JSON.stringify(data) }),
    updateOption: (id: string, data: Partial<FieldOption>) =>
      apiFetch<FieldOption>(`/field-options/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    reorder: (dropdownKey: string, orderedIds: string[]) =>
      apiFetch<{ success: boolean }>(`/field-options/reorder/${dropdownKey}`, {
        method: 'PUT',
        body: JSON.stringify({ orderedIds }),
      }),
    deleteOption: (id: string) =>
      apiFetch<{ success: boolean }>(`/field-options/${id}`, { method: 'DELETE' }),
    getUsage: (id: string) =>
      apiFetch<{ usageCount: number; displayValue: string; dropdownKey: string }>(
        `/field-options/${id}/usage`,
      ),
    seed: () => apiFetch<{ created: number; skipped: number }>('/field-options/seed', { method: 'POST' }),
  },

  upload: {
    migration: async (file: File) => {
      const csvData = await file.text();
      return apiFetch<{
        success: boolean; importBatchId: string; created: number; duplicates: number; errored: number; errors: string[];
      }>(
        '/upload/migration',
        { method: 'POST', body: JSON.stringify({ csvData, fileName: file.name }) },
      );
    },
    migrationHistory: () =>
      apiFetch<{ data: MigrationBatch[] }>('/upload/migration/history'),
    migrationRollback: (importBatchId: string) =>
      apiFetch<{ success: boolean; deletedDevices: number; deletedSpecs: number }>(
        `/upload/migration/rollback/${importBatchId}`,
        { method: 'DELETE' },
      ),
    bulkSpecs: async (file: File) => {
      const isXlsx = file.name.endsWith('.xlsx');
      if (isXlsx) {
        const buffer = await file.arrayBuffer();
        const fileData = btoa(
          new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''),
        );
        return apiFetch<{ success: boolean; matched: number; notFound: number; errored: number; errors: string[] }>(
          '/upload/bulk-specs',
          { method: 'POST', body: JSON.stringify({ fileData, fileType: 'xlsx' }) },
        );
      }
      const csvData = await file.text();
      return apiFetch<{ success: boolean; matched: number; notFound: number; errored: number; errors: string[] }>(
        '/upload/bulk-specs',
        { method: 'POST', body: JSON.stringify({ csvData }) },
      );
    },
    clearAll: () =>
      apiFetch<{ success: boolean; deleted: Record<string, number> }>(
        '/upload/clear-all',
        { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' }) },
      ),
  },

  intake: {
    preview: (rows: Omit<IntakePreviewRow, 'partnerMatches' | 'warnings' | 'errors' | 'status'>[]) =>
      apiFetch<{
        rows: IntakePreviewRow[];
        summary: {
          total: number; ready: number; warnings: number; errors: number;
          newCount?: number; duplicateCount?: number; conflictCount?: number; inFileDuplicateCount?: number;
        };
      }>('/intake/preview', { method: 'POST', body: JSON.stringify({ rows }) }),
    import: (rows: IntakePreviewRow[], fileName: string) =>
      apiFetch<IntakeImportResult>('/intake/import', {
        method: 'POST',
        body: JSON.stringify({ rows, fileName }),
      }),
    list: (params?: QueryParams) =>
      apiFetch<PaginatedResponse<IntakeRequest>>(`/intake${qs(params)}`),
    get: (id: string) =>
      apiFetch<IntakeRequest & { partners: Array<{ id: string; partnerNameRaw: string; partnerId: string | null; matchConfidence: string }> }>(
        `/intake/${id}`,
      ),
    history: () =>
      apiFetch<{ data: IntakeImportBatch[] }>('/intake/history'),
    rollback: (batchId: string) =>
      apiFetch<{ success: boolean; deletedRequests: number; deletedPartners: number; restoredCount?: number }>(
        `/intake/rollback/${batchId}`,
        { method: 'DELETE' },
      ),
  },

  disambiguation: {
    disambiguate: (importType: ImportType, rows: Record<string, unknown>[]) =>
      apiFetch<DisambiguationResponse>('/import/disambiguate', {
        method: 'POST',
        body: JSON.stringify({ importType, rows }),
      }),
    resolve: (
      importType: ImportType,
      answers: ClarificationAnswer[],
      originalFields: DisambiguationFieldResult[],
      rows: Record<string, unknown>[],
    ) =>
      apiFetch<{ fields: DisambiguationFieldResult[]; questions: []; remainingCount: number }>(
        '/import/disambiguate/resolve',
        {
          method: 'POST',
          body: JSON.stringify({ importType, answers, originalFields, rows }),
        },
      ),
  },

  versionMappings: {
    list: (params?: { platform?: string; active?: string }) =>
      apiFetch<{ data: CoreVersionMapping[] }>(`/version-mappings${qs(params)}`),
    create: (data: { coreVersion: string; friendlyVersion: string; notes?: string }) =>
      apiFetch<CoreVersionMapping>('/version-mappings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { friendlyVersion?: string; notes?: string; isActive?: boolean }) =>
      apiFetch<CoreVersionMapping>(`/version-mappings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    unmapped: () =>
      apiFetch<{ data: UnmappedVersion[] }>('/version-mappings/unmapped'),
    friendlyVersions: () =>
      apiFetch<{ data: string[] }>('/version-mappings/friendly-versions'),
    usage: (id: string) =>
      apiFetch<{ usageCount: number }>(`/version-mappings/usage/${id}`),
    seed: () =>
      apiFetch<{ created: number; skipped: number }>('/version-mappings/seed', { method: 'POST' }),
  },

  questionnaireIntake: {
    upload: async (file: File, options: {
      partnerId?: string;
      aiExtraction?: boolean;
      notes?: string;
    } = {}) => {
      const buffer = await file.arrayBuffer();
      const fileData = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''),
      );
      return apiFetch<QuestionnaireIntakeJob>('/questionnaire-intake', {
        method: 'POST',
        body: JSON.stringify({
          fileData,
          fileName: file.name,
          partnerId: options.partnerId,
          aiExtraction: options.aiExtraction ?? false,
          notes: options.notes,
        }),
      });
    },
    list: (params?: { status?: string; partner_id?: string; search?: string; page?: number; pageSize?: number }) =>
      apiFetch<PaginatedResponse<QuestionnaireIntakeJob>>(`/questionnaire-intake${qs(params)}`),
    get: (id: string) =>
      apiFetch<QuestionnaireIntakeJobDetail>(`/questionnaire-intake/${id}`),
    triggerExtraction: (id: string) =>
      apiFetch<{ status: string; message: string }>(`/questionnaire-intake/${id}/trigger-extraction`, {
        method: 'POST',
      }),
    retryDevice: (jobId: string, deviceId: string) =>
      apiFetch<{ status: string; message: string }>(`/questionnaire-intake/${jobId}/retry-device/${deviceId}`, {
        method: 'POST',
      }),
    getStagedDevices: (id: string) =>
      apiFetch<(QuestionnaireStagedDevice & { fields: QuestionnaireStagedField[] })[]>(
        `/questionnaire-intake/${id}/staged-devices`,
      ),
    download: (id: string) =>
      apiFetch<{ url: string; fileName: string }>(`/questionnaire-intake/${id}/download`),
    getReview: (id: string) =>
      apiFetch<{
        job: QuestionnaireIntakeJob;
        devices: (QuestionnaireStagedDevice & { fields: QuestionnaireStagedField[] })[];
        partner: { id: string; displayName: string } | null;
      }>(`/questionnaire-intake/${id}/review`),
    updateJob: (id: string, data: { partnerId?: string }) =>
      apiFetch<QuestionnaireIntakeJob>(`/questionnaire-intake/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    updateStagedDevice: (jobId: string, deviceId: string, data: Record<string, unknown>) =>
      apiFetch<QuestionnaireStagedDevice>(`/questionnaire-intake/${jobId}/staged-devices/${deviceId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    updateField: (jobId: string, deviceId: string, fieldId: string, data: Record<string, unknown>) =>
      apiFetch<QuestionnaireStagedField>(
        `/questionnaire-intake/${jobId}/staged-devices/${deviceId}/fields/${fieldId}`,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    resolveAll: (jobId: string, deviceId: string) =>
      apiFetch<{ resolved: number }>(
        `/questionnaire-intake/${jobId}/staged-devices/${deviceId}/resolve-all`,
        { method: 'PATCH' },
      ),
    approve: (id: string) =>
      apiFetch<{ status: string; summary: Record<string, number>; affectedDeviceIds: string[] }>(
        `/questionnaire-intake/${id}/approve`,
        { method: 'POST' },
      ),
    reject: (id: string, reason?: string) =>
      apiFetch<{ status: string }>(`/questionnaire-intake/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    getDeviceSources: (deviceId: string) =>
      apiFetch<(import('./types').DeviceQuestionnaireSource & { jobFileName?: string })[]>(
        `/questionnaire-intake/device-sources/${deviceId}`,
      ),
    notifications: {
      list: (params?: { unread?: string; limit?: number }) =>
        apiFetch<import('./types').AppNotification[]>(`/questionnaire-intake/notifications/list${qs(params)}`),
      markRead: (notificationId: string) =>
        apiFetch<{ success: boolean }>(
          `/questionnaire-intake/notifications/${notificationId}/read`,
          { method: 'PATCH' },
        ),
    },
  },

  users: {
    list: () => apiFetch<{ users: User[] }>('/users'),
    updateRole: (userId: string, role: UserRole) =>
      apiFetch<{ user: User }>(`/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
  },

  partnerAliases: {
    list: (params?: { active?: string }) =>
      apiFetch<{ data: PartnerAlias[] }>(`/partner-aliases${qs(params)}`),
    create: (data: {
      alias: string;
      partnerId?: string | null;
      resolutionType: 'direct' | 'contextual';
      contextRules?: unknown;
      notes?: string;
    }) =>
      apiFetch<PartnerAlias>('/partner-aliases', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<{
      alias: string;
      partnerId: string | null;
      resolutionType: string;
      contextRules: unknown;
      notes: string;
      isActive: boolean;
    }>) =>
      apiFetch<PartnerAlias>(`/partner-aliases/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deactivate: (id: string) =>
      apiFetch<{ success: boolean }>(`/partner-aliases/${id}/deactivate`, { method: 'PUT' }),
    seed: () =>
      apiFetch<{ created: number; skipped: number; warnings: string[] }>('/partner-aliases/seed', { method: 'POST' }),
  },

};

export { ApiError };
