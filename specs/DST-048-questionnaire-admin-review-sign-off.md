---
spec_id: DST-048-questionnaire-admin-review-sign-off
---

# DST-048 — Questionnaire Admin Review, Conflict Resolution & Import Sign-Off

| Field | Value |
|---|---|
| **Story ID** | DST-048 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T3 — Hardware Spec Ingestion |
| **Priority** | P1 |
| **Story Points** | 13 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-047 (Questionnaire Intake & AI Extraction), DST-001 (schema), DST-006 (audit log), DST-012 (spec form) |
| **Blocks** | Nothing |

---

## User Story

As an Admin, I can review the structured data extracted from a partner questionnaire device by device, resolve any conflicts with existing registry data, assign or confirm the partner, approve or reject individual devices, and commit the finalized data to the registry with a single sign-off action — so that no questionnaire data enters the database without my explicit review and no device is imported without being matched to the correct partner record.

---

## Background

DST-047 handles upload, parsing, and AI extraction, producing a set of staged device records and field-level extractions. This story covers everything that happens after extraction is complete: the admin-facing review, correction, conflict resolution, and final commit.

The review workflow must handle several interrelated problems:

**Partner ambiguity.** The extraction pipeline may not be able to identify the partner with confidence. The admin must be able to assign a partner before approving any device — because a device cannot be committed to the registry without a partner association.

**Per-device approval.** A questionnaire may contain 6 devices, of which the admin only wants to import 3. The workflow must support approving a subset and rejecting the rest, without blocking the approved devices behind the rejected ones.

**Conflict resolution.** When a questionnaire contains a value for a field that already exists in the registry, the admin must see both values and explicitly choose which one wins. Both values are preserved for audit. This is distinct from the case where a field is new (no existing value) — those can be fast-approved without per-field review.

**Out-of-scope devices.** Android, AOSP, and unknown-platform devices require the same approval flow as in-scope devices, but create records flagged as Phase 2. The admin needs to see clearly that these are out of scope before approving them.

**New vs. existing devices.** When a device is new (no match found by the extractor), the admin must confirm the device's identity and create a skeleton device record as part of the import. When a device exists, the admin is updating existing specs rather than creating new ones.

---

## Review Workflow Overview

The review workflow is a 4-step process accessible from the intake job detail page (DST-047). Steps must be completed in order; completing a step unlocks the next.

```
Step 1: Assign Partner     →  Step 2: Review Devices     →  Step 3: Resolve Conflicts  →  Step 4: Sign Off
 (if unassigned)               (per-device approve/reject)   (conflicting fields only)      (commit to registry)
```

If the partner was auto-detected with confidence ≥ 0.85, Step 1 is pre-completed and shown as confirmed (with an "Edit" option). The admin is dropped directly into Step 2.

If there are no conflicts anywhere in the intake job, Step 3 is skipped automatically.

A progress indicator at the top of every step shows which step is active and how many are remaining.

---

## Step 1: Assign Partner

This step is required only when `questionnaire_intake_jobs.partner_id` is null (partner could not be auto-detected with sufficient confidence).

### UI

```
┌──────────────────────────────────────────────────────────────┐
│  Step 1 of 4: Assign Partner                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  DST could not confidently identify the partner for this     │
│  questionnaire.                                              │
│                                                              │
│  File:  Disney_UnknownPartner_Q1_2023.xlsx                   │
│                                                              │
│  Signals found in file:                                      │
│  • Filename: no recognizable partner pattern                 │
│  • Content: no "Partner name" row detected                   │
│  • AI suggestion: "Possibly Vodafone" (confidence: 0.61)     │
│                                                              │
│  Assign partner:                                             │
│  [ Search partners…                                    ▼ ]   │
│                                                              │
│  Or:  [ Create new partner record ]                          │
│                                                              │
│                           [ Cancel ]  [ Confirm Partner → ]  │
└──────────────────────────────────────────────────────────────┘
```

The partner dropdown searches the `partners` table including aliases (DST-046). The AI suggestion is shown as guidance only and does not pre-select the dropdown.

"Create new partner record" opens a modal with the minimum required fields to create a partner (display name, region, countries). On save, the new partner is selected automatically.

Confirming a partner sets `questionnaire_intake_jobs.partner_id` and `partner_detection_method = 'admin'` and advances to Step 2.

**API:**

`PATCH /api/questionnaire-intake/:id` — updates `partner_id` and `partner_detection_method`.

---

## Step 2: Review Devices

This is the primary step. The admin reviews each detected device and decides whether to approve or reject it.

### Device review list

Each device from `questionnaire_staged_devices` is shown as a card. Cards are ordered: in-scope first, then out-of-scope; within each group, devices with conflicts are listed before devices without.

```
┌──────────────────────────────────────────────────────────────┐
│  Step 2 of 4: Review Devices                                 │
│  3 devices detected  ·  0 approved  ·  0 rejected            │
│                                                              │
│  [ Approve All In-Scope ]   [ Reject All ]                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  EOSv1   ncp_linux  ·  In scope                        │  │
│  │  ──────────────────────────────────────────────────    │  │
│  │  Matched:  DCX960 / EOS-1008C  (exact)                 │  │
│  │  47 fields extracted  ·  3 conflicting                 │  │
│  │  Partner:  Liberty Global                              │  │
│  │                                                        │  │
│  │  [ View Fields ]   [ Reject ]   [ Approve ✓ ]          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  EOSv2   ncp_linux  ·  In scope                        │  │
│  │  ──────────────────────────────────────────────────    │  │
│  │  ⚠ No match — New device                               │  │
│  │  Detected: "2008C-STB" / "Humax" / Broadcom            │  │
│  │  52 fields extracted  ·  0 conflicting                 │  │
│  │                                                        │  │
│  │  Match to existing:  [ Search devices…          ▼ ]    │  │
│  │  Or create as new device                               │  │
│  │                                                        │  │
│  │  [ View Fields ]   [ Reject ]   [ Approve ✓ ]          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  AVSB Android   android_tv  ·  ⚠ Out of scope           │  │
│  │  (Phase 2 — will be flagged, not active in catalog)    │  │
│  │  ──────────────────────────────────────────────────    │  │
│  │  ⚠ No match — New device                               │  │
│  │  Detected: "DxIW393" / Sagemcom / Broadcom             │  │
│  │  38 fields extracted  ·  0 conflicting                 │  │
│  │                                                        │  │
│  │  [ View Fields ]   [ Reject ]   [ Approve ✓ ]          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### "View Fields" panel

Clicking "View Fields" opens an inline expansion (not a modal) showing all extracted fields for that device, grouped by category. Each field row shows:

| Column | Content |
|---|---|
| Field name | Canonical display name from the spec schema |
| Question (raw) | The original question text from the questionnaire |
| Extracted value | Normalized value, with type-appropriate formatting |
| Confidence | AI confidence badge: green (≥ 0.90), amber (0.75–0.89), red (< 0.75) |
| Conflict | "Existing: [value]" in amber if `conflict_status = 'conflicts_with_existing'` |
| Reasoning | Hover popover showing `ai_reasoning` text |

Fields with `extracted_value = null` (unanswered questions or unmappable questions) are shown collapsed under a "Skipped / Unanswered (N)" disclosure link at the bottom of the category.

The admin can override any individual extracted value inline at this stage. Overrides are recorded with `extraction_method = 'admin_override'` on the staged field.

### Approving a device

When the admin clicks "Approve" on a device:

- If the device has **no conflicts**: the card is immediately marked ✓ Approved (green). No additional steps required for this device before commit.
- If the device has **conflicts**: a warning is shown: "This device has 3 conflicting fields. You can approve it now and resolve conflicts in Step 3, or resolve conflicts first." Two buttons: "Approve & Resolve Later" and "Resolve Now." Either path is valid.

### Rejecting a device

Clicking "Reject" opens a small popover:

```
Reject this device?
Reason (optional): [_______________________]
[ Cancel ]  [ Reject Device ]
```

The rejection reason is stored in `questionnaire_staged_devices.rejection_reason`. Rejected devices are dimmed in the list. The admin can un-reject a device at any time before sign-off.

### New device identity confirmation

For unmatched devices (no existing registry record), the admin must either:

1. **Search and assign an existing device** using the "Match to existing" dropdown. This uses the same device search as the main device catalog, with the extracted model name and number pre-filled as the search query.
2. **Approve as a new device.** In this case, the admin confirms the identity fields (model name, model number, device type, manufacturer) populated from the extraction. These are shown in an editable form:

```
  New device details (pre-filled from questionnaire):
  Consumer name:    [ MagentaTV One (2. Generation) ]
  Model number:     [ G7                            ]
  Manufacturer:     [ SEI Robotics                  ]
  Device type:      [ STB                      ▼ ]
  Partner key:      [ (auto-assigned from partner)  ]
```

The admin must confirm these before approving. The device record is not created until Step 4 (sign-off) — this step only stages the identity data.

**API:**

`PATCH /api/questionnaire-intake/:id/staged-devices/:deviceId` — updates `review_status`, `rejection_reason`, `matched_device_id`, and confirmed identity fields.

---

## Step 3: Resolve Conflicts

This step appears only if one or more approved devices have fields with `conflict_status = 'conflicts_with_existing'`. Rejected devices are excluded.

### Conflict resolution list

Each conflict is shown as a row in a table, grouped by device. The admin must resolve every conflict before proceeding to sign-off.

```
┌──────────────────────────────────────────────────────────────┐
│  Step 3 of 4: Resolve Conflicts                              │
│  3 conflicts across 1 device                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Device: EOSv1 / DCX960 / EOS-1008C                          │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  Field: CPU Speed                                            │
│  Source question:  "CPU Speed"                               │
│  ┌────────────────────────────────┬───────────────────────┐  │
│  │  ◉ From questionnaire          │  ○ Keep existing      │  │
│  │  "12k DMIPS, Dual core"        │  "12k DMIPS"          │  │
│  │  (confidence: 0.92)            │  (set 2023-06-14)     │  │
│  └────────────────────────────────┴───────────────────────┘  │
│  Note: Values are semantically equivalent — the questionnaire │
│  value has more detail. Recommended: use questionnaire value. │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  Field: OS Version                                           │
│  Source question:  "OS version"                              │
│  ┌────────────────────────────────┬───────────────────────┐  │
│  │  ◉ From questionnaire          │  ○ Keep existing      │  │
│  │  "4.9"                         │  "4.1"                │  │
│  │  (confidence: 0.97)            │  (set 2022-11-03)     │  │
│  └────────────────────────────────┴───────────────────────┘  │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  Field: RAM (total device memory)                            │
│  Source question:  "Device memory / memory type"             │
│  ┌────────────────────────────────┬───────────────────────┐  │
│  │  ◉ From questionnaire          │  ○ Keep existing      │  │
│  │  3072 MB  (parsed from         │  2048 MB              │  │
│  │  "3GB / DDR4", conf: 0.99)     │  (set 2022-11-03)     │  │
│  └────────────────────────────────┴───────────────────────┘  │
│  ⚠ Values differ significantly. Verify source document.     │
│                                                              │
│  [ Accept All Questionnaire Values ]      [ Next: Sign Off ] │
└──────────────────────────────────────────────────────────────┘
```

### Resolution behavior

- Each conflict is a radio choice: "From questionnaire" or "Keep existing."
- "From questionnaire" is pre-selected by default when AI confidence ≥ 0.85.
- "Keep existing" is pre-selected when AI confidence < 0.75.
- Between 0.75 and 0.85, no default is set; the admin must explicitly choose.
- "Accept All Questionnaire Values" sets all unresolved conflicts to "From questionnaire" in a single action. This does not override conflicts where the admin has already manually selected "Keep existing."

### What is stored

Regardless of which value wins, both the `extracted_value` (from the questionnaire) and the `existing_value` are preserved on the `questionnaire_staged_fields` record permanently. Only `resolution` changes: `'use_new'` or `'keep_existing'`. The audit log entry written at sign-off records both the old value, the new value (if changed), and the source intake job.

**API:**

`PATCH /api/questionnaire-intake/:id/staged-devices/:deviceId/fields/:fieldId` — updates `resolution` for a single field.

`PATCH /api/questionnaire-intake/:id/staged-devices/:deviceId/resolve-all` — bulk-sets all pending conflicts for a device to `resolution = 'use_new'`.

---

## Step 4: Sign Off

This is the final confirmation step. No data has been written to `devices`, `device_specs`, or `device_deployments` until this step.

### Summary screen

```
┌──────────────────────────────────────────────────────────────┐
│  Step 4 of 4: Sign Off                                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Ready to import:                                            │
│                                                              │
│  ✓  EOSv1 / DCX960 / EOS-1008C                               │
│     Updating existing device  ·  47 fields  ·  3 overwritten │
│                                                              │
│  ✓  EOSv2 / 2008C-STB  (new device)                          │
│     Creating new device record  ·  52 fields added           │
│                                                              │
│  ✗  AVSB Android / DxIW393  (rejected)                       │
│                                                              │
│  Source file will be attached to 2 device records.           │
│                                                              │
│  Partner:  Liberty Global                                     │
│  Uploaded by:  Sarah Chen  ·  Mar 4, 2026, 10:42 AM          │
│                                                              │
│  [ ← Back ]              [ Reject All ]  [ Confirm Import ]  │
└──────────────────────────────────────────────────────────────┘
```

The "Confirm Import" button is the single commit action. It is disabled until all devices have a review status of either `approved` or `rejected` (no device can remain `pending`).

### Commit transaction

On "Confirm Import," the following operations execute in a single database transaction:

1. **For each approved existing device:**
   - For each staged field with `resolution = 'use_new'`: write `extracted_value` to the corresponding column in `device_specs`.
   - For each staged field with `resolution = 'keep_existing'`: no write to `device_specs`; the staged field record is updated to reflect the decision.
   - Fields with `conflict_status` in (`new_field`, `no_existing_device`) and `extracted_value` not null: written to `device_specs` unconditionally.

2. **For each approved new device:**
   - Create a `devices` record with confirmed identity fields (display name, model number, manufacturer, device type, partner key).
   - If `is_out_of_scope = true`: set `devices.phase = 'phase_2'` and `devices.status = 'out_of_scope'`.
   - Create a `device_specs` record for the new device.
   - Write all extracted fields with non-null `extracted_value` to `device_specs`.

3. **For all approved devices:**
   - Create a `device_questionnaire_sources` record linking the device to this intake job.

4. **Intake job record:**
   - Set `status` to `'approved'`, `'partially_approved'` (if any devices were rejected), or `'rejected'` (if all were rejected).

5. **Audit log (DST-006):**
   - For each field written to `device_specs`, one audit entry: entity type `device_spec`, entity id (device id), field changed, old value, new value, source `questionnaire_intake:{intake_job_id}`, user, timestamp.
   - For each new device created, one audit entry: entity type `device`, action `create`, source, user, timestamp.

If the transaction fails for any reason, it is rolled back entirely. No partial writes occur. An error message is shown with a "Retry" option.

### Post-commit state

After a successful commit:

- The admin is redirected to the intake job detail page, now showing status "Approved" or "Partially Approved."
- Each approved device shows a "View Device Record →" link.
- The source questionnaire file download link remains accessible on the intake job detail page indefinitely.

---

## Device Detail Integration

Once an intake job has been committed, the device detail page (DST-012/DST-013) gains a "Source Questionnaires" section, visible to all roles (read-only for non-admins):

```
Source Questionnaires

┌────────────────────────────────────────────────────────────┐
│  Disney_LibertyGlobal_STB_Questionnaire_v1.xlsx            │
│  Uploaded Mar 4, 2026  ·  Reviewed by Sarah Chen           │
│  47 fields from this file  ·  3 fields overrode existing   │
│  [ Download File ]                                         │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Vodafone_Device_questionnaires_combined.xlsx              │
│  Uploaded Jan 18, 2026  ·  Reviewed by Tom Yates           │
│  12 fields from this file  ·  0 fields overrode existing   │
│  [ Download File ]                                         │
└────────────────────────────────────────────────────────────┘
```

If multiple questionnaires have contributed data for the same field, hovering the field value on the spec display shows which questionnaire it came from and when it was imported.

---

## Rejecting an Entire Intake Job

The admin can reject the entire intake job at any point during the review (Step 1–4) by clicking "Reject All" in the action bar. This is a two-click confirmation:

```
Reject this entire questionnaire import?
This will reject all detected devices and mark the file as rejected.
No data will be written to the registry.

Reason (optional): [___________________________________]

[ Cancel ]  [ Confirm Reject All ]
```

Setting the intake job to `rejected` does not delete the staged data or the source file. The file remains downloadable and the staged device records remain in the database for reference. The admin can re-open any intake job with status `rejected` and reverse the decision by approving individual devices — this transitions the job status back to `pending_review`.

---

## Multi-Questionnaire Conflict Resolution (Cross-Job)

When a device already has spec data from a previously committed questionnaire, and a new questionnaire for the same device is being reviewed, the conflict resolution step (Step 3) presents both values as described above. The previous questionnaire is identified by name in the "existing value" panel:

```
  Field: RAM (total device memory)
  ┌────────────────────────────────┬──────────────────────────┐
  │  ◉ From this questionnaire     │  ○ Keep existing         │
  │  3072 MB                       │  2048 MB                 │
  │  (conf: 0.99)                  │  Source: Vodafone_Q1.xlsx │
  │                                │  Imported: Jan 18, 2026  │
  └────────────────────────────────┴──────────────────────────┘
```

The `existing_value` column on `questionnaire_staged_fields` stores the value as it existed at extraction time (a point-in-time snapshot). This means that even if the field is updated by another path between extraction and review, the conflict comparison reflects what was present when the extraction ran — preventing silent overwrites.

---

## Notifications

When an intake job reaches `pending_review` status, all users with the Admin role receive an in-app notification (bell icon in the top bar):

```
New questionnaire ready for review
Disney_LibertyGlobal_STB_Questionnaire_v1.xlsx
3 devices detected  ·  3 conflicts to resolve
[Review Now →]
```

Notifications are not sent by email in Phase 1. Email notifications are a Phase 2 enhancement.

---

## Permissions

| Action | Required role |
|---|---|
| Upload a questionnaire | Editor, Admin |
| Trigger AI extraction | Editor, Admin |
| View intake queue | Viewer, Editor, Admin |
| Review and approve/reject devices | Admin only |
| Resolve conflicts | Admin only |
| Sign off and commit | Admin only |
| Reject entire intake job | Admin only |
| Download source questionnaire file | Viewer, Editor, Admin |

Editors can upload files and trigger extraction but cannot review or commit. This allows TAMs (who have Editor access) to upload questionnaires they receive from partners, while ensuring no data enters the registry without Admin sign-off.

---

## API Endpoints

**`GET /api/questionnaire-intake/:id/review`**

Returns the full review state for an intake job:
- All staged devices with `review_status`, `matched_device_id`, identity fields, and total/conflict field counts.
- All staged fields grouped by device, including `conflict_status`, `extracted_value`, `existing_value`, and `resolution`.
- Intake job partner and status.

**`POST /api/questionnaire-intake/:id/approve`**

Commits the intake job. Executes the sign-off transaction described above. Returns the updated intake job record and a summary of records created/updated. Returns `409 Conflict` if any device has `review_status = 'pending'`, or if any conflict has `resolution = 'pending'`. Returns `422 Unprocessable Entity` if `partner_id` is null.

**`POST /api/questionnaire-intake/:id/reject`**

Sets the entire intake job to `rejected`. Accepts optional `reason` in the request body.

---

## Acceptance Criteria

- The review workflow has four clearly labeled steps: Assign Partner, Review Devices, Resolve Conflicts, Sign Off.
- Step 1 (Assign Partner) is shown only when `partner_id` is null; if the partner was auto-detected at ≥ 0.85 confidence, the admin enters at Step 2 with the partner shown as confirmed.
- Step 3 (Resolve Conflicts) is skipped automatically if no approved device has conflicting fields.
- Each device card in Step 2 clearly distinguishes: matched existing device, new device (requiring identity confirmation), and out-of-scope device (Phase 2 flag shown).
- Approving a new device requires the admin to confirm or edit the identity fields (model name, model number, device type, manufacturer) before advancing.
- Each conflict in Step 3 shows both the extracted value and the existing value, including the source questionnaire and import date of the existing value.
- "From questionnaire" is pre-selected for conflicts where AI confidence ≥ 0.85; no default is set for conflicts with confidence between 0.75 and 0.85.
- "Accept All Questionnaire Values" resolves all unresolved conflicts to `use_new` in a single action without affecting conflicts where the admin has already selected `keep_existing`.
- Both the extracted value and the existing value are stored permanently on `questionnaire_staged_fields` regardless of which was chosen; neither is discarded.
- The sign-off transaction is atomic: if it fails, no records are written and the admin sees an error with a retry option.
- For each field written to `device_specs` at commit, a DST-006 audit log entry records the old value, the new value, and the source intake job ID.
- Out-of-scope (Phase 2) devices approved at sign-off create device records with `phase = 'phase_2'` and `status = 'out_of_scope'`; they appear in the main catalog with a Phase 2 badge.
- The device detail page gains a "Source Questionnaires" section listing all intake jobs that contributed data, with file download links.
- Multi-questionnaire conflict resolution correctly shows the source questionnaire name and import date in the "existing value" panel.
- Admin users receive an in-app notification when any intake job reaches `pending_review` status.
- Editors can upload and trigger extraction but cannot access the review, conflict resolution, or sign-off steps.
- An intake job with status `rejected` retains its source file, staged device records, and staged field records; the admin can reverse the rejection and approve individual devices at any time.
- `POST /api/questionnaire-intake/:id/approve` returns `409` if any device is still `pending`, `422` if `partner_id` is null.
