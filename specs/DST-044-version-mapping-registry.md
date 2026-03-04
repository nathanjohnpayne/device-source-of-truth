# DST-044 — Core Version Mapping Registry & Friendly Version Display

| Field | Value |
|---|---|
| **Story ID** | DST-044 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T3 — Telemetry & Observability |
| **Priority** | P1 |
| **Story Points** | 5 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-043 (Telemetry Upload & Upsert — `core_version` field on device telemetry records must exist before mapping can be applied) |
| **Blocks** | Nothing |

---

## User Story

As an Admin, I can manage a registry that maps internal core version build strings to human-readable friendly version labels, so that when telemetry is uploaded from Datadog the device record displays a meaningful version name rather than a raw build hash — and I can add new mappings as new core versions ship without a code deploy.

---

## Background

Datadog telemetry exports include a `core_version` field containing internal build strings of the form:

```
{semantic_version}+{git_hash}.{build_number}
```

Examples: `42.7.1+47d0315.8`, `2025.09.5+8dcd8b6.2`, `dev+8dcd8b6.1`

These strings are not meaningful to non-engineering stakeholders. The attached file provides the initial mapping of 17 build strings to 16 friendly labels (two build hashes map to the same semantic version `NCP 2025.09.1`). New core versions ship frequently — the mapping table must be Admin-editable without a code deploy.

On each telemetry upload, DST resolves the incoming `core_version` to its friendly label and stores both. The device record displays the friendly version alongside a "Version Updated" timestamp reflecting when that mapping was last applied.

---

## Data Model

### New table: `core_version_mappings`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key. |
| `core_version` | VARCHAR(100) | Raw build string from Datadog. Unique, non-null. Indexed. |
| `friendly_version` | VARCHAR(100) | Human-readable label (e.g., `ADK 3.1.1`, `NCP 2025.09.5`). Non-null. |
| `platform` | VARCHAR(20) | Derived on insert from the `core_version` prefix — see Platform Detection below. Read-only after insert. |
| `notes` | TEXT | Optional. Free-text field for Admin to record context (e.g., "patch build for Broadcom kernel regression"). |
| `is_active` | BOOLEAN | Defaults to `TRUE`. Inactive mappings are retained for historical display but excluded from resolution on new uploads. |
| `created_at` | TIMESTAMPTZ | Set on insert. |
| `created_by` | VARCHAR(100) | Admin email. |
| `updated_at` | TIMESTAMPTZ | Set on any edit. |
| `updated_by` | VARCHAR(100) | Admin email. |

Unique constraint: `core_version`. One build string maps to exactly one friendly label.

### Changes to `device_telemetry`

| Column | Type | Change |
|---|---|---|
| `core_version` | VARCHAR(100) | **Existing.** Updated on every upsert to the value from the latest telemetry upload. |
| `friendly_version` | VARCHAR(100) | **New.** Resolved from `core_version_mappings` at upload time. `NULL` if no mapping exists. |
| `version_updated_at` | DATE | **New.** Set to the snapshot date of the upload that last changed `core_version`. Distinct from `count_updated_at` (DST-043) — version and count may update on different upload cycles. |

Schema migration is idempotent (`ADD COLUMN IF NOT EXISTS`).

---

## Platform Detection

The `platform` column is derived from the `core_version` string at insert time and stored — it is not recomputed on reads.

| `core_version` prefix pattern | `platform` value |
|---|---|
| Matches `^\d{4}\.\d+` (year-dot format, e.g., `2025.09.5+…`) | `NCP` |
| Matches `^\d+\.\d+` (integer-dot format, e.g., `42.16+…`, `47.4.1+…`) | `ADK` |
| Starts with `dev+` | `DEV` |
| Anything else | `UNKNOWN` |

This allows the Admin UI to filter and sort the mapping registry by platform without string parsing in queries.

---

## Seed Data

On first deploy, seed the following 17 mappings from the attached file. All seeded as `is_active = TRUE`, `created_by = 'system'`.

| `core_version` | `friendly_version` | `platform` |
|---|---|---|
| `2025.05+88628f4.4` | `NCP 2025.05` | `NCP` |
| `2025.05.1+bbc7cd5.1` | `NCP 2025.05.1` | `NCP` |
| `2025.08.2+7dca2fb.5` | `NCP 2025.08.2` | `NCP` |
| `2025.09.1+d46f8bd.4` | `NCP 2025.09.1` | `NCP` |
| `2025.09.1+d46f8bd.5` | `NCP 2025.09.1` | `NCP` |
| `2025.09.2+8d2725c.4` | `NCP 2025.09.2` | `NCP` |
| `2025.09.4+f31e80d.4` | `NCP 2025.09.4` | `NCP` |
| `2025.09.5+8dcd8b6.2` | `NCP 2025.09.5` | `NCP` |
| `2025.09.6+883dd41.14` | `NCP 2025.09.6` | `NCP` |
| `2025.09.7+886889c.10` | `NCP 2025.09.7` | `NCP` |
| `2025.09.8+c7d3126.1` | `NCP 2025.09.8` | `NCP` |
| `2025.09.9+d69ec3a.1` | `NCP 2025.09.9` | `NCP` |
| `42.7.1+47d0315.8` | `ADK 3.0.1` | `ADK` |
| `42.15+ad3ca0f.1` | `ADK 3.1` | `ADK` |
| `42.16+17f4b8d.1` | `ADK 3.1.1` | `ADK` |
| `47.4.1+8e3bba6.1` | `ADK 3.x (newer)` | `ADK` |
| `dev+8dcd8b6.1` | `Dev Build` | `DEV` |

> **Note — `ADK 3.x (newer)`:** This is a placeholder label for a build string that was newer than the known ADK mapping set at export time. When the correct ADK label for `47.4.1` is confirmed, the Admin should update this mapping via the registry UI. The placeholder is intentional and is not an error in the seed data.

> **Note — `NCP 2025.09.1` (two build strings):** `d46f8bd.4` and `d46f8bd.5` are minor patch variants of the same semantic release. Both correctly map to `NCP 2025.09.1`. Multiple `core_version` entries may share a `friendly_version` — this is expected and not a data quality issue.

---

## Version Resolution at Upload Time

During telemetry upload (DST-043 upsert flow), after the incoming `core_version` is parsed from the CSV:

1. Look up `core_version_mappings WHERE core_version = :incoming AND is_active = TRUE`.
2. **Match found:** Set `friendly_version` to the matched `friendly_version`. Set `version_updated_at` to the snapshot date if and only if `core_version` changed from the previously stored value. If `core_version` is the same as the existing record, `version_updated_at` is not touched.
3. **No match:** Set `friendly_version = NULL`. Flag the row amber in the Preview & Validate step with: "No version mapping for `[core_version]`. The raw build string will be stored. Add a mapping in the Version Registry to display a friendly label." Import is not blocked — unmapped versions are valid telemetry.
4. After import, all `core_version` values with no mapping are surfaced in Admin panel > Version Registry > Unmapped Versions (see below).

---

## Retroactive Resolution

When a new mapping is added to the registry, or an existing mapping's `friendly_version` is edited, DST retroactively updates `friendly_version` on all `device_telemetry` rows whose `core_version` matches the changed entry. This update runs as a background job immediately on save, not at the next upload.

`version_updated_at` is **not** changed by retroactive resolution — it reflects when the telemetry data changed, not when the label was updated.

---

## Admin UI — Version Registry

Location: Admin panel > Version Registry (new section).

### Registry table

Columns: Platform | Core Version | Friendly Version | Notes | Active | Created | Updated | Actions.

Filterable by `platform` (NCP / ADK / DEV / UNKNOWN / All) and by `is_active`. Default view: active only, sorted by `platform` then `core_version` descending.

### Adding a mapping

"+ Add Mapping" button opens an inline form:

- **Core Version** (required) — text input. On blur, platform is auto-detected and shown as a read-only badge next to the field.
- **Friendly Version** (required) — text input with a typeahead that suggests existing `friendly_version` values (to encourage reuse for patch variants of the same release).
- **Notes** (optional) — text input.

Saving checks for a duplicate `core_version`. If one exists (including inactive), shows: "A mapping for `[core_version]` already exists ([active/inactive]). Edit the existing entry instead?"

### Editing a mapping

Inline edit on any row. Changing `friendly_version` shows: "This will also update the friendly version displayed for [N] device records currently on this build. Continue?" Confirm triggers the retroactive resolution job.

### Deactivating a mapping

Soft delete (sets `is_active = FALSE`). Shows: "[N] device records are currently on this build. Deactivating will not remove their friendly version label, but this build string will no longer resolve on future uploads. Continue?"

### Unmapped Versions panel

A collapsible section at the bottom of the Version Registry page listing all `core_version` values present in `device_telemetry` that have no active entry in `core_version_mappings`. Columns: Core Version | Platform (auto-detected) | Device Count | Partner Count | First Seen. Each row has a "+ Add Mapping" shortcut that pre-fills the core version in the add form.

---

## Device Record Display

In the device record view, the version row displays:

```
Core Version      NCP 2025.09.5          (raw: 2025.09.5+8dcd8b6.2)
Version Updated   February 25, 2026
```

- The friendly label is the primary display value.
- The raw `core_version` string is shown in parentheses as a secondary label for engineering reference.
- If `friendly_version` is `NULL` (unmapped), show the raw `core_version` string alone with an amber badge: "Unmapped — add to Version Registry."
- `version_updated_at` is formatted as `{MonthName} {D}, {YYYY}`, consistent with `count_updated_at` (DST-043). If null (pre-migration record), show "—".

---

## Acceptance Criteria

- `core_version_mappings` table exists with all columns specified. `core_version` is unique and indexed. Schema migration is idempotent.
- All 17 seed mappings are present on first deploy.
- Uploading `Discover_2026-February-25_with_versions.csv` resolves all 249 rows to a `friendly_version` without any unmapped version warnings.
- Two `core_version` values mapping to the same `friendly_version` (`NCP 2025.09.1`) is accepted without error.
- `version_updated_at` is set to the snapshot date when `core_version` changes on a device record, and is not updated when `core_version` is unchanged on re-upload.
- Unmapped `core_version` values produce amber warnings in the Preview & Validate step but do not block import.
- Post-import, unmapped versions appear in the Unmapped Versions panel.
- Editing a `friendly_version` in the registry triggers retroactive update of all matching `device_telemetry` rows. `version_updated_at` is not changed by retroactive resolution.
- The Version Registry is filterable by platform. Platform is auto-detected from `core_version` on insert and stored; it is not recomputed on reads.
- The device record view displays `friendly_version` as the primary label with the raw build string in parentheses. Unmapped records show the raw string with an amber badge.
- Adding a duplicate `core_version` entry (including matching an inactive one) shows a warning rather than silently inserting.
- Non-Admin users cannot access the Version Registry or the Unmapped Versions panel.
