# DST-037 — Airtable Intake Request Import

| Field | Value |
|---|---|
| **Story ID** | DST-037 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T2 — Data Ingestion & Migration |
| **Priority** | P1 |
| **Story Points** | 8 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-001 (database schema), DST-003 (auth — Admin role required), DST-036 (dropdown option management, for request_type and region controlled vocabularies) |
| **Blocks** | DST-038 (Airtable deprecation / full migration) |

---

## User Story

As an Admin, I can upload a CSV exported from the Airtable Intake Requests base and have DST parse, normalize, and import the records so that partner intake history is consolidated in DST and no longer dependent on Airtable access.

---

## Background

The Partnerships & Devices team tracks all partner integration requests in an Airtable base called Intake Requests. The export format (`IntakeRequests.csv`) contains 11 columns across 499 current records and is the system of record for request history, TAM assignments, and launch targets. This story imports that data into a new `intake_requests` table in DST, normalizes all country and region values to defined standards, strips emoji, and links each request to its partner record(s) where a match exists.

---

## Source File Analysis

The Airtable export produces a UTF-8 CSV with a BOM (`\uFEFF`). The parser must strip the BOM before processing.

**Source columns:**

| # | CSV Column | Notes |
|---|---|---|
| 1 | `Request Subject` | Free-text title. May contain bracketed prefixes like `[F&I]`, `[Intake]`, `[ANDTV]` added by the Airtable workflow. |
| 2 | `RequestType` | Controlled vocabulary — 11 distinct values (see mapping below). |
| 3 | `Request Status` | Only value in current export: `Approved & Provisioned`. Field preserved for future states. |
| 4 | `Request Phase` | Either blank or `Operational`. |
| 5 | `Partner` | One or more partner names, comma-separated within a single cell. 22 rows in the sample have multiple partners. |
| 6 | `Country` | Highly inconsistent — see normalization rules below. 46 rows have multiple countries. 3 rows are blank. |
| 7 | `Region (from Partner)` | Disney internal region code. Sometimes multiple, comma-separated. |
| 8 | `TAM` | One or more full names, comma-separated. |
| 9 | `Integration Engineering Lead` | One or more full names, comma-separated. May be blank. |
| 10 | `Target Launch Date` | M/D/YYYY. May be blank. |
| 11 | `Release Target` | M/D/YYYY. May be blank. 31 rows have multiple comma-separated dates. |

---

## Database Changes

### New table: `intake_requests`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key. |
| `airtable_subject` | TEXT | Raw value of `Request Subject`. Preserved verbatim including bracketed prefixes. |
| `request_type` | VARCHAR(50) | Normalized — see mapping below. Stored as display value referencing `field_options` key `intake_request_type`. |
| `request_status` | VARCHAR(50) | Defaults to `Approved & Provisioned`. |
| `request_phase` | VARCHAR(50) | `Operational` or `NULL`. |
| `countries` | VARCHAR(2)[] | Array of ISO 3166-1 alpha-2 codes after normalization. `NULL` if blank in source. |
| `regions` | VARCHAR(20)[] | Array of normalized Disney region codes. |
| `tam_names` | TEXT[] | Array of full names parsed from comma-separated field. |
| `ie_lead_names` | TEXT[] | Array of full names parsed from `Integration Engineering Lead`. |
| `target_launch_date` | DATE | `NULL` if blank. |
| `release_targets` | DATE[] | Array of dates parsed from `Release Target`. `NULL` if blank. |
| `imported_at` | TIMESTAMPTZ | Set on insert. |
| `imported_by` | VARCHAR(100) | Email of the Admin who ran the import. |
| `import_batch_id` | UUID | Groups all records from a single upload together. Allows rollback of a full batch. |

### New junction table: `intake_request_partners`

Many intake requests name multiple partners; many partners appear across multiple requests.

| Column | Type | Notes |
|---|---|---|
| `intake_request_id` | UUID | FK → `intake_requests.id` |
| `partner_name_raw` | VARCHAR(200) | The individual partner name token as it appeared in the CSV after splitting on `,`. |
| `partner_id` | UUID | FK → `partners.id` — nullable. Populated by the match step if a partner record exists. |
| `match_confidence` | VARCHAR(20) | `exact`, `fuzzy`, or `unmatched`. |

---

## Field Mapping

### `RequestType` → `intake_request_type`

Stored via DST-036 managed dropdown key `intake_request_type`. Seed with the following options exactly as they appear in the source — no renaming, as these are Disney internal codes:

| Source Value | Stored As |
|---|---|
| `ADK` | `ADK` |
| `ANDTV` | `ANDTV` |
| `BBD` | `BBD` |
| `Content Provider API` | `Content Provider API` |
| `Eligibility API` | `Eligibility API` |
| `Feeds & Integration` | `Feeds & Integration` |
| `Partner API` | `Partner API` |
| `Perks` | `Perks` |
| `Redemption Code` | `Redemption Code` |
| `Supplemental Data API` | `Supplemental Data API` |
| `Web App` | `Web App` |

---

## Country Normalization

All country values must be normalized to ISO 3166-1 alpha-2 before storage. The parser must:

1. Strip all emoji characters (Unicode blocks U+1F1E0–U+1F1FF flag sequences, U+1F300–U+1F9FF, U+2600–U+26FF, U+2700–U+27BF).
2. Split on `,` to handle multi-country cells.
3. Trim whitespace from each token.
4. Apply the lookup table below.
5. If a token does not match any rule, flag it as `UNKNOWN:<raw_value>` and surface it in the import preview for Admin review rather than silently dropping it.

### Normalization lookup table

| Raw value(s) in source | Normalized ISO 3166-1 alpha-2 |
|---|---|
| `Albania` | `AL` |
| `Argentina` | `AR` |
| `AU`, `Australia` | `AU` |
| `AT`, `Austria` | `AT` |
| `BE`, `Belgium` | `BE` |
| `Belize` | `BZ` |
| `Bolivia` | `BO` |
| `BR`, `Brazil` | `BR` |
| `Canada` | `CA` |
| `CL`, `Chile` | `CL` |
| `Colombia` | `CO` |
| `Costa Rica` | `CR` |
| `Czechia` | `CZ` |
| `Denmark` | `DK` |
| `Dominican Republic` | `DO` |
| `Ecuador` | `EC` |
| `El Salvador` | `SV` |
| `Finland` | `FI` |
| `France` | `FR` |
| `DE`, `Germany` | `DE` |
| `Greece` | `GR` |
| `Guatemala` | `GT` |
| `HK`, `Hong Kong` | `HK` |
| `Honduras` | `HN` |
| `Hungary` | `HU` |
| `Iceland` | `IS` |
| `IE`, `Ireland` | `IE` |
| `IT`, `Italy` | `IT` |
| `Jamaica` | `JM` |
| `Japan` | `JP` |
| `MX`, `Mexico` | `MX` |
| `NL`, `Netherlands` | `NL` |
| `NZ`, `New Zealand` | `NZ` |
| `Nicaragua` | `NI` |
| `Norway` | `NO` |
| `Panama` | `PA` |
| `Paraguay` | `PY` |
| `PE`, `Peru` | `PE` |
| `Poland` | `PL` |
| `PT`, `Portugal` | `PT` |
| `Romania` | `RO` |
| `Saint Lucia` | `LC` |
| `Singapore` | `SG` |
| `Slovakia` | `SK` |
| `South Korea` | `KR` |
| `ES`, `Spain` | `ES` |
| `SE`, `Sweden` | `SE` |
| `CH`, `Switzerland` | `CH` |
| `TW`, `Taiwan` | `TW` |
| `Trinidad and Tobago` | `TT` |
| `UK`, `United Kingdom` | `GB` |
| `US`, `USA`, `United States` | `US` |
| `Uruguay` | `UY` |
| `Venezuela` | `VE` |
| `Global`, `WW` | `XW` _(see note)_ |

> **Note — `XW` (Worldwide):** ISO 3166-1 reserves the `X` prefix for user-assigned codes. `XW` is the conventional value for "worldwide / not territory-specific." Store as `XW`; display in the UI as "Worldwide."

> **⚠️ Data quality flag — bare code `SK`:** The source file uses `SK` in two contexts: Slovakia (ISO correct) and South Korea (where `KR` is correct). In the sample export, rows with `SK` in the Country column and `APAC` in Region — e.g., "SKT (SK) Telecom" — appear to intend South Korea. The parser cannot resolve this ambiguity automatically. Flag all rows where `Country = SK` for Admin review in the import preview, surfacing both the Region value and the partner name so the reviewer can assign `SK` (Slovakia) or `KR` (South Korea) before confirming the import.

---

## Region Normalization

The source field `Region (from Partner)` uses Disney internal region codes. Normalize to the following controlled vocabulary and store via DST-036 dropdown key `intake_region`:

| Raw value(s) in source | Normalized stored value | Display label |
|---|---|---|
| `APAC` | `APAC` | Asia-Pacific |
| `DOMESTIC` | `DOMESTIC` | Domestic (US/CA) |
| `EMEA` | `EMEA` | Europe, Middle East & Africa |
| `GLOBAL` | `GLOBAL` | Global |
| `LATAM` | `LATAM` | Latin America |
| _(blank)_ | `NULL` | — |

Multiple region tokens in a single cell (e.g., `"EMEA, LATAM"`) are split on `,`, trimmed, individually normalized, and stored as an array. Duplicate tokens within a row are deduplicated before storage.

---

## Multi-Value Handling

| Field | Strategy |
|---|---|
| **Partner (multiple)** | Split on `,`. Each token becomes one row in `intake_request_partners` with the same `intake_request_id`. Attempt an exact-then-fuzzy match against `partners.name`; store `partner_id` if matched. |
| **Country (multiple)** | Split on `,`. Normalize each token individually. Store as `VARCHAR(2)[]` array. |
| **Region (multiple)** | Split on `,`. Normalize and deduplicate. Store as `VARCHAR(20)[]` array. |
| **TAM (multiple)** | Split on `,`. Trim. Store as `TEXT[]`. No attempt to resolve to user accounts in Phase 1. |
| **IE Lead (multiple)** | Same as TAM. |
| **Release Target (multiple)** | Split on `,`. Parse each as `M/D/YYYY`. Store as `DATE[]`. Flag unparseable tokens for review. |

---

## Import UI

Location: Admin panel > Data Import > Intake Requests (new section).

### Step 1 — Upload

- File input accepts `.csv` only.
- On selection, the file is parsed client-side before upload so the preview renders without a round-trip.
- Parser strips UTF-8 BOM, reads headers, and validates that all 11 expected columns are present. If any are missing, show an error and halt: "Missing required columns: [list]. Verify this is an Airtable Intake Requests export and try again."
- File size limit: 10 MB.

### Step 2 — Preview & Validation

Render a paginated preview table (50 rows per page) showing the parsed and normalized data. Highlight:

- **Orange** — rows where normalization produced a warning (e.g., `SK` country ambiguity, unrecognized country token, unparseable date).
- **Red** — rows that will be skipped due to a hard error (e.g., blank `Request Subject`, unrecognized `RequestType`).
- **Yellow** — rows where a partner name produced no match in DST (`match_confidence = unmatched`).

Above the table, show a summary banner:

```
499 rows parsed — 492 ready to import, 5 with warnings (review required), 2 skipped (errors)
```

Warnings require Admin resolution before the batch can be confirmed. For each warning row, show an inline dropdown or text override so the Admin can correct the value (e.g., reassign `SK` to `KR` or `SK`) without editing the source file.

The Admin can also choose "Skip this row" for any warning row to exclude it from the batch.

### Step 3 — Confirm & Import

- "Import [N] records" button (disabled until all warnings are resolved or skipped).
- On confirm: write all records transactionally. If the transaction fails, no rows are written.
- On success: show "Import complete — [N] records imported, [N] skipped. Batch ID: [uuid]."
- Import is logged in the audit log.

### Rollback

Any import batch can be rolled back by an Admin from Admin panel > Data Import > Import History. Rollback deletes all `intake_requests` and `intake_request_partners` rows with the matching `import_batch_id`. A rollback requires a confirmation modal displaying the batch date, Admin who ran it, and record count. Rollback is only available within 30 days of import.

---

## Partner Matching Logic

For each partner name token after splitting:

1. **Exact match:** `LOWER(TRIM(token)) = LOWER(TRIM(partners.name))` → `match_confidence = exact`.
2. **Fuzzy match:** Jaro-Winkler similarity ≥ 0.90 → `match_confidence = fuzzy`. Surface fuzzy matches in the preview for Admin confirmation.
3. **No match:** Store `partner_id = NULL`, `match_confidence = unmatched`. The Admin can manually link unmatched partners from the intake request detail view post-import.

---

## Acceptance Criteria

- Uploading `IntakeRequests.csv` (499 rows) completes without error for all clean rows.
- All emoji are stripped from Country values before storage. No emoji appear in any stored or displayed field.
- All full country names and non-standard codes (`UK`, `USA`, `WW`, `Global`) are converted to ISO 3166-1 alpha-2 before storage. The UI displays country names (resolved from ISO code), not raw codes.
- Rows where `Country = SK` are flagged in the preview with a disambiguation prompt before import.
- Multi-partner rows produce one `intake_request_partners` row per partner token, all referencing the same `intake_request_id`.
- Multi-country and multi-region cells are split, normalized, deduplicated, and stored as arrays.
- Multi-date `Release Target` cells are split and stored as `DATE[]`.
- An import with any unresolved hard errors cannot be confirmed. The confirm button remains disabled.
- A successfully imported batch can be rolled back within 30 days by an Admin.
- The import audit log records: Admin email, timestamp, file name, batch ID, row counts (imported / skipped / errored).
- Non-Admin users do not see the Data Import section.

---

## Out of Scope

- Automatic scheduled sync from the Airtable API (Phase 2).
- Resolving TAM and IE Lead names to DST user accounts (Phase 2 — dependent on user directory integration).
- Creating partner records automatically for unmatched partner names (Admin-initiated manual linking only in Phase 1).
- Deduplication across import batches (i.e., re-importing the same CSV does not automatically detect and skip already-imported records — the Admin is responsible for not importing duplicates).
