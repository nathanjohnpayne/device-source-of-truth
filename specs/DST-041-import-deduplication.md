# DST-041 — Import Deduplication

| Field | Value |
|---|---|
| **Story ID** | DST-041 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T2 — Data Ingestion & Migration |
| **Priority** | P1 |
| **Story Points** | 5 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-037 (Intake Request Import), DST-038 (Partner Key Registry Import) |
| **Blocks** | Nothing |

---

## User Story

As an Admin importing partner data, I am warned before confirming any import if records already exist in DST that match incoming rows, and I can choose to skip, overwrite, or merge each conflict — so that re-running an export or importing overlapping files never silently creates duplicate records.

---

## Background

DST-037 explicitly deferred deduplication to a future story, noting that "re-importing the same CSV creates duplicates and the Admin is responsible for avoiding that." DST-038 has a unique constraint on `partner_keys.key` that causes a hard error on re-import rather than a managed conflict. Neither behavior is acceptable in production: silent duplicates corrupt reporting; hard constraint errors leave the Admin with no recovery path short of manual deletion.

This story establishes a deduplication strategy for every current and future DST import flow, surfacing conflicts in the validation preview with a clear per-row resolution choice before any data is written.

---

## Natural Keys by Import Type

Deduplication requires a stable natural key — a field or combination of fields that identifies a record as logically the same across imports, independent of the database-generated UUID.

### Intake Requests (DST-037)

Airtable does not export a stable row ID. The natural key is the combination of:

```
(airtable_subject, partner_name_raw, target_launch_date)
```

Rationale: the subject line is authored per request and is highly specific; combined with the partner name token and launch date, collisions are rare and intentional matches are reliable. If `target_launch_date` is blank on both the incoming and existing record, it is treated as a match on the first two fields alone.

This composite key is stored as a generated column `natural_key` on `intake_requests`:

```sql
natural_key TEXT GENERATED ALWAYS AS (
  LOWER(TRIM(airtable_subject))
  || '|' || LOWER(TRIM(partner_name_raw))
  || '|' || COALESCE(target_launch_date::TEXT, '')
) STORED;

CREATE UNIQUE INDEX intake_requests_natural_key_idx ON intake_requests (natural_key);
```

### Partner Keys (DST-038)

The natural key is `partner_keys.key` — the manifest identifier itself. This is already unique-constrained. The existing hard constraint error is replaced by the managed conflict flow defined in this story.

### Future import types

Every new import flow must declare its natural key in its ticket before implementation. The deduplication framework introduced here applies automatically once the natural key index exists.

---

## Conflict Detection

Conflict detection runs as part of the existing parser pipeline, after normalization and before the validation preview renders. For each incoming row, the parser computes the natural key and queries DST for an existing record.

Three outcomes:

| State | Definition | Display |
|---|---|---|
| **New** | No existing record with this natural key. | No indicator — rows proceed normally. |
| **Duplicate** | Incoming row is byte-for-byte identical to the existing record on all mapped fields. | Blue "Duplicate" badge. Default action: Skip. |
| **Conflict** | Natural key matches an existing record, but one or more field values differ. | Amber "Conflict" badge. Admin must choose a resolution. |

---

## Resolution Options

### Duplicate (identical record)

Default action is **Skip** — the row is excluded from the import with no further action required. The Admin can override to **Overwrite** if they want to force a re-write (useful for correcting `imported_by` metadata or resetting `imported_at`).

### Conflict (same natural key, different values)

The Admin must choose one of three resolutions per row:

**Skip** — discard the incoming row. The existing record is unchanged.

**Overwrite** — replace all mapped fields on the existing record with the incoming values. The existing record's `id`, `import_batch_id` (original), `created_at`, and `created_by` are preserved; `updated_at` and `updated_by` are set to the current Admin and timestamp.

**Merge** — apply only the non-blank incoming values to the existing record. Fields that are blank in the incoming row are left as-is on the existing record. Useful when a re-export fills in fields that were blank in the original import.

The Admin can apply a resolution to all conflicts of the same type in one action using "Apply to all conflicts" — mirroring the bulk clarification pattern from DST-039.

---

## Validation Preview Changes

The existing summary banner gains a conflict count:

```
312 rows parsed — 287 new, 18 duplicates (will skip), 7 conflicts (action required), 0 errors
```

The preview table gains a **Status** column as its first column. Conflict and duplicate rows are sorted to the top by default so the Admin sees them immediately without paginating.

For conflict rows, a diff view is shown inline: existing value on the left in grey, incoming value on the right in amber, with the resolution dropdown (Skip / Overwrite / Merge) at the end of the row.

The "Import [N] records" button remains disabled until all conflict rows have a chosen resolution. Duplicate rows with the default Skip action do not block confirmation.

---

## Within-File Deduplication

The incoming file itself may contain duplicate rows (e.g., a partner appearing in multiple LATAM batch rows in the same export). The parser deduplicates within the file before comparing against DST:

- For intake requests: if two rows share the same natural key within the file, the first occurrence is kept and subsequent ones are flagged red ("Duplicate within file — row [N] kept") and skipped.
- For partner keys: `partner_keys.key` must be unique within the file. Subsequent rows with the same key are flagged red and skipped.

---

## Batch Rollback Interaction

When an Overwrite or Merge resolution is applied, the original record's pre-import state is captured in the audit log so it can be restored if the batch is rolled back. Rollback (from DST-037) now covers three operations:

- Delete all rows imported as **New** in the batch.
- Restore all rows that were **Overwritten** to their pre-import field values.
- Restore all rows that were **Merged** to their pre-import field values.

The rollback confirmation modal is updated to display: "This will delete [N] new records, restore [N] overwritten records, and restore [N] merged records."

---

## Acceptance Criteria

- Re-importing `IntakeRequests.csv` against a DST database that already contains those records produces zero new duplicates. All matching rows are flagged as Duplicate (skip) or Conflict (action required) in the preview.
- Re-importing `partner_key_mapping_enriched_2.csv` with an existing `partner_keys.key` no longer throws a database constraint error. Instead, the row is surfaced as a Conflict in the preview.
- Natural key index on `intake_requests` is created as part of the idempotent schema migration.
- Conflict rows display a diff of existing vs. incoming values for every differing field.
- Skip, Overwrite, and Merge resolutions each produce the correct outcome on confirmation.
- Merge does not overwrite existing non-blank values with blank incoming values.
- "Apply to all conflicts" correctly bulk-applies a resolution to all currently unresolved conflict rows.
- Within-file duplicates (same natural key appearing more than once in the CSV) are flagged red and only the first occurrence is eligible for import.
- The import summary banner correctly counts new, duplicate, conflict, and error rows.
- Batch rollback correctly restores Overwritten and Merged records to their pre-import state, and deletes New records.
- The rollback confirmation modal reflects the correct counts of each operation type.
