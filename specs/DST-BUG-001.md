# DST-BUG-001 — AllModels Migration: Partner Column Not Resolving to Any Partner Records

| Field | Value |
|---|---|
| **Bug ID** | DST-BUG-001 |
| **Severity** | P1 — Blocker |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Affected Story** | DST-031 — One-Time Migration: AllModels to DST Registry |
| **Related Specs** | DST-031, DST-038, DST-046 |
| **Reporter** | Nathan Payne |
| **Status** | Open |

---

## Summary

When running the AllModels migration (DST-031), zero devices resolve to a partner record, even when Reference Data and Partner Keys have been imported first. All rows land as unmatched.

---

## Steps to Reproduce

1. Import Reference Data (DST-036 dropdowns).
2. Import Partner Keys via `partner_key_mapping_enriched_2.csv` (DST-038).
3. Run the AllModels migration against the AllModels CSV export.
4. Observe: 0 of N device rows resolve to a partner. All are flagged as unmatched.

---

## Root Cause

The DST-031 acceptance criteria states:

> "Partner (looked up against `partner_keys` table)"

This language has been implemented literally: the migration is attempting to match the `Partner` column from AllModels against `partner_keys.key`. However, `partner_keys.key` stores **Datadog manifest keys** — snake_case identifiers such as `claro_br`, `vodafone_es`, `tivo_evolution_emea`. The AllModels `Partner` column contains **friendly display names** such as `Claro`, `Vodafone`, `TiVo`. These will never match under any conditions, producing 100% failure.

The correct join target is **`partners.friendly_partner_name`**, resolved via the full DST-046 resolution chain (exact match → alias lookup → fuzzy match). The `partner_keys` table is not the resolution target; it is the downstream table that links a resolved partner to Datadog telemetry. The DST-031 spec wording is ambiguous and should be clarified as part of this fix (see Spec Clarification Requests below).

---

## Secondary Issue: Names That Will Remain Unresolved After the Fix

Even after correcting the lookup target, the following `Partner` values in AllModels will not resolve without additional action:

| Partner Value in CSV | Issue | Required Action |
|---|---|---|
| `Temis` | Alias for `Telefónica` — not a canonical partner name | DST-046 alias seeding must be deployed |
| `Titan - Mediatek` | Alias for `Philips TVs` | DST-046 alias seeding must be deployed |
| `Titan - Novatek` | Alias for `Philips TVs` | DST-046 alias seeding must be deployed |
| `Virgin Media O2` | Alias for `Virgin Media` | DST-046 alias seeding must be deployed |
| `Movistar` | Contextual alias — resolves based on Region + Country | DST-046 must be deployed; verify Region=EMEA / Country=ES on all four rows |
| `Amlogic` | Chipset name in the Partner column — source data error | Manual correction in AllModels before re-import |
| `Broadcom` | Chipset name in the Partner column — source data error | Manual correction in AllModels before re-import |
| `DT` | Presumably Deutsche Telekom; no canonical name or alias covers this abbreviation | Add alias `DT` → canonical name in DST-046 Alias Registry before re-import |

---

## Fix

### 1. Correct the migration lookup target (DST-031)

Change the partner resolution step to match `Partner` (after whitespace trim) against `partners.friendly_partner_name` using the full DST-046 resolution chain:

1. Exact match: `LOWER(TRIM(partner_column)) = LOWER(partners.friendly_partner_name)`
2. Alias lookup: `partner_aliases WHERE LOWER(TRIM(alias)) = LOWER(TRIM(partner_column)) AND is_active = TRUE`
3. Fuzzy match: Jaro-Winkler ≥ 0.90 against `partners.friendly_partner_name`
4. Unmatched: flag amber for manual Admin assignment

### 2. Confirm DST-046 is deployed before re-running the migration

Five partner names (`Temis`, `Titan - Mediatek`, `Titan - Novatek`, `Virgin Media O2`, `Movistar`) depend on the DST-046 alias seed data being present. Without it, they will still land as unmatched amber even with the correct lookup target.

### 3. Resolve source data errors in AllModels

`Amlogic` and `Broadcom` are chipset names, not partner names. The affected rows in AllModels need their `Partner` field corrected to the actual deploying partner before or immediately after import.

### 4. Add `DT` alias

Add an alias `DT` → `Deutsche Telekom` (or the appropriate canonical name in the `partners` table) via Admin panel > Partner Key Registry > Aliases tab, per DST-046.

---

## Spec Clarification Requests

The following spec language is ambiguous or incorrect and should be confirmed and corrected before this ticket is closed.

### DST-031 — Acceptance Criteria, Partner column mapping

**Current wording:**
> "Partner (looked up against `partner_keys` table)"

**Problem:** This implies the lookup target is `partner_keys.key`, which stores Datadog manifest keys — not human-readable partner names. The intended behavior (and the correct behavior) is to resolve against `partners.friendly_partner_name` via the DST-046 alias resolution chain.

**Requested clarification:** Please confirm that the correct lookup target is `partners.friendly_partner_name`, and update the acceptance criteria to read something like:

> "Partner — resolved against `partners.friendly_partner_name` using the DST-046 resolution chain (exact match → alias lookup → fuzzy match). Unresolved rows flagged amber for manual Admin assignment."

### DST-046 — Migration dependency not declared

**Problem:** DST-046 (Partner Alias Registry) is a hard runtime dependency of the AllModels migration for at least five partner names (`Temis`, `Titan - Mediatek`, `Titan - Novatek`, `Virgin Media O2`, `Movistar`). This dependency is not listed in DST-031's dependency table, nor is DST-031 listed as a dependent in DST-046.

**Requested clarification:** Please confirm that DST-046 must be fully deployed (including seed data) before DST-031 is executed, and add `DST-046` to the DST-031 dependency field.

### DST-038 — Spec language contributing to misread

**Problem:** DST-038 describes the `partner_keys` table as the mechanism by which partners are resolved, which is accurate for Datadog telemetry. However, the overlap in terminology between "partner resolution" in DST-038 (key → partner) and "partner resolution" in DST-031 (display name → partner) appears to have contributed to the misread in the migration implementation.

**Requested clarification:** No spec change required, but recommend adding a note to DST-031 explicitly distinguishing the two resolution paths to prevent recurrence.

---

## Acceptance Criteria for This Bug Fix

- Re-running the AllModels migration after the fix produces partner matches for all rows whose `Partner` value has an exact, alias, or fuzzy match in the `partners` table.
- DST-046 alias seed data is confirmed deployed before migration is re-run.
- `Temis`, `Titan - Mediatek`, `Titan - Novatek`, `Virgin Media O2`, and `Movistar` rows all resolve correctly via alias lookup.
- `Amlogic` and `Broadcom` rows are either corrected in the source and re-imported, or flagged amber with a clear reconciliation report note identifying the source data error.
- A `DT` alias is added for Deutsche Telekom and resolves correctly.
- DST-031 acceptance criteria wording is updated to reflect the correct lookup target.
- DST-046 is added as a declared dependency in DST-031.
- Migration is re-run and produces a reconciliation report confirming expected match counts.
