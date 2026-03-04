# DST-050 — Questionnaire AI Extraction: Cost Disclosure

| Field | Value |
|---|---|
| **Story ID** | DST-050 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T3 — Hardware Spec Ingestion |
| **Priority** | P1 |
| **Story Points** | 2 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-047 (Questionnaire Intake & AI Extraction — the two trigger points this gate sits in front of) |
| **Blocks** | DST-047 (gate must be in place before extraction can be triggered in production) |
| **Related** | DST-040, DST-042 (opt-in pattern for other import flows — this story is the mandatory-AI variant) |

---

## User Story

As an Admin triggering AI extraction on a partner questionnaire, I am shown a cost disclosure before any Anthropic API calls are made, so that I understand the cost implication and have explicitly acknowledged it — even though I cannot opt out, because AI extraction is required for this workflow.

---

## Background

DST-040 and DST-042 established a cost disclosure modal for AI-assisted import flows, gated behind an opt-in checkbox. The questionnaire extraction pipeline (DST-047) cannot offer an opt-out: unlike the disambiguation pass in DST-037/038, which supplements rule-based normalization, the questionnaire extraction pass *is* the normalization — the unstructured nature of the data means rule-based-only processing cannot produce reliable results. There is no fallback mode of equivalent quality.

The opt-in checkbox from DST-042 is therefore not appropriate here. However, the principle behind it — that costs should be disclosed and acknowledged before they are incurred — remains valid. This story implements that principle without the opt-out mechanism: a one-time acknowledgment modal that fires before the first extraction trigger, with a single "I understand, continue" action.

The DST-042 checkbox and modal are **not reused** for this flow. This story produces a distinct modal with copy specific to the questionnaire context.

---

## Trigger Points

There are two places in DST-047 where AI extraction can be initiated. The disclosure fires at both.

**Trigger A — Upload form, auto-extract path.**
The upload form in DST-047 includes a "Use AI Extraction?" checkbox (unchecked by default). When the admin checks this box, the disclosure modal fires immediately, before the file is uploaded. If the admin acknowledges, the checkbox remains checked and the upload proceeds normally. Unlike DST-042, there is no "Cancel" path that unchecks the box — the modal has one action only (see below). The admin's only way to avoid triggering extraction at upload time is to leave the checkbox unchecked and trigger manually later.

**Trigger B — Intake job detail page, manual-extract path.**
When an intake job has status `awaiting_extraction`, the detail page shows a "Run AI Extraction" button. Clicking this button fires the disclosure modal before the extraction API call is made.

The modal fires **once per browser session**, not once per trigger. If the admin has already acknowledged it during Trigger A, Trigger B does not re-fire it. Session state is tracked in `sessionStorage` under the key `dst_questionnaire_ai_disclosed`.

---

## Modal Specification

### Trigger A (upload form)

Fires when the "Use AI Extraction?" checkbox is checked.

| Element | Content |
|---|---|
| **Title** | "AI Extraction Required" |
| **Body** | "Questionnaire extraction uses Claude to map each question-answer pair to a normalized spec field. This step is required to produce reliable structured data from partner questionnaires and cannot be skipped. It uses the Anthropic API and will incur usage costs billed to your organization's API account. Costs scale with the number of devices in the file — most questionnaires are a few cents or less." |
| **Primary action** | "Got It — Continue Upload" |
| **No secondary action** | The modal has no cancel or dismiss option. The admin can close the upload form entirely if they do not want to proceed. |

### Trigger B (manual extraction button)

Fires when "Run AI Extraction" is clicked on the intake job detail page.

| Element | Content |
|---|---|
| **Title** | "AI Extraction Required" |
| **Body** | Same as Trigger A. |
| **Primary action** | "Got It — Run Extraction" |
| **No secondary action** | As above. |

The only difference between the two modals is the label on the primary action button, which reflects the immediate action that follows acknowledgment.

---

## Session Acknowledgment Tracking

```typescript
// On modal primary action click:
sessionStorage.setItem('dst_questionnaire_ai_disclosed', 'true');

// Before showing the modal at either trigger point:
if (sessionStorage.getItem('dst_questionnaire_ai_disclosed') === 'true') {
  // Skip modal, proceed directly to upload or extraction trigger
}
```

This is intentionally session-scoped (not persisted to `localStorage` or the database). The disclosure re-fires on each new page load, matching the behavior established in DST-042.

---

## Acceptance Criteria

- The cost disclosure modal fires when the "Use AI Extraction?" checkbox is checked on the upload form (Trigger A), before any file upload begins.
- The modal fires when "Run AI Extraction" is clicked on the intake job detail page (Trigger B), before any extraction API call is made.
- The modal has a single action button. There is no cancel, dismiss, or close option.
- Clicking the primary action closes the modal and immediately proceeds with the action that triggered it (upload or extraction).
- The modal fires at most once per browser session. If acknowledged at Trigger A, it does not re-fire at Trigger B within the same session.
- Session acknowledgment is tracked in `sessionStorage`; it resets on page reload or new tab.
- No Anthropic API calls are made before the modal has been acknowledged in the current session.
- The modal copy correctly identifies that extraction is required (not optional) and that costs will be incurred.
