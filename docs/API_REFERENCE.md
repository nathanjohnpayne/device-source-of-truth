# API Reference

Core REST API documentation for the Device Source of Truth backend. All endpoints are served from a single Firebase Cloud Function and are prefixed with `/api`.

This reference currently covers the primary CRUD, upload, and reporting routes. Newer questionnaire-intake, field-options, user-admin, alias, and version-mapping endpoints are documented in [`AGENTS.md`](../AGENTS.md) and the backend route files until this reference is expanded.

---

## Authentication

Every request must include a Firebase Auth ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

The `authenticate` middleware validates the token, checks that the email domain is `@disney.com` or `@disneystreaming.com`, and resolves the user's role from the `users` Firestore collection.

### Error Responses (Auth)

| Status | Body | Cause |
|---|---|---|
| 401 | `{ "error": "Missing or invalid Authorization header" }` | No Bearer token |
| 401 | `{ "error": "Token does not contain an email" }` | Malformed token |
| 401 | `{ "error": "Invalid or expired token" }` | Token failed verification |
| 401 | `{ "error": "User not found in system" }` | No matching `users` document |
| 403 | `{ "error": "Email domain not authorized" }` | Email not `@disney.com` or `@disneystreaming.com` |
| 403 | `{ "error": "Insufficient permissions" }` | User role lacks required permission |

---

## Common Patterns

### Pagination

List endpoints return paginated results:

```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "pageSize": 50,
  "totalPages": 3
}
```

Query parameters:
- `page` (number, default: 1) — page number
- `pageSize` (number, default: 50, max: 200) — items per page

### Error Format

All errors follow this shape:

```json
{
  "error": "Human-readable error message",
  "detail": "Technical detail (optional)"
}
```

---

## Partners

### List Partners

```
GET /api/partners
```

**Auth:** any authenticated user

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `region` | string | Filter by region (`NA`, `EMEA`, `LATAM`, `APAC`) |
| `search` | string | Case-insensitive substring match on `displayName` |
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 50, max: 200) |

**Response:** `PaginatedResponse<PartnerWithStats>`

Each partner includes computed stats:

```json
{
  "data": [
    {
      "id": "abc123",
      "displayName": "Samsung Electronics",
      "regions": ["NA", "EMEA"],
      "countriesIso2": ["US", "CA", "GB"],
      "createdAt": "2026-02-25T00:00:00.000Z",
      "updatedAt": "2026-02-25T00:00:00.000Z",
      "partnerKeyCount": 5,
      "deviceCount": 42,
      "activeDeviceCount": 1250000
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 50,
  "totalPages": 1
}
```

### Get Partner Detail

```
GET /api/partners/:id
```

**Auth:** any authenticated user

**Response:** Partner with nested `partnerKeys[]` and `devices[]` arrays.

### Create Partner

```
POST /api/partners
```

**Auth:** editor or admin

**Request Body:**

```json
{
  "displayName": "Samsung Electronics",
  "regions": ["NA", "EMEA"],
  "countriesIso2": ["US", "CA", "GB"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `displayName` | string | yes | Partner display name |
| `regions` | string[] | no | Region codes (defaults to `[]`) |
| `countriesIso2` | string[] | no | Country codes (defaults to `[]`) |

**Response:** `201 Created` with the created partner document.

### Update Partner

```
PUT /api/partners/:id
```

**Auth:** editor or admin

**Request Body:** Partial partner fields to update (same fields as create). `id` and `createdAt` are stripped.

**Response:** Updated partner document.

### Delete Partner

```
DELETE /api/partners/:id
```

**Auth:** admin only

**Response:** `{ "success": true }`

---

## Partner Keys

### List Partner Keys

```
GET /api/partner-keys
```

**Auth:** any authenticated user

**Response:** `{ "data": PartnerKey[] }` — each key includes a resolved `partnerDisplayName`.

### Create Partner Key

```
POST /api/partner-keys
```

**Auth:** admin only

**Request Body:**

```json
{
  "key": "samsung-tizen-mt5867",
  "partnerId": "abc123",
  "chipset": "MT5867",
  "oem": "Samsung",
  "region": "NA",
  "countries": ["US", "CA"]
}
```

**Response:** `201 Created` with the created partner key document.

### Update Partner Key

```
PUT /api/partner-keys/:id
```

**Auth:** admin only

**Response:** Updated partner key document.

### Delete Partner Key

```
DELETE /api/partner-keys/:id
```

**Auth:** admin only

**Response:** `{ "success": true }`

---

## Devices

### List Devices

```
GET /api/devices
```

**Auth:** any authenticated user

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `partnerId` | string | Filter by partner (resolves through partner keys) |
| `partnerKeyId` | string | Filter by partner key |
| `region` | string | Filter by region (resolves through partner keys) |
| `deviceType` | string | Filter by device type (`STB`, `Smart TV`, etc.) |
| `certificationStatus` | string | Filter by certification status |
| `tierId` | string | Filter by hardware tier |
| `specCompleteness` | string | `has_specs` or `missing_specs` |
| `search` | string | Substring match on `displayName` or `deviceId` |
| `page` | number | Page number |
| `pageSize` | number | Items per page |

**Response:** `PaginatedResponse<DeviceWithRelations>`

Each device includes resolved names:

```json
{
  "data": [
    {
      "id": "dev123",
      "displayName": "Samsung UN55TU7000",
      "deviceId": "samsung_un55tu7000",
      "partnerKeyId": "pk456",
      "deviceType": "Smart TV",
      "status": "active",
      "activeDeviceCount": 85000,
      "specCompleteness": 72,
      "tierId": "tier1",
      "partnerName": "Samsung Electronics",
      "partnerKeyName": "samsung-tizen-mt5867",
      "tierName": "Tier 1"
    }
  ]
}
```

**Default sort:** `activeDeviceCount` descending (most popular devices first).

### Get Device Detail

```
GET /api/devices/:id
```

**Auth:** any authenticated user

**Response:** `DeviceDetail` — full device with all related data:

```json
{
  "id": "dev123",
  "displayName": "Samsung UN55TU7000",
  "...device fields...",
  "partner": { "id": "...", "displayName": "Samsung Electronics", "..." },
  "partnerKey": { "id": "...", "key": "samsung-tizen-mt5867", "..." },
  "spec": { "id": "...", "identity": {}, "soc": {}, "...12 categories..." },
  "tier": { "id": "...", "tierName": "Tier 1", "..." },
  "deployments": [],
  "telemetrySnapshots": [],
  "auditHistory": []
}
```

Telemetry snapshots are limited to the 20 most recent. Audit history is limited to the 50 most recent entries.

### Create Device

```
POST /api/devices
```

**Auth:** editor or admin

**Request Body:**

```json
{
  "displayName": "Samsung UN55TU7000",
  "deviceId": "samsung_un55tu7000",
  "partnerKeyId": "pk456",
  "deviceType": "Smart TV",
  "certificationStatus": "Not Submitted"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `displayName` | string | yes | Human-readable name |
| `deviceId` | string | yes | Unique Datadog join key |
| `partnerKeyId` | string | yes | Reference to partner key |
| `deviceType` | string | no | Device type (defaults to `Other`) |
| `certificationStatus` | string | no | Certification status (defaults to `Not Submitted`) |

**Response:** `201 Created`. Returns `409 Conflict` if `deviceId` already exists.

### Update Device

```
PUT /api/devices/:id
```

**Auth:** editor or admin

**Request Body:** Partial device fields to update.

**Response:** Updated device document.

### Delete Device

```
DELETE /api/devices/:id
```

**Auth:** admin only

**Response:** `{ "success": true }`

---

## Device Specs

### Get Device Specs

```
GET /api/device-specs/:deviceId
```

**Auth:** any authenticated user

**Response:** `DeviceSpec` object with all 12 category sub-objects. Returns `404` if no specs exist for this device.

### Create/Update Device Specs

```
PUT /api/device-specs/:deviceId
```

**Auth:** editor or admin

**Request Body:** Full or partial `DeviceSpec` object. The `deviceId` field is set from the URL parameter.

**Side Effects:**
1. Calculates spec completeness percentage and updates the device's `specCompleteness` field
2. Runs tier assignment engine and updates the device's `tierId` field
3. Creates `deviceTierAssignment` history record if tier changed
4. Logs field-level audit entries for all changed fields

**Response:** Updated device spec document.

---

## Hardware Tiers

### List Tiers

```
GET /api/tiers
```

**Auth:** any authenticated user

**Response:** `{ "data": HardwareTier[] }` — sorted by `tierRank` ascending.

### Get Tier Detail

```
GET /api/tiers/:id
```

**Auth:** any authenticated user

**Response:** Tier document plus `assignedDeviceCount` (number of devices currently assigned to this tier).

### Create Tier

```
POST /api/tiers
```

**Auth:** admin only

**Request Body:**

```json
{
  "tierName": "Tier 1",
  "tierRank": 1,
  "ramMin": 2048,
  "gpuMin": 256,
  "cpuSpeedMin": 1500,
  "cpuCoresMin": 4,
  "requiredCodecs": ["hevc", "av1", "eac3"],
  "require64Bit": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `tierName` | string | yes | Display name |
| `tierRank` | number | yes | Sort order (1 = highest) |
| `ramMin` | number | no | Minimum app-available RAM (MB) |
| `gpuMin` | number | no | Minimum GPU memory (MB) |
| `cpuSpeedMin` | number | no | Minimum CPU speed (MHz) |
| `cpuCoresMin` | number | no | Minimum CPU cores |
| `requiredCodecs` | string[] | no | Required codec support (defaults to `[]`) |
| `require64Bit` | boolean | no | 64-bit requirement (defaults to `false`) |

**Response:** `201 Created` with the created tier document.

### Update Tier

```
PUT /api/tiers/:id
```

**Auth:** admin only

**Side Effects:** After updating the tier definition, **all devices are reassigned** via `reassignAllDevices()`. The response includes `devicesReassigned` count.

**Response:** Updated tier document with `devicesReassigned: number`.

### Delete Tier

```
DELETE /api/tiers/:id
```

**Auth:** admin only

**Response:** `{ "success": true }`

### Preview Tier Assignment

```
POST /api/tiers/preview
```

**Auth:** admin only

**Request Body:**

```json
{
  "tiers": [
    { "id": "t1", "tierName": "Tier 1", "tierRank": 1, "ramMin": 2048, "..." },
    { "id": "t2", "tierName": "Tier 2", "tierRank": 2, "ramMin": 1024, "..." }
  ]
}
```

**Response:** Mapping of tier IDs to device counts and device ID lists, including an `unassigned` bucket.

```json
{
  "t1": { "tierName": "Tier 1", "count": 45, "devices": ["dev1", "dev2", "..."] },
  "t2": { "tierName": "Tier 2", "count": 120, "devices": ["dev3", "..."] },
  "unassigned": { "tierName": "Unassigned", "count": 15, "devices": ["dev4", "..."] }
}
```

This is a **read-only** operation — no device assignments are changed.

### Simulate Eligibility

```
POST /api/tiers/simulate
```

**Auth:** editor or admin

**Request Body:** Feature requirements to test against all device specs:

```json
{
  "ramMin": 1500,
  "gpuMin": 128,
  "cpuSpeedMin": 1200,
  "require64Bit": true,
  "requiredCodecs": ["hevc"]
}
```

**Response:**

```json
{
  "eligibleCount": 85,
  "ineligibleCount": 45,
  "eligible": ["deviceId1", "deviceId2", "..."],
  "ineligible": ["deviceId3", "..."]
}
```

---

## Telemetry

### Upload Telemetry CSV

```
POST /api/telemetry/upload
```

**Auth:** admin only

**Request Body:**

```json
{
  "csvData": "partner,device,core_version,count_unique_device_id,count\n...",
  "snapshotDate": "2026-02-25",
  "fileName": "telemetry_2026-02-25.csv"
}
```

**Expected CSV columns:**

| Column | Description |
|---|---|
| `partner` | Partner key string |
| `device` | Device identifier |
| `core_version` | ADK core version |
| `count_unique_device_id` | Unique device count |
| `count` | Total event count |

**Side Effects:**
1. Creates `telemetrySnapshot` documents for each row
2. Generates `alerts` for unregistered partner keys and devices
3. Creates `uploadHistory` record

**Response:** Upload summary with row counts and any errors.

### Get Upload History

```
GET /api/telemetry/history
```

**Auth:** any authenticated user

**Response:** `PaginatedResponse<UploadHistory>`

---

## Alerts

### List Alerts

```
GET /api/alerts
```

**Auth:** any authenticated user

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `type` | string | Filter by alert type (`unregistered_device`, `new_partner_key`, `inactive_key`) |
| `status` | string | Filter by status (`open`, `dismissed`) |
| `page` | number | Page number |
| `pageSize` | number | Items per page |

**Response:** `PaginatedResponse<Alert>`

### Dismiss Alert

```
PUT /api/alerts/:id/dismiss
```

**Auth:** admin only

**Request Body:**

```json
{
  "dismissReason": "Test Device"
}
```

Valid dismiss reasons: `Test Device`, `Duplicate Key`, `Will Register`, `Internal / Deprecated`

**Response:** Updated alert document with `status: "dismissed"`.

---

## Audit Log

### List Audit Entries

```
GET /api/audit
```

**Auth:** any authenticated user

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `entityType` | string | Filter by entity type |
| `entityId` | string | Filter by entity document ID |
| `userId` | string | Filter by user who made the change |
| `startDate` | string | ISO date — filter entries after this date |
| `endDate` | string | ISO date — filter entries before this date |
| `page` | number | Page number |
| `pageSize` | number | Items per page |

**Response:** `PaginatedResponse<AuditLogEntry>`

Default sort: `timestamp` descending (most recent first).

---

## Search

### Global Search

```
GET /api/search?q=samsung
```

**Auth:** any authenticated user

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `q` | string | Search query (case-insensitive substring match) |

**Response:**

```json
{
  "devices": [...],
  "partners": [...],
  "partnerKeys": [...]
}
```

Searches across `displayName` and `deviceId` on devices, `displayName` on partners, and `key` on partner keys. Limited to first 10 results per category.

---

## Reports

### Dashboard Report

```
GET /api/reports/dashboard
```

**Auth:** any authenticated user

**Response:** Aggregated KPIs:

```json
{
  "totalDevices": 500,
  "totalActiveDevices": 2500000,
  "specCoverage": 68,
  "openAlerts": 12,
  "totalPartnerKeys": 150,
  "certificationBreakdown": { "Certified": 200, "Pending": 50, "..." },
  "tierBreakdown": { "Tier 1": 100, "Tier 2": 200, "Unassigned": 200 },
  "deviceTypeBreakdown": { "Smart TV": 300, "STB": 150, "..." },
  "topDevices": [...]
}
```

### Partner Report

```
GET /api/reports/partner/:id
```

**Auth:** any authenticated user

**Response:** Partner-specific statistics and device breakdown.

### Spec Coverage Report

```
GET /api/reports/spec-coverage
```

**Auth:** any authenticated user

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `partnerId` | string | Filter by partner |
| `deviceType` | string | Filter by device type |

**Response:** Per-device spec completeness data with category-level breakdown.

---

## Upload / Migration

### Migrate Devices from CSV

```
POST /api/upload/migration
```

**Auth:** admin only

**Request Body:**

```json
{
  "csvData": "device_id,display_name,partner_key,device_type,...\n..."
}
```

**Expected CSV columns:**

| Column | Alternate Name | Description |
|---|---|---|
| `device_id` | `deviceId` | Unique device identifier (required) |
| `display_name` | `displayName` | Device display name |
| `partner_key` | `partnerKeyId` | Partner key reference |
| `device_type` | `deviceType` | Device type |
| `adk_version` | — | ADK version |
| `certification_status` | — | Certification status |
| `certification_notes` | — | Certification notes |
| `questionnaire_url` | — | Questionnaire URL |
| `active_device_count` | — | Active device count |

Duplicate `deviceId` values are skipped (not overwritten).

**Response:**

```json
{
  "success": true,
  "totalRows": 500,
  "created": 480,
  "duplicates": 15,
  "errored": 5,
  "errors": ["Row missing device_id", "..."]
}
```

### Get Migration CSV Template

```
GET /api/upload/migration/template
```

**Auth:** any authenticated user

**Response:** CSV file download with column headers.

### Bulk Import Specs

```
POST /api/upload/bulk-specs
```

**Auth:** editor or admin

**Request Body:** Either CSV data or base64-encoded XLSX:

```json
{
  "csvData": "device_id,device_model,manufacturer,...\n..."
}
```

Or:

```json
{
  "fileData": "<base64-encoded-xlsx>",
  "fileType": "xlsx"
}
```

Supports 90+ columns matching all spec fields. See the template endpoint for the full column list.

**Side Effects:**
1. Creates or updates `deviceSpecs` document for each matched device
2. Recalculates `specCompleteness` on each device
3. Runs tier assignment for each device

**Response:**

```json
{
  "success": true,
  "totalRows": 100,
  "matched": 90,
  "notFound": 8,
  "errored": 2,
  "errors": ["Device not found: xyz123", "..."]
}
```

### Get Bulk Specs CSV Template

```
GET /api/upload/bulk-specs/template
```

**Auth:** any authenticated user

**Response:** CSV file download with all 90+ spec column headers.
