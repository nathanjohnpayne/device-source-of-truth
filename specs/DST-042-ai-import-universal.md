---
spec_id: DST-042-ai-import-universal
tested: false
reason: "implementation pending"
---

# DST-042 — AI Import: Universal Coverage, Field-Type Optimization & Opt-In Control

| Field | Value |
|---|---|
| **Story ID** | DST-042 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T2 — Data Ingestion & Migration |
| **Priority** | P1 |
| **Story Points** | 8 |
| **Product Owner** | Nathan Payne |
| **Supersedes** | DST-040 (AI Import opt-in checkbox — absorbed into this story) |
| **Extends** | DST-039 (AI-Assisted Import Disambiguation — architectural changes to batching and scope) |
| **Dependencies** | DST-039, DST-037, DST-038, DST-041 |
| **Blocks** | Nothing |

---

## User Story

As an Admin, the AI disambiguation pass applies to every DST import flow where it adds value, runs as fast as possible by grouping API calls by field type rather than by row, and is gated behind a single opt-in checkbox with a cost disclosure — so that AI-assisted imports are faster, cheaper, and available everywhere without requiring per-flow implementation work.

---

## Background

DST-039 introduced an AI disambiguation pass, but scoped it narrowly to the two existing import flows (DST-037, DST-038) and designed API calls row-by-row. DST-040 added an opt-in checkbox as a thin separate ticket. This story replaces both with a unified, extensible implementation:

- A **field-type-aware batching model** that groups all ambiguous values of the same type across the entire file into a single API call, rather than sending one call per row. This reduces API call count, total token usage, and wall-clock import time — especially for large files where the same ambiguity pattern repeats across dozens of rows.
- A **universal AI import framework** that any future DST import flow can opt into by declaring its field type mappings, with no per-flow AI integration work.
- A **fully implemented opt-in checkbox and cost disclosure modal**, superseding the stub in DST-040.

---

## Field Type Classification

Not every field benefits from AI disambiguation. Sending clean, structured values to the API wastes tokens and adds latency. The AI pass operates on a whitelist of field types, evaluated per value — a field is only sent to the API if its value fails rule-based normalization.

### Types eligible for AI disambiguation

| Field Type | Example ambiguities | AI value-add |
|---|---|---|
| `country` | Emoji, full names, non-standard codes (`UK`, `WW`, `Global`), bare codes with geographic ambiguity (`SK`) | High — contextual signals across row and file resolve most cases |
| `region` | `NA` (North America vs. N/A), `Worldwide`, mixed-delimiter arrays | High — partner name and country on same row are strong signals |
| `partner_name` | Encoding corruption, abbreviations, brand vs. legal name, fuzzy matches | High — file-wide pattern matching catches systematic encoding errors |
| `enum` | Values that don't exactly match a controlled vocabulary entry but are close (e.g., `"Yes—Hardware"` vs. `"Yes - Hardware"`) | Medium — useful when a new export uses slightly different phrasing |
| `multi_value_delimiter` | Cells containing both `,` and `;`, or values that contain commas as part of a proper noun | Medium — context from other cells in the same column resolves most |
| `date` | Formats where day ≤ 12 and month/day are ambiguous (e.g., `01/02/2025`) | Low-medium — only fires when genuinely ambiguous |

### Types excluded from AI disambiguation — always rule-based

| Field Type | Reason |
|---|---|
| Valid ISO 3166-1 alpha-2 code already in lookup table | Deterministic — no ambiguity to resolve |
| Numeric | No linguistic ambiguity; validation errors are hard errors |
| Boolean | Two possible values; rule-based is sufficient |
| UUID / system-generated ID | Never ambiguous |
| Value exactly matching a controlled vocabulary entry | Already clean |
| Blank / null | No value to resolve |
| Date in unambiguous ISO format (`YYYY-MM-DD`) | Deterministic |

This means that for a typical clean file — where most values are already well-formed — **few or no fields are sent to the API**, and the AI pass adds near-zero latency.

---

## Batching Architecture

DST-039 designed one API call per row. This story replaces that model with one API call per **field type per import**, run in parallel.

### Call structure

After rule-based normalization, the parser collects all values that failed normalization and groups them by field type:

```
country_batch    = [all raw country values that failed lookup]
region_batch     = [all raw region values that failed lookup]
partner_batch    = [all partner name values that failed exact match]
enum_batch       = [all enum values that failed exact match, keyed by field_options key]
delimiter_batch  = [all multi-value cells with ambiguous delimiters]
date_batch       = [all date values that are genuinely ambiguous]
```

Each non-empty batch becomes one API call. All calls are dispatched in parallel (`Promise.all`). The parser reassembles results back to rows by index after all calls resolve.

### Token optimization per call

Each batch call includes only the information the model needs to resolve that field type — not the full row for every entry:

**Country batch prompt context:**
```
Valid set: [full ISO 3166-1 alpha-2 lookup table]
For each entry, also provided: partner_name, region (as disambiguation signals)
```

**Region batch prompt context:**
```
Valid set: [APAC, DOMESTIC, EMEA, GLOBAL, LATAM]
For each entry, also provided: country, partner_name (as disambiguation signals)
```

**Partner name batch prompt context:**
```
Known partners: [name list from partners table]
For each entry, also provided: country, region, request_type (as disambiguation signals)
```

**Enum batch prompt context:**
```
field_key: [e.g., intake_request_type]
Valid values: [full option list from field_options for that key]
```

Supporting fields (partner name, country, region) are passed as context strings only — they are not re-resolved in a batch where they are not the primary target. This keeps each call focused and minimises prompt size.

### Within-session value cache

Resolved values are cached in memory for the duration of the import session, keyed on `(field_type, raw_value, context_hash)`. If the same raw value with the same contextual signals appears on multiple rows — common in LATAM batch exports where dozens of rows share the same country ambiguity — the API is called once and the result is reused for all subsequent rows. Cache hits are marked "AI resolved (cached)" in the preview.

### Timeouts and parallelism

- Each batch call has a 5-second timeout.
- All batch calls for a single import are dispatched simultaneously. Wall-clock time is bounded by the slowest batch, not the sum of all batches.
- If any individual batch times out or errors, only that field type falls back to rule-based handling. Other batches are unaffected and their results are applied normally.

---

## Universal AI Import Framework

Any future import flow registers its field type mappings in a single configuration object. No per-flow AI integration code is required beyond this declaration.

```typescript
// Example: a future device spec CSV import registering its AI-eligible fields
registerImportFlow({
  flowId: "device_specs",
  fields: [
    { csvColumn: "Country",       fieldType: "country" },
    { csvColumn: "Region",        fieldType: "region" },
    { csvColumn: "Chipset",       fieldType: "enum", optionsKey: "partner_chipset" },
    { csvColumn: "OS",            fieldType: "enum", optionsKey: "device_os" },
    { csvColumn: "Manufacturer",  fieldType: "partner_name" },
  ]
});
```

The framework handles batch construction, parallel dispatch, caching, result reassembly, and preview rendering automatically. Fields not listed in the registration are never sent to the API.

### Coverage across current import flows

| Import Flow | Ticket | AI-eligible fields |
|---|---|---|
| Intake Requests | DST-037 | `country`, `region`, `partner_name` (from Partner column), `date` (Release Target), `multi_value_delimiter` |
| Partner Key Registry | DST-038 | `country`, `region`, `partner_name` (from friendly_partner_name), `enum` (chipset) |
| STB Questionnaire bulk import _(if implemented)_ | DST-035 / future | `enum` (all 89 dropdown fields), `country`, `region` |
| Any future import | — | Declared via `registerImportFlow` |

---

## Opt-In Checkbox & Cost Disclosure

This section supersedes DST-040 in full.

### Placement

On the upload screen (Step 1) of every DST import flow, below the file input:

```
☐ Use AI Import?
```

- Unchecked by default.
- Accompanied by a tooltip on hover: "Runs an AI pass to automatically resolve ambiguous values. May incur additional Anthropic API costs."

### Cost disclosure modal

Fires on the first check per page load. Does not re-fire on subsequent check/uncheck cycles within the same session.

| Element | Content |
|---|---|
| **Title** | "AI-Assisted Import" |
| **Body** | "Enabling AI Import runs ambiguous field values through Claude to automatically resolve issues like country codes, region names, and partner name variations. Only values that fail standard validation are sent — clean data is never transmitted. This uses the Anthropic API and may incur additional usage costs billed to your organization's API account." |
| **Primary action** | "Enable AI Import" — confirms, closes modal, checkbox remains checked |
| **Secondary action** | "Cancel" — closes modal, checkbox reverts to unchecked |

### Behavior when unchecked

The AI disambiguation pass is skipped entirely. No Anthropic API calls are made. Rule-based normalization from DST-037/038 runs as normal. The import is not degraded — flagged rows still appear for manual review.

---

## Preview Changes

The existing validation preview gains one column and one summary metric:

- **"Resolved by" column:** For each AI-resolved field value, shows a badge: `AI` (auto-resolved at ≥ 0.90 confidence), `AI ⚠` (amber, 0.75–0.89), or `Manual` (Admin override). Clicking any badge opens a popover showing the raw value, resolved value, confidence score, one-sentence reasoning, and an override control.
- **Summary banner** gains: "X values resolved by AI (Y cached)."

---

## Acceptance Criteria

- The "Use AI Import?" checkbox appears on every DST import flow's upload screen, unchecked by default.
- Checking the box triggers the cost disclosure modal on the first check per page load; subsequent check/uncheck cycles within the session do not re-trigger it.
- "Cancel" reverts the checkbox to unchecked; "Enable AI Import" confirms it.
- When unchecked, zero Anthropic API calls are made during the import.
- When checked, only values that failed rule-based normalization are sent to the API — clean values are never transmitted.
- API calls are grouped by field type, not by row. All field type batches for a single import are dispatched in parallel.
- Repeated identical raw values with the same context (same field type, same disambiguation signals) result in one API call, with subsequent occurrences served from cache. The preview labels cached resolutions as "AI resolved (cached)."
- Wall-clock time for the AI pass on `IntakeRequests.csv` (499 rows) does not exceed 8 seconds under normal API latency.
- If any field type batch times out or errors, that field type falls back to rule-based handling and remaining batches are unaffected. A banner in the preview indicates which field types fell back.
- A new import flow can be registered for AI disambiguation by adding a single `registerImportFlow` configuration entry, with no additional AI integration code.
- The DST-035 STB Questionnaire bulk import flow (when implemented) automatically inherits AI disambiguation for all `enum` fields by declaring them in its flow registration.
- DST-040 is closed as superseded by this story. No work from DST-040 carries forward independently.
