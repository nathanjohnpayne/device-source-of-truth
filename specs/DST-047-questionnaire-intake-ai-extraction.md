# DST-047 — Questionnaire Intake & AI Extraction Pipeline

| Field | Value |
|---|---|
| **Story ID** | DST-047 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T3 — Hardware Spec Ingestion |
| **Priority** | P1 |
| **Story Points** | 13 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-001 (schema), DST-002 (API), DST-003 (auth), DST-012 (spec fields), DST-042 (AI import framework) |
| **Blocks** | DST-048 |

---

## User Story

As an Admin or TAM, I can upload a partner device questionnaire spreadsheet — in any version or format received over the years — and have DST automatically parse it, detect the devices it contains, and run an AI extraction pass that maps each question-answer pair to the correct normalized DST spec field, so that the raw file is preserved on record and structured data is ready for admin review without manual transcription.

---

## Background

Partner device questionnaires are the primary source of hardware spec data for the Disney Streaming NCP/ADK ecosystem. They have been collected over several years as emailed Excel files, and they present several structural problems that make programmatic ingestion non-trivial:

**Format fragmentation.** At least four distinct questionnaire layouts have been identified in the existing Google Drive corpus. All share the same conceptual structure — a numbered question list with one column per device — but differ in sheet names, header row location, question wording, question numbering, and the specific fields asked. Newer versions (e.g., the 2024 GM template) added categories like "Android TV" and "Android system properties" that do not exist in older Linux-only templates.

**Multi-device files.** A single questionnaire can contain data for many devices. The Liberty Global file contains three devices (EOSv1, EOSv2, Apollo); the Vodafone combined file contains six or more. Devices are represented as columns, not rows. Each column has a header that serves as the device identifier, and that identifier may be a model number, a platform codename, a marketing name, or a free-text label.

**Unstructured answers.** Answers in the value cells are free text. The same concept appears in many forms: RAM is expressed as "3GB / DDR4", "3 GB", "4GB", "4096 MB"; CPU speed as "12k DMIPS, Dual core", "12k DMIPS"; booleans as "yes", "Yes", "YES", "no", "n/a", "not supported". Rule-based normalization alone cannot reliably handle all cases without an LLM pass.

**Mixed platform scope.** Some questionnaires contain both in-scope (NCP/Linux-based) and out-of-scope (Android TV, AOSP) devices in the same file. Out-of-scope devices must be captured — flagged as Phase 2 — rather than discarded, because they represent real devices in the partner ecosystem.

**Questionnaire versions.** Question numbering and wording has evolved across versions. "STB Vendor" (older) became "STB Manufacturer" and then "Device vendor / ODM" in different templates. The AI extraction pass handles this by reasoning over question text semantically rather than matching question numbers or exact strings.

This story covers everything up to the point where structured, staged data is ready for an admin to review. The review, conflict resolution, and commit workflow is DST-048.

---

## Detected Questionnaire Formats

The parser must recognize the following format families from file structure alone. Format detection happens before extraction and determines which sheet to operate on and where the header row is.

| Format ID | Identifying signals | Sheet target | Header row signal |
|---|---|---|---|
| `lg_stb_v1` | Single sheet named "STB Tech Questionnaire"; row 1 has "No.", "Category", "Description" in cols A–C; no "Partner name" row near top | Sheet 0 | Row 1 |
| `gm_2024` | Multiple sheets including "3. Tech Questionnaire"; row 1 of that sheet has "No.", "Category", "Description" | Sheet named "3. Tech Questionnaire" | Row 1 |
| `vodafone_combined` | Sheet named "STB Tech Questionnaire"; row 1 col A is `drm`; row 2 has "No.", "Category", "Description" | Sheet named "STB Tech Questionnaire" | Row 2 |
| `android_atv` | Single sheet; row 1 has "No.", "Category", "Description"; early rows include "Partner name" and "Partner type" questions | Sheet 0 | Row 1 |
| `unknown` | None of the above match | Parser attempts best-effort column detection; flags intake job for admin review |

For `unknown` format files, the parser still attempts extraction but sets `questionnaire_format = 'unknown'` and `status = 'pending_review'` with a prominent warning in the admin UI.

---

## Data Model

### New Tables

#### `questionnaire_intake_jobs`

One record per uploaded file. Persists regardless of extraction outcome.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `file_name` | `text` NOT NULL | Original filename as uploaded |
| `file_storage_path` | `text` NOT NULL | Path in file store (S3 or Firebase Storage) |
| `file_size_bytes` | `integer` | |
| `uploaded_by` | `uuid` FK `users` | |
| `uploaded_at` | `timestamptz` NOT NULL | |
| `partner_id` | `uuid` FK `partners` NULLABLE | Null until detected or admin-assigned |
| `partner_confidence` | `float` NULLABLE | 0.0–1.0; confidence of auto-detection |
| `partner_detection_method` | `text` NULLABLE | `'filename'`, `'content'`, `'ai'`, `'admin'` |
| `questionnaire_format` | `text` NOT NULL | See format IDs above |
| `device_count_detected` | `integer` NULLABLE | Number of device columns found |
| `status` | `text` NOT NULL | See status enum below |
| `ai_extraction_mode` | `text` NULLABLE | `'auto'` or `'manual'`; null if not yet triggered |
| `ai_extraction_started_at` | `timestamptz` NULLABLE | |
| `ai_extraction_completed_at` | `timestamptz` NULLABLE | |
| `extraction_error` | `text` NULLABLE | Human-readable error summary if extraction failed (e.g., "All 3 device(s) failed AI extraction — likely due to API rate limits or timeouts. Try again in a few minutes.") |
| `notes` | `text` NULLABLE | Admin free-text notes |
| `created_at` | `timestamptz` NOT NULL | |
| `updated_at` | `timestamptz` NOT NULL | |

**Status enum for `questionnaire_intake_jobs`:**

| Status | Meaning |
|---|---|
| `uploading` | File transfer in progress |
| `parsing` | Structural parse running |
| `parse_failed` | Structural parse could not identify device columns |
| `awaiting_extraction` | Parsed successfully; waiting for admin to trigger AI extraction (manual mode only) |
| `extracting` | AI extraction pass in progress |
| `extraction_failed` | AI pass errored; staged data may be partial |
| `pending_review` | Extraction complete; waiting for admin sign-off (DST-048) |
| `approved` | All staged devices approved and committed |
| `partially_approved` | Some devices approved, some rejected |
| `rejected` | Admin rejected the entire intake job |

#### `questionnaire_staged_devices`

One record per device column detected in the questionnaire. Represents a device candidate before it is matched to a registry record and approved.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `intake_job_id` | `uuid` FK `questionnaire_intake_jobs` NOT NULL | |
| `column_index` | `integer` NOT NULL | Zero-based column index of this device in the spreadsheet |
| `raw_header_label` | `text` NOT NULL | The text in the header row for this device column (e.g., "EOSv2", "G7", "DEVICE 1") |
| `detected_model_name` | `text` NULLABLE | AI-extracted consumer-facing model name, if found in the questionnaire |
| `detected_model_number` | `text` NULLABLE | AI-extracted model number / SKU |
| `detected_manufacturer` | `text` NULLABLE | AI-extracted OEM / manufacturer |
| `platform_type` | `text` NOT NULL | `'ncp_linux'`, `'android_tv'`, `'android_aosp'`, `'unknown'` |
| `is_out_of_scope` | `boolean` NOT NULL DEFAULT `false` | True for non-NCP/ADK platforms |
| `matched_device_id` | `uuid` FK `devices` NULLABLE | Matched to existing registry record; null if new device |
| `match_confidence` | `float` NULLABLE | |
| `match_method` | `text` NULLABLE | `'exact_model_number'`, `'ai'`, `'admin'` |
| `review_status` | `text` NOT NULL DEFAULT `'pending'` | `'pending'`, `'approved'`, `'rejected'` |
| `reviewed_by` | `uuid` FK `users` NULLABLE | |
| `reviewed_at` | `timestamptz` NULLABLE | |
| `rejection_reason` | `text` NULLABLE | |
| `extraction_error` | `text` NULLABLE | Per-device error message if AI extraction failed for this device (e.g., "AI extraction returned no results after retries") |
| `created_at` | `timestamptz` NOT NULL | |

#### `questionnaire_staged_fields`

One record per question-answer pair per device. This is the granular extraction output.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `staged_device_id` | `uuid` FK `questionnaire_staged_devices` NOT NULL | |
| `intake_job_id` | `uuid` FK `questionnaire_intake_jobs` NOT NULL | Denormalized for query convenience |
| `dst_field_key` | `text` NOT NULL | Canonical `device_specs` column name (e.g., `soc_vendor`, `ram_mb`, `codec_avc`) |
| `dst_field_category` | `text` NOT NULL | Display category (e.g., "Hardware", "Memory & Storage", "Media Codecs") |
| `raw_question_text` | `text` NOT NULL | The original question text from column C of the questionnaire |
| `raw_answer_text` | `text` NULLABLE | The raw cell value from the device column for this question |
| `extracted_value` | `text` NULLABLE | Normalized, type-coerced value ready to write to `device_specs` |
| `extraction_method` | `text` NOT NULL | `'ai'`, `'rule_based'`, `'skipped'` |
| `ai_confidence` | `float` NULLABLE | Per-field confidence from the AI pass (0.0–1.0) |
| `ai_reasoning` | `text` NULLABLE | One-sentence explanation from the AI for this extraction |
| `conflict_status` | `text` NOT NULL DEFAULT `'new_field'` | See conflict enum below |
| `existing_value` | `text` NULLABLE | Current value in `device_specs` for this field, if the device already exists in the registry |
| `resolution` | `text` NOT NULL DEFAULT `'pending'` | `'pending'`, `'use_new'`, `'keep_existing'`, `'skipped_by_admin'` |
| `resolved_by` | `uuid` FK `users` NULLABLE | |
| `resolved_at` | `timestamptz` NULLABLE | |
| `created_at` | `timestamptz` NOT NULL | |

**Conflict status enum:**

| Status | Meaning |
|---|---|
| `new_field` | This field has no existing value in `device_specs`; no conflict possible |
| `matches_existing` | Extracted value matches existing value (after normalization); no conflict |
| `conflicts_with_existing` | Extracted value differs from existing value; admin must resolve |
| `no_existing_device` | Device does not exist in registry yet; all fields are implicitly new |

#### `device_questionnaire_sources`

Link table recording which intake jobs contributed data to which device records. Provides the permanent audit trail connecting device specs back to source documents.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `device_id` | `uuid` FK `devices` NOT NULL | |
| `intake_job_id` | `uuid` FK `questionnaire_intake_jobs` NOT NULL | |
| `staged_device_id` | `uuid` FK `questionnaire_staged_devices` NOT NULL | |
| `imported_at` | `timestamptz` NOT NULL | |
| `imported_by` | `uuid` FK `users` NOT NULL | |
| UNIQUE | (`device_id`, `intake_job_id`) | One device can only be imported from a given intake job once |

---

## Upload UI

### Entry point

A new "Questionnaires" section is added to the Admin panel sidebar, below the existing import flows. It contains two views: **Intake Queue** (all jobs, filterable by status) and **Upload New Questionnaire**.

### Upload form

The upload form is intentionally minimal. The goal is to get the file into the system quickly; the heavy decisions happen in the review step.

```
┌─────────────────────────────────────────────────────────┐
│  Upload Partner Questionnaire                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  File  [  Choose file  ]  Disney_LibertyGlobal_v1.xlsx  │
│         Accepted: .xlsx, .xls  ·  Max 20 MB             │
│                                                         │
│  Partner (optional)                                     │
│  [ -- Auto-detect --                              ▼ ]   │
│  Leave blank to let DST identify the partner from the   │
│  file. You can assign it manually after upload.         │
│                                                         │
│  ☐  Use AI Extraction?                             ⓘ   │
│     Auto-extract spec fields using Claude.              │
│     Only ambiguous values are sent to the API.          │
│                                                         │
│  Notes (optional)                                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│                           [ Cancel ]  [ Upload File ]   │
└─────────────────────────────────────────────────────────┘
```

**"Use AI Extraction?" checkbox behavior:**

- Unchecked by default.
- First check triggers the cost disclosure modal inherited from DST-042 (same modal, same copy, same confirm/cancel logic).
- When checked: extraction begins automatically after parsing completes. The admin is taken to the intake job detail page and sees a live progress indicator.
- When unchecked: parsing runs and the intake job reaches `awaiting_extraction` status. The admin can trigger extraction manually from the intake job detail page at any time, or proceed to review with rule-based-only extracted data.

---

## Parsing Pipeline

Parsing is synchronous with the upload request for files under 5 MB. For files over 5 MB, it is queued as a background job and the admin is redirected to the intake job detail page, which polls for status updates.

### Step 1: Format detection

The parser inspects the file to identify which format family it belongs to, using the signals in the format detection table above. The detected format is stored in `questionnaire_format`.

### Step 2: Header row and device column identification

Using the detected format, the parser locates the header row and reads device column headers. Device columns are all columns to the right of the "Description" column. The raw header label for each column is stored as `raw_header_label` on a new `questionnaire_staged_devices` record.

Sample columns are filtered out: any column whose header exactly matches "SAMPLE RESPONSE", "SAMPLE", or "(sample)" (case-insensitive) is excluded from device detection.

### Step 3: Platform type detection (rule-based pre-pass)

Before AI extraction, the parser makes a rule-based determination of each device's platform type by scanning the question list for platform-specific markers:

| Signal | Platform type assigned |
|---|---|
| Questions include "Android OS type" or "ro.product.device" | `android_tv` or `android_aosp` (determined by answer to "Android OS type") |
| Questions include "SoC Vendor" and "Broadcom SAGE" but no Android questions | `ncp_linux` |
| Questions include both Android and Linux sections | `ncp_linux` (Linux sections take precedence; Android sections may relate to a different column) |
| No distinguishing signals found | `unknown` |

Devices with `platform_type` in (`android_tv`, `android_aosp`) are flagged `is_out_of_scope = true`.

### Step 4: Partner auto-detection

The parser attempts to identify the partner from three signal sources, in priority order:

1. **Filename pattern.** Regex matching against known partner name patterns in the filename (e.g., "LibertyGlobal", "Liberty_Global", "Vodafone", "GM", "DeutscheTelekom"). Uses the Partner Alias Registry (DST-046) for fuzzy matching.
2. **Content signals.** The parser scans for a "Partner name" row near the top of the questionnaire (present in the Android template). If found, the value is matched against the partner registry.
3. **AI partner detection.** If neither of the above yields a confident match, the first 20 rows of the questionnaire are sent to the AI with the prompt: "Given this questionnaire excerpt, what is the partner company name? If identifiable, return the canonical partner name. If not identifiable, return null." This is a single, inexpensive call — not part of the main extraction batch.

The result is stored in `partner_id` (if matched) and `partner_detection_method`. If confidence is below 0.85, `partner_id` is left null and the intake job is flagged for admin partner assignment in DST-048.

### Step 5: Raw question-answer extraction

For each device column, the parser iterates all data rows and records every question-answer pair as a `questionnaire_staged_fields` row with:

- `raw_question_text`: value from column C of that row
- `raw_answer_text`: value from the device column for that row
- `dst_field_key`: set to `'__unmapped__'` until the AI extraction pass runs
- `extraction_method`: set to `'skipped'`

Rows where both the question and the answer are null are skipped entirely. Rows where the question is not null but the answer is null are recorded with `raw_answer_text = null` — these represent questions the partner left blank.

---

## AI Extraction Pass

The AI extraction pass maps each question-answer pair to a canonical `device_specs` field and normalizes the answer value. It extends the DST-042 universal AI import framework with a new extraction mode designed for unstructured questionnaire data.

### Registration

```typescript
registerImportFlow({
  flowId: "questionnaire_extraction",
  mode: "semantic_extraction",  // new mode — not disambiguation
  extractionTarget: "device_specs",
});
```

### Call structure and chunking

Each device's Q/A pairs are split into **chunks of 30** (`CHUNK_SIZE = 30`) and sent as sequential API calls. A real-world questionnaire commonly has 100–150 Q/A pairs; sending all of them in a single call produces a prompt large enough to exceed the API timeout before a response is returned. Chunking keeps each call small enough to complete reliably within the timeout budget.

For a device with 143 Q/A pairs, this produces 5 sequential calls (pairs 1–30, 31–60, 61–90, 91–120, 121–143). Results from all chunks are merged into a single field list after all chunks complete. Where two chunks return a result for the same `dst_field_key`, the result with the higher confidence score wins.

A **1,500 ms inter-chunk delay** (`INTER_CHUNK_DELAY_MS = 1500`) is inserted between chunks for the same device to keep combined output token volume below rate limits.

**Prompt structure (per-chunk call):**

```
System:
You are a device specification extraction engine for Disney Streaming's internal 
device registry. Your task is to map each question-answer pair from a partner 
questionnaire to a normalized spec field.

Return ONLY a JSON array. Each element must have:
  - dst_field_key: the canonical field name from the schema below
  - extracted_value: the normalized value (type-coerced per field type)
  - confidence: float 0.0–1.0
  - reasoning: one sentence explaining the extraction (max 120 chars)

If a question does not map to any field in the schema, set dst_field_key to null.
If the answer is blank, "n/a", or uninformative, set extracted_value to null.

Target schema (field_key: description, type, accepted_values_or_format):
[full device_specs schema injected here — ~90 fields]

User:
Partner: {partner_display_name or "Unknown"}
Device column header: {raw_header_label}
Platform type: {platform_type}
Chunk: {chunk_index + 1} of {total_chunks}

Question-answer pairs:
1. Q: "Model name of device" | A: "MagentaTV One (2. Generation)"
2. Q: "SoC Vendor" | A: "Amlogic"
3. Q: "CPU Speed" | A: "24k DMIPS"
[... up to 30 pairs ...]
```

The schema injected into the system prompt is generated from the `device_specs` column definitions in DST-001, including field type, units, and accepted values for enum fields. It is a static string built once at server startup.

### Device processing: sequential with retry and backoff

Devices are processed **one at a time** (sequential loop), not with concurrent `Promise.all`. Concurrent multi-device dispatch multiplies output token volume and reliably triggers HTTP 429 rate-limit errors from the Anthropic API when a questionnaire contains several devices.

For each chunk within a device, the call is retried up to **3 times** (`MAX_RETRIES = 3`) on HTTP 429 or timeout. Retry uses exponential backoff: **3 s → 6 s → 12 s** (`RETRY_BASE_DELAY_MS = 3000`, delay = `RETRY_BASE_DELAY_MS * 2^attempt`). If all retries are exhausted, the chunk is marked failed and extraction for that device stops.

**API timeout per chunk call: 45 seconds** (`API_TIMEOUT_MS = 45000`). This is longer than a simple disambiguation call because the prompt includes the full schema plus up to 30 Q/A pairs.

### Extraction constants

| Constant | Value | Rationale |
|---|---|---|
| `CHUNK_SIZE` | 30 | Keeps prompt size within reliable timeout budget |
| `INTER_CHUNK_DELAY_MS` | 1,500 | Rate-limit headroom between chunks for the same device |
| `API_TIMEOUT_MS` | 45,000 | Accounts for schema + 30 Q/A pairs in prompt |
| `MAX_RETRIES` | 3 | Handles transient 429s and single-call timeouts |
| `RETRY_BASE_DELAY_MS` | 3,000 | Base for exponential backoff (3 s → 6 s → 12 s) |
| Device concurrency | 1 (sequential) | Prevents combined output volume from exceeding rate limits |

### Failure detection — explicit rules

A device extraction is counted as **failed** if `extractDeviceFields()` returns an empty array **and** the device had at least one non-null Q/A pair. An empty result from a device with real data is never a success; it indicates a timeout or rate-limit failure that exhausted all retries.

This must be enforced explicitly in the orchestrator. The following logic is **required**:

```typescript
const results = await extractDeviceFields(qaPairs, context, client);

if (results.length === 0 && qaPairs.length > 0) {
  // Extraction failed — do not count as complete
  devicesFailed++;
  await db.stagedDevices.update(deviceId, {
    extractionError: "AI extraction returned no results after retries"
  });
} else {
  // Write extracted fields to staged_fields
  for (const result of results) { /* ... batch.update() ... */ }
  devicesComplete++;
}
```

Falling through to `devicesComplete++` after an empty result — without the guard above — produces a silent failure: the job reaches `pending_review` with 0 fields extracted and no error indicator, and the admin has no way to know extraction did not run.

### Job-level failure status

After all devices are processed, the job status is set as follows:

| Outcome | Job status set to |
|---|---|
| All devices succeeded (≥ 1 field extracted) | `pending_review` |
| Some devices succeeded, some failed | `pending_review` — failed devices show per-card error and inline retry |
| All devices failed | `extraction_failed` |

When `extraction_failed`, a human-readable summary is written to `questionnaire_intake_jobs.extraction_error`:

```
"All {N} device(s) failed AI extraction — likely due to API rate limits or timeouts. Try again in a few minutes."
```

The frontend must never display `pending_review` as "Complete" without first verifying that at least one device has `extracted_fields_count > 0`. A job that is `pending_review` with all devices showing 0 extracted fields is a failed extraction, not a completed one, and the UI must surface this distinctly.

### Post-extraction normalization

After the AI returns JSON for a device, a rule-based normalization pass is applied to `extracted_value` before storage:

| Field type | Normalization |
|---|---|
| RAM / memory (MB) | Parse "3GB", "3 GB / DDR4", "3072 MB" → integer MB |
| Boolean codec/DRM fields | "yes", "Yes", "YES", "supported", "✓" → `true`; "no", "No", "n/a", "–" → `false` |
| Date fields | Any parseable date format → ISO `YYYY-MM-DD`; "n/a", "not released" → null |
| Enum fields | Case-insensitive match against accepted values; closest match used if confidence ≥ 0.85 |
| Free-text fields | Trimmed; leading/trailing whitespace removed; non-breaking spaces replaced |

### Conflict detection

After extraction, each `questionnaire_staged_fields` row is compared against the current value in `device_specs` for the matched device (if a match exists). The `conflict_status` column is set accordingly:

- If the device has no existing record: all fields set to `no_existing_device`.
- If the device exists but the field is null: `new_field`.
- If the extracted value matches the existing value (after normalization): `matches_existing`.
- If the extracted value differs: `conflicts_with_existing`.

Fields with `conflicts_with_existing` status are surfaced prominently in the DST-048 review UI.

### Device registry matching

After extraction, the parser attempts to match each staged device to an existing record in the `devices` table:

1. **Exact model number match.** If `detected_model_number` exactly matches `devices.device_id` or a known alias — `match_method = 'exact_model_number'`, confidence 1.0.
2. **AI match.** The device's extracted name, model number, manufacturer, and SoC are sent in a single batch call: "Given these device attributes, does this device match any of the following registry records? Return the device_id of the best match and a confidence score, or null if no match." — `match_method = 'ai'`.
3. **No match.** `matched_device_id` left null; DST-048 will offer admin the option to create a new device or manually assign an existing one.

---

## API Endpoints

### Upload

**`POST /api/questionnaire-intake`**

Accepts `multipart/form-data` with:
- `file`: the questionnaire file
- `partner_id` (optional): UUID if admin pre-assigned
- `ai_extraction`: boolean (default false)
- `notes` (optional): string

Returns the created `questionnaire_intake_jobs` record immediately. Parsing and extraction proceed asynchronously (or synchronously for small files).

**`GET /api/questionnaire-intake`**

Returns a paginated list of all intake jobs, ordered by `uploaded_at` DESC. Supports filter params: `status`, `partner_id`, `uploaded_by`.

**`GET /api/questionnaire-intake/:id`**

Returns the full intake job record plus:
- `staged_devices`: array of `questionnaire_staged_devices` for this job, each including a `field_summary` (total fields, extracted fields, conflict count)
- `partner`: partner record if assigned
- `extraction_progress`: `{total_devices, devices_complete, devices_failed}` (populated during extraction)

**`POST /api/questionnaire-intake/:id/trigger-extraction`**

Manually triggers the AI extraction pass on an intake job with status `awaiting_extraction`. Sets `ai_extraction_mode = 'manual'` and `status = 'extracting'`. Returns 409 if extraction has already run or is in progress.

**`POST /api/questionnaire-intake/:id/staged-devices/:deviceId/retry-extraction`**

Re-runs AI extraction for a single failed device without re-processing devices that already have extracted fields. Only valid when the target `questionnaire_staged_devices` record has `extraction_error` set. Resets that device's `extraction_error` to null, re-runs the chunked extraction pass for that device only, and updates the job status (e.g., promoting from `extraction_failed` to `pending_review` if the retry succeeds and all other devices are already complete). Returns 409 if the device is not in a failed state.

**`GET /api/questionnaire-intake/:id/staged-devices`**

Returns all `questionnaire_staged_devices` for the job with their full `questionnaire_staged_fields` arrays.

---

## Intake Queue UI

A table in the Admin panel listing all intake jobs with the following columns:

| Column | Notes |
|---|---|
| File name | Clickable → intake job detail |
| Partner | Detected partner name, or "⚠ Unassigned" in amber if null |
| Devices detected | Count of device columns found |
| Format | Detected format ID |
| Status | Badge with color coding |
| Uploaded by / date | |
| Actions | "Review" (→ DST-048 detail), "Re-run extraction" (if extraction failed) |

Status badge colors:

| Status | Color |
|---|---|
| `uploading`, `parsing`, `extracting` | Blue (in-progress) |
| `awaiting_extraction` | Amber |
| `parse_failed`, `extraction_failed` | Red |
| `pending_review` | Amber |
| `approved`, `partially_approved` | Green |
| `rejected` | Gray |

---

## Intake Job Detail Page (Pre-Review)

This page is visible during and after extraction, before the admin begins the DST-048 review workflow. It serves as the status monitor for the extraction job.

**Header section:**

```
┌──────────────────────────────────────────────────────────────┐
│  Disney_LibertyGlobal_STB_Questionnaire_v1.xlsx              │
│  Uploaded by: Sarah Chen  ·  Mar 4, 2026, 10:42 AM           │
│                                                              │
│  Partner:  Liberty Global   [Change]                         │
│  Format:   lg_stb_v1   ·   3 devices detected                │
│  Status:   ● Extracting…   Device 2 of 3                     │
└──────────────────────────────────────────────────────────────┘
```

**Extraction progress indicator**

During active extraction, the status line shows a real-time step indicator for the device currently being processed:

```
Status:  ● Extracting…   EOSv1 — chunk 2 of 5
         Reading spreadsheet ✓ → Extracting fields ● → Validating → Done
```

The four steps (Reading spreadsheet, Extracting fields, Validating, Done) advance as the job progresses. The current device name and chunk position are shown during the Extracting step.

**Device cards (one per detected device column):**

```
┌─────────────────────────────────────────────────────────────┐
│  EOSv1  ·  platform: ncp_linux  ·  In scope                 │
│  ─────────────────────────────────────────────────────────  │
│  Matched to:  DCX960 / EOS-1008C  (exact model number)      │
│  Fields extracted:  47 / 89   ·   3 conflicts detected      │
│  ● Extracting…  chunk 2 of 5                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  EOSv2  ·  platform: ncp_linux  ·  In scope                 │
│  ─────────────────────────────────────────────────────────  │
│  Matched to:  ⚠ No match found — new device or reassign     │
│  Fields extracted:  52 / 89   ·   0 conflicts               │
│  ✓ Complete                                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐  ← red border
│  G7  ·  platform: android_tv  ·  ⚠ Out of scope (Phase 2)  │
│  ─────────────────────────────────────────────────────────  │
│  ✗ Extraction failed                                        │
│  AI extraction returned no results after retries            │
│                                          [ Retry Device ]   │
└─────────────────────────────────────────────────────────────┘
```

Failed device cards render with a red border and display the `extraction_error` string from `questionnaire_staged_devices`. The inline "Retry Device" button calls `POST /api/questionnaire-intake/:id/staged-devices/:deviceId/retry-extraction`.

**Global error banner (full failure — all devices failed):**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ✗  Extraction failed for all devices. This is usually caused by API rate    │
│     limits or timeouts. Wait a few minutes, then try again.                  │
│                                                    [ Restart Extraction ]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Global warning banner (partial failure — some devices failed, some succeeded):**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ⚠  Extraction failed for 1 of 3 devices. Use the Retry button on the        │
│     failed device card, or begin review and retry from the review screen.    │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Action bar (enabled once all extractions complete or partially complete):**

```
                        [ Download Source File ]  [ Begin Review → ]
```

"Begin Review" is available even when some devices failed extraction, so the admin can approve the successful devices without being blocked. Failed devices appear in the review with their error state and a retry option.

If extraction has not yet been triggered (status = `awaiting_extraction`):

```
  AI extraction has not been run yet.
  [ Run AI Extraction ]   or   [ Review with Rule-Based Data Only ]
```

---

## File Storage

The uploaded questionnaire file is stored at upload time, before parsing begins, so it is never lost even if parsing or extraction fails.

**Storage path convention:**

```
questionnaires/{intake_job_id}/{original_filename}
```

Files are stored in Firebase Storage (Phase 1) or S3 (Phase 2 enterprise migration). The `file_storage_path` column on `questionnaire_intake_jobs` stores the full path. A signed download URL is generated on demand (not stored) via `GET /api/questionnaire-intake/:id/download`.

When DST-048 commits approved device data, a reference to the intake job is written to `device_questionnaire_sources` for each affected device. The device detail page (DST-013) gains a "Source Questionnaires" section listing all intake jobs that have contributed data to that device, with a download link to each file.

---

## Handling Out-of-Scope Devices

Devices with `is_out_of_scope = true` (Android TV, Android AOSP, or unknown platform) are carried through the full extraction pipeline and appear in the DST-048 review UI. They are not hidden or discarded.

When an out-of-scope device is approved by an admin in DST-048:

1. A new device record is created (or an existing one is updated) in the `devices` table.
2. The device's `phase` field is set to `'phase_2'` and `status` is set to `'out_of_scope'`.
3. The device appears in the main device catalog with a "Phase 2 — Out of Scope" badge.
4. It does not appear in Datadog sync diffs or hardware tier scoring until Phase 2.
5. The spec data is written to `device_specs` normally — the data is valid regardless of scope.

This ensures no data from a questionnaire is ever silently discarded.

---

## Acceptance Criteria

- Admin can upload `.xlsx` and `.xls` files up to 20 MB via the Admin panel "Upload New Questionnaire" form.
- The parser correctly identifies the format for all four reference questionnaires (LG v1, GM 2024, Vodafone combined, Android G7) and targets the correct sheet in multi-sheet files.
- The parser identifies device columns and creates one `questionnaire_staged_devices` record per non-sample device column.
- Platform type is correctly identified as `ncp_linux` for all LG and Vodafone devices, `android_tv` for the G7 and Vodafone Android devices, and `is_out_of_scope` is set accordingly.
- Partner auto-detection correctly identifies Liberty Global, GM / Deutsche Telekom, and Vodafone from the four reference files, or leaves `partner_id` null with `partner_detection_method = 'ai'` if confidence is below 0.85.
- The "Use AI Extraction?" checkbox triggers the DST-042 cost disclosure modal on first check per page load. Unchecking it results in zero Anthropic API calls.
- When AI extraction is enabled (auto or manual), devices are processed sequentially (one at a time). Each device's Q/A pairs are chunked into groups of 30 and sent as sequential API calls, each with a 45-second timeout and up to 3 retries with exponential backoff on 429 or timeout errors. A 1,500 ms delay is applied between chunks for the same device.
- After extraction, `questionnaire_staged_fields` records exist for every non-null question-answer pair, with `dst_field_key` populated (or null for unmappable questions), `extracted_value` normalized, and `ai_confidence` set.
- Conflict detection correctly sets `conflict_status` to `conflicts_with_existing` for any field where the extracted value differs from the existing `device_specs` value after normalization.
- The uploaded file is stored in Firebase Storage immediately on upload, before parsing begins. A download link is available on the intake job detail page regardless of extraction status.
- `device_questionnaire_sources` records are created for every device-intake-job pair committed in DST-048, enabling the device detail page to display source questionnaire links.
- Out-of-scope devices (Android TV, AOSP) are extracted, staged, and presented for admin review; they are not discarded or hidden.
- The Intake Queue displays all jobs with correct status badges and supports filtering by status and partner.
- A `GET /api/questionnaire-intake/:id` response includes extraction progress counts during active extraction (polled by the UI).
- A device whose extraction returns an empty result array despite having non-null Q/A pairs is counted as `devicesFailed`, not `devicesComplete`. Its `extraction_error` field is populated and the job status is set to `extraction_failed` if all devices fail.
- The frontend never renders a job as "Complete" unless at least one device has `extracted_fields_count > 0`. A `pending_review` job with all devices at 0 extracted fields is surfaced as an extraction failure.
- Failed device cards display a red border, the error message, and an inline "Retry Device" button. A full-failure global banner and a partial-failure global warning banner are shown as appropriate.
- `POST /api/questionnaire-intake/:id/staged-devices/:deviceId/retry-extraction` re-runs extraction for a single failed device without affecting already-extracted devices.
