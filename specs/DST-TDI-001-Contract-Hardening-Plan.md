---
spec_id: DST-TDI-001-Contract-Hardening-Plan
tested: false
reason: "planning document; implementation is validated by existing contract tests under functions/test/contracts/"
tags:
  - device-source-of-truth
  - plan
  - data-validation
  - adk
---
# Contract Hardening Plan: Shared DTOs, Strict Device Validation, and Numeric Coercion

> **Historical note.** This file is the original planning artifact for
> DST-TDI-001 and is preserved here for reference. The work it describes has
> already landed on `main`; treat implementation tasks below as a record of
> the plan at the time it was written, not as open work items.

## Summary

This workstream will harden the live API contract surface for devices, device specs, partner keys, telemetry history, reports, and audit data without pulling legacy import routes into scope.

The implementation will do four things in one coordinated pass:

1. Introduce a real shared contract package used by both frontend and backend.
2. Replace generic `Partial<T>` request typing with explicit request/response DTOs for the routes in scope.
3. Add strict backend validation for device and device-spec writes, plus centralized numeric coercion for read models.
4. Rebase the existing contract test suite onto the current schema so tests and runtime contracts stop drifting.

Grounding from current repo state:
- Backend contract tests already exist under `functions/test/contracts`.
- Frontend smoke tests already exist under `src/test/smoke`.
- Current failures already show drift:
  1. `functions/test/contracts/deviceSpecs.test.ts` is still asserting the legacy 12-section spec shape.
  2. `src/test/smoke/DashboardPage.test.tsx` expects a heading on `null` API data even though the page now renders a fallback state.

## Scope
In scope:
1. `GET/POST/PUT /api/devices`
2. `GET/PUT /api/device-specs/:deviceId`
3. `GET /api/partner-keys`
4. `GET /api/telemetry/history`
5. `GET /api/reports/dashboard`
6. `GET /api/reports/partner/:id`
7. `GET /api/reports/spec-coverage`
8. Shared enums and read models used by those routes and the consuming frontend pages
9. Contract tests and smoke tests impacted by those changes

Out of scope for this workstream:
1. `POST /api/upload/bulk-specs`
2. Migration import/write routes under `/api/upload/migration`
3. Deployment creation
4. Full codebase-wide migration of every shared type; this pass will migrate the audited surfaces and leave compatibility barrels for the rest

## Decisions Locked In
1. Shared contract strategy: create a new repo-level shared package.
2. Validation mode: strict reject by default.
3. Legacy import routes: deferred to a separate workstream.
4. Canonical device schema: `region` and `countriesIso2` are not device write fields.
5. Dashboard null-response behavior: keep the existing graceful fallback and update the smoke test to assert it.

## Important Public Contract Changes
1. `POST /api/devices` will accept only the explicit create DTO.
2. `PUT /api/devices/:id` will accept only mutable device fields.
3. `PUT /api/device-specs/:deviceId` will accept only the 16 known section keys and only known fields within those sections.
4. Invalid or unknown fields on the write routes above will return `400` with `{ error, detail }`.
5. Response DTOs for reports, partner key list items, telemetry history items, and device detail will be explicitly typed and shared.
6. `AuditEntityType` will include `partnerAlias` and `system` in the shared contract.
7. Partner keys will be modeled and tested as `regions: PartnerKeyRegion[]`, not `region: string`.
8. Numeric fields returned by device, device-spec, telemetry, and report endpoints will be normalized before leaving the backend.

## Implementation Plan

### 1. Create a Shared Contract Package
1. Add `packages/contracts/` as a local internal package named `@dst/contracts`.
2. Give it its own `package.json`, `tsconfig.json`, and `src/` entrypoint.
3. Add `@dst/contracts` as a local `file:` dependency in both the root `package.json` and `functions/package.json`.
4. Add package build steps so both frontend and functions builds/tests compile contracts first.
5. Keep `src/lib/types.ts` and `functions/src/types/index.ts` as temporary compatibility barrels.
6. In this pass, those barrel files will re-export the moved contracts from `@dst/contracts` and keep only truly frontend-only or backend-only leftovers.

### 2. Move the Shared Types That Matter for This Audit
Move these contracts into `@dst/contracts` now:

1. Primitives and enums:
   - `Timestamp`
   - `CertificationStatus`
   - `DeviceType`
   - `DeviceStatus`
   - `Region`
   - `PartnerKeyRegion`
   - `AuditEntityType`
   - `AlertStatus`
   - `AlertDismissReason`

2. Core entities:
   - `Partner`
   - `PartnerKey`
   - `Device`
   - `DeviceSpec`
   - `DeviceDeployment`
   - `TelemetrySnapshot`
   - `HardwareTier`
   - `AuditLogEntry`
   - `UploadHistory`

3. Enriched read models:
   - `PaginatedResponse<T>`
   - `DeviceWithRelations`
   - `DeviceDetail`
   - `PartnerWithStats`

4. Request DTOs:
   - `CreateDeviceRequest`
   - `UpdateDeviceRequest`
   - `SaveDeviceSpecRequest`

5. Response DTOs:
   - `PartnerKeyListItem`
   - `TelemetryHistoryItem`
   - `DashboardReportResponse`
   - `PartnerReportResponse`
   - `SpecCoverageReportResponse`

### 3. Define Canonical Device and Device-Spec DTOs
Define these DTOs in `@dst/contracts` and make them the only write contracts used by both frontend and backend.

1. `CreateDeviceRequest`
   - Required: `displayName`, `deviceId`, `partnerKeyId`
   - Optional: `deviceType`, `liveAdkVersion`, `certificationStatus`
   - Explicitly excluded: `region`, `countriesIso2`, `activeDeviceCount`, `specCompleteness`, `tierId`, `createdAt`, `updatedAt`, `id`

2. `UpdateDeviceRequest`
   - Allowed mutable fields only:
     - `displayName`
     - `partnerKeyId`
     - `deviceType`
     - `status`
     - `liveAdkVersion`
     - `certificationStatus`
     - `certificationNotes`
     - `lastCertifiedDate`
     - `questionnaireUrl`
     - `questionnaireFileUrl`
   - Explicitly rejected:
     - computed fields like `activeDeviceCount`, `specCompleteness`, `tierAssignedAt`
     - identity fields like `id`, `createdAt`, `updatedAt`

3. `SaveDeviceSpecRequest`
   - Allowed top-level keys only:
     - `general`
     - `hardware`
     - `firmwareUpdates`
     - `mediaCodec`
     - `frameRates`
     - `contentProtection`
     - `native`
     - `videoPlayback`
     - `uhdHdr`
     - `audioVideoOutput`
     - `other`
     - `appRuntime`
     - `audioCapabilities`
     - `accessibility`
     - `platformIntegration`
     - `performanceBenchmarks`
   - Each section must be an object.
   - Unknown section keys are rejected.
   - Unknown fields inside a known section are rejected.

### 4. Add Runtime Schemas in the Shared Package
Use `zod` inside `@dst/contracts` for the contracts in scope.

1. Add request schemas:
   - `CreateDeviceRequestSchema`
   - `UpdateDeviceRequestSchema`
   - `SaveDeviceSpecRequestSchema`

2. Add response schemas:
   - `DeviceSchema`
   - `DeviceWithRelationsSchema`
   - `DeviceDetailSchema`
   - `DeviceSpecSchema`
   - `PartnerKeyListItemSchema`
   - `TelemetryHistoryItemSchema`
   - `DashboardReportResponseSchema`
   - `PartnerReportResponseSchema`
   - `SpecCoverageReportResponseSchema`
   - `paginatedResponseSchema()`

3. Export TypeScript types from those schemas where useful for DTOs and read models.

This is not a full schema-first conversion. It is a shared-package contract layer with runtime schemas for the audited routes only.

### 5. Fix Backend Device Write Validation
1. Stop using `const updates = { ...req.body }` in `PUT /api/devices/:id`.
2. Parse `req.body` through `CreateDeviceRequestSchema` or `UpdateDeviceRequestSchema` before any Firestore write.
3. On validation failure, return `400` with:
   - `error: 'Invalid request payload'`
   - `detail` containing the rejected keys or schema issues
4. Persist `liveAdkVersion` on create instead of forcing `null`.
5. Keep `partnerKeyId` required on create.
6. Do not accept `region` or `countriesIso2` on device writes.
7. Only pass validated fields into Firestore.

### 6. Fix Backend Device-Spec Write Validation
1. Parse `PUT /api/device-specs/:deviceId` through `SaveDeviceSpecRequestSchema`.
2. Build the stored document from the validated payload only.
3. Default missing sections to `{}` so the persisted document remains structurally complete.
4. Reject unknown top-level sections and unknown nested fields with `400`.
5. Keep `deviceId` and `updatedAt` server-owned.
6. Recalculate spec completeness and tier assignment only after successful validation.

### 7. Centralize Numeric Coercion
Create a dedicated backend coercion layer and stop relying on ad hoc conversions in routes.

1. Add a `functions/src/services/coercion.ts` module.
2. Keep `safeNumber()` for loose human-entered counts.
3. Add stricter helpers for API/read models:
   - `coerceNumberOrZero`
   - `coerceNumberOrNull`
   - `coerceDeviceDoc`
   - `coerceTelemetrySnapshotDoc`
   - `coerceDeviceSpecDoc`
4. `coerceDeviceSpecDoc` must normalize all numeric leaf fields in the 16-section schema.
5. Apply the coercion layer in:
   - `functions/src/routes/devices.ts`
   - `functions/src/routes/reports.ts`
   - `functions/src/routes/search.ts` if it returns devices
6. Specifically guarantee numeric normalization for:
   - `Device.activeDeviceCount`
   - `Device.specCompleteness`
   - `TelemetrySnapshot.uniqueDevices`
   - `TelemetrySnapshot.eventCount`
   - numeric fields inside `DeviceSpec.hardware`, `frameRates`, `performanceBenchmarks`, and other numeric sections
7. Do not return raw Firestore values from the routes in scope.

### 8. Fix Region and Enriched Response Contract Drift in Scope
1. Standardize route DTOs on `PartnerKey.regions: PartnerKeyRegion[]`.
2. Update dashboard and spec-coverage report logic to derive region from `regions[0]` or an explicit normalization helper.
3. Add `partnerDisplayName` to the shared `PartnerKeyListItem` response contract.
4. Add `rollbackAvailable` to the shared `TelemetryHistoryItem` response contract.
5. Expand shared `AuditEntityType` to include `partnerAlias` and `system`.

### 9. Update Frontend API Layer to Use DTOs
1. Replace generic `crudEndpoints<T>` usage for devices and specs with explicit methods:
   - `api.devices.create(data: CreateDeviceRequest)`
   - `api.devices.update(id: string, data: UpdateDeviceRequest)`
   - `api.deviceSpecs.save(deviceId: string, data: SaveDeviceSpecRequest)`
2. Update report methods to return the shared response DTOs instead of inline anonymous shapes.
3. Remove route-local casts from:
   - `src/pages/DashboardPage.tsx`
   - `src/pages/SpecCoveragePage.tsx`
   - `src/pages/DeviceCreatePage.tsx`
   - `src/pages/DeviceDetailPage.tsx`
   - `src/pages/SpecEditPage.tsx`
   - `src/pages/PartnerKeyRegistryPage.tsx`
   - `src/pages/TelemetryUploadPage.tsx`

### 10. Align Frontend Behavior with the Canonical DTOs
1. `DeviceCreatePage`
   - Make `partnerKeyId` required client-side.
   - Stop sending `countriesIso2`.
   - Stop sending `region`.
   - Keep `liveAdkVersion`.
   - Remove or hide the create-form region/countries inputs in this workstream, because they are not part of the canonical device contract.

2. `DashboardPage`
   - Consume `DashboardReportResponse` directly.
   - Keep the null/error fallback.
   - Remove `Record<string, unknown>` parsing.

3. `SpecCoveragePage`
   - Consume `SpecCoverageReportResponse` directly.
   - Remove the cast.

4. `SpecEditPage`
   - Save against `SaveDeviceSpecRequest`.
   - Remove `as unknown as Partial<DeviceSpec>`.

### 11. Rebase the Existing Contract Test Suite Instead of Replacing It
Use the current `functions/test/contracts` harness and make it authoritative.

1. Replace `functions/test/contracts/schemas.ts` with imports from `@dst/contracts`.
2. Update `functions/test/helpers/fixtures.ts` to current data model:
   - `partnerKeys.regions[]` instead of `region`
   - 16-section `deviceSpecs`
   - telemetry rows with string numeric fixtures in targeted tests so coercion is actually exercised
3. Keep `supertest`, `vitest`, and the in-memory Firestore mock.

### 12. Add or Update Contract Tests for the Exact Gaps in Scope
Add these cases explicitly:

1. `functions/test/contracts/devices.test.ts`
   - list response matches `PaginatedResponse<DeviceWithRelations>`
   - detail response matches `DeviceDetail`
   - create persists `liveAdkVersion`
   - create rejects missing `partnerKeyId`
   - create rejects `region`, `countriesIso2`, and computed fields
   - update rejects `activeDeviceCount`, `specCompleteness`, `createdAt`, and `id`
   - detail coerces telemetry counts to numbers

2. `functions/test/contracts/deviceSpecs.test.ts`
   - GET matches the 16-section `DeviceSpecSchema`
   - PUT accepts the 16-section request DTO
   - numeric spec fields return as numbers
   - unknown top-level section returns `400`
   - unknown field within a known section returns `400`
   - missing device returns `404`

3. `functions/test/contracts/partnerKeys.test.ts`
   - each item matches `PartnerKeyListItem`
   - `partnerDisplayName` is present
   - `regions` is an array
   - pagination fields are present

4. `functions/test/contracts/telemetry.test.ts`
   - history response matches `PaginatedResponse<TelemetryHistoryItem>`
   - `rollbackAvailable` is present and boolean

5. `functions/test/contracts/reports.test.ts`
   - dashboard matches `DashboardReportResponse`
   - dashboard region breakdown uses `regions[]`
   - partner report device list numeric fields are numbers
   - spec coverage summary numeric fields are numbers
   - spec coverage row `region` is derived from the array-based partner key model

6. `functions/test/contracts/audit-or-shared-schema coverage`
   - contract schema accepts `partnerAlias`
   - contract schema accepts `system`

### 13. Keep and Adjust Smoke Tests Affected by the Contract Cleanup
1. Update `src/test/smoke/DashboardPage.test.tsx` so the null-response case asserts the fallback text, not the heading.
2. Update any page mocks that currently use legacy `DeviceSpec` or partner-key shapes.
3. Add a small smoke test for `DeviceCreatePage` if it does not already exist:
   - renders with partner-key options
   - blocks submit without `partnerKeyId`
   - does not crash when partner-key list is empty

## Acceptance Criteria
1. `npm test` passes at repo root.
2. `npm test` passes in `functions/`.
3. `npm run build` passes at repo root.
4. `npm run build` passes in `functions/`.
5. The routes in scope no longer accept unknown/computed device or device-spec write fields.
6. The routes in scope no longer leak string numerics for fields typed as numbers.
7. Contract tests import shared schemas from `@dst/contracts`, not a backend-only duplicate.
8. Frontend pages in scope no longer rely on `Record<string, unknown>` or `as unknown as` casts for these contracts.
9. `src/lib/types.ts` and `functions/src/types/index.ts` stop being divergent source-of-truth files for the moved contracts.

## Assumptions and Defaults
1. Strict validation is the default because no alternate validation mode was selected.
2. Device region/country entry is not a device contract concern and is removed from the create DTO.
3. Legacy import endpoints are deferred and must not be blocked by this workstream’s green suite.
4. The shared package will own the audited contracts only; long-tail types can stay in compatibility barrels until a later pass.
