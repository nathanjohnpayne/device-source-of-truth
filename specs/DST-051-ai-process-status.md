# DST-051 — AI Process Real-Time Status & Recovery

| Field | Value |
|---|---|
| **Story ID** | DST-051 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T2 — Data Ingestion & Migration |
| **Priority** | P1 |
| **Story Points** | 3 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-042 (AI Import: Universal Coverage — AI pass architecture must exist) |
| **Blocks** | Nothing |

---

## User Story

As an Admin running an AI-assisted import, I can see real-time status of the AI pass in progress — including which step is currently executing, whether it has completed successfully, and a "Restart AI Pass" button if it fails — so that I am never left staring at a spinner with no feedback, and can recover without abandoning the import.

---

## Background

DST-039 and DST-042 introduced an AI disambiguation pass that runs between CSV parsing and the validation preview. The pass dispatches parallel batch API calls (one per field type), each with a 5-second timeout. When the import file is large or API latency is high, this pass can take several seconds. Currently, no progress feedback is shown — the UI blocks silently until all batches resolve or timeout.

Admins have reported uncertainty about whether the AI pass is still running, has stalled, or has silently failed. Because the pass is multi-step (batch construction → parallel dispatch → response assembly → preview render), meaningful per-step status is achievable and valuable.

This story adds a real-time status panel to every screen that invokes the AI pass, using the existing batch architecture from DST-042 as the source of truth for step progression.

---

## Scope: Screens Where AI Is Available

The status panel applies to every current and future DST screen that runs the AI pass. As of this ticket, that includes:

| Screen | Flow | AI Trigger |
|---|---|---|
| Import upload → preview (Intake Requests) | DST-037 | "Use AI Import?" checkbox checked |
| Import upload → preview (Partner Key Registry) | DST-038 | "Use AI Import?" checkbox checked |
| Any future import flow registered via `registerImportFlow` | DST-042 framework | Same checkbox |

The panel is rendered by the universal AI import framework (DST-042), not implemented per-flow. Adding a new flow via `registerImportFlow` automatically inherits the status panel.

---

## Status Steps

The AI pass exposes the following discrete steps. Each maps to an event emitted by the framework that the status panel subscribes to.

| Step | Label shown in UI | Condition |
|---|---|---|
| 1 | Analyzing file | Batch construction begins — ambiguous values identified, grouped by field type |
| 2 | Sending to AI _(N batches)_ | Batch API calls dispatched; N = number of distinct field types with ambiguous values |
| 3 | Processing responses | At least one batch has returned; assembly in progress |
| 4 | Finalizing results | All batches resolved or timed out; result reassembly complete |
| 5 | Done | Preview rendered successfully |

Step 2 label dynamically reflects the actual batch count (e.g., "Sending to AI — 3 batches"). If N = 1, the label reads "Sending to AI — 1 batch."

---

## Status Panel UI

### Placement

The panel replaces the existing spinner (if any) during the AI pass. It renders inline, directly above the validation preview area, and collapses automatically upon successful completion (step 5).

### Appearance — in progress

```
┌─────────────────────────────────────────────────────────────────┐
│  ● Analyzing file                              ✓                │
│  ● Sending to AI — 3 batches                   ✓                │
│  ◌ Processing responses              [animated pulse]           │
│  ○ Finalizing results                                           │
│  ○ Done                                                         │
└─────────────────────────────────────────────────────────────────┘
```

- `✓` = completed step (green check).
- Animated pulse = active step (step name in normal weight; spinner/pulse on the right).
- `○` = pending step (muted, not yet reached).

Completed steps remain visible throughout the pass so the Admin can see how far along the process is, not just what is currently executing.

### Appearance — success

On step 5 (Done), the panel transitions to a single-line success state for 2 seconds, then collapses:

```
✓ AI pass complete — 47 values resolved, 3 flagged for review.
```

The summary counts (`values resolved`, `flagged for review`) are derived from the assembled result already computed by DST-042. No new data is needed.

### Appearance — failure

If the AI pass fails (all batches either error or time out, or a non-recoverable API error is returned):

```
┌─────────────────────────────────────────────────────────────────┐
│  ✕ AI pass failed                                               │
│  The AI could not complete. Your import is unaffected —         │
│  rule-based validation will be applied instead.                 │
│                                              [Restart AI Pass]  │
└─────────────────────────────────────────────────────────────────┘
```

- The failure state persists until the Admin acts — it does not auto-dismiss.
- "Restart AI Pass" re-runs the AI pass in full (re-dispatches all batches) without requiring the Admin to re-upload the file. The same parsed row data is reused.
- If a partial failure occurs (some batches succeeded, others timed out per DST-042 fallback behavior), the panel shows success with a warning banner below it: "AI could not resolve [N] field type(s) — [country, region] fell back to rule-based validation." No restart button appears in the partial-failure case; the fallback output is usable.

---

## Implementation Notes

### Event model

The DST-042 `registerImportFlow` framework dispatches progress events that the status panel subscribes to. No per-flow wiring is needed.

```typescript
// Events emitted by the AI import framework (DST-042)
type AIPassEvent =
  | { type: "ai_pass_start" }
  | { type: "ai_pass_step"; step: 1 | 2 | 3 | 4; batchCount?: number }
  | { type: "ai_pass_complete"; resolved: number; flagged: number }
  | { type: "ai_pass_failed"; reason: string }
  | { type: "ai_pass_partial_failure"; failedFieldTypes: string[] };
```

The status panel is a single shared React component that receives these events. It requires no knowledge of which specific import flow is running.

### Restart behavior

"Restart AI Pass" fires `ai_pass_start` again on the already-parsed row data. The panel resets to step 1. No file re-upload, no re-parsing. The prior (failed) result is discarded.

### Accessibility

- Each step transition announces itself via an ARIA live region (`aria-live="polite"`).
- The failure state announces immediately (`aria-live="assertive"`).
- The "Restart AI Pass" button is keyboard-focusable and meets 4.5:1 contrast.

---

## Acceptance Criteria

- The status panel renders on every DST import screen where the AI pass runs — currently the Intake Request and Partner Key Registry import flows — and is inherited automatically by any future flow registered via `registerImportFlow`.
- The panel is not shown when the "Use AI Import?" checkbox is unchecked.
- Steps 1–4 display with accurate status (completed, active, or pending) as the pass progresses. The active step updates in real time — it does not wait for the full pass to complete before updating.
- Step 2 label reflects the actual batch count dynamically.
- On successful completion (step 5), the panel displays a summary line with resolved and flagged counts, then collapses after 2 seconds.
- On full failure, the failure state persists with the "Restart AI Pass" button visible and functional. Clicking it re-runs the AI pass on the already-parsed data without requiring file re-upload.
- On partial failure (some batches timed out per DST-042 fallback), no restart button appears; a warning banner identifies which field types fell back to rule-based validation.
- Each step transition is announced via ARIA live region. The failure state uses `aria-live="assertive"`.
- The status panel component requires no per-flow implementation. A flow registered via `registerImportFlow` inherits it automatically.
- No regression to existing DST-042 import behavior — the panel is additive and display-only.
