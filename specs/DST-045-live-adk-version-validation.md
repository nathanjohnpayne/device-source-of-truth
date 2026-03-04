# DST-045 — `liveAdkVersion` Validation Against Known Friendly Versions

| Field | Value |
|---|---|
| **Story ID** | DST-045 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T3 — Telemetry & Observability |
| **Priority** | P1 |
| **Story Points** | 3 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-044 (Version Mapping Registry — `friendly_version` controlled vocabulary is the source of truth for validation) |
| **Blocks** | Nothing |

---

## User Story

As an Admin, when a `liveAdkVersion` value arrives via any DST import or Questionnaire submission, it is validated against the known set of `friendly_version` labels in the Version Registry — and flagged with a warning if no match is found — so that version data stays consistent across all entry points.

---

## Background

DST-044 established `core_version_mappings` as the source of truth for friendly version labels (e.g., `ADK 3.1.1`, `NCP 2025.09.5`). The `liveAdkVersion` field can arrive through two paths:

- **CSV import** — any import flow whose schema includes a `liveAdkVersion` column (e.g., a device spec or STB Questionnaire bulk import).
- **Questionnaire form** — the `liveAdkVersion` field on the STB Technical Questionnaire (DST-035), filled in directly by a partner or Certification Specialist.

In both cases, the value entered should correspond to a `friendly_version` that already exists in the registry. If it does not — because a new platform version has shipped and no mapping has been added yet, or because a partner entered a non-standard label — the discrepancy should be visible before data is committed, but should not block the workflow.

---

## Validation Logic

### Canonical value set

The valid set for `liveAdkVersion` is the distinct list of active `friendly_version` values from `core_version_mappings WHERE is_active = TRUE`, queried at validation time. This set is not hardcoded — it reflects whatever mappings currently exist in the registry.

### Match rules

Matching is case-insensitive and whitespace-normalized (trim both ends, collapse internal runs of whitespace to a single space). Exact match after normalization is the only passing condition. Partial matches, prefix matches, and fuzzy matches do not resolve a warning — they produce a warning like an unrecognized value would.

### Warning condition

A warning is raised when:
- The incoming `liveAdkVersion` value, after normalization, does not appear in the active `friendly_version` set.
- The field is non-blank. A blank `liveAdkVersion` is valid and does not produce a warning.

### Warning message

```
"liveAdkVersion" value "[value]" is not a recognized friendly version.
Verify the value or add it to the Version Registry before importing.
```

The warning includes a direct link to Admin panel > Version Registry so the Admin can add the mapping without leaving the import flow.

---

## Import Flow Behavior

When `liveAdkVersion` is present as a column in any CSV import registered via `registerImportFlow` (DST-042):

- The field type is registered as `liveAdkVersion` — a new named type, distinct from `enum`, because its valid set is dynamic (drawn live from `core_version_mappings`) rather than static (drawn from `field_options`).
- Rule-based normalization runs first (case and whitespace normalization). If the normalized value matches, the row is clean.
- If no match is found, the row is flagged **amber** in the Preview & Validate step with the warning above. The row is not flagged red and is not excluded from the import by default — the Admin may proceed.
- The amber flag does not count toward the "errors" total in the summary banner. It counts toward a new "version warnings" total:

```
312 rows parsed — 287 new, 18 duplicates (will skip), 5 version warnings, 2 errors
```

- The AI disambiguation pass (DST-042), if enabled, does **not** attempt to auto-resolve `liveAdkVersion` mismatches. The Version Registry is authoritative; the correct response to an unknown value is for a human to add the mapping, not for AI to guess at the label.

---

## Questionnaire Form Behavior

On the STB Technical Questionnaire form (DST-035), `liveAdkVersion` is presented as a text input with typeahead. The typeahead draws from the active `friendly_version` set in real time.

- If the submitter selects a value from the typeahead, no warning is generated.
- If the submitter types a free-text value that does not match any active `friendly_version`, an inline warning appears beneath the field on blur:

```
⚠ "[value]" is not a recognized version. If this is a new release,
ask your Admin to add it to the Version Registry.
```

- The warning is non-blocking — the form can be saved and submitted with an unrecognized `liveAdkVersion`. The warning is preserved on the saved record and surfaced in the device record view with the same amber badge used for unmapped telemetry versions (DST-044).
- Saving a Questionnaire record with an unrecognized `liveAdkVersion` adds it to the Unmapped Versions panel in the Version Registry (DST-044), alongside unmapped telemetry versions, so all unresolved version values are visible in one place regardless of their entry path.

---

## Unmapped Versions Panel Update

The Unmapped Versions panel (DST-044) gains a **Source** column indicating how each unresolved version arrived:

| Source | Meaning |
|---|---|
| `Telemetry` | Arrived via Datadog CSV upload |
| `Import` | Arrived via a CSV import flow |
| `Questionnaire` | Entered directly on the STB Questionnaire form |

This allows the Version Registry Admin to prioritize: a `liveAdkVersion` that arrived from a partner-submitted Questionnaire may need verification before a mapping is added, whereas a telemetry build string is unambiguously a real version.

---

## Acceptance Criteria

- A `liveAdkVersion` value that exactly matches (case-insensitive, whitespace-normalized) an active `friendly_version` in the registry passes validation with no warning.
- A `liveAdkVersion` value that does not match any active `friendly_version` produces an amber warning in the import preview and an inline warning on the Questionnaire form. Neither blocks the import or form submission.
- A blank `liveAdkVersion` produces no warning.
- The warning message includes a direct link to the Version Registry.
- The AI disambiguation pass does not attempt to auto-resolve `liveAdkVersion` mismatches.
- The import summary banner counts `liveAdkVersion` warnings separately from hard errors.
- The Questionnaire form `liveAdkVersion` input has a typeahead populated from active `friendly_version` values.
- Submitting a Questionnaire with an unrecognized `liveAdkVersion` adds the value to the Unmapped Versions panel with source `Questionnaire`.
- Importing a CSV with an unrecognized `liveAdkVersion` adds the value to the Unmapped Versions panel with source `Import`.
- The Unmapped Versions panel correctly shows the Source column distinguishing `Telemetry`, `Import`, and `Questionnaire` entries.
- If a new mapping is added to the Version Registry that resolves a previously flagged `liveAdkVersion`, the amber badge clears on all affected records (retroactive resolution, consistent with DST-044 behavior).
