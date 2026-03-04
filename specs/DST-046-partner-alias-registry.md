# DST-046 — Partner Alias Registry

| Field | Value |
|---|---|
| **Story ID** | DST-046 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T2 — Data Ingestion & Migration |
| **Priority** | P1 |
| **Story Points** | 3 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-038 (Partner Key Registry — canonical `partners` table must exist) |
| **Blocks** | Nothing |

---

## User Story

As an Admin, I can register alternate display names for partners so that when a CSV import or Questionnaire submission uses a non-canonical name — such as a platform name, a legacy brand, or a rebranded entity — DST resolves it to the correct partner record without requiring the source file to be corrected.

---

## Background

Device data arrives from multiple sources that use inconsistent partner naming conventions. The `AllModels.csv` device inventory revealed five concrete cases where partner names in source files do not match `friendly_partner_name` values in the Partner Key Registry (DST-038):

| Source name | Canonical partner | Reason for divergence |
|---|---|---|
| `Temis` | `Telefónica` | Temis is the internal middleware platform name used in LATAM operations — not the partner's public name |
| `Titan - Novatek` | `Philips TVs` | Titan is the OS name; the chipset variant is embedded in the alias rather than stored as a separate field |
| `Titan - Mediatek` | `Philips TVs` | Same — MediaTek chipset variant expressed as a name suffix |
| `Movistar` | Context-dependent | Bare `Movistar` resolves to `Movistar Spain` when Region is EMEA / Country is Spain; to `Movistar HispAm` when Region is LATAM |
| `Virgin Media O2` | `Virgin Media` | Corporate rebrand — `Virgin Media O2` is the current legal name but the partner key infrastructure uses `virginmedia_*` |

Without an alias layer, any of these names in a source file produces an unmatched partner warning and requires manual linking post-import. With aliases registered, resolution is automatic and transparent.

---

## Data Model

### New table: `partner_aliases`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key. |
| `alias` | VARCHAR(200) | The non-canonical name as it appears in source files. Case-insensitive unique constraint (see below). Non-null. |
| `partner_id` | UUID | FK → `partners.id`. Nullable only when `resolution_type = contextual` — in that case the target partner is determined at resolution time. |
| `resolution_type` | VARCHAR(20) | `direct` — maps unconditionally to `partner_id`. `contextual` — requires additional signals to resolve; see Contextual Resolution below. |
| `context_rules` | JSONB | Required when `resolution_type = contextual`. Null otherwise. See schema below. |
| `notes` | TEXT | Optional. Free-text explanation of why the alias exists. |
| `is_active` | BOOLEAN | Defaults to `TRUE`. Inactive aliases are retained for history but not applied during import. |
| `created_at` | TIMESTAMPTZ | Set on insert. |
| `created_by` | VARCHAR(100) | Admin email. |
| `updated_at` | TIMESTAMPTZ | Updated on any edit. |
| `updated_by` | VARCHAR(100) | Admin email. |

**Unique constraint:** `LOWER(TRIM(alias))` — alias matching is always case-insensitive and whitespace-normalized. An alias cannot be registered if it already exists as a `friendly_partner_name` in `partners` (guard against accidental shadowing of canonical names).

---

## Contextual Resolution

Some aliases cannot resolve to a single partner unconditionally. The `context_rules` JSONB column encodes a priority-ordered list of rules, each mapping a field condition to a `partner_id`.

### Schema

```json
{
  "signals": ["region", "country"],
  "rules": [
    {
      "conditions": { "region": ["EMEA"], "country_iso": ["ES"] },
      "partner_id": "<uuid of Movistar Spain>"
    },
    {
      "conditions": { "region": ["LATAM"] },
      "partner_id": "<uuid of Movistar HispAm>"
    }
  ],
  "fallback": null
}
```

Rules are evaluated in order. The first rule whose conditions all match the incoming row is applied. `fallback` is the `partner_id` to use if no rule matches — `null` means flag as unresolved.

Available signal fields: `region`, `country_iso`, `device_type`, `vendor`.

### Evaluation at import time

When a row's partner name matches an alias with `resolution_type = contextual`, the resolver evaluates `context_rules` against the normalized field values on the same row. If a rule matches, the row is resolved silently. If no rule matches and `fallback` is null, the row is flagged amber with: "Partner alias `[alias]` could not be resolved with the available context. Manual assignment required."

---

## Seed Data

On first deploy, seed the following aliases. All seeded as `is_active = TRUE`, `created_by = 'system'`.

### Direct aliases

| `alias` | Canonical `friendly_partner_name` | `notes` |
|---|---|---|
| `Temis` | `Telefónica` | LATAM middleware platform name used in device manifests and internal tracking sheets |
| `Titan - Novatek` | `Philips TVs` | Titan OS + Novatek chipset expressed as a compound name in AllModels device inventory |
| `Titan - Mediatek` | `Philips TVs` | Titan OS + MediaTek chipset expressed as a compound name in AllModels device inventory |
| `Virgin Media O2` | `Virgin Media` | Current legal entity name post-rebrand; partner key infrastructure retains `virginmedia_*` keys |

### Contextual aliases

| `alias` | `resolution_type` | Rules |
|---|---|---|
| `Movistar` | `contextual` | Region=EMEA + Country=ES → `Movistar Spain`; Region=LATAM → `Movistar HispAm`; fallback=null |

> **Note — all four `Movistar` rows in AllModels are Region=EMEA / Country=Spain.** They resolve to `Movistar Spain` under the seeded rules. The LATAM branch is seeded for forward compatibility, as bare `Movistar` may appear in future LATAM imports.

---

## Resolution Order in Import Flows

Partner name resolution now runs in this priority order on every import row:

1. **Exact match** against `partners.friendly_partner_name` (existing — DST-038).
2. **Alias lookup** against `partner_aliases WHERE LOWER(TRIM(alias)) = LOWER(TRIM(incoming)) AND is_active = TRUE`. If `resolution_type = direct`, resolve immediately. If `contextual`, evaluate `context_rules`.
3. **Fuzzy match** against `partners.friendly_partner_name` (existing — Jaro-Winkler ≥ 0.90).
4. **Unmatched** — flag amber, Admin links manually.

Alias resolution is inserted at step 2, before fuzzy matching. A row resolved via alias records `match_confidence = alias_direct` or `match_confidence = alias_contextual` in `intake_request_partners` (DST-037) or `partner_keys` (DST-038) as applicable.

---

## Admin UI — Alias Registry

Location: Admin panel > Partner Key Registry > Aliases tab (new tab alongside the key table).

### Alias table

Columns: Alias | Resolution Type | Resolves To | Context Rules | Notes | Active | Created | Updated | Actions.

"Resolves To" displays the canonical `friendly_partner_name` for direct aliases; "Context-dependent" with a popover showing the rules for contextual aliases.

### Adding an alias

"+ Add Alias" button opens a form:

- **Alias** (required) — text input. On blur, checks for collision with existing `friendly_partner_name` values and warns if found.
- **Resolution Type** — radio: Direct / Contextual.
- **If Direct:** Partner dropdown (searches `partners.friendly_partner_name`).
- **If Contextual:** Rule builder — ordered list of condition → partner pairs, with a fallback partner (optional).
- **Notes** (optional).

### Editing and deactivating

Inline edit on any row. Deactivating shows: "[N] import rows resolved via this alias in the last 90 days. Deactivating means future imports using `[alias]` will fall through to fuzzy matching or be flagged unmatched."

---

## Acceptance Criteria

- `partner_aliases` table exists with all columns specified. `LOWER(TRIM(alias))` unique constraint is enforced. Schema migration is idempotent.
- All five seed aliases are present on first deploy.
- Importing a file containing `Temis`, `Titan - Novatek`, `Titan - Mediatek`, or `Virgin Media O2` resolves each to the correct partner record without an unmatched warning.
- Importing a file containing `Movistar` with Region=EMEA and Country=Spain resolves to `Movistar Spain`. With Region=LATAM, resolves to `Movistar HispAm`.
- A `Movistar` row with no matching context rule is flagged amber with the contextual resolution failure message.
- Alias resolution is applied before fuzzy matching in the import pipeline.
- `match_confidence` is recorded as `alias_direct` or `alias_contextual` on resolved rows.
- Attempting to register an alias that matches an existing `friendly_partner_name` (case-insensitive) produces a warning rather than silently inserting.
- Deactivating an alias does not delete it; it is retained for history and excluded from future resolution passes.
- Non-Admin users cannot access the Alias Registry tab.
