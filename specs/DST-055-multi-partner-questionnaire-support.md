# DST-055 — Multi-Partner Questionnaire Support

| Field | Value |
|---|---|
| **Story ID** | DST-055 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T3 — Hardware Spec Ingestion |
| **Priority** | P1 |
| **Story Points** | 8 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-047 (Questionnaire Intake & AI Extraction), DST-048 (Admin Review & Sign-Off), DST-038 (Partner Key Registry), DST-046 (Partner Alias Registry) |
| **Blocks** | Nothing |
| **Amends** | DST-047 (partner detection and data model), DST-048 (Step 1 partner assignment and sign-off commit) |

---

## User Story

As an Admin, I can ingest a questionnaire submitted by an umbrella organization on behalf of multiple operating brands — where a single device may be deployed by several partners, each with its own markets, certification status, and partner key — so that every deployment relationship is captured in the registry without collapsing distinct partner records into one or discarding any deployment data.

---

## Background

DST-047 and DST-048 were designed around a one-to-one assumption: one questionnaire file maps to one partner, and every device in that file belongs to that partner. This assumption breaks for Liberty Global and similar umbrella organizations.

**The Liberty Global pattern.** Liberty Global submits a single questionnaire covering devices deployed across its European operating brands: VodafoneZiggo (Netherlands), Virgin Media O2 (UK), Telenet (Belgium), Sunrise/UPC (Switzerland), and Virgin Media (Ireland). The file itself is attributed to "Liberty Global" — but no device is deployed by "Liberty Global" directly. Each device column (EOSv1, EOSv2, Apollo, Apollo V1+) is deployed by a subset of those brands, identified in the "model name" question, the "countries deployed" question, and an ancillary "Certs and extensions" sheet that maps partner brands to certification status per device.

From the reference file (`Disney__STB_Technical_Questionnaire_-_Virgin_Media__Ziggo_Telenet_Liberty_Global_-_v1_2.xlsx`):

| Device column | Deployed by |
|---|---|
| EOSv1 (HZN4/360 SW) | VodafoneZiggo (NL), Virgin Media O2 (UK), Telenet (BE), Sunrise/UPC (CH) |
| EOSv2 (HZN4/360 SW) | VodafoneZiggo (NL), Telenet (BE), Sunrise/UPC (CH) |
| Apollo (Bento/TV2.0/Stream SW) | Virgin Media O2 (UK), UPC Poland, Virgin Media (IE) |
| Apollo V1+ | Telenet (BE), Sunrise (CH) |
| EOSv1 (TiVo SW) | Virgin Media O2 (UK) |

This is not an edge case. Any partner with a multi-brand or multi-country structure — telco groups, cable MSOs — will submit questionnaires in this pattern.

**What changes.** The following assumptions in DST-047 and DST-048 must be updated:

1. `questionnaire_intake_jobs.partner_id` (single FK) cannot represent the full submitter + brand picture.
2. `questionnaire_staged_devices` has no mechanism to associate a device with multiple partners.
3. The DST-048 Step 1 "Assign Partner" flow presents a single partner picker, which is wrong.
4. The sign-off commit writes one `device_questionnaire_sources` record per device, not one per device-partner pair.
5. The "Certs and extensions" sheet — present in LG questionnaires — is currently ignored.

This story addresses all five.

---

## Data Model Changes

### Amendment to `questionnaire_intake_jobs`

**Remove:** `partner_id uuid FK partners NULLABLE`  
**Remove:** `partner_confidence float NULLABLE`  
**Remove:** `partner_detection_method text NULLABLE`

**Add:** `submitter_partner_id uuid FK partners NULLABLE` — the entity that submitted the file (e.g., Liberty Global). May be a parent entity with no direct device deployments. Null until confirmed by admin.  
**Add:** `submitter_detection_method text NULLABLE` — `'filename'`, `'content'`, `'ai'`, `'admin'`  
**Add:** `submitter_confidence float NULLABLE`  
**Add:** `is_multi_partner boolean NOT NULL DEFAULT false` — true if the parser detects multiple operating brands in device answers or in a secondary certs/partner sheet.

The submitter is who sent the file. It is not necessarily the partner associated with any device.

### New table: `questionnaire_intake_partners`

One record per operating brand identified in a questionnaire, across all device columns. This is the many-to-many bridge between an intake job and the set of partners whose devices appear in it.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `intake_job_id` | `uuid` FK `questionnaire_intake_jobs` NOT NULL | |
| `partner_id` | `uuid` FK `partners` NULLABLE | Matched to registry; null if unresolved |
| `raw_detected_name` | `text` NOT NULL | Brand name as extracted from questionnaire content (e.g., "VodafoneZiggo NL", "Virgin Media UK") |
| `detection_source` | `text` NOT NULL | `'model_name_cell'`, `'countries_cell'`, `'certs_sheet'`, `'ai'`, `'admin'` |
| `match_confidence` | `float` NULLABLE | |
| `match_method` | `text` NULLABLE | `'alias'`, `'ai'`, `'admin'` |
| `review_status` | `text` NOT NULL DEFAULT `'pending'` | `'pending'`, `'confirmed'`, `'rejected'` |
| `created_at` | `timestamptz` NOT NULL | |

### New table: `questionnaire_staged_device_partners`

Maps each staged device to the specific partners it is deployed by. This is the per-device-per-partner junction.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `staged_device_id` | `uuid` FK `questionnaire_staged_devices` NOT NULL | |
| `intake_partner_id` | `uuid` FK `questionnaire_intake_partners` NOT NULL | |
| `countries` | `text[]` NULLABLE | Countries where this device is deployed by this partner (parsed from "countries deployed" answer) |
| `certification_status` | `text` NULLABLE | From certs sheet: `'certified'`, `'cert_extended'`, `'not_available'`, `'pending'`, null if not in certs sheet |
| `certification_adk_version` | `text` NULLABLE | ADK version from cert text, if parseable (e.g., "3.1.1", "3.0.0") |
| `partner_model_name` | `text` NULLABLE | Partner-specific consumer name for this device (e.g., "TV360" for Virgin Media, "Mediabox next" for VodafoneZiggo) |
| `detection_source` | `text` NOT NULL | `'model_name_cell'`, `'certs_sheet'`, `'ai'`, `'admin'` |
| `review_status` | `text` NOT NULL DEFAULT `'pending'` | `'pending'`, `'confirmed'`, `'rejected'` |
| UNIQUE | (`staged_device_id`, `intake_partner_id`) | One deployment record per device-partner pair |

### Amendment to `device_questionnaire_sources`

**Add:** `partner_id uuid FK partners NOT NULL` — which partner this deployment link is for.  
**Change UNIQUE constraint:** from `(device_id, intake_job_id)` to `(device_id, intake_job_id, partner_id)` — a device can have multiple deployment records from the same intake job, one per partner.

### New table: `device_partner_deployments`

The committed, canonical record of which partners deploy a given device. Created at sign-off from `questionnaire_staged_device_partners`. This is the permanent many-to-many between `devices` and `partners`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `device_id` | `uuid` FK `devices` NOT NULL | |
| `partner_id` | `uuid` FK `partners` NOT NULL | |
| `countries` | `text[]` NULLABLE | Countries where this partner deploys this device |
| `partner_model_name` | `text` NULLABLE | Consumer-facing name used by this partner for this device |
| `certification_status` | `text` NULLABLE | Current certification status |
| `certification_adk_version` | `text` NULLABLE | |
| `active` | `boolean` NOT NULL DEFAULT true` | False if deployment has ended |
| `source_intake_job_id` | `uuid` FK `questionnaire_intake_jobs` NULLABLE | Intake job that created or last updated this record |
| `created_at` | `timestamptz` NOT NULL | |
| `updated_at` | `timestamptz` NOT NULL | |
| UNIQUE | (`device_id`, `partner_id`) | |

---

## Parser Changes (DST-047 Amendment)

### Multi-partner detection

After format detection and device column identification, the parser runs a multi-partner detection pass before AI extraction. This pass looks for three signals, in order:

**Signal 1: Secondary partner/certs sheet.**

If the workbook contains a sheet named "Certs and extensions", "Certs", "Certifications", or any sheet where cell B1 or C1 contains a device column header from the primary sheet, treat it as a partner-certification matrix. Parse it as follows:

- Column A: operating brand labels (e.g., "UK (VMO2)", "NL (Ziggo)", "BE (Telenet)")
- Row 1: device column headers (must match headers from the primary sheet, ignoring whitespace)
- Intersection cells: certification status text

For each non-null intersection cell, create a `questionnaire_staged_device_partners` record. The operating brand label in column A is matched against the Partner Alias Registry (DST-046). The certification cell text is parsed for status keywords:

| Cell text contains | `certification_status` |
|---|---|
| "Certified" (case-insensitive) | `'certified'` |
| "Cert extended" | `'cert_extended'` |
| "Not available" | `'not_available'` |
| "Pending" | `'pending'` |
| Any other non-null text | `'certified'` (flagged for admin review) |

ADK version is extracted from the certification text via regex: any substring matching `\d+\.\d+(\.\d+)?` (e.g., "3.1.1", "3.0.0", "3.0.1").

Setting `is_multi_partner = true` on the intake job if two or more distinct operating brand labels are detected.

**Signal 2: Model name cell — multi-line or parenthetical brand mentions.**

The "model name" question answer (question 1.0 in the reference format) often contains newline-delimited brand mentions: "Mediabox next (VodafoneZiggo NL)\nTV360 (Virgin Media UK & IE)\nTelenet TV Box (Telenet BE)". The parser splits on newlines and applies regex to extract parenthetical brand references. Each extracted brand string is matched against the Partner Alias Registry. Matches create `questionnaire_intake_partners` records with `detection_source = 'model_name_cell'`.

The per-brand consumer model name (e.g., "Mediabox next", "TV360", "Telenet TV Box") is stored in `questionnaire_staged_device_partners.partner_model_name`.

**Signal 3: Countries deployed cell.**

The "countries deployed" question (question 7.0 in the reference format) may contain text like "Netherlands, UK, Belgium, Ireland, Switzerland - operated by LGI". Country codes or names are extracted and cross-referenced against known country-partner mappings in the `device_partner_deployments` registry. This signal is lower confidence and only used to supplement Signals 1 and 2, not as a standalone source.

### Submitter vs. operating brand distinction

When multi-partner signals are detected:

- The file-level entity (detected from filename or AI) is stored as `submitter_partner_id`. Liberty Global, Comcast, Sky Group, etc., are submitters, not deployers.
- The per-device brands detected from Signals 1 and 2 are the operating partners and stored in `questionnaire_intake_partners`.
- If no multi-partner signals are detected, `submitter_partner_id` and the single detected partner are the same entity, and the intake job behaves exactly as in DST-047.

### Format table update (DST-047 amendment)

Add a new format family:

| Format ID | Identifying signals | Sheet target | Header row signal | Notes |
|---|---|---|---|---|
| `lg_stb_v1_2` | Primary sheet named "STB Tech Questionnaire"; row 1 has "No.", "Category", "Description"; second sheet named "Certs and extensions" with device headers in row 1 | Primary: "STB Tech Questionnaire" | Row 1 | Multi-partner; certs sheet parsed separately |

This is a superset of `lg_stb_v1`. The distinguishing signal is the presence of "Certs and extensions" as a second sheet.

---

## AI Extraction Prompt Changes (DST-047 Amendment)

For multi-partner questionnaires, the per-device chunk prompt gains two additional context fields:

```
User:
Submitter: {submitter_display_name}          ← was "Partner:"
Operating partners for this device: {comma-separated list of confirmed brand names}
Device column header: {raw_header_label}
Platform type: {platform_type}
Chunk: {chunk_index + 1} of {total_chunks}
```

The AI is instructed not to try to extract partner-specific values as separate spec fields — hardware specs (SoC, RAM, codecs, DRM) are device-level facts, not partner-level. Partner-specific information (consumer name, countries, certification) has already been captured in the structured parsing pass and should not be re-extracted in the field extraction call.

---

## Review Workflow Changes (DST-048 Amendment)

### Step 1 replacement: Confirm Submitter & Resolve Partners

Step 1 is expanded from a single partner picker into a two-panel screen. It is required when `is_multi_partner = true` or when `submitter_partner_id` is null.

```
┌──────────────────────────────────────────────────────────────────┐
│  Step 1 of 4: Confirm Submitter & Partners                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SUBMITTER (who sent this file)                                  │
│  ──────────────────────────────                                  │
│  Detected:  Liberty Global   (confidence: 0.94, from filename)   │
│  [ Liberty Global                                          ▼ ]   │
│  The submitter may be a parent organization. Devices are         │
│  assigned to operating brands below.                             │
│                                                                  │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│  OPERATING BRANDS (partners that deploy these devices)           │
│  ─────────────────────────────────────────────────────           │
│  DST detected 4 operating brands across 5 devices.              │
│  Unresolved brands must be matched before sign-off.             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  "UK (VMO2)"                                               │  │
│  │  Detected via: Certs sheet · 3 devices                     │  │
│  │  Matched to:  Virgin Media O2  ✓  (alias match)            │  │
│  │  [ Virgin Media O2                                   ▼ ]   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  "NL (Ziggo)"                                              │  │
│  │  Detected via: Certs sheet · 2 devices                     │  │
│  │  Matched to:  VodafoneZiggo  ✓  (alias match)              │  │
│  │  [ VodafoneZiggo                                     ▼ ]   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  "BE (Telenet)"                                            │  │
│  │  Detected via: Certs sheet · 3 devices                     │  │
│  │  Matched to:  Telenet  ✓  (alias match)                    │  │
│  │  [ Telenet                                           ▼ ]   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  "VodafoneZiggo NL"                           ⚠ Duplicate? │  │
│  │  Detected via: Model name cell · 2 devices                 │  │
│  │  Matched to:  VodafoneZiggo  ✓  (alias match)              │  │
│  │  [ VodafoneZiggo                                     ▼ ]   │  │
│  │  ⓘ  Already matched by "NL (Ziggo)" above. If these are   │  │
│  │     the same partner, DST will merge the deployment rows.  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [ + Add partner manually ]                                      │
│                                                                  │
│                          [ Cancel ]  [ Confirm & Continue → ]    │
└──────────────────────────────────────────────────────────────────┘
```

**Duplicate detection.** When two detected brand strings resolve to the same `partner_id`, a warning is shown. The admin may confirm the merge (both detection sources are recorded but only one `questionnaire_intake_partners` record is retained) or override one of the matches to a different partner.

**Unresolved brands.** A detected brand that could not be matched to any partner record is shown with a red border and an empty dropdown. The admin must either match it to an existing partner, create a new partner record, or mark it as "Ignore" (in which case the deployment rows for that brand are discarded). Sign-off cannot proceed while any brand row has `review_status = 'pending'`.

**Single-partner fallback.** When `is_multi_partner = false`, Step 1 renders the existing single-partner picker from DST-048 with no changes.

### Step 2 amendment: per-device partner deployment panel

The device card in Step 2 gains a "Deployed by" section showing the operating brands for that device and their certification status from the certs sheet:

```
┌────────────────────────────────────────────────────────────────┐
│  EOSv1 (HZN4/360 SW)   ncp_linux  ·  In scope                 │
│  ──────────────────────────────────────────────────────────    │
│  Matched:  DCX960 / EOS-1008C  (exact model number)           │
│  47 fields extracted  ·  3 conflicting                        │
│                                                               │
│  Deployed by:                                                  │
│  ┌──────────────────────┬──────────────┬────────────────────┐  │
│  │  Partner             │  Markets     │  Cert status       │  │
│  ├──────────────────────┼──────────────┼────────────────────┤  │
│  │  Virgin Media O2     │  UK          │  ✓ Certified       │  │
│  │  VodafoneZiggo       │  NL          │  ✓ Cert extended   │  │
│  │  Telenet             │  BE          │  ✓ Cert extended   │  │
│  └──────────────────────┴──────────────┴────────────────────┘  │
│  [ Edit deployments ]                                          │
│                                                               │
│  [ View Fields ]   [ Reject ]   [ Approve ✓ ]                  │
└────────────────────────────────────────────────────────────────┘
```

"Edit deployments" opens an inline panel where the admin can add, remove, or correct deployment rows for this device. Changes are written to `questionnaire_staged_device_partners`.

### Step 4 amendment: sign-off commit transaction

The commit transaction is extended to handle multi-partner device records. For each approved device:

1. For each confirmed `questionnaire_staged_device_partners` record:
   - **Upsert** `device_partner_deployments`: if a record already exists for this `(device_id, partner_id)` pair, update `countries`, `partner_model_name`, `certification_status`, `certification_adk_version`. If not, create it.
   - Create a `device_questionnaire_sources` record with the `partner_id` from this deployment.

2. The audit log entry for each deployment write includes: entity type `device_partner_deployment`, entity id (device + partner), fields changed, source intake job, user, timestamp.

The existing `device_specs` write (hardware fields) is unchanged — it is device-level, not partner-level. Spec data is written once regardless of how many partners deploy the device.

---

## Device Detail Page Integration

The device detail page gains a "Partner Deployments" section that replaces the flat "Partner" field currently sourced from the partner key:

```
Partner Deployments

┌──────────────────────────────────────────────────────────┐
│  Virgin Media O2   ·  UK   ·  Certified (ADK 3.1.1)      │
│  Consumer name: TV360                                     │
│  Source: Liberty_Global_Questionnaire_v1_2.xlsx           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  VodafoneZiggo   ·  NL   ·  Cert extended (ADK 3.1.1)    │
│  Consumer name: Mediabox next                             │
│  Source: Liberty_Global_Questionnaire_v1_2.xlsx           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Telenet   ·  BE   ·  Cert extended                       │
│  Consumer name: Telenet TV Box                            │
│  Source: Liberty_Global_Questionnaire_v1_2.xlsx           │
└──────────────────────────────────────────────────────────┘
```

On the partner detail page, a "Deployed Devices" section shows all devices in `device_partner_deployments` for that partner, filterable by certification status and active/inactive.

---

## Partner Alias Registry Additions (DST-046 dependency)

The following aliases should be seeded into the alias registry to ensure the LG brand labels from the certs sheet are resolved correctly on first import. These are illustrative; the alias registry admin UI (DST-046) handles ongoing additions.

| Raw label | Canonical partner |
|---|---|
| `UK (VMO2)` | Virgin Media O2 |
| `NL (Ziggo)` | VodafoneZiggo |
| `BE (Telenet)` | Telenet |
| `VodafoneZiggo NL` | VodafoneZiggo |
| `Virgin Media UK` | Virgin Media O2 |
| `Virgin Media UK & IE` | Virgin Media O2 |
| `Telenet BE` | Telenet |
| `Sunrise` | Sunrise |
| `Sunrise/UPC` | Sunrise |
| `UPC CH` | Sunrise |
| `UPC PL` | UPC Poland |
| `Liberty Global` | Liberty Global |
| `LGI` | Liberty Global |

---

## API Changes

**`GET /api/questionnaire-intake/:id`**

Response adds:
- `is_multi_partner`: boolean
- `submitter_partner`: partner record for the submitter (if confirmed)
- `intake_partners`: array of `questionnaire_intake_partners` records, each including matched `partner` record and `device_count`

**`GET /api/questionnaire-intake/:id/staged-devices`**

Each staged device in the response includes:
- `partner_deployments`: array of `questionnaire_staged_device_partners` records, each including the matched `intake_partner` record

**`PATCH /api/questionnaire-intake/:id/intake-partners/:intakePartnerId`**

Updates `partner_id` and `review_status` for an individual detected brand. Used by the Step 1 partner resolution UI.

**`PUT /api/questionnaire-intake/:id/staged-devices/:deviceId/deployments`**

Replaces the set of `questionnaire_staged_device_partners` for a device. Used by the "Edit deployments" panel in Step 2.

**`GET /api/devices/:id/deployments`**

Returns all `device_partner_deployments` for a device, ordered by `partner.friendly_partner_name`.

---

## Backward Compatibility

The `questionnaire_intake_jobs.partner_id` column is renamed to `submitter_partner_id` by migration. All existing intake jobs with a non-null `partner_id` are migrated: a `questionnaire_intake_partners` record is created for each with `partner_id` = the former `partner_id` and `detection_source = 'admin'`, and a single `questionnaire_staged_device_partners` row is created for each staged device in that job pointing to the same partner.

Existing DST-048 sign-off logic that reads `partner_id` from the intake job must be updated to read `submitter_partner_id`. All partner assignment lookups in DST-048 Step 1 that currently reference `partner_id` must reference the `questionnaire_intake_partners` table instead.

---

## Acceptance Criteria

- The parser correctly detects `lg_stb_v1_2` format when "Certs and extensions" is present as a second sheet, and sets `is_multi_partner = true` on the intake job.
- The certs sheet is parsed into `questionnaire_staged_device_partners` records: for each non-null intersection cell, one record is created with `certification_status`, `certification_adk_version` (if parseable), and `detection_source = 'certs_sheet'`.
- Operating brand labels in column A of the certs sheet are matched against the Partner Alias Registry (DST-046). Labels that cannot be matched are surfaced in Step 1 with a required admin resolution action.
- Multi-line model name cells are parsed for parenthetical brand mentions. Each extracted brand creates a `questionnaire_intake_partners` record with `detection_source = 'model_name_cell'`, and the per-brand consumer name is stored in `questionnaire_staged_device_partners.partner_model_name`.
- When two detected brand strings resolve to the same `partner_id`, a duplicate warning is shown in Step 1. The admin can confirm the merge or override one match.
- Step 1 of the DST-048 review workflow renders the two-panel "Confirm Submitter & Partners" screen when `is_multi_partner = true`, and the existing single-partner picker when `is_multi_partner = false`.
- Sign-off cannot proceed while any `questionnaire_intake_partners` record has `review_status = 'pending'`.
- Each device card in Step 2 shows a "Deployed by" table listing operating brands, markets, and certification status from the certs sheet for that device. The admin can edit deployment rows inline.
- The sign-off commit upserts `device_partner_deployments` for each approved device-partner pair. Where a record already exists for `(device_id, partner_id)`, it is updated rather than duplicated.
- `device_questionnaire_sources` records are written with `partner_id` set to the operating partner, not the submitter. A device deployed by three partners from one questionnaire generates three `device_questionnaire_sources` records with distinct `partner_id` values.
- The device detail page displays a "Partner Deployments" section showing all deployment records with consumer name, markets, and certification status per partner.
- The partner detail page displays a "Deployed Devices" section listing all devices in `device_partner_deployments` for that partner.
- Existing intake jobs with a single `partner_id` are migrated correctly: `partner_id` → `submitter_partner_id`, and one `questionnaire_intake_partners` + `questionnaire_staged_device_partners` record is created per device.
- For single-partner questionnaires (`is_multi_partner = false`), the entire workflow is functionally identical to the pre-DST-055 behavior. No regressions.
- The reference file (`Disney__STB_Technical_Questionnaire_-_Virgin_Media__Ziggo_Telenet_Liberty_Global_-_v1_2.xlsx`) is parsed as `lg_stb_v1_2` format, with Liberty Global as submitter and VodafoneZiggo, Virgin Media O2, Telenet, and Sunrise as operating brands, with device-partner deployment rows populated from both the certs sheet and model name cells.
