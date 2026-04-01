---
spec_id: DST-043-telemetry-upsert-filename-date
---

# DST-043 — Telemetry Upload: Upsert Device Counts & Parse Snapshot Date from Filename

| Field | Value |
|---|---|
| **Story ID** | DST-043 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T3 — Telemetry & Observability |
| **Priority** | P1 |
| **Story Points** | 3 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-038 (Partner Key Registry — partner resolution required for upsert key), DST-041 (Import Deduplication — upsert logic is consistent with dedup strategy) |
| **Blocks** | Nothing |

---

## User Story

As an Admin uploading a Datadog CSV export, the snapshot date is automatically parsed from the filename so I don't have to enter it manually, and each row upserts the device count fields for that partner–device combination so that re-uploading a file never creates duplicate telemetry records — and each device record shows when its count was last updated.

---

## Background

The Telemetry Upload screen (shown in the attached screenshot) accepts Datadog CSV exports with five columns: `partner`, `device`, `core_version`, `count_unique_device_id`, `count`. It currently requires the Admin to manually set a Snapshot Date via a date picker.

Datadog saved-query exports follow a predictable filename convention that already encodes the export date. Parsing it from the filename eliminates manual entry and a class of data-entry errors where the uploaded file and the recorded snapshot date disagree.

The upload also currently behaves as an append — re-uploading the same file or a refreshed export for the same reporting period creates duplicate rows. The correct behavior is an upsert: each `(partner, device)` combination has exactly one current count record, and uploading new telemetry replaces the previous values for that combination.

---

## Filename Date Parsing

### Observed format

```
Discover_2026-February-25_2163.csv
```

### Pattern

```
{QueryName}_{YYYY}-{MonthName}-{DD}_{QueryID}.csv
```

| Segment | Example | Notes |
|---|---|---|
| `QueryName` | `Discover` | Free text, no spaces. Ignored for date parsing. |
| `YYYY` | `2026` | 4-digit year. |
| `MonthName` | `February` | Full English month name. Must map to month number. |
| `DD` | `25` | Zero-padded or bare day. |
| `QueryID` | `2163` | Numeric Datadog query identifier. Ignored for date parsing. |

### Parsing logic

1. Strip the `.csv` extension.
2. Split on `_`. Expect at least 3 segments; the date is the second-to-last segment (index `-2` from the end), the query ID is the last.
3. Split the date segment on `-`. Expect exactly 3 parts: `[YYYY, MonthName, DD]`.
4. Map `MonthName` to a month number using a case-insensitive English month lookup (January=1 through December=12).
5. Construct an ISO date: `YYYY-MM-DD`.
6. If parsing fails at any step — unexpected segment count, unrecognized month name, non-numeric year or day — fall back to the manual Snapshot Date picker and display an inline warning: "Could not parse date from filename. Please confirm the snapshot date below."

### Snapshot Date field behavior after this change

- On file selection, attempt filename parsing immediately (client-side, before upload).
- If parsing succeeds: populate the Snapshot Date field with the parsed date and mark it read-only, with a note beneath: "Parsed from filename." The Admin can click "Edit" to override if the parsed date is wrong.
- If parsing fails: leave the Snapshot Date field editable as today, with the warning above.
- The Snapshot Date field is never hidden — it remains visible so the Admin always sees and can verify the date being recorded.

---

## Upsert Behavior

### Upsert key

```
(partner_key, device)
```

`partner_key` is resolved from the `partner` column via the Partner Key Registry (DST-038). `device` is the raw string from the CSV. Together they uniquely identify a telemetry record. `core_version` is **not** part of the upsert key — a version change on the same partner–device combination is an update to the existing record, not a new record.

### Upsert logic

For each incoming row, after partner key resolution:

```sql
INSERT INTO device_telemetry (
  partner_key, device, core_version,
  count_unique_device_id, count,
  count_updated_at, snapshot_date, upload_batch_id
)
VALUES (...)
ON CONFLICT (partner_key, device)
DO UPDATE SET
  core_version           = EXCLUDED.core_version,
  count_unique_device_id = EXCLUDED.count_unique_device_id,
  count                  = EXCLUDED.count,
  count_updated_at       = EXCLUDED.count_updated_at,
  snapshot_date          = EXCLUDED.snapshot_date,
  upload_batch_id        = EXCLUDED.upload_batch_id;
```

`partner_key` and `device` form a unique index: `UNIQUE (partner_key, device)`.

Only `count_unique_device_id`, `count`, `core_version`, `count_updated_at`, `snapshot_date`, and `upload_batch_id` are overwritten on conflict. `created_at` and the original `upload_batch_id` (first import) are preserved in the audit log, not overwritten on the live record.

### Stale upload guard

If the incoming `snapshot_date` is **earlier** than the `snapshot_date` already stored for a given `(partner_key, device)` combination, the row is flagged amber in the Preview & Validate step with the message: "Existing record has a newer snapshot ([existing date]). Uploading this row would overwrite newer data with older data." The Admin must explicitly check "Overwrite anyway" per flagged row before the import can be confirmed. This prevents an older export from silently clobbering fresher telemetry.

---

## `count_updated_at` Field

### Definition

`count_updated_at` stores the snapshot date parsed from the filename (or confirmed via the date picker). It represents when Datadog generated the export — i.e., the date the counts were accurate — not when the Admin uploaded the file. Upload timestamp is captured separately as `uploaded_at`.

### Schema changes to `device_telemetry`

| Column | Type | Change |
|---|---|---|
| `count_updated_at` | DATE | **New.** Set to the parsed snapshot date on every upsert. |
| `uploaded_at` | TIMESTAMPTZ | **New.** Set to `NOW()` on every upsert. |
| `upload_batch_id` | UUID | **New.** Groups all rows from a single upload together. |
| `snapshot_date` | DATE | **Existing** (formerly the manual date picker value) — now populated from `count_updated_at`. Retained for backward compatibility; functionally equivalent to `count_updated_at`. |

Migration: `ALTER TABLE device_telemetry ADD COLUMN IF NOT EXISTS count_updated_at DATE; ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ; ADD COLUMN IF NOT EXISTS upload_batch_id UUID;` — idempotent.

### Display

In the device record view, the count fields display as:

```
Unique Device IDs    1,842
Total Count          2,163
Count Updated        February 25, 2026
```

"Count Updated" is formatted as `{MonthName} {D}, {YYYY}` — matching the style of the source filename. If `count_updated_at` is null (records imported before this story), display "—".

---

## Preview & Validate Step Changes

The existing Preview & Validate step (Step 2) gains:

- A **"Snapshot Date" header** above the table confirming the parsed date: "Snapshot date: February 25, 2026 (parsed from filename)."
- A **"Status" column** as the first column:
  - **New** — no existing record for this `(partner_key, device)`.
  - **Update** — existing record found; `count_unique_device_id` and/or `count` will be replaced.
  - **No change** — existing record found and all values are identical (counts and core_version match).
  - **Stale ⚠** — incoming snapshot date is older than stored snapshot date (amber; requires explicit override).
- **Summary banner:** "148 rows — 12 new, 131 updates, 3 no change, 2 stale (review required)."

---

## Upload History

The Upload History panel (currently showing "No upload history yet") displays one row per completed upload batch:

| Column | Content |
|---|---|
| Snapshot Date | Parsed from filename |
| Uploaded At | Timestamp of upload |
| File | Filename |
| Uploaded By | Admin email |
| Rows | New / Updated / No change / Stale overwritten |
| Batch ID | UUID, truncated, copyable |

---

## Acceptance Criteria

- Uploading `Discover_2026-February-25_2163.csv` automatically populates the Snapshot Date field with `2026-02-25` and marks it read-only with "Parsed from filename."
- Parsing is case-insensitive for month names (`february`, `February`, `FEBRUARY` all resolve correctly).
- If the filename does not match the expected pattern, the Snapshot Date field remains editable and an inline warning is shown.
- The Snapshot Date field is always visible; it is never hidden regardless of parse outcome.
- On import, rows are upserted on `(partner_key, device)`. Re-uploading the same file produces zero new rows and marks all rows as "No change."
- Uploading a refreshed export for the same snapshot period correctly updates `count_unique_device_id`, `count`, and `core_version` for all matching rows and sets `count_updated_at` to the snapshot date.
- `created_at` is not overwritten on upsert.
- Rows where the incoming `snapshot_date` is earlier than the stored `snapshot_date` are flagged amber in the preview and cannot be imported without explicit per-row "Overwrite anyway" confirmation.
- The device record view displays "Count Updated" formatted as `{MonthName} {D}, {YYYY}`.
- The Upload History panel correctly shows one row per completed batch with all specified columns.
- Schema migration is idempotent. Existing telemetry rows have `count_updated_at = NULL` and display "—" in the UI.
