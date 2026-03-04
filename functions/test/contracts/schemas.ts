/**
 * Re-export all contract schemas from the shared package.
 * Contract tests should import from here or directly from @dst/contracts.
 */
export {
  paginatedResponseSchema,
  PartnerSchema,
  PartnerWithStatsSchema,
  PartnerKeySchema,
  PartnerKeyListItemSchema,
  DeviceSchema,
  DeviceWithRelationsSchema,
  DeviceSpecSchema,
  DeviceDetailSchema,
  HardwareTierSchema,
  DeploymentSchema,
  TelemetrySnapshotSchema,
  AuditLogEntrySchema,
  UploadHistorySchema,
  TelemetryHistoryItemSchema,
  AlertSchema,
  DashboardReportResponseSchema,
  PartnerReportResponseSchema,
  SpecCoverageReportResponseSchema,
  TierPreviewSchema,
  SimulateResultSchema,
  SearchResultSchema,
  ErrorSchema,
  CreateDeviceRequestSchema,
  UpdateDeviceRequestSchema,
  SaveDeviceSpecRequestSchema,
} from '@dst/contracts';
