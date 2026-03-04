# DST-038 — Partner Key Registry: Datadog Manifest Key Mapping

| Field | Value |
|---|---|
| **Story ID** | DST-038 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T2 — Data Ingestion & Migration |
| **Priority** | P1 |
| **Story Points** | 5 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-001 (database schema), DST-003 (auth — Admin role required), DST-036 (dropdown management, for chipset/OS/region controlled vocabularies) |
| **Blocks** | DST-039 (Datadog telemetry ingestion — requires key→partner resolution before device metrics can be attributed) |

---

## User Story

As a Device Operations Admin, I can manage a registry of partner keys and import the existing mapping from CSV so that when Datadog telemetry arrives with a partner key in the device manifest, DST can resolve it to the correct partner record, enrichment attributes, and device inventory — even when a single partner operates under multiple keys.

---

## Background

Every device Disney deploys streams with a manifest that identifies the partner via a short snake-case identifier called the **partner key** (e.g., `claro_br`, `tivo_evolution_emea`). Datadog uses this key as the primary dimension for device-level telemetry. DST must resolve each key to a canonical partner in order to attribute metrics, aggregate across a partner's full device fleet, and drive hardware-tiered feature delivery.

The relationship is one-to-many: one partner may operate under multiple keys. For example, Vodafone operates five keys (`vodafone_es`, `vodafone_pt`, `vodafone_gr`, `vodafone_ro`, `vodafone_de`), one per country. TiVo operates five keys segmented by OEM and region. All of these resolve to the same partner record but carry different enrichment attributes per key (chipset, OEM, OS, countries of operation).

The existing mapping lives in a spreadsheet (`partner_key_mapping_enriched_2.csv`) with 47 keys across 26 partners. This story creates the data model, import flow, and management UI for that registry.

---

## Source File Analysis

File: `partner_key_mapping_enriched_2.csv`
Encoding: Windows-1252 (Latin-1 superset — **not** UTF-8). The parser must open with `encoding='latin-1'` or detect and transcode. One character is corrupted in the source: "Telefónica" appears as "Telefnica" due to the `ó` (`\x97`) encoding issue. This must be corrected on import (see normalization table below).

**Source columns:**

| CSV Column | DST Field | Notes |
|---|---|---|
| `partner_key` | `partner_keys.key` | Unique identifier. Snake-case. Used verbatim — no transformation. |
| `friendly_partner_name` | Lookup → `partners.name` | Used to resolve `partner_id`. Not stored redundantly. See matching logic. |
| `countries_operate_iso2` | `partner_keys.countries` | ISO 3166-1 alpha-2 codes. Semicolon-delimited in multi-country rows. See normalization. |
| `regions_operate` | `partner_keys.regions` | Disney region code. See normalization. |
| `chipset` | `partner_keys.chipset` | Controlled vocabulary — 4 values in current data. |
| `oem` | `partner_keys.oem` | Free text. Blank for most rows (38 of 47). |
| `kernal` _(sic)_ | `partner_keys.kernel` | Column is misspelled in source. DST stores as `kernel`. Only value in current data: `Linux`. |
| `os` | `partner_keys.os` | Free text. Blank for most rows. Values: `TiVo OS`, `Titan OS`. |

---

## Database Changes

### New table: `partner_keys`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key. |
| `key` | VARCHAR(100) | The manifest partner key. Unique, non-null. Indexed. This is the value Datadog emits. |
| `partner_id` | UUID | FK → `partners.id`. Nullable — allows registering a key before a partner record exists. |
| `countries` | VARCHAR(2)[] | Array of ISO 3166-1 alpha-2 codes. `NULL` if not specified. |
| `regions` | VARCHAR(20)[] | Array of normalized Disney region codes. `NULL` if not specified. |
| `chipset` | VARCHAR(50) | References `field_options` key `partner_chipset`. Nullable. |
| `oem` | VARCHAR(100) | Free text. Nullable. |
| `kernel` | VARCHAR(100) | Free text. Nullable. |
| `os` | VARCHAR(100) | Free text. Nullable. |
| `is_active` | BOOLEAN | Defaults to `TRUE`. Inactive keys are retained for historical telemetry lookups but excluded from active device counts. |
| `source` | VARCHAR(20) | `csv_import` or `manual`. Set on creation. |
| `import_batch_id` | UUID | FK → import batch. Nullable (null for manually created keys). |
| `created_at` | TIMESTAMPTZ | Set on insert. |
| `created_by` | VARCHAR(100) | Email of Admin. |
| `updated_at` | TIMESTAMPTZ | Updated on any edit. |
| `updated_by` | VARCHAR(100) | Email of Admin. |

Unique constraint: `key`. A partner key must be globally unique — two partners cannot share a key.

Index: `(partner_id)` for reverse lookup (all keys for a given partner).

### Changes to existing `partners` table

No schema changes. The `partner_keys.partner_id` FK is the only relationship. A partner record can be looked up from a key via join, and all keys for a partner via reverse join.

---

## Normalization Rules

### Country (`countries_operate_iso2`)

Multi-country values in the source use `;` as the delimiter (distinct from the intake CSV, which uses `,`). Split on `;`, trim, then apply:

| Raw value | Normalized |
|---|---|
| `UK` | `GB` |
| `Worldwide` | `XW` |
| All valid ISO 3166-1 alpha-2 codes | Stored as-is |

All other values: flag for Admin review in the import preview.

### Region (`regions_operate`)

| Raw value | Normalized stored value |
|---|---|
| `APAC` | `APAC` |
| `EMEA` | `EMEA` |
| `LATAM` | `LATAM` |
| `NA` | `DOMESTIC` _(see note)_ |
| `Worldwide` | `GLOBAL` |

> **⚠️ `NA` → `DOMESTIC`:** In the source file, `NA` appears only on `tivo_us` and `tivo_element_us` — both US-market keys. Context strongly indicates "North America" rather than "N/A." These are flagged orange in the import preview so the Admin can confirm before import. If `NA` appears on future rows with non-US countries, flag as `UNKNOWN` for review.

### Partner name encoding (`friendly_partner_name`)

The source file is Windows-1252 encoded. One name is corrupted: `Telefnica` (raw bytes `\x54\x65\x6C\x65\x66\x97\x6E\x69\x63\x61`) should be `Telefónica`. Apply this correction unconditionally during parsing before the partner match step.

### Chipset (`chipset`)

Stored via DST-036 managed dropdown key `partner_chipset`. Seed with the four values found in the current data:

- `Amlogic`
- `Broadcom`
- `MediaTek`
- `Novatek`

### Column name (`kernal` → `kernel`)

The source CSV column is misspelled. The parser maps `kernal` → `kernel` explicitly. Do not propagate the typo.

---

## Partner Matching Logic

For each row, attempt to resolve `friendly_partner_name` to an existing `partners.id`:

1. **Exact match** (after encoding correction and whitespace trim): `LOWER(friendly_partner_name) = LOWER(partners.name)` → store `partner_id`, `match_confidence = exact`.
2. **Fuzzy match**: Jaro-Winkler ≥ 0.90 → store `partner_id`, `match_confidence = fuzzy`. Surface in import preview for Admin confirmation.
3. **No match**: Store `partner_id = NULL`, `match_confidence = unmatched`. Admin can link post-import from the partner key detail view.

---

## Partners with Multiple Keys — Current Data

The following partners in the seed file have more than one key. This is the expected pattern, not an error.

| Partner | Keys | Differentiating attribute |
|---|---|---|
| Claro | `claro_br`, `claro_zte_br`, `clarokaon_br` | OEM / device model variant within same country |
| Movistar HispAm | `movistar_ar`, `movistar_cl`, `movistar_co` | Country |
| Movistar Spain | `movistar_es`, `telefonica_es` | Legacy vs. rebranded key within same country |
| Philips TVs | `titan_novatek`, `titan_novatek_latam`, `titan_mediatek_latam`, `titan_mediatek_emea` | Chipset × region |
| Telefónica | `temis_ar`, `temis_br`, `temis_cl`, `temis_co`, `temis_pe` | Country |
| TiVo | `tivo_us`, `tivo_element_us`, `tivo_evolution_emea`, `tivo_thomson_emea`, `tivo_skyworth_emea` | OEM × region |
| Virgin Media | `virginmedia_uk`, `virginmedia_ie` | Country |
| Vodafone | `vodafone_es`, `vodafone_pt`, `vodafone_gr`, `vodafone_ro`, `vodafone_de` | Country |

---

## Import UI

Location: Admin panel > Data Import > Partner Keys (new tab alongside Intake Requests from DST-037).

### Step 1 — Upload

- File input accepts `.csv` only. File size limit: 10 MB.
- Parser auto-detects Windows-1252 encoding (look for `\x97` or similar non-UTF-8 bytes) and transcodes to UTF-8 before processing. Falls back to UTF-8 if the file is clean.
- Validates that all 8 expected columns are present (accepting the misspelled `kernal`). If any are missing, show an error and halt.

### Step 2 — Preview & Validation

Paginated table (50 rows per page) showing parsed and normalized values. Highlight:

- **Orange** — rows with normalization warnings (e.g., `NA` region, unrecognized country token, fuzzy partner match).
- **Red** — rows that will be skipped: blank `partner_key`, or `partner_key` already exists in DST with a different `partner_id` (key collision).
- **Yellow** — rows where `friendly_partner_name` produced no partner match (`unmatched`).

Summary banner:

```
47 rows parsed — 44 ready to import, 3 with warnings (review required), 0 skipped (errors)
```

Admin must resolve all orange rows before confirming. For each, the preview shows an inline dropdown to confirm or override the normalized value.

### Step 3 — Confirm & Import

- "Import [N] records" button disabled until all warnings are resolved or skipped.
- Transactional write — all or nothing.
- On success: "Import complete — [N] partner keys imported, [N] skipped. Batch ID: [uuid]."
- Audit log entry written.

### Rollback

Same pattern as DST-037: rollback available within 30 days, deletes all `partner_keys` rows with the matching `import_batch_id`. Confirmation modal required.

---

## Management UI — Partner Key Registry

Location: Partners > [Partner Name] > Partner Keys tab (new tab on the partner detail page).

**Per-partner view:**
- Table: Key | Countries | Region | Chipset | OEM | Kernel | OS | Active | Source | Last Updated.
- "+ Add Key" button opens an inline form (all fields, `key` required).
- Edit and deactivate (soft delete) available per row.
- Deactivating a key shows a warning if the key has active Datadog telemetry in the last 30 days: "This key is currently receiving telemetry. Deactivating it will exclude its devices from active counts."

**Global registry view:**
Location: Admin panel > Partner Key Registry.
- Flat table of all 47+ keys across all partners, searchable by key name or partner name.
- Clicking a row opens the partner detail page at the Partner Keys tab.
- Useful for resolving unmatched keys surfaced by Datadog that haven't yet been registered.

---

## Datadog Resolution Logic

When a Datadog telemetry event arrives with a `partner_key` value:

1. Look up `partner_keys WHERE key = :incoming_key AND is_active = TRUE`.
2. If found: attribute the event to `partner_id`, apply enrichment attributes (`chipset`, `oem`, `os`, `countries`, `regions`) from the key record.
3. If not found: write the event with `partner_id = NULL`. Surface the unresolved key in a "Unknown Keys" report in the Admin panel so it can be registered.

This resolution must be fast — it runs on every telemetry ingestion event. The index on `partner_keys.key` (unique, btree) supports sub-millisecond lookup.

---

## Acceptance Criteria

- `partner_keys` table exists with all columns specified above. `key` is unique and indexed. Schema migration is idempotent.
- Uploading `partner_key_mapping_enriched_2.csv` parses all 47 rows without encoding errors, corrects `Telefnica` → `Telefónica`, maps `kernal` → `kernel`.
- `UK` → `GB` and `Worldwide` → `XW` are applied unconditionally. `NA` region rows (`tivo_us`, `tivo_element_us`) are flagged orange in the import preview and require Admin confirmation before import.
- Multi-country semicolon-delimited values are split and stored as `VARCHAR(2)[]` arrays.
- All 8 partners with multiple keys import successfully — multiple rows per `partner_id` is expected and not treated as an error or duplicate.
- `partner_chipset` dropdown key is seeded in `field_options` (DST-036) with: Amlogic, Broadcom, MediaTek, Novatek.
- The partner detail page shows a Partner Keys tab listing all keys for that partner with their enrichment attributes.
- Adding or editing a key from the partner detail page writes to `partner_keys` with `source = manual`.
- Deactivating a key with active Datadog telemetry in the last 30 days shows a warning modal before confirming.
- The global Partner Key Registry in the Admin panel shows all keys, is searchable by key name and partner name, and links to the correct partner detail page.
- Datadog ingestion resolves a known key to its `partner_id` in a single indexed lookup. Unknown keys are surfaced in the Admin panel Unknown Keys report rather than silently dropped.
- Import batches can be rolled back within 30 days. Rollback is logged in the audit trail.

---

## Out of Scope

- Automatic discovery of new keys from Datadog without Admin confirmation (Phase 2).
- Mapping partner keys to specific device models or SKUs (covered by DST-034 / DST-035 device spec fields).
- Versioning of key enrichment attributes over time (e.g., tracking when a key's chipset changed — Phase 2).
