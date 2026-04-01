---
spec_id: DST-040-ai-import-opt-in
tested: false
reason: "implementation pending"
---

# DST-040 — AI Import Opt-In & Cost Disclosure

| Field | Value |
|---|---|
| **Story ID** | DST-040 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T2 — Data Ingestion & Migration |
| **Priority** | P2 |
| **Story Points** | 2 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-039 (AI-Assisted Import Disambiguation — AI pass must exist before this gate is meaningful) |
| **Blocks** | Nothing |

---

## User Story

As an Admin importing partner data, I can choose whether to run the AI disambiguation pass so that I understand and accept any associated API costs before they are incurred.

---

## Changes

### Step 1 of all import flows (Upload screen)

Add a checkbox below the file input on every DST import flow that uses the AI disambiguation pass (currently: Intake Requests from DST-037, Partner Key Registry from DST-038; applies to all future import flows by default):

```
☐ Use AI Import?
```

- Unchecked by default.
- Label links to a tooltip on hover: "Runs an AI pass to automatically resolve ambiguous field values before review. May incur additional Anthropic API costs."
- When the Admin checks the box, a modal appears immediately (before any file is processed).

### Cost disclosure modal

| Element | Content |
|---|---|
| **Title** | "AI-Assisted Import" |
| **Body** | "Enabling AI Import runs your file through Claude to automatically resolve ambiguous values such as country codes, region names, and partner name variations. This uses the Anthropic API and may incur additional usage costs billed to your organization's API account. Costs scale with file size — most standard imports are a few cents or less." |
| **Primary action** | "Enable AI Import" — confirms, closes modal, checkbox remains checked |
| **Secondary action** | "Cancel" — closes modal, checkbox is unchecked |

The modal does not appear again for the same import session if the Admin unchecks and re-checks the box. It only fires on the first check per page load.

### Behavior when unchecked

If the Admin proceeds with the checkbox unchecked, the AI disambiguation pass (DST-039) is skipped entirely. The import runs with rule-based normalization only, and the standard orange/red/yellow flagging from DST-037/038 applies. No Anthropic API calls are made.

---

## Acceptance Criteria

- The "Use AI Import?" checkbox appears on the upload screen of all DST import flows.
- The checkbox is unchecked by default.
- Checking the box triggers the cost disclosure modal before any processing begins.
- Clicking "Enable AI Import" confirms the choice; clicking "Cancel" reverts the checkbox to unchecked.
- The modal fires only once per page load, not on every check/uncheck cycle.
- When the checkbox is unchecked at import confirmation time, no Anthropic API calls are made.
- When the checkbox is checked, the AI pass from DST-039 runs as specified.
