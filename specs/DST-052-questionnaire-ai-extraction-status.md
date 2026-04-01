---
spec_id: DST-052-questionnaire-ai-extraction-status
---

# DST-052 — Questionnaire AI Extraction: Real-Time Status & Recovery

| Field | Value |
|---|---|
| **Story ID** | DST-052 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T3 — Hardware Spec Ingestion |
| **Priority** | P1 |
| **Story Points** | 3 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | AI-assisted questionnaire field extraction must be implemented; DST-035 (STB Questionnaire Field Schema) |
| **Related** | DST-051 (AI Process Real-Time Status & Recovery — covers import flows; this ticket covers the questionnaire screen) |
| **Blocks** | Nothing |

---

## User Story

As an Admin reviewing a questionnaire submission, I can see real-time status of the AI field extraction in progress — including which step is currently executing, per-device extraction progress, and a "Restart Extraction" button if it fails — so that I am never left with a frozen "0 / 143 fields extracted" counter and no indication of whether the process is still running.

---

## Background

The questionnaire detail screen (Admin > Questionnaires > [submission]) shows one device card per staged device, each displaying an extraction counter ("0 / 143 fields extracted"). When the AI extraction pass runs, it reads the uploaded XLS, identifies each device's sheet or section, and extracts up to 143 spec fields per device by invoking the Anthropic API.

This process is meaningfully different from the import disambiguation pass covered by DST-051:

- It operates on a structured XLS rather than a normalized CSV.
- It runs per device, not per field type — each device's tab or section is processed as a discrete unit.
- Progress is already partially surfaced via the per-device field counter, but the counter only reflects completed extractions; it gives no signal while a device is mid-extraction, and gives no recovery path when a device fails.

Admins have reported confusion when the counter stays at "0 / 143" for an extended period with no feedback — it is not clear whether extraction is still running, has stalled, or has failed.

---

## Scope

This ticket covers the questionnaire detail screen exclusively. Import flow status is handled by DST-051.

---

## Status Steps

The AI extraction pass exposes the following steps per device. Each maps to a server-sent event or polling update emitted during extraction.

| Step | Label shown in UI | Condition |
|---|---|---|
| 1 | Reading spreadsheet | XLS is being parsed; sheet structure identified |
| 2 | Extracting fields — Device N | Per-device AI extraction call dispatched and in progress |
| 3 | Validating values | Extracted values are being matched against controlled vocabulary (`field_options`) |
| 4 | Done | Extraction complete; field counter updated to final value |

Step 2 is repeated for each device in sequence. The label reflects which device is currently being processed (e.g., "Extracting fields — Device 2").

---

## Status Panel UI

### Placement

The status panel renders as a slim banner directly below the questionnaire header (file name, upload metadata, partner assignment) and above the "Staged devices" section. It is visible only while extraction is running or has failed. It does not appear before extraction is initiated or after successful completion.

### Appearance — in progress

```
┌──────────────────────────────────────────────────────────────────┐
│  ● Reading spreadsheet                                  ✓        │
│  ● Extracting fields — Device 2             [animated pulse]     │
│  ○ Validating values                                             │
│  ○ Done                                                          │
└──────────────────────────────────────────────────────────────────┘
```

Simultaneously, each device card updates its field counter in real time as fields are extracted — no page reload required. The card being actively processed shows a subtle animated border or pulse to indicate it is the current device.

### Appearance — success

On completion, the banner collapses after 2 seconds. The device cards display their final extracted counts. No persistent success state is needed — the field counters serve as the durable result.

### Appearance — full failure (all devices failed)

```
┌──────────────────────────────────────────────────────────────────┐
│  ✕ Extraction failed                                             │
│  AI could not extract fields from this questionnaire.            │
│  Your file is unaffected — you can enter fields manually or      │
│  try again.                                             [Restart] │
└──────────────────────────────────────────────────────────────────┘
```

"Restart" re-runs the full extraction pass on the already-uploaded file. No re-upload required.

### Appearance — partial failure (one or more devices failed)

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠ Extraction incomplete                                         │
│  Device 3 could not be extracted. Fields already extracted for   │
│  Device 1 and Device 2 are saved.                                │
│                                            [Retry Device 3]      │
└──────────────────────────────────────────────────────────────────┘
```

- The failed device card displays an error state inline: "Extraction failed — [Retry]."
- "Retry Device 3" re-runs extraction for the failed device only. Already-extracted devices are not re-processed.
- The per-device retry button on the card and the banner button are equivalent — either one works.

---

## Implementation Notes

### Progress delivery

The server emits extraction progress via server-sent events (SSE) or a polling endpoint, whichever is already used for other real-time updates in the application. Events include:

```typescript
type ExtractionEvent =
  | { type: "extraction_start"; deviceCount: number }
  | { type: "extraction_step"; step: 1 | 2 | 3; deviceName?: string }
  | { type: "extraction_field_update"; deviceId: string; extracted: number; total: number }
  | { type: "extraction_device_complete"; deviceId: string; extracted: number }
  | { type: "extraction_device_failed"; deviceId: string; reason: string }
  | { type: "extraction_complete" }
  | { type: "extraction_failed"; reason: string };
```

`extraction_field_update` drives the real-time counter on each device card and should be emitted as fields are confirmed, not batched at the end.

### Retry scope

Retrying a single failed device re-sends only that device's sheet or section to the API. The server retains the parsed XLS in the session so no re-upload or re-parse is needed.

### Accessibility

- Step transitions announce via `aria-live="polite"`.
- The failure and partial-failure states announce via `aria-live="assertive"`.
- "Restart" and per-device "Retry" buttons are keyboard-focusable and meet 4.5:1 contrast.

---

## Acceptance Criteria

- The status panel renders on the questionnaire detail screen during AI extraction and is not shown at any other time.
- Steps 1–3 update in real time during extraction. Step 2 label reflects which device is currently being processed.
- Per-device field counters update in real time as fields are confirmed — they do not wait for the full device extraction to complete.
- The device card currently being processed shows a visual active state (animated border or equivalent).
- On successful completion, the banner collapses after 2 seconds. Device cards show final extracted counts.
- On full failure, the failure banner persists with a "Restart" button. Clicking it re-runs extraction on the already-uploaded file without requiring re-upload.
- On partial failure, the banner identifies the failed device(s) by name. A "Retry [Device N]" button re-runs extraction for that device only, leaving already-extracted devices untouched.
- The per-device card also shows an inline error state with a retry control for any failed device.
- All state transitions are announced via ARIA live regions; failure states use `aria-live="assertive"`.
- No regression to existing questionnaire field counter or manual entry behavior.
