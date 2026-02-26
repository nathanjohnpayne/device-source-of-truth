

![][image1]

# **Device Source of Truth**

## Disney — Partnerships & Devices Product Brief · Epic · Jira Story Tickets

# 

# **Part 1 — Product Brief**

## **1.1  Executive Summary**

The Device Source of Truth (DST) is a purpose-built internal platform that consolidates Disney Streaming's device ecosystem data into a single, authoritative, and continuously maintained system of record. It resolves a critical operational gap: today, device identities, hardware specifications, partner relationships, field deployment counts, ADK version history, and DRM compliance data are scattered across Datadog, Airtable, Google Drive, emailed spreadsheets, and institutional memory — with no reliable way to join them together.

DST will serve as the foundation for hardware-tiered feature delivery, ADK certification management, partner lifecycle tracking, QoE monitoring, and executive reporting across Disney+, Hulu, and ESPN device platforms.

## **1.2  Problem Statement**

### **What exists today**

The NCP and ADK partner ecosystem currently spans 52 partner keys (as reported by Datadog), representing approximately 25 distinct partner brands, across 136 unique device identifiers, running on hardware in 2.4 million active device instances in the field (NCP/ADK only). The data describing this ecosystem is fragmented across at least four systems owned by four different teams:

| System | Owner | What It Contains | Problem |
| :---- | :---- | :---- | :---- |
| **Datadog (RUM/Metrics)** | Engineering / Observability | Partner key, device model code, ADK version, unique device IDs, event counts | Raw slugs, no human names, no specs, multi-version rows |
| **Airtable / AllModels** | Certification Team (PGM) | Device name, partner name, region, country, device type, ADK version, DRM, questionnaire link | Inconsistently maintained, no join key to Datadog for \~57 devices |
| **Google Drive (XLS)** | TAM Team | Full hardware specs: SoC, CPU, RAM, GPU, storage, codecs, DRM, HDR, firmware lifecycle | Hundreds of emailed files; no ingestion, no extraction |
| **Partner Key Mapping** | P\&D Product (manual) | Datadog slug → partner name, region, countries, chipset, OEM | Incomplete (5 unmapped keys), not connected to any system |

### **The specific gap this creates**

* There is no way to look at a Datadog device slug (e.g., titan\_novatek/pus83xx\_2k24) and immediately know the partner name, human-readable device name, hardware specs, field population, ADK version in use, and DRM compliance status.

* 57 out of 136 devices in the Datadog field report have no corresponding record in Airtable — those devices are invisible to the team outside of raw log data.

* Hardware specs from partner questionnaires (90+ fields covering RAM, GPU, SoC, codecs, HDR, DRM) are locked in emailed Excel files. There is no way to query across them.

* There is no tiering or scoring system. Feature eligibility for new capabilities (e.g., Atmos, higher-bitrate streams, UI enhancements) is determined manually via allow lists — the same process the team already moved away from for Atmos on Android.

* Planning for future features that require minimal hardware (RAM, GPU, CPU thresholds) requires ad hoc analysis each time, with no single source to query.

## **1.3  Goals & Success Criteria**

### **Primary Goals**

* Establish a single, authoritative record for every device in the Disney Streaming NCP/ADK ecosystem, with a reliable join key between production telemetry (Datadog) and device metadata.

* Extract and normalize hardware specifications from partner questionnaires into structured, queryable fields.

* Enable automated hardware tier scoring — classify every device into a tier based on configurable spec thresholds — with tier assignments informing feature eligibility.

* Provide operational teams (Certification, TAM, Partner Integration, PMs, TPMs) with a shared interface to browse, search, update, and report on device data.

* Build the foundation for future platform expansion to Roku, Android TV, Fire TV, Apple TV, iOS, and Web.

### **Success Criteria (Phase 1 — NCP/ADK)**

| Criterion | Measurement |
| :---- | :---- |
| 100% of Datadog NCP/ADK partner keys are mapped to a canonical partner record | 0 unmapped keys in sync report |
| 100% of Datadog devices matched to a device record (or flagged as ‘unregistered’) | Automated nightly sync diff report |
| Spec data captured for 90%+ of devices by active device count | Field population coverage report |
| Hardware tier assigned to every device with spec data | Tier completion dashboard |
| Time to find device specs \+ field count reduced from hours to \<2 min | PM team self-reported in retrospective |
| The certification team uses DST as the primary device registry (replacing Airtable only) | Airtable no longer manually updated after cutover |

## **1.4  Non-Goals (Phase 1\)**

* Real-time streaming telemetry or crash rate monitoring — DST will display synced field counts, not replace Datadog.

* Roku, Android TV, Fire TV native, Apple TV, iOS, and Web device records — Phase 2 expansion after NCP/ADK is proven.

* Partner-facing portal for questionnaire submission — this is a Phase 2 enhancement (public partner links with authentication).

* Automated questionnaire parsing / AI extraction — Phase 2; Phase 1 requires manual structured entry with questionnaire as reference.

* DRM compliance enforcement or certification workflow automation.

## **1.5  Users & Roles**

| Role | Team | Primary DST Workflows |
| :---- | :---- | :---- |
| P\&D Product Manager | P\&D Product (NCP/ADK) | Browse device catalog, run hardware reports, configure tier thresholds, and executive reporting |
| Certification Specialist | Certification (PGM \+ Partner Support) | Register new devices, update ADK versions, mark questionnaire status, record cert results |
| Technical Account Manager | TAM | Look up partner device inventory, upload questionnaire data, and view partner coverage reports |
| Partner Integration PM | P\&D Product | View partner profile, track integration status, browse device specs for compatibility planning |
| Program Manager (TPM) | Partnerships Program | View certification SLAs, partner device counts, ADK version adoption rates |

## **1.6  Data Model Overview**

DST is organized around six core entities. All Datadog telemetry keys resolve to this model at query time rather than being stored denormalized.

### **Core Entities**

| Entity | Key Fields | Purpose |
| :---- | :---- | :---- |
| **Partner** | id, display\_name, regions, countries\_iso2 | Canonical brand (e.g., 'Philips TVs', 'TiVo', 'Movistar HispAm') |
| **Partner Key** | key (Datadog slug), partner\_id, chipset, oem, region | Maps Datadog/system slugs to canonical partners; one partner can have many keys |
| **Device** | id, display\_name, device\_id (Datadog key), partner\_key, device\_type, status | One row per unique hardware model; device\_id is the Datadog join key |
| **Device Spec** | device\_id \+ 90 spec fields (RAM, GPU, SoC, codecs, DRM, etc.) | Normalized hardware spec data extracted from questionnaires |
| **Telemetry Snapshot** | partner\_key, device\_id, core\_version, unique\_devices, event\_count, snapshot\_date | Periodic syncs from Datadog; one row per partner+device+version+date |
| **Hardware Tier** | tier\_name, ram\_min, gpu\_min, cpu\_min, codec\_requirements, score\_formula | Configurable tier definitions; device tier computed automatically from spec fields |

| Key Design Decision — Partner Key Multiplicity A single partner brand (e.g., Philips TVs) maps to multiple Datadog partner keys depending on chipset vendor and region (titan\_novatek, titan\_novatek\_latam, titan\_mediatek\_latam, titan\_mediatek\_emea). Similarly, the same physical hardware model (e.g., EOSv2 / 2008c-stb from Humax) is deployed by multiple partners (VodafoneZiggo, Virgin Media O2, Telenet, Sunrise). The data model handles both directions: Partner → many Partner Keys, and Device → many Partner deployments. |
| :---- |

## **1.7  Key Integrations**

* Datadog (RUM/Metrics) — Manual CSV export from Datadog used to populate Telemetry Snapshots in Phase 1\. Automated nightly sync via the Datadog API is a Phase 2 enhancement to be implemented once the POC is validated.

* Airtable (AllModels base) — Phase 1: one-time migration of existing device records and questionnaire links into DST, plus manual CSV import/export support so teams can continue working in Airtable during the POC. Phase 2: bidirectional sync once DST is validated; Airtable is deeply embedded in production workflows and full cutover is a future-state decision, not a Phase 1 requirement.

* Google Drive — TAM team uploads partner questionnaire XLS files; DST provides a structured intake form to enter key fields, with the files attached as reference artifacts.

## **1.8  Technical Approach**

* Frontend: React web application with a responsive, component-driven UI.

* Backend: REST API (Node.js or Python/FastAPI) with a relational database (PostgreSQL recommended for JSON column support on spec fields).

* Airtable Integration (Phase 1): Manual CSV import/export. The import tool reads AllModels CSV exports and creates/updates device records in DST. The export tool generates a CSV file in the AllModels format, so teams can continue working in Airtable without disruption. Bidirectional automated sync via Airtable REST API is a Phase 2 feature.

* Datadog Integration (Phase 1): Manual export workflow — admins download a CSV from Datadog and upload it to DST via the Admin panel to refresh telemetry snapshots. Automated nightly ingestion via the Datadog API is a Phase 2 feature.

* Authentication (Phase 1): Google OAuth restricted to @disney.com and @disneystreaming.com email domains. No accounts are created — login is gated at the Google identity level. Disney SSO / Okta integration is a Phase 2 feature once the POC is migrated to the enterprise infrastructure.

* Deployment (Phase 1 — POC): Firebase Hosting (frontend) \+ Firebase Realtime Database or Firestore (backend data store). Chosen for rapid POC iteration with minimal infrastructure overhead. Phase 2: migrate to Disney's internal cloud infrastructure and enterprise CI/CD pipeline once the POC is validated with the team.

# **Part 2 — Epic**

## **EPIC-DST: Device Source of Truth — Phase 1 (NCP/ADK)**

| Epic Title | Device Source of Truth — Phase 1: NCP/ADK Core Platform |
| :---- | :---- |
| **Product Owner** | Nathan Payne — Sr. PM II, NCP \+ ADK |
| **Team** | P\&D Product — NCP Squad / App Foundations Fleet |
| **Priority** | P1 — FY26 Strategic Initiative |
| **Platforms Covered** | NCP \+ ADK (Phase 1). Roku, Android TV, Fire TV, Apple TV, iOS, Web, and BBD in Phase 2\. |

### **Epic Description**

Build a custom web application that serves as the system of record for all NCP/ADK partner devices deployed across Disney+, Hulu, and ESPN. The system will: (1) provide a canonical partner and device registry that resolves Datadog telemetry identifiers to human-readable records; (2) store and expose normalized hardware specs from partner questionnaires; (3) automatically compute hardware tier classifications based on configurable scoring rules; (4) display field deployment counts via Datadog CSV uploads in Phase 1, with automated sync in Phase 2; and (5) support team workflows for device registration, questionnaire data entry, ADK version tracking, and reporting. The Phase 1 POC will be hosted on Firebase and migrated to Disney enterprise infrastructure in Phase 2\.

### **Stories by Theme**

**The epic is organized into 7 themes. Each theme produces a shippable unit of value. Themes should be sequenced in the order listed; Theme 1 is a prerequisite for all others.**

| \# | Theme | Outcome | Stories | Est. Points |
| :---- | :---- | :---- | :---- | :---- |
| **T1** | Data Model & Infrastructure | Database schema, API scaffolding, auth, deployment pipeline live | 6 | 34 |
| **T2** | Partner & Device Registry | All 47 partner keys and 136+ devices registered; Datadog slugs resolved | 5 | 29 |
| **T3** | Hardware Spec Ingestion | Spec data entry UI covering all 90 questionnaire fields; existing files migrated | 5 | 31 |
| **T4** | Datadog Telemetry Upload | Manual Datadog CSV upload populates field counts; unregistered devices flagged | 4 | 21 |
| **T5** | Hardware Tier Scoring | Configurable tier thresholds; automatic tier assignment per device; tier browser | 5 | 28 |
| **T6** | Search, Browse & Reporting | Full device/partner catalog search; partner coverage reports; export to CSV/PDF | 5 | 24 |
| **T7** | Airtable Migration & Sync | One-time migration of AllModels data; optional post-cutover Airtable sync job | 4 | 18 |
| **TOTAL** | — | — | **34** | **185** |

# **Part 3 — Jira Story Tickets**

Each story below follows the format: Story ID, Title, User Story, Acceptance Criteria, Technical Notes, and Story Points. Stories are sequenced within their theme in priority order.

  **THEME 1 — Data Model & Infrastructure**

### **DST-001 — Database Schema Design & Migration Scripts**

| Type | Technical Story |
| :---- | :---- |
| **Points** | 8 |

User Story: As an engineer, I need a fully normalized relational schema so that all device, partner, spec, telemetry, and tier data can be stored, queried, and joined reliably.

**Acceptance Criteria:**

* Schema implements all six core entities: partners, partner\_keys, devices, device\_specs, telemetry\_snapshots, hardware\_tiers, and device\_tier\_assignments.

* partner\_keys.key is unique and indexed; devices.device\_id is unique and indexed (join key for Datadog).

* device\_specs stores all 90 questionnaire fields as typed columns (not JSON blob) to enable filtering and range queries on RAM, GPU memory, CPU cores, etc.

* All FK relationships are enforced with cascading deletes where appropriate.

* Migration scripts are checked into version control; the schema is versioned with a migration tool (Flyway or Alembic).

* Seed data scripts for all 47 partner keys and existing AllModels device IDs included.

Technical Notes: PostgreSQL is strongly recommended. device\_specs fields should use nullable numeric types for RAM (MB), GPU memory (MB), CPU cores (INT), and CPU speed (FLOAT/DMIPS). Codec support fields should be boolean. DRM fields should be enum or text with constrained values. Include a questionnaire\_url text field on devices to preserve the Google Drive link during migration.

### **DST-002 — API Scaffold: Core CRUD Endpoints**

| Type | Technical Story |
| :---- | :---- |
| **Points** | 8 |

User Story: As a frontend developer, I need REST API endpoints for all core entities so that the UI can read and write data without direct database access.

**Acceptance Criteria:**

* REST endpoints implemented for: GET/POST/PUT/DELETE on /partners, /partner-keys, /devices, /device-specs, /hardware-tiers.

* GET /devices returns partner display name and live device count (aggregated from telemetry\_snapshots) by default via join.

* GET /devices/:id returns a full device record, including specs, tier assignment, partner info, and latest telemetry counts.

* API returns a 404 with a descriptive error for an unknown device\_id or partner\_key.

* OpenAPI (Swagger) spec is auto-generated and accessible at /docs.

* All write endpoints require an authenticated session (Google OAuth — see DST-003).

Technical Notes: Use RESTful conventions. Avoid N+1 queries — device list endpoint should JOIN partner and aggregate telemetry in a single query. Pagination is required for all list endpoints (default: 50, max: 200). Sort by unique\_devices DESC by default.

### **DST-003 — Authentication: Google OAuth (disney.com / disneystreaming.com)**

| Points | 5 |
| :---- | :---- |

User Story: As an internal Disney employee, I can log in to DST using my @disney.com or @disneystreaming.com Google account so that access is restricted to the right team without any separate account management.

**Acceptance Criteria:**

* Google OAuth 2.0 configured via Firebase Authentication; login attempts from non-disney.com and non-disneystreaming.com email domains are rejected at the auth layer with a clear error message.

* Role model implemented: Viewer (read-only), Editor (create/update devices and specs), Admin (manage tiers, partner keys, trigger uploads). Roles assigned manually by an Admin in the DST app (no Okta group sync in Phase 1).

* All app routes require authentication except the health check endpoint. Unauthenticated requests redirect to the Google login screen.

* Firebase session tokens expire after 8 hours; re-authentication is handled via standard Google OAuth flow. Disney SSO / Okta integration is explicitly Phase 2, after migration from Firebase to enterprise infrastructure.

* Unauthorized API requests return a 401 status code with a redirect to Google login.

### **DST-004 — CI/CD Pipeline & Deployment to Internal Infrastructure**

| Points | 5 |
| :---- | :---- |

User Story: As an engineer, I need an automated build-and-deploy pipeline so that changes can be reliably shipped to staging and production without manual steps.

**Acceptance Criteria:**

* CI pipeline runs on every PR: lint, unit tests, migration validation, Docker build.

* Staging environment auto-deploys on merge to main.

* Production deployment requires a manual approval gate in the pipeline.

* Environment variables (DB credentials, Datadog API token, Firebase config, Google OAuth client secrets) managed via secrets manager; never hardcoded.

* The health check endpoint (/health) returns 200 with the DB connectivity status.

### **DST-005 — React App Shell, Navigation & Design System**

| Points | 5 |
| :---- | :---- |

User Story: As a user, I can navigate a clean, consistent interface to move between devices, partners, specs, tiers, and reports without confusion.

**Acceptance Criteria:**

* App shell includes: persistent sidebar navigation (Devices, Partners, Tiers, Reports, Admin), a top bar with a user avatar and logout, and a breadcrumb trail on detail pages.

* Navigation items: Devices (with a badge showing the total count), Partners, Hardware Tiers, Reports, Admin (visible only to the Admin role).

* Responsive layout works at 1280px+ width (desktop/laptop target).

* Loading states and error boundaries are implemented on all data-fetching views.

* Component library established (internal or third-party, e.g., Shadcn/Radix) with typography, color tokens, button variants, and table components documented in a Storybook or equivalent.

### **DST-006 — Audit Log: Track All Data Changes**

| Points | 3 |
| :---- | :---- |

User Story: As an Admin, I can see a log of every change made to device records so that I can track who changed what and when, and revert if necessary.

**Acceptance Criteria:**

* All CREATE, UPDATE, and DELETE operations on devices, device\_specs, partner\_keys, and hardware\_tiers are logged with the following fields: entity type, entity id, field changed, old value, new value, user, and timestamp.

* The audit log is viewable in the Admin panel, with filtering by entity type, user, and date range.

* Audit entries are append-only (no deletion of log records).

  **THEME 2 — Partner & Device Registry**

### **DST-007 — Partner Registry: View & Manage Canonical Partners**

| Points | 5 |
| :---- | :---- |

User Story: As a P\&D PM or TAM, I can view a list of all canonical partners, including their regions, countries, and associated Datadog keys, so I have a reliable reference for the full partner landscape.

**Acceptance Criteria:**

* The partner list view shows: display name, regions, countries (flag \+ ISO code), number of partner keys, total devices, and total active devices (from telemetry).

* The partner detail view shows all associated partner\_keys, all devices grouped by partner\_key, and regions and countries of operation.

* Editors can add/edit partner records and associate partner keys to a canonical partner.

* Initial seed: all 47 partner keys from partner\_key\_mapping\_enriched\_2.csv loaded, plus 5 internal keys (dss, twdc\_microsoft, twdc\_amazon, broadcom, amlogic) with appropriate partner records.

* Partners with multiple keys for the same brand (e.g., Claro with claro\_br / claro\_zte\_br / clarokaon\_br) are consolidated under a single partner record.

### **DST-008 — Device Registry: View, Search & Add Devices**

| Points | 8 |
| :---- | :---- |

User Story: As any user, I can browse the full device catalog, search by name or device ID, and filter by partner, region, ADK version, and device type to quickly find a specific device or a slice of the ecosystem.

**Acceptance Criteria:**

* Device list view shows: device display name, device\_id (Datadog key), partner name, region, ADK version, hardware tier (if assigned), and active device count (from latest telemetry snapshot).

* Full-text search across device name and device\_id. Filter panel: partner (multi-select), region, device type, ADK version, tier, spec completeness (has specs / missing specs).

* 'Spec Completeness' indicator per device: percentage of key spec fields populated (RAM, GPU, SoC, codecs, DRM).

* Device detail page: all metadata, all spec fields grouped by category (Hardware, Memory, Codecs, DRM, Firmware), field count, field population status, active device count with version breakdown, tier badge, and audit history.

* 'Register New Device' form accessible to Editors: device\_id (validated as unique), display name, partner\_key (dropdown), device type, region, countries, and initial ADK version.

* Devices with no spec data show a prominent 'Specs Missing' banner with a CTA to enter specs.

### **DST-009 — Device Detail: ADK Version & Certification Status Tracking**

| Points | 5 |
| :---- | :---- |

User Story: As a Certification Specialist, I can update a device's live ADK version and certification status so that the registry always reflects the version and certification status actually deployed and certified in the field.

**Acceptance Criteria:**

* Each device record has: live\_adk\_version (text), certification\_status (enum: Certified / Pending / In Review / Not Submitted / Deprecated), last\_certified\_date, and certification\_notes.

* Editors can update live\_adk\_version and certification\_status via inline edit on the device detail page.

* The version history table in the device detail shows all previous ADK versions with dates updated (from the audit log).

* Certification status filter available on device list view.

* Devices with status 'Pending' or 'In Review' appear in a Certification Queue accessible from the Admin panel sidebar.

### **DST-010 — Device Deployment: Many-to-Many Partner Deployments**

| Points | 5 |
| :---- | :---- |

User Story: As a P\&D PM, I need to understand that the same physical hardware (e.g., the Humax EOSv2/2008c-stb) is deployed by multiple partners in different countries, so I don't confuse hardware specs with partner deployments.

**Acceptance Criteria:**

* Data model supports device\_deployments join table: device\_id, partner\_key, country\_iso2, deployment\_status (Active / Deprecated), deployed\_adk\_version.

* The device detail page shows a 'Deployed By' table listing all partner and country combinations where this hardware is active.

* When the same device\_id appears under multiple partner\_keys in Datadog, they are linked to the same device record and shown as separate deployment rows.

* EOSv2 (2008c-stb) correctly shows 5 deployment rows: VodafoneZiggo (NL), Virgin Media O2 (UK), Telenet (BE), Sunrise (CH), Virgin Media (IE).

### **DST-011 — Unregistered Device Alert: Datadog Devices Not in Registry**

| Points | 6 |
| :---- | :---- |

User Story: As an Admin, I want to be alerted whenever a Datadog CSV upload contains a partner key or device ID that lacks a registry record, so the registry remains complete without manual cross-referencing.

**Acceptance Criteria:**

* After each Datadog CSV upload, a diff is computed: any partner\_key or device\_id in the upload that is not found in the registry triggers an ‘Unregistered Device’ alert.

* Unregistered alerts are listed in the Admin panel with partner\_key, device\_id, first-seen date, and unique device count (so low-traffic test devices can be deprioritized).

* Admin can dismiss an alert (with reason: 'Test Device', 'Duplicate Key', 'Will Register'), which suppresses it from future diffs.

* Dismissed alerts remain in the log with the dismissal reason and user.

* Initial run of this story against the current Datadog export should surface the 57 currently unmapped devices for triage.

  **THEME 3 — Hardware Spec Ingestion**

### **DST-012 — Spec Entry UI: Structured Hardware Spec Form**

| Points | 8 |
| :---- | :---- |

User Story: As a TAM or Certification Specialist, I can open a structured form for any device and enter the hardware specs from the partner's questionnaire, so the data is normalized and queryable rather than buried in a spreadsheet.

**Acceptance Criteria:**

* Spec form covers all 12 questionnaire categories from the GM questionnaire template: Device Identity, SoC & Hardware, OS & Middleware, Memory & Storage, GPU & Graphics, Streaming & Platform, Video Output & Display, Firmware & Update Lifecycle, Media Codecs, Frame Rate & Playback, Content Protection / DRM, Hardware Security.

* Each field is typed correctly: numeric inputs for RAM/GPU/CPU values; dropdowns for SoC vendor (Broadcom, Novatek, MediaTek, Amlogic, other), DRM system, OS type; boolean toggles for codec support (AVC, HEVC, E-AC-3, Atmos, HDR10, Dolby Vision); date pickers for firmware timeline fields.

* The form shows the completion percentage and highlights any required fields that are empty.

* 'Source questionnaire' file attachment field accepts PDF/XLS upload and stores the file with the record as a reference artifact.

* 'Source questionnaire URL' field accepts a Google Drive link as an alternative to file upload.

* Partial saves allowed — editors can save incomplete forms and return later.

* Form validates numeric ranges (e.g., RAM cannot be negative; CPU cores must be integers).

### **DST-013 — Spec Categories: Section-by-Section Display on Device Detail**

| Points | 5 |
| :---- | :---- |

User Story: As a P\&D PM or engineer, I can view all hardware specs for a device, organized by category, so I can quickly assess its capabilities without wading through all 90 fields at once.

**Acceptance Criteria:**

* The device detail page renders specs in collapsible sections matching the 12 questionnaire categories.

* Each section shows a completion badge (e.g., '7/9 fields complete') and highlights missing fields in amber.

* Numeric memory values shown in standardized units: MB for app-available RAM/GPU memory, GB for total device memory and storage.

* Boolean codec/HDR/DRM fields shown as green checkmark (supported) or gray dash (not supported / unknown).

* 'Edit Specs' button opens the spec entry form (DST-012) pre-populated with existing values.

### **DST-014 — Spec Coverage Dashboard: Which Devices Are Missing Specs**

| Points | 5 |
| :---- | :---- |

User Story: As a P\&D PM, I want a dashboard view showing spec completeness across the device ecosystem, weighted by field population, so I can prioritize which specs to collect first.

**Acceptance Criteria:**

* The Spec Coverage report shows: total devices, devices with full specs (all key fields), devices with partial specs, and devices with no specs.

* 'Weighted coverage' metric: same as above, but weighted by active device count — so a missing spec on a device with 600K users is surfaced above one with 100 users.

* Table view sortable by: active device count, spec completeness %, partner, and region.

* 'Missing questionnaire' flag for devices where spec data could not be entered because no questionnaire was ever received — shown separately from 'questionnaire received but not entered'.

### **DST-015 — Questionnaire Links: Migrate & Preserve Google Drive References**

| Points | 5 |
| :---- | :---- |

User Story: As any user, I can click directly to the source questionnaire for any device from within DST so that I always have access to the original document while the structured data is being backfilled.

**Acceptance Criteria:**

* All 144 questionnaire URLs from AllModels.csv are migrated to the questionnaire\_url field on the corresponding device records during the Airtable migration (DST-030).

* The device detail page shows a 'Source Questionnaire' link when a URL is present; it opens in a new tab.

* 'No questionnaire on file' badge shown when questionnaire\_url is null, with a CTA to upload or link one.

* Questionnaire link status is shown in the Spec Coverage report (DST-014) as a separate column.

### **DST-016 — Bulk Spec Import: CSV/XLS Upload for Batch Entry**

| Points | 8 |
| :---- | :---- |

User Story: As a TAM or Certification Specialist, I can upload a CSV or XLS file containing spec data for multiple devices at once, so I can populate the registry in bulk rather than entering each device one at a time.

**Acceptance Criteria:**

* Bulk import accepts CSV or XLS with a column header row mapping to device\_id \+ spec field names.

* The import preview step shows matched vs unmatched device\_ids and any validation errors before committing.

* Partial imports allowed — rows with validation errors are skipped and reported; valid rows are committed.

* The import summary shows: rows processed, records updated, records skipped (with reason), and records created (if device\_id is new and flagged).

* Downloadable import template (CSV) available from the Admin panel.

  **THEME 4 — Datadog Telemetry Upload**

### **DST-017 — Datadog CSV Upload: Manual Telemetry Ingestion**

| Points | 8 |
| :---- | :---- |

User Story: As a P\&D PM or Admin, I can upload a CSV file exported from Datadog to refresh device field counts in DST, so the registry reflects current production data without requiring an automated pipeline in Phase 1\.

**Acceptance Criteria:**

* Admin panel includes a ‘Upload Datadog Export’ action that accepts a CSV matching the format of the Datadog Discover export (partner, device, core\_version, count\_unique\_device\_id, count). The expected CSV columns are documented in the UI.

* On upload, rows are written to telemetry\_snapshots with snapshot\_date set to the upload date (Admin can optionally override the snapshot date to match the Datadog export date).

* Aggregated active\_device\_count per device\_id (sum of unique\_device\_id across all versions in the upload) is stored on the device record and updated with each upload.

* Version breakdown (e.g., PS4 on 2025.09.5 \= 234K, PS4 on 2025.09.2 \= 10K) stored in telemetry\_snapshots for detailed version view.

* Upload job logs (success/failure with row counts) to an internal log table; errors (malformed rows, unrecognised columns) are surfaced in the Admin panel with details. Upload history (who uploaded, when, row count) is retained.

* A note in the Admin panel documents that automated nightly ingestion via the Datadog API is planned for Phase 2\. The manual upload workflow is the authoritative approach for Phase 1\.

### **DST-018 — Telemetry Display: Version Breakdown on Device Detail**

| Points | 5 |
| :---- | :---- |

User Story: As a P\&D PM or Certification Specialist, I can see the full ADK version breakdown for a device (how many units are on each version) to understand version adoption and identify stragglers.

**Acceptance Criteria:**

* The device detail page includes a 'Field Telemetry' section showing: total unique devices, breakdown by core\_version (sorted by device count desc), and last upload date.

* Version adoption bar chart showing % of devices on each version (relative to total).

* Historical trend: line chart showing total active device count over the last 90 days (requires 90 days of snapshot data; initially will show as it accumulates).

* For devices where multiple Datadog partner\_keys map to the same device, counts are shown per partner\_key separately and as an aggregate total.

### **DST-019 — Datadog Partner Key Alert: New/Missing Keys on Upload**

| Points | 5 |
| :---- | :---- |

User Story: As an Admin, I want to know when a Datadog CSV upload contains a new partner\_key that isn't in the registry, or when a registered key is absent from the latest upload, so that the partner registry stays accurate.

**Acceptance Criteria:**

* After each Datadog CSV upload, the system compares partner\_keys in the upload against the partner\_keys table. New keys create a 'New Partner Key Detected' alert in the Admin panel.

* If a registered partner\_key is absent from 3 consecutive uploads, a 'Partner Key Inactive' alert is raised.

* Alerts shown in the Admin panel include: key name, first seen/last seen dates, and device count at last sight.

* Admin can resolve alerts by: linking to an existing partner, creating a new partner record, or marking as 'internal test / deprecated'.

### **DST-020 — Telemetry History: Snapshot Retention & Pruning**

| Points | 3 |
| :---- | :---- |

User Story: As an engineer, I need telemetry snapshot data to be retained appropriately and pruned on a schedule so that the database doesn't grow unboundedly from repeated uploads.

**Acceptance Criteria:**

* Telemetry snapshots are retained at full daily granularity for 90 days.

* Snapshots older than 90 days are rolled up to weekly aggregates and retained for 2 years.

* Weekly aggregates older than 2 years are deleted on a monthly cleanup job.

* Retention policy configurable by Admin without code change.

  **THEME 5 — Hardware Tier Scoring**

### **DST-021 — Tier Definition UI: Create & Manage Hardware Tiers**

| Points | 8 |
| :---- | :---- |

User Story: As a P\&D PM, I can define hardware tiers (e.g., Tier 1/Tier 2/Tier 3\) by setting minimum thresholds for RAM, GPU memory, CPU speed, and required codec/DRM support, so that tier assignments are automatic and configurable without engineering changes.

**Acceptance Criteria:**

* Tier definition form allows: tier name, tier rank (integer, lower \= higher tier), minimum RAM available to app (MB), minimum GPU memory (MB), minimum CPU speed (DMIPS or GHz — selectable unit), minimum CPU cores, required codecs (multi-select: AVC, HEVC, Atmos, HDR10, Dolby Vision, Widevine L1, PlayReady SL3000), 64-bit OS required (boolean).

* Multiple tiers supported (minimum 3: Tier 1 / Tier 2 / Tier 3 / Uncategorized).

* Tiers are evaluated in rank order — a device is assigned to the highest tier whose thresholds it meets.

* The 'Preview Impact' button shows how many devices would be assigned to each tier at the current threshold values before saving.

* Tier definitions versioned: changes create a new version with a timestamp; prior versions are retained and viewable. Tier reassignment on save is logged in the audit trail.

* Only the Admin role can create/modify tier definitions.

### **DST-022 — Tier Assignment Engine: Automatic Scoring on Spec Save**

| Points | 5 |
| :---- | :---- |

User Story: As any user, I see a device's hardware tier automatically updated whenever its spec data changes or tier definitions are updated so that tier assignments are always current without manual intervention.

**Acceptance Criteria:**

* Tier assignment is recomputed automatically whenever: (a) device spec fields are saved, or (b) tier definitions are saved.

* The device record stores the current tier\_id and tier\_assigned\_at timestamp.

* Tier badge displayed prominently on device detail and device list views.

* Devices with insufficient spec data to meet any tier are shown as 'Uncategorized — specs incomplete' with specific missing fields highlighted.

* Tier assignment history tracked in device\_tier\_assignments table (device\_id, tier\_id, assigned\_at, trigger: 'spec\_update' or 'tier\_definition\_update').

### **DST-023 — Tier Browser: View All Devices by Tier**

| Points | 5 |
| :---- | :---- |

User Story: As a P\&D PM, I can browse all devices organized by hardware tier to understand the distribution of our device ecosystem and plan feature eligibility accordingly.

**Acceptance Criteria:**

* The Hardware Tiers section of the app shows each tier as a card/panel with the tier name, threshold summary, device count, and active device count (from telemetry).

* Expanding a tier card shows all assigned devices, including name, partner, active device count, and key spec values (RAM, GPU, SoC).

* 'Uncategorized' tier is always shown at the bottom with the count of devices missing sufficient spec data.

* Tier distribution pie/donut chart showing % of active devices in each tier (weighted by field population, not device count).

* 'What tier does a device meet?' tool: enter hypothetical spec values and see which tier they qualify for — useful for partner device planning.

### **DST-024 — Tier Impact Report: Feature Eligibility by Tier**

| Points | 5 |
| :---- | :---- |

User Story: As a P\&D PM planning a new feature with a minimum hardware requirement, I can enter the minimum RAM, GPU, and codec requirements for that feature and immediately see which devices and what percentage of the active field population would be eligible.

**Acceptance Criteria:**

* 'Feature Eligibility Simulator' tool: input form accepting minimum values for any spec fields (RAM, GPU, CPU, codecs, DRM).

* Results show: devices that meet all requirements (with names, partners, active device count), devices that fail (with which requirements they fall short of), total eligible active devices, and % of total NCP/ADK field.

* Results exportable to CSV.

* Simulation results are read-only and do not affect tier definitions or assignments.

### **DST-025 — Codec & DRM Capability Views: Cross-Device Filtering**

| Points | 5 |
| :---- | :---- |

User Story: As an engineer or PM, I can filter the device catalog by codec and DRM capabilities (e.g., 'show all devices that support Dolby Vision AND Widevine L1') so that I can quickly identify the addressable device population for a specific content or playback feature.

**Acceptance Criteria:**

* The device list filter panel includes a 'Capabilities' section with boolean toggles for: AVC, HEVC, E-AC-3, Dolby Atmos, HDR10, HDR10+, HLG, Dolby Vision, Widevine L1, Widevine L3, PlayReady SL3000, PlayReady SL2000, HDCP 2.x, and 64-bit OS.

* Multiple capability filters are combined using AND logic (all selected must be true).

* Results count updates in real time as filters are toggled.

* The result set shows the active device count total for all matching devices.

  **THEME 6 — Search, Browse & Reporting**

### **DST-026 — Global Search: Instant Lookup Across All Entities**

| Points | 5 |
| :---- | :---- |

User Story: As any user, I can type a device name, device ID, partner name, or Datadog key into the global search bar and immediately navigate to the matching record, so finding anything in the system takes seconds.

**Acceptance Criteria:**

* The persistent search bar in the top navigation is available on all pages.

* Search indexes: device display name, device\_id, partner display name, partner\_key.

* Results appear in a dropdown as the user types (debounced at 200ms), grouped by entity type: Devices, Partners.

* Clicking a result navigates directly to that entity's detail page.

* A Datadog slug search query (e.g., 'titan\_novatek') returns both the partner\_key record and the associated devices.

### **DST-027 — Partner Report: Coverage & Health by Partner**

| Points | 5 |
| :---- | :---- |

User Story: As a P\&D PM or TAM, I can view a report for any partner that shows their full device inventory, spec completeness, ADK version adoption, and active device trends, so I have everything I need before a partner meeting.

**Acceptance Criteria:**

* The partner report is accessible from the partner detail page and from the Reports section.

* Report sections: Device Inventory (all devices, status, ADK version), Spec Coverage (% complete by device), Telemetry Summary (total active devices, MoM trend), Hardware Tier Distribution (devices by tier for this partner), Certification Status Summary.

* Report renders as a web page and is exportable to PDF (for partner meetings) and CSV (for data analysis).

### **DST-028 — Ecosystem Overview Dashboard**

| Points | 5 |
| :---- | :---- |

User Story: As a P\&D PM, I want a home dashboard that shows key numbers across the NCP/ADK ecosystem, providing an at-a-glance view for check-ins and executive communications.

**Acceptance Criteria:**

* Home dashboard KPI cards: Total Active Devices (NCP+ADK), Total Devices in Registry, Spec Coverage % (weighted), Devices Certified / Pending / Uncertified, Unregistered Device Alerts (badge count).

* Ecosystem map: a world map with dots or choropleth shading showing active device density by country (using telemetry and partner-country data).

* Top 20 devices by active device count with tier badge and partner name.

* ADK version adoption bar chart across all devices.

* Dashboard data refreshes on each page load (no manual refresh needed).

### **DST-029 — Export: CSV & PDF for Any Report View**

| Points | 4 |
| :---- | :---- |

User Story: As a P\&D PM or TPM, I can export any device list or report to CSV or PDF so that I can share it in presentations, send it to engineering leads, or include it in partner communications.

**Acceptance Criteria:**

* 'Export CSV' button available on: device list (with current filters applied), partner report, spec coverage report, tier browser, feature eligibility simulator results.

* 'Export PDF' button available on: partner report (formatted for sharing), tier browser summary.

* Exports include a header row with field names and a footer row with a generated\_at timestamp.

* CSV exports use UTF-8 with BOM for Excel compatibility.

### **DST-030 — Region & Country Views**

| Points | 5 |
| :---- | :---- |

User Story: As a P\&D PM, I can filter and view the device ecosystem by region (EMEA, LATAM, APAC, NA) and country so that I can understand regional hardware distribution for initiatives like Hotstar enablement and Kepler rollout.

**Acceptance Criteria:**

* Region filter available on device list, partner list, and spec coverage report.

* Countries displayed with ISO 3166-1 alpha-2 codes and flag emoji (consistent with AllModels format).

* Region breakdown summary card on home dashboard showing active devices by region.

* Country filter accepts free text or dropdown; supports multi-select.

  **THEME 7 — Airtable Migration & Sync**

### **DST-031 — One-Time Migration: AllModels to DST Registry**

| Points | 5 |
| :---- | :---- |

User Story: As an Admin, I need all existing device records from the Airtable AllModels base migrated to DST at launch so that we start with a complete registry rather than an empty one.

**Acceptance Criteria:**

* The migration script reads all 212 rows from the AllModels CSV (and the live Airtable base at migration time) and creates corresponding device records in DST.

* Column mapping: Device (display name), Device ID → device\_id, Vendor → oem, Region, Country, Device Type, Live ADK Version, 64 bit (boolean), DRM, Tech Questionnaire URL, Partner (looked up against partner\_keys table).

* Rows with blank Device ID flagged for manual review and imported with a 'device\_id\_missing' status.

* Duplicate device\_id values (same hardware, multiple partners) consolidated into one device record with multiple deployment rows (per DST-010).

* Migration produces a reconciliation report: records imported, records flagged, records skipped (with reasons).

* Migration is idempotent — re-running it does not create duplicate records.

### **DST-032 — Airtable Sync: Phase 2 Bidirectional Sync**

| Points | 5 |
| :---- | :---- |

User Story: As an Admin, I can enable bidirectional sync between DST and Airtable in Phase 2 so that both systems stay in sync during the extended transition period, given that Airtable is embedded in production workflows and full cutover is not yet planned.

**Acceptance Criteria:**

* Phase 2 feature. Configurable bidirectional sync job (can be enabled/disabled from Admin panel without code deploy) running on a scheduled cadence.

* Sync writes device name, live ADK version, active device count, certification status, and tier back to corresponding Airtable records.

* Airtable records are matched by the device\_id field; unmatched DST records are skipped (not created in Airtable).

* Sync log shows rows pushed, rows skipped, and errors.

* Sync direction is configurable: DST → Airtable only (default for the Phase 2 launch), or bidirectional with conflict-resolution rules (last-write-wins by default). Full Airtable cutover remains a future-state decision; this sync is designed to coexist indefinitely.

### **DST-033 — Phase 1 Readiness Checklist & Airtable Transition Plan**

| Points | 3 |
| :---- | :---- |

User Story: As a P\&D PM, I need a defined set of criteria that must be met before DST is considered the primary system of record so that we can transition teams confidently without forcing an immediate Airtable cutover.

**Acceptance Criteria:**

* Phase 1 readiness criteria documented and tracked in Admin panel: (1) All AllModels devices migrated, (2) At least one successful Datadog CSV upload with no processing errors, (3) All Certification Team members onboarded and trained, (4) Spec coverage ≥ 80% by active device count, (5) Tier definitions reviewed and approved by P\&D PM.

* Checklist shown in the Admin panel with the current status of each criterion (green/amber/red).

* 'Declare Phase 1 Complete' Admin action marks DST as the primary source of record and records the timestamp. Airtable continues operating in parallel; the Phase 2 bidirectional sync (DST-032) is the mechanism for keeping Airtable current. Full Airtable cutover is an explicit future decision, not automatic.

### **DST-034 — Team Onboarding: In-App Guide & Contextual Help**

| Points | 5 |
| :---- | :---- |

User Story: As a new user from the TAM, Certification, or PM team, I can quickly get up to speed on using DST, so adoption is not blocked by a lack of training.

**Acceptance Criteria:**

* First-login welcome modal with 5-step overview: what DST is, how to find a device, how to enter specs, how to read tiers, how to run reports.

* Contextual help tooltips on spec form fields explaining what each field means and where to find the value in a partner questionnaire.

* In-app link to a Confluence 'DST User Guide' page (to be authored by PM team, not in scope of this story to author — just the link and tooltip framework).

* 'What does this tier mean?' expandable info panel on device detail pages.

# **Appendix — Story Summary & Sequencing**

| ID | Title | Theme | Points | Dependencies |
| :---- | :---- | :---- | :---- | :---- |
| **DST-001** | Database Schema & Migrations | T1 | 8 | — |
| **DST-002** | API Scaffold: Core CRUD | T1 | 8 | DST-001 |
| **DST-003** | Authentication: Google OAuth (disney.com) | T1 | 5 | DST-002 |
| **DST-004** | CI/CD Pipeline & Deployment | T1 | 5 | DST-001 |
| **DST-005** | React App Shell & Navigation | T1 | 5 | DST-003 |
| **DST-006** | Audit Log | T1 | 3 | DST-002 |
| **DST-007** | Partner Registry | T2 | 5 | DST-005 |
| **DST-008** | Device Registry: View, Search, Add | T2 | 8 | DST-007 |
| **DST-009** | ADK Version & Cert Status | T2 | 5 | DST-008 |
| **DST-010** | Many-to-Many Partner Deployments | T2 | 5 | DST-007 |
| **DST-011** | Unregistered Device Alerts | T2 | 6 | DST-017 |
| **DST-012** | Spec Entry UI (90-field form) | T3 | 8 | DST-008 |
| **DST-013** | Spec Category Display on Detail | T3 | 5 | DST-012 |
| **DST-014** | Spec Coverage Dashboard | T3 | 5 | DST-013 |
| **DST-015** | Questionnaire Links Migration | T3 | 5 | DST-031 |
| **DST-016** | Bulk Spec Import (CSV/XLS) | T3 | 8 | DST-012 |
| **DST-017** | Datadog CSV Upload | T4 | 8 | DST-001 |
| **DST-018** | Telemetry Display on Device Detail | T4 | 5 | DST-017 |
| **DST-019** | Partner Key Sync Alerts | T4 | 5 | DST-017 |
| **DST-020** | Snapshot Retention & Pruning | T4 | 3 | DST-017 |
| **DST-021** | Tier Definition UI | T5 | 8 | DST-012 |
| **DST-022** | Tier Assignment Engine | T5 | 5 | DST-021 |
| **DST-023** | Tier Browser | T5 | 5 | DST-022 |
| **DST-024** | Feature Eligibility Simulator | T5 | 5 | DST-022 |
| **DST-025** | Codec & DRM Capability Filters | T5 | 5 | DST-012 |
| **DST-026** | Global Search | T6 | 5 | DST-008 |
| **DST-027** | Partner Report | T6 | 5 | DST-018 |
| **DST-028** | Ecosystem Overview Dashboard | T6 | 5 | DST-018 |
| **DST-029** | Export: CSV & PDF | T6 | 4 | DST-008 |
| **DST-030** | Region & Country Views | T6 | 5 | DST-008 |
| **DST-031** | One-Time AllModels Migration | T7 | 5 | DST-007 |
| **DST-032** | Airtable Sync: Phase 2 Bidirectional | T7 | 5 | DST-031 |
| **DST-033** | Cutover Readiness Checklist | T7 | 3 | DST-031 |
| **DST-034** | Team Onboarding & In-App Help | T7 | 5 | DST-005 |
| **TOTAL** | **34 stories** | **7 themes** | **185 pts** |  |

## **Phase 2 Backlog (Out of Scope — Phase 1\)**

* Partner-facing questionnaire intake portal with public, time-limited submission links.

* AI-assisted questionnaire parsing: upload a partner XLS and auto-extract spec fields using LLM extraction.

* Expansion to Roku, Android TV, Fire TV native, Apple TV, iOS, Web, and BBD device platforms.

* Feature flag integration: connect the hardware tier directly to the feature flag system so tier assignments automatically gate feature delivery.

* Automated DRM compliance check: validate PlayReady SL3000 / Widevine L1 presence against Disney content protection requirements.

* Partner notification workflows: automated email to TAM when a device misses a certification SLA.

* Two-way Google Drive integration: monitor a folder for new questionnaire files and automatically create intake tasks.

* Datadog automated nightly sync: replace the manual CSV upload workflow with a scheduled API-driven ingestion job once the POC is migrated from Firebase to enterprise infrastructure.

* Disney SSO / Okta authentication: replace Google OAuth domain-restricted auth with full enterprise Okta OIDC integration; role assignment via Okta group membership; migration from Firebase Auth to enterprise identity provider.

* Airtable bidirectional sync (DST-032): automated sync between DST and Airtable to keep both systems current during the extended parallel-operation period. Full Airtable cutover is a future-state decision to be made after Phase 2 validation.

* Firebase to enterprise migration: move hosting, auth, and data store from Firebase to Disney's internal cloud infrastructure with enterprise CI/CD pipeline.

[image1]: <data:image/png;base64,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>