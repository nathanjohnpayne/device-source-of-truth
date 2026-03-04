import { logEvent } from './firebase';

export type AnalyticsEvent =
  | 'page_view'
  | 'login'
  | 'login_failed'
  | 'device_search'
  | 'device_filter'
  | 'device_view'
  | 'device_register'
  | 'device_update'
  | 'partner_view'
  | 'partner_create'
  | 'partner_update'
  | 'spec_form_open'
  | 'spec_form_save'
  | 'spec_bulk_import'
  | 'questionnaire_upload'
  | 'telemetry_upload'
  | 'alert_dismiss'
  | 'tier_definition_save'
  | 'tier_preview'
  | 'simulator_run'
  | 'global_search'
  | 'report_view'
  | 'export'
  | 'audit_log_view'
  | 'migration_run'
  | 'clear_all_data'
  | 'readiness_declare'
  | 'onboarding_start'
  | 'onboarding_complete'
  | 'help_tooltip_view'
  | 'field_option_reorder'
  | 'field_option_update'
  | 'field_option_delete'
  | 'field_option_create'
  | 'partner_key_import_preview'
  | 'partner_key_import_complete'
  | 'partner_key_import_rollback'
  | 'partner_key_ai_disambiguation'
  | 'partner_key_clarification_resolved'
  | 'intake_ai_disambiguation'
  | 'intake_clarification_resolved'
  | 'partner_alias_saved'
  | 'partner_aliases_seeded';

export interface AnalyticsParams {
  page_view: { page_title: string; page_path: string };
  login: { method: string };
  login_failed: { reason: string };
  device_search: { query: string };
  device_filter: { filters: string };
  device_view: { device_id: string };
  device_register: { device_id: string };
  device_update: { device_id: string; fields: string };
  partner_view: { partner_id: string };
  partner_create: { partner_name: string };
  partner_update: { partner_id: string };
  spec_form_open: { device_id: string };
  spec_form_save: { device_id: string; category: string };
  spec_bulk_import: { count: number };
  questionnaire_upload: { device_id: string };
  telemetry_upload: { file_name: string; row_count: number };
  alert_dismiss: { alert_id: string; reason: string };
  tier_definition_save: { tier_name: string };
  tier_preview: { tier_count: number };
  simulator_run: { result_tier: string };
  global_search: { query_length: number; result_count: number };
  report_view: { report_type: string };
  export: { type: string; format: string };
  audit_log_view: { entity_type?: string };
  migration_run: { row_count: number };
  clear_all_data: { deleted_collections: number; deleted_records: number };
  readiness_declare: { device_id: string };
  onboarding_start: Record<string, never>;
  onboarding_complete: Record<string, never>;
  help_tooltip_view: { tooltip_id: string };
  field_option_reorder: { dropdown_key: string };
  field_option_update: { dropdown_key: string; option_id: string };
  field_option_delete: { dropdown_key: string; option_id: string };
  field_option_create: { dropdown_key: string };
  partner_key_import_preview: { row_count: number };
  partner_key_import_complete: { imported: number };
  partner_key_import_rollback: { batch_id: string };
  partner_key_ai_disambiguation: { auto_resolved: number; questions: number; fallback: boolean };
  partner_key_clarification_resolved: { answered: number };
  intake_ai_disambiguation: { auto_resolved: number; questions: number; fallback: boolean };
  intake_clarification_resolved: { answered: number };
  partner_alias_saved: { resolution_type: string };
  partner_aliases_seeded: { created: number };
}

export function trackEvent<E extends AnalyticsEvent>(
  name: E,
  params?: AnalyticsParams[E],
) {
  if (import.meta.env.DEV) return;
  logEvent(name, params as Record<string, string | number | boolean | undefined>);
}

export function trackPageView(pageName: string, pagePath: string) {
  trackEvent('page_view', { page_title: pageName, page_path: pagePath });
}
