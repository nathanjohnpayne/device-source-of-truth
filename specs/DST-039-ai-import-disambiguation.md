# DST-039 — AI-Assisted Import Disambiguation

| Field | Value |
|---|---|
| **Story ID** | DST-039 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T2 — Data Ingestion & Migration |
| **Priority** | P1 |
| **Story Points** | 8 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-037 (Intake Request Import), DST-038 (Partner Key Registry Import) — this story enhances both import flows |
| **Blocks** | Nothing — enhances existing flows, does not gate them |

---

## User Story

As an Admin importing partner data from CSV, I want the system to automatically resolve ambiguous field values using AI — and ask me targeted clarifying questions when it cannot — so that I spend less time manually correcting rows and have confidence that the data landed correctly.

---

## Background

DST-037 and DST-038 introduced CSV import flows for Airtable intake requests and partner key mappings respectively. Both flows surface orange-flagged rows for Admin review when normalization is ambiguous. In the current design, the Admin must evaluate each flagged row individually.

In practice, the same ambiguities recur in predictable patterns: `SK` meaning South Korea vs. Slovakia; region codes like `NA` that are contextually obvious; partner names that differ only by encoding corruption or minor typos; multi-value cells that use inconsistent delimiters. An AI disambiguation layer can resolve most of these automatically, explain its reasoning, and batch the remainder into a focused set of questions rather than presenting every flagged row as an undifferentiated list.

This story adds an AI pass between raw CSV parsing and the validation preview. It applies to all current and future DST import flows.

---

## Architecture

```
CSV upload
    │
    ▼
Parser (existing — DST-037/038)
  Strip BOM, detect encoding, split columns
    │
    ▼
AI Disambiguation Pass  ◄── THIS STORY
  Per-row, per-field confidence scoring
  Auto-resolve high-confidence ambiguities
  Batch low-confidence items into clarification questions
  Present questions to Admin
  Admin answers → re-score → finalize
    │
    ▼
Validation Preview (existing)
  Only truly unresolvable items remain orange
    │
    ▼
Import confirmation (existing)
```

The AI pass calls `POST /api/import/disambiguate` with the parsed rows and receives back annotated rows (each field tagged with `resolved_value`, `confidence`, `reasoning`) plus a batched list of clarification questions. This endpoint calls the Anthropic Messages API server-side.

---

## AI Disambiguation Rules by Field

### Country

**Auto-resolve (no question needed):**

| Pattern | Resolution | Reasoning |
|---|---|---|
| Emoji flag sequence present | Strip emoji, parse full country name, map to ISO code | Emoji are decorative; the name is the value |
| `UK` | `GB` | Standard editorial mapping, zero ambiguity |
| `USA` | `US` | Standard alias |
| `Worldwide`, `WW`, `Global`, `🌎` | `XW` | All equivalent "no specific territory" markers |
| Full country name in any capitalisation | Map to ISO code via lookup | Deterministic |
| Valid ISO code that appears only once in the file | Store as-is | No conflict to resolve |

**Ask the Admin:**

| Pattern | Question |
|---|---|
| Bare code `SK` with `Region = APAC` or partner name containing "Korea", "KT", "SKT", "SKB" | "Row [N] — country code `SK` with region APAC. Did you mean **KR (South Korea)** or **SK (Slovakia)**?" |
| Bare code `SK` with `Region = EMEA` or partner name containing "Slovak", "Telekom" | Same question, but pre-select SK (Slovakia) as the suggested answer |
| Any 2-letter token not in ISO 3166-1 alpha-2 and not in the lookup table | "Row [N] — `[value]` is not a recognized country code. What country does this refer to?" (free text + ISO code search) |
| Blank country with a populated partner name | "Row [N] — no country listed for **[partner name]**. Is this a worldwide/global deployment, or should a specific country be added?" |

### Region

**Auto-resolve:**

| Pattern | Resolution |
|---|---|
| `NA` where country is `US`, `CA`, or region neighbors are `DOMESTIC` in the same partner | `DOMESTIC` |
| `Worldwide` | `GLOBAL` |
| Any standard code (`APAC`, `EMEA`, `LATAM`, `DOMESTIC`, `GLOBAL`) | Store as-is |
| Multiple comma-separated tokens that are all valid | Split, deduplicate, store as array |
| Blank | `NULL` |

**Ask the Admin:**

| Pattern | Question |
|---|---|
| `NA` where country is non-US/CA or country is blank | "Row [N] — region `NA` for **[partner name]**. Does this mean **DOMESTIC (North America)** or is it blank/not applicable?" |
| Unrecognized region token | "Row [N] — `[value]` is not a recognized Disney region code. Which region applies? (APAC / DOMESTIC / EMEA / GLOBAL / LATAM)" |
| Conflicting region tokens (e.g., `DOMESTIC, EMEA` on a single row) | "Row [N] — **[partner]** has regions DOMESTIC and EMEA on the same record. Is this intentional (multi-region partner), or should one be removed?" |

### Partner Name → Partner Record Match

**Auto-resolve:**

| Pattern | Resolution |
|---|---|
| Exact match after trim and case normalization | `match_confidence = exact` — no question |
| Encoding artifact correctable by character map (e.g., `Telef\x97nica` → `Telefónica`) and result matches exactly | Correct and match — no question |
| Jaro-Winkler ≥ 0.95 and only one candidate | `match_confidence = fuzzy`, auto-accept — note shown in preview but no blocking question |

**Ask the Admin:**

| Pattern | Question |
|---|---|
| Jaro-Winkler 0.80–0.94 | "Row [N] — **[raw name]** doesn't exactly match any partner. Did you mean **[closest match]** ([similarity]%)? Or is this a new partner?" |
| Multiple candidates all ≥ 0.80 | "Row [N] — **[raw name]** could match: [list of candidates with scores]. Which is correct?" (radio list) |
| No match at all (< 0.80) | "Row [N] — **[raw name]** doesn't match any known partner. Is this a new partner to create, or a different name for an existing one?" (search box) |

### Multi-Value Delimiter Detection

Some source files use `,` and others use `;` as the multi-value delimiter within a single cell. Future exports may use `|` or newlines.

**Auto-resolve:** If all values in a cell separated by the expected delimiter (`,` for intake, `;` for partner keys) are individually valid, use the expected delimiter.

**Ask the Admin:**

| Pattern | Question |
|---|---|
| Cell contains both `,` and `;` | "Row [N], field **[field name]** — `[raw value]`. This cell contains both commas and semicolons. Which separates multiple values here?" (show a preview of each interpretation) |
| A token within a multi-value cell looks like a whole country name containing a comma (e.g., `Trinidad and Tobago`) | AI detects that splitting on `,` would produce an invalid token, and tries `;` first before asking |

### Dates

**Auto-resolve:**

- `M/D/YYYY` → `DATE` (unambiguous — US format)
- `MM/DD/YYYY` → same
- `YYYY-MM-DD` → ISO date, parse directly

**Ask the Admin:**

| Pattern | Question |
|---|---|
| Ambiguous format where day ≤ 12 (e.g., `01/02/2025` — could be Jan 2 or Feb 1) | "Row [N] — **01/02/2025** is ambiguous. Is this **January 2** or **February 1**, 2025?" |
| Unparseable date string | "Row [N] — `[value]` isn't a valid date. What date was intended?" (date picker) |

---

## Batching Questions

Questions must never be presented one at a time as a modal sequence. Instead:

1. After the AI pass completes, all questions are collected and grouped by type.
2. They are presented in a single consolidated "Clarification Required" panel, shown above the import preview table.
3. Groups:

   - **Country ambiguities** — all country questions together
   - **Region ambiguities** — all region questions together
   - **Partner matching** — all unmatched/fuzzy partner questions together
   - **Other** — date, delimiter, and miscellaneous

4. Within each group, questions are rendered as a compact table: one row per import row, with an inline answer control (dropdown, radio, or text search depending on question type).
5. The Admin can answer all questions in a group at once using a "Apply to all similar rows" checkbox where the same question type appears on multiple rows with the same pattern (e.g., all `SK` country ambiguities can be answered once and applied to all matching rows in the file).
6. Answering all questions re-triggers the AI pass on only the affected rows. The preview table updates in place.

---

## AI Prompt Design

The disambiguation endpoint sends the following context to the Anthropic API per batch:

```
You are a data normalization assistant for Disney's Device Source of Truth (DST) system.
You are processing a CSV import of [import type: Intake Requests | Partner Key Mapping].

For each row and field marked as ambiguous, determine the most likely correct value based on:
- The field's purpose and valid value set (provided below)
- All other fields on the same row as contextual signals
- Patterns across the full file (e.g., if SK appears with APAC region on five rows and all partner names reference Korean carriers, the pattern is strong evidence for KR)
- Disney's internal region taxonomy (APAC, DOMESTIC, EMEA, GLOBAL, LATAM)

Valid value sets:
[injected dynamically from field_options per import type]

For each ambiguous field return:
{
  "field": "<field_name>",
  "raw_value": "<original>",
  "resolved_value": "<best guess>",
  "confidence": 0.0–1.0,
  "reasoning": "<one sentence>",
  "needs_human": true | false,
  "question": "<question text if needs_human is true, else null>"
}

Confidence threshold for auto-resolve: 0.90.
Below 0.90, set needs_human = true and provide a question.
Never silently drop a value. If you cannot resolve it, preserve the raw value and ask.
```

The model is `claude-sonnet-4-6`. `max_tokens` is set to 2000 per batch of up to 50 rows. Rows are batched to stay within context limits; the full file is processed across as many API calls as needed before the preview renders.

---

## Confidence Thresholds

| Confidence | Behaviour |
|---|---|
| ≥ 0.90 | Auto-resolved. Shown in preview with a grey "AI resolved" badge. Admin can override by clicking the badge. |
| 0.75–0.89 | Auto-resolved but flagged yellow. Shown with an amber "AI resolved — verify" badge. Admin should review but is not blocked. |
| < 0.75 | Not auto-resolved. Shown orange. Generates a clarification question. Admin must answer before import. |
| 0.00 (raw value uninterpretable) | Shown red. Row skipped unless Admin provides a valid value. |

---

## Audit Trail

Every AI resolution is recorded alongside the import batch audit log entry:

```json
{
  "row": 12,
  "field": "countries_operate_iso2",
  "raw_value": "SK",
  "resolved_value": "KR",
  "confidence": 0.87,
  "reasoning": "Region is APAC and partner name contains 'SKT', a Korean carrier.",
  "resolution_source": "ai_auto",
  "overridden_by_admin": false
}
```

If the Admin overrides an AI resolution, `overridden_by_admin: true` and `admin_value` are recorded. This log is accessible from the import batch detail view for 90 days.

---

## Error Handling

- If the Anthropic API call fails or times out (5-second timeout per batch), the import falls back to the existing rule-based normalization from DST-037/038. The preview renders with a banner: "AI disambiguation unavailable — falling back to standard validation. Flagged rows require manual review." The import is not blocked.
- If the API returns a malformed or unparseable response for a specific row, that row falls back to rule-based handling. Other rows in the batch are unaffected.
- API errors are logged server-side. The Admin is never shown a raw API error message.

---

## Acceptance Criteria

- All country emoji are stripped and full country names resolved to ISO codes without Admin intervention.
- `UK` → `GB`, `USA` → `US`, `Worldwide`/`WW`/`Global` → `XW` are resolved automatically at ≥ 0.90 confidence with no question generated.
- `SK` rows generate a clarifying question when the region or partner name does not unambiguously indicate one country. When contextual signals are strong (e.g., `Region = APAC` + Korean carrier name), the AI auto-resolves to `KR` at ≥ 0.90 confidence.
- `NA` region on US-country rows auto-resolves to `DOMESTIC` at ≥ 0.90. `NA` on ambiguous rows generates a question.
- `Telefnica` (encoding-corrupted) is corrected to `Telefónica` and matched to the correct partner record without a question.
- All clarification questions are presented as a single batched panel, not as sequential modals.
- "Apply to all similar rows" correctly identifies and bulk-resolves rows with the same question pattern.
- AI-resolved fields display a badge in the preview; clicking the badge shows the reasoning and allows override.
- Every AI resolution is recorded in the import audit log with raw value, resolved value, confidence, and reasoning.
- If the Anthropic API is unavailable, the import falls back gracefully to rule-based validation and a banner is shown. The import is not blocked.
- Non-Admin users cannot access the import flow or the AI disambiguation endpoint.

---

## Out of Scope

- Training or fine-tuning a custom model on Disney partner data.
- AI-assisted field mapping for CSV files with unknown or non-standard column headers (i.e., this story assumes the column structure of DST-037/038 source files — novel schemas are a future story).
- Real-time disambiguation during Datadog telemetry ingestion (the AI pass is import-time only; runtime key resolution remains the indexed lookup from DST-038).
- Storing or learning from Admin overrides to improve future confidence scores (Phase 2).
