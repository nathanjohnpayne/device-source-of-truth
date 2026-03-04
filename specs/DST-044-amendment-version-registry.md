# DST-044 (Amendment) — Version Registry: Missing Labels & Plugin Suffix Stripping

| Field | Value |
|---|---|
| **Story ID** | DST-044 (Amendment) |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T3 — Telemetry & Observability |
| **Priority** | P1 |
| **Story Points** | 1 |
| **Product Owner** | Nathan Payne |
| **Amends** | DST-044 (Core Version Mapping Registry & Friendly Version Display) |
| **Dependencies** | DST-044 must be deployed before this amendment is applied |
| **Blocks** | Nothing |

---

## Background

Analysis of `AllModels.csv` against the DST-044 seed data revealed two gaps in the Version Registry:

1. **Four version labels are missing.** `ADK 2.1.1`, `ADK 3.1.0`, `ADK 4.0`, and `ADK 4.0 Beta` appear across 45 devices in the AllModels inventory but were not included in the initial seed. Without these entries, importing AllModels device records produces unmatched version warnings on those rows.

2. **Plugin suffix variants are not stripped before matching.** Two `core_version` values in AllModels use a compound format with a plugin version appended (`ADK 3.0.1+plugin-4.2.14`, `ADK 3.0.1+plugin-4.2.21`). These do not match the registry entry for `ADK 3.0.1` because the suffix is present. A normalization step is needed to strip the `+plugin-x.x.x` suffix before the registry lookup.

---

## Changes

### 1. Additional seed entries

Add the following rows to `core_version_mappings`. All seeded as `is_active = TRUE`, `created_by = 'system'`.

| `core_version` | `friendly_version` | `platform` | `notes` |
|---|---|---|---|
| `ADK 2.1.1` | `ADK 2.1.1` | `ADK` | Legacy version. Present on Movistar HispAm Proteus/VIP devices. |
| `ADK 3.1.0` | `ADK 3.1` | `ADK` | Patch variant of ADK 3.1. Present on Fetch, NOS, Vestel, and Philips TVs devices. Maps to the same friendly label as `42.15+ad3ca0f.1`. |
| `ADK 4.0` | `ADK 4.0` | `ADK` | New major version. Confirm final friendly label with engineering before importing Philips TVs devices on this build. |
| `ADK 4.0 Beta` | `ADK 4.0 Beta` | `ADK` | Pre-release build. Label is provisional — update when release is finalized. |

> **Note — `ADK 3.1.0` → `ADK 3.1`:** The AllModels inventory uses `ADK 3.1.0` (with trailing zero) while the existing registry entry uses `ADK 3.1` (without). Both refer to the same release. The new mapping stores `ADK 3.1.0` as the `core_version` key and maps it to the existing `friendly_version` label `ADK 3.1`, making `ADK 3.1` the canonical display name for both variants.

> **Note — `ADK 4.0` and `ADK 4.0 Beta`:** These are platform-version-style strings rather than build hashes in the `{semver}+{hash}.{build}` format used by all other ADK entries. They appear to originate from the AllModels spreadsheet rather than a Datadog export. The Version Registry accepts them as-is, but engineering should confirm whether a corresponding build hash entry is needed when devices on ADK 4.0 begin appearing in Datadog telemetry.

### 2. Plugin suffix normalization

Before performing a registry lookup on any `core_version` value — whether from a CSV import, a Questionnaire field, or a Datadog telemetry upload — apply the following normalization step:

**Strip the `+plugin-{version}` suffix if present.**

Pattern: remove any substring matching `\+plugin-[\d.]+$` from the end of the string.

| Raw value | Normalized | Lookup result |
|---|---|---|
| `ADK 3.0.1+plugin-4.2.14` | `ADK 3.0.1` | Matches existing registry entry |
| `ADK 3.0.1+plugin-4.2.21` | `ADK 3.0.1` | Matches existing registry entry |
| `42.7.1+47d0315.8` | `42.7.1+47d0315.8` | Unchanged — `+47d0315.8` does not match the plugin pattern |

The normalization is applied at lookup time only. The original raw `core_version` value is always stored as-is in `device_telemetry.core_version` — the normalized form is never persisted. This preserves the full build string for engineering reference while enabling clean registry resolution.

The normalized value is shown parenthetically in the preview: "Resolved via normalized form `ADK 3.0.1` (raw: `ADK 3.0.1+plugin-4.2.21`)."

---

## Acceptance Criteria

- All four new `core_version_mappings` entries are present after migration. Migration is idempotent.
- `ADK 3.1.0` resolves to friendly label `ADK 3.1`.
- `ADK 3.0.1+plugin-4.2.14` and `ADK 3.0.1+plugin-4.2.21` both resolve to `ADK 3.0.1` / friendly label `ADK 3.0.1` without an unmatched version warning.
- The raw `core_version` value including the plugin suffix is stored in `device_telemetry.core_version` unmodified.
- Plugin suffix normalization applies to all entry paths: CSV import, Questionnaire form, and Datadog telemetry upload.
- No existing registry entries or device telemetry records are modified by the migration.
