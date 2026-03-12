# AGENTS.md — Device Source of Truth (DST)

Platform-agnostic instructions for AI coding agents working on the DST codebase. Read this before making changes.

## 1. Repository Overview

### What This Project Is
DST is an internal Disney Streaming tool that consolidates NCP/ADK partner device data — hardware specs, partner relationships, deployment counts, ADK versions, and DRM compliance — into a single queryable system of record. It replaces data scattered across Datadog, Airtable, Google Drive, and spreadsheets.

The product spec lives in `specs/Device Source of Truth (DST).md` (877 lines). Read it for full business context.

### Architecture Overview
```
React SPA (Vite + Tailwind)  →  Firebase Cloud Functions (Express REST API)  →  Firestore
     ↓                                    ↓
Firebase Auth (Google OAuth)      Firebase Storage (questionnaire files)
Firebase Analytics (GA4)
Firebase Hosting (static SPA)
```

**No separate servers.** Everything runs inside one Firebase project (`device-source-of-truth`).

- Frontend: React 19 + TypeScript + Tailwind CSS 4, built with Vite 7
- Backend: Express 5 app exported as a Firebase Cloud Function named `api`, plus a Cloud Tasks function `extractDeviceTask` for async AI extraction
- Database: Firestore (28 collections)
- AI: Anthropic Claude API (claude-sonnet-4-6) for import disambiguation and questionnaire field extraction
- Auth: Firebase Auth with Google OAuth, domain-restricted to `@disney.com` and `@disneystreaming.com`

### Directory Structure
```
/
├── src/                          ← React frontend
│   ├── App.tsx                   ← Router, auth guards, lazy-loaded routes
│   ├── main.tsx                  ← Entry point
│   ├── index.css                 ← Tailwind imports + global styles
│   ├── pages/                    ← 28 route-level page components
│   ├── components/
│   │   ├── layout/               ← AppShell (sidebar + topbar), GlobalSearch
│   │   ├── shared/               ← DataTable, Badge, Modal, FilterPanel, Logo, etc.
│   │   ├── specs/                ← SpecFormFields (reusable form inputs)
│   │   └── onboarding/           ← WelcomeModal (first-login wizard)
│   ├── hooks/
│   │   ├── useAuth.tsx           ← AuthProvider + useAuth() hook
│   │   ├── useAppUpdate.ts       ← Dual-path update detection (SW + version polling)
│   │   ├── useAIPassStatus.ts    ← AI pass status reducer for import disambiguation (DST-051)
│   │   ├── useFieldOptions.tsx   ← Field options context provider for spec dropdowns
│   │   └── useImportPrerequisites.tsx ← Shared context for prerequisite checks (partners/keys exist)
│   └── lib/
│       ├── firebase.ts           ← Firebase client SDK init (Auth, Firestore, Analytics)
│       ├── api.ts                ← Typed fetch wrapper for /api/* endpoints
│       ├── analytics.ts          ← Typed GA4 event tracking (no-op in dev)
│       ├── analyticsParams.ts    ← GA4 event parameter definitions
│       ├── analyticsRoutes.ts    ← Route path → analytics page title mapping
│       ├── export.ts             ← CSV/PDF export utilities
│       ├── format.ts             ← Shared formatting helpers (formatDate, formatDateTime, formatNumber, formatRelativeTime, getFreshnessState)
│       ├── questionnaireFields.ts ← Questionnaire field key → DST spec field mappings
│       └── types.ts              ← Frontend-layer TypeScript interfaces (re-exports from @dst/contracts + frontend-only types)
│
├── functions/                    ← Firebase Cloud Functions (backend)
│   ├── src/
│   │   ├── index.ts              ← Express app + extractDeviceTask Cloud Tasks function
│   │   ├── middleware/auth.ts    ← Token verification, domain check, role guard
│   │   ├── routes/               ← 18 Express routers
│   │   ├── services/             ← Business logic (audit, tierEngine, specCompleteness, intakeParser, aiDisambiguate, aiImportFramework, seedFieldOptions, questionnaireParser, questionnaireExtractor, partnerResolver, partnerAliasResolver, coercion, safeNumber, storage, logger)
│   │   └── types/index.ts        ← Backend type definitions (mirrors src/lib/types.ts)
│   ├── package.json              ← Separate deps (firebase-admin, express, xlsx, etc.)
│   └── tsconfig.json
│
├── packages/
│   └── contracts/
│       └── src/index.ts          ← Canonical shared types & Zod schemas (~1250 lines)
│
├── public/
│   ├── favicon.svg               ← SVG favicon
│   └── og-image.png              ← Open Graph social preview image
├── specs/                        ← Product specs and feature stories
├── tests/                        ← Standard placeholder (main suites in root and functions/)
├── plans/                        ← Feature rollout and migration plans
├── rules/                        ← Repository-level binding constraints
├── docs/                         ← Extended documentation
├── config/                       ← Application configuration files
├── mappings/                     ← Data mapping files for partner/device data transformations
├── scripts/
│   ├── check-no-public-secrets.mjs  ← Secret scanning (runs as part of npm test)
│   ├── ui-consistency-check.mjs     ← UI pattern consistency validation
│   └── ci/                          ← CI enforcement scripts
├── firebase.json                 ← Hosting rewrites + functions + firestore config
├── firestore.rules               ← Firestore security rules (28 collections)
├── storage.rules                 ← Firebase Storage security rules
├── .env / .env.example           ← Firebase API keys (3 vars, all VITE_ prefixed)
├── .env.op                       ← 1Password references for deploy auth (op:// URIs, safe to commit)
├── functions/.env.tpl            ← 1Password secret references (op:// URIs, safe to commit)
└── vite.config.ts                ← Vite + Tailwind + code-split config
```

### Data Model (Firestore Collections)

| Collection | Purpose | Key Fields |
|---|---|---|
| `partners` | Canonical partner brands | displayName, regions[], countriesIso2[] |
| `partnerKeys` | Datadog slugs → partner mapping | key (unique), partnerId, chipset, oem |
| `devices` | One row per hardware model | deviceId (unique, Datadog join key), partnerKeyId, certificationStatus, activeDeviceCount, lastTelemetryAt, specCompleteness, tierId |
| `deviceSpecs` | ~260 typed hardware spec fields | deviceId (1:1), 16 category sub-objects |
| `deviceDeployments` | Many-to-many: device × partner × country | deviceId, partnerKeyId, countryIso2, deploymentStatus |
| `telemetrySnapshots` | Periodic Datadog field counts | partnerKey, deviceId, coreVersion, uniqueDevices, snapshotDate |
| `hardwareTiers` | Tier definitions (Tier 1/2/3) | tierName, tierRank, ramMin, gpuMin, requiredCodecs[] |
| `deviceTierAssignments` | Tier assignment history | deviceId, tierId, trigger |
| `auditLog` | Append-only change log | entityType, entityId, field, oldValue, newValue, userId |
| `alerts` | Unregistered device/key alerts | type, partnerKey, deviceId, status, dismissReason |
| `uploadHistory` | Telemetry upload log | uploadedBy, fileName, rowCount, successCount |
| `users` | Role assignments | email, role (viewer/editor/admin), displayName, photoUrl, lastLogin, updatedAt, updatedBy |
| `config` | App-level settings | retentionDailyDays, retentionWeeklyYears |
| `fieldOptions` | Controlled vocabulary dropdown options | dropdownKey, displayLabel, displayValue, sortOrder, isActive |
| `partnerKeyImportBatches` | Partner key CSV import history | importedBy, fileName, keyCount, status |
| `intakeRequests` | Airtable intake request records | requestType, partnerName, region, tamOwner, batchId |
| `intakeRequestPartners` | Intake request → partner links | intakeRequestId, partnerId, matchType |
| `intakeImportHistory` | Intake CSV import history | importedBy, fileName, rowCount, status |
| `questionnaireIntakeJobs` | Questionnaire file upload/parse/extraction jobs | fileName, fileStoragePath, submitterPartnerId, isMultiPartner, questionnaireFormat, status, aiExtractionMode, extractionStep, extractionCurrentDevice, devicesComplete, devicesFailed, tasksEnqueued, notificationSentAt |
| `questionnaireStagedDevices` | Devices detected from a questionnaire file | intakeJobId, rawHeaderLabel, platformType, matchedDeviceId, reviewStatus, extractionStatus |
| `questionnaireStagedFields` | Individual Q/A pairs extracted per device | stagedDeviceId, dstFieldKey, rawQuestionText, extractedValue, conflictStatus, resolution |
| `deviceQuestionnaireSources` | Links devices to questionnaire jobs that populated their specs | deviceId, intakeJobId, partnerId, fieldsImported, fieldsOverridden |
| `questionnaireIntakePartners` | Detected operating brands per multi-partner intake job | intakeJobId, partnerId, rawDetectedName, detectionSource, matchConfidence, reviewStatus, deviceCount |
| `questionnaireStagedDevicePartners` | Per-device partner deployment links within a staged intake | stagedDeviceId, intakePartnerId, countries, certificationStatus, certificationAdkVersion, partnerModelName, reviewStatus |
| `devicePartnerDeployments` | Committed device × partner deployment records | deviceId, partnerId, countries, partnerModelName, certificationStatus, certificationAdkVersion, active, sourceIntakeJobId |
| `notifications` | In-app notifications for admins | recipientRole, title, body, link, read |
| `coreVersionMappings` | Core version → friendly version lookup | coreVersion, friendlyVersion, platform, isActive |
| `partnerAliases` | Alternative partner names → canonical partner | alias, partnerId, resolutionType, contextRules, isActive |

---

## 2. Agent Operating Rules

### Key Files to Read First

1. **`packages/contracts/src/index.ts`** — The canonical source of truth for all shared data types and Zod schemas. Every Firestore entity, every API request/response shape, every spec category is defined here. `src/lib/types.ts` and `functions/src/types/index.ts` re-export from this package. Read this first.
2. **`functions/src/index.ts`** — Express app structure and all route mounts.
3. **`functions/src/middleware/auth.ts`** — How authentication and role-based access control works.
4. **`src/App.tsx`** — All client-side routes and their auth guards (ProtectedRoute, EditorRoute, AdminRoute).
5. **`src/hooks/useAuth.tsx`** — How the frontend resolves the current user and their role.

### API Routes

All routes are prefixed with `/api` and require a valid Firebase Auth Bearer token. The `authenticate` middleware in `functions/src/middleware/auth.ts` runs on every request.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /partners | any | List partners with stats |
| POST | /partners | editor+ | Create partner |
| GET | /partners/:id | any | Partner detail |
| PUT | /partners/:id | editor+ | Update partner |
| DELETE | /partners/:id | admin | Delete partner |
| GET | /partner-keys | any | List partner keys (`exactKey` param for single-key lookup) |
| POST | /partner-keys | admin | Create partner key |
| GET | /devices | any | List devices (paginated, filterable, searchable) |
| POST | /devices | editor+ | Register new device |
| GET | /devices/:id | any | Full device detail |
| PUT | /devices/:id | editor+ | Update device |
| GET | /device-specs/:deviceId | any | Get specs for a device |
| PUT | /device-specs/:deviceId | editor+ | Create/update specs (triggers tier recalculation) |
| GET | /tiers | any | List tier definitions |
| POST | /tiers | admin | Create tier |
| PUT | /tiers/:id | admin | Update tier (triggers full reassignment) |
| POST | /tiers/preview | admin | Preview tier impact without saving |
| POST | /tiers/simulate | any | Feature eligibility simulator |
| POST | /telemetry/upload | admin | Upload Datadog CSV |
| GET | /telemetry/history | any | Upload history |
| GET | /alerts | any | List alerts (pageSize up to 2000) |
| PUT | /alerts/:id/dismiss | admin | Dismiss alert with reason |
| GET | /audit | any | Audit log (filterable) |
| GET | /search?q= | any | Global search across devices, partners, keys |
| GET | /reports/dashboard | any | Dashboard KPIs |
| GET | /reports/partner/:id | any | Partner report |
| GET | /reports/spec-coverage | any | Spec coverage report |
| POST | /upload/migration | admin | AllModels CSV migration |
| GET | /upload/migration/history | admin | Migration batch history |
| DELETE | /upload/migration/rollback/:batchId | admin | Rollback a migration batch |
| GET | /upload/migration/template | any | Download migration CSV template |
| POST | /upload/bulk-specs | editor+ | Bulk spec import |
| GET | /upload/bulk-specs/template | any | Download bulk spec CSV template |
| DELETE | /upload/clear-all | admin | Clear all imported data |
| GET | /partner-keys/:id | any | Get partner key detail |
| PUT | /partner-keys/:id | admin | Update partner key |
| DELETE | /partner-keys/:id | admin | Delete partner key |
| POST | /partner-keys/import/preview | admin | Preview partner key CSV import |
| POST | /partner-keys/import/confirm | admin | Confirm partner key CSV import |
| GET | /partner-keys/import-batches | admin | List partner key import batches |
| POST | /partner-keys/import-batches/:id/rollback | admin | Rollback a partner key import |
| DELETE | /telemetry/rollback/:batchId | admin | Rollback a telemetry upload |
| POST | /intake/preview | admin | Preview Airtable intake CSV |
| POST | /intake/import | admin | Import intake request records |
| GET | /intake | any | List intake requests |
| GET | /intake/history | any | Intake import history |
| GET | /intake/:id | any | Get intake request detail |
| DELETE | /intake/rollback/:batchId | admin | Rollback an intake import |
| POST | /import/disambiguate | admin | AI disambiguation pass on parsed import rows (DST-039) |
| POST | /import/disambiguate/resolve | admin | Apply admin answers to AI clarification questions |
| POST | /questionnaire-intake | editor+ | Upload questionnaire file, create job, parse, optionally trigger AI extraction |
| GET | /questionnaire-intake | any | List questionnaire intake jobs |
| GET | /questionnaire-intake/:id | any | Get intake job detail with staged device summaries |
| POST | /questionnaire-intake/:id/trigger-extraction | editor+ | Manually trigger AI extraction |
| GET | /questionnaire-intake/:id/staged-devices | any | All staged devices with extracted fields |
| GET | /questionnaire-intake/:id/download | any | Generate signed URL for source file download |
| GET | /questionnaire-intake/:id/review | any | Full review state |
| PATCH | /questionnaire-intake/:id | admin | Update intake job (partner assignment) |
| PATCH | /questionnaire-intake/:id/staged-devices/:deviceId | admin | Update staged device |
| PATCH | /questionnaire-intake/:id/staged-devices/:deviceId/fields/:fieldId | admin | Update field resolution |
| PATCH | /questionnaire-intake/:id/staged-devices/:deviceId/resolve-all | admin | Bulk resolve conflicts |
| POST | /questionnaire-intake/:id/approve | admin | Commit approved devices to catalog (atomic transaction) |
| POST | /questionnaire-intake/:id/reject | admin | Reject entire intake job |
| POST | /questionnaire-intake/:id/retry-device/:deviceId | editor+ | Retry AI extraction for a single failed device (DST-052) |
| GET | /questionnaire-intake/notifications/list | any | List in-app notifications |
| PATCH | /questionnaire-intake/notifications/:id/read | any | Mark notification as read |
| PATCH | /questionnaire-intake/:id/intake-partners/:intakePartnerId | admin | Update intake partner |
| PUT | /questionnaire-intake/:id/staged-devices/:deviceId/deployments | admin | Replace partner deployment links |
| GET | /questionnaire-intake/device-sources/:deviceId | any | Get questionnaire sources for a device |
| GET | /questionnaire-intake/device-deployments/:deviceId | any | Get partner deployments for a committed device |
| GET | /questionnaire-intake/partner-deployments/:partnerId | any | Get devices deployed by a partner |
| GET | /field-options | any | List dropdown key summaries |
| GET | /field-options/all | any | Bulk fetch all field options grouped by key |
| GET | /field-options/key/:dropdownKey | any | Get options for a specific dropdown |
| POST | /field-options | admin | Create a field option |
| PUT | /field-options/:id | admin | Update a field option |
| PUT | /field-options/reorder/:dropdownKey | admin | Reorder options within a dropdown |
| DELETE | /field-options/:id | admin | Soft-delete a field option |
| GET | /field-options/:id/usage | admin | Count device specs using this option |
| POST | /field-options/seed | admin | Seed default field options |
| GET | /version-mappings | any | List core version → friendly version mappings |
| POST | /version-mappings | admin | Create a version mapping |
| PUT | /version-mappings/:id | admin | Update a version mapping |
| GET | /version-mappings/unmapped | any | List core versions with no friendly mapping |
| GET | /version-mappings/friendly-versions | any | Distinct active friendly versions |
| GET | /version-mappings/usage/:id | any | Count telemetry rows using a mapping |
| POST | /version-mappings/seed | admin | Seed default version mappings |
| GET | /users | admin | List all users with roles |
| PATCH | /users/:id/role | admin | Update a user's role (transactional last-admin guard) |
| GET | /partner-aliases | any | List partner aliases |
| POST | /partner-aliases | admin | Create a partner alias |
| PUT | /partner-aliases/:id | admin | Update a partner alias |
| PUT | /partner-aliases/:id/deactivate | admin | Deactivate a partner alias |
| POST | /partner-aliases/seed | admin | Seed default partner aliases |

### Role System

Three roles, checked by `requireRole()` middleware on the backend and `useAuth()` on the frontend:

| Role | Can Do |
|---|---|
| `viewer` | Read all data, run simulations, use search |
| `editor` | Everything viewer can do + create/edit devices, specs, partners |
| `admin` | Everything editor can do + manage tiers, upload telemetry, manage partner keys, import intake requests, run migrations, dismiss alerts, rollback imports, review/approve/reject questionnaire imports, manage user roles |

Roles are stored in the `users` Firestore collection. A user doc is auto-provisioned with `role: 'viewer'` on first login. Admins manage roles in-app via `/admin/users`. Guardrails prevent self-demotion (403) and last-admin removal (409, Firestore transaction). Role changes take effect on the affected user's next API request.

### Frontend Conventions

- **Routing:** All routes defined in `src/App.tsx`. Pages are lazy-loaded via `React.lazy()`.
- **Auth guards:** `ProtectedRoute` (requires login), `EditorRoute` (requires editor+), `AdminRoute` (requires admin).
- **State management:** No external state library. `useState` + `useEffect` for data fetching. Auth state via React Context.
- **API calls:** Always use `api.*` from `src/lib/api.ts`. It auto-attaches the Firebase Auth Bearer token.
- **Styling:** Tailwind CSS utility classes only. No CSS modules, no styled-components.
- **Icons:** `lucide-react` exclusively.
- **Charts:** `recharts` for all data visualizations.
- **Date formatting:** Use `formatDate()`, `formatDateTime()`, `formatRelativeTime()` from `src/lib/format.ts`. Use `getFreshnessState()` for freshness classification. Do not use inline `toLocaleString()`.
- **Analytics:** Use `trackEvent()` from `src/lib/analytics.ts` (no-op in dev).
- **Exports:** Use `exportToCsv()` and `exportToPdf()` from `src/lib/export.ts`.
- **Destructive actions:** Confirm buttons must use `bg-red-600 hover:bg-red-700` (not primary indigo).
- **Button tokens:** Use `rounded-lg` and `bg-indigo-600 hover:bg-indigo-700` for primary buttons.
- **Responsive shell:** `AppShell` is mobile-responsive. Below `lg:` the sidebar collapses; a hamburger opens it as a slide-over.
- **`LoadingSpinner`:** Without `inline`, wraps in `<div className="flex items-center justify-center p-12">` — for full-page states. Inside buttons, always pass `inline` prop to avoid button size inflation.

#### Shared Components Reference
- `DataTable`, `Badge`, `Modal`, `FilterPanel`, `EmptyState`, `LoadingSpinner`, `Tooltip` — general purpose
- `ClarificationPanel`, `AIPassStatusPanel` — AI disambiguation import UI (DST-051)
- `ExtractionStatusPanel` — questionnaire AI extraction with 4-step stepper and retry (DST-052)
- `PrerequisiteBanner` — warns when required data (partners/keys) is missing before import flows
- `VersionInput` — core-version text input with friendly-version resolution
- `FreshnessBadge` — color-coded freshness dot + text; `compact` prop for dot-only in table cells (DST-053)
- `FreshnessMicroPanel` — hover card with freshness details (150ms show / 100ms hide, keyboard accessible)
- `Logo` — device-cloud SVG inline with `fill="currentColor"`
- `UpdateBanner` — new-version detection via service worker + version polling; renders in AppShell header

### Backend Conventions

- **All routes** in `functions/src/routes/*.ts` export a default Express `Router`.
- **Firestore access:** Always use `admin.firestore()` (Admin SDK, bypasses security rules).
- **Audit logging:** Call `diffAndLog()` or `logAuditEntry()` from `functions/src/services/audit.ts` on every mutation.
- **Tier recalculation:** After saving specs, call `assignTierToDevice(deviceId)`. After saving tier definitions, call `reassignAllDevices()`.
- **Spec completeness:** After saving specs, call `calculateSpecCompleteness()` and update `specCompleteness` on the device doc.
- **ESM:** Backend uses ES modules. All imports must use `.js` extensions.
- **Error handling:** Wrap route handlers in try/catch, return `{ error, detail }` JSON with appropriate status codes.

### Common Tasks

#### Adding a new Firestore collection
1. Add the TypeScript interface to `packages/contracts/src/index.ts`
2. Re-export the type in both `src/lib/types.ts` and `functions/src/types/index.ts`
3. Add Firestore rules for the collection in `firestore.rules`
4. Create the route file in `functions/src/routes/`
5. Mount the router in `functions/src/index.ts`
6. Add API client methods in `src/lib/api.ts`

#### Adding a new page
1. Create the page component in `src/pages/`
2. Add the route in `src/App.tsx` (with appropriate auth guard)
3. Add a lazy import at the top of `App.tsx`
4. Add a nav item in `src/components/layout/AppShell.tsx` if it should appear in the sidebar
5. Page views are tracked automatically by `PageViewTracker` in `App.tsx`

#### Adding a new API endpoint
1. Add the route handler in the appropriate `functions/src/routes/*.ts` file
2. Use `requireRole()` middleware if the endpoint requires specific permissions
3. Add audit logging for mutations via `diffAndLog()` or `logAuditEntry()`
4. Add the corresponding method in `src/lib/api.ts`

### Important Behaviors to Know

1. **Two separate `package.json` files.** Root is for the frontend, `functions/package.json` is for the backend. Install deps in the right one.
2. **Two separate `tsconfig` setups.** Frontend uses `tsconfig.app.json` (erasableSyntaxOnly). Backend uses `functions/tsconfig.json` (standard ESNext).
3. **Types are defined in three places.** `packages/contracts/src/index.ts` is canonical. `src/lib/types.ts` and `functions/src/types/index.ts` re-export and add layer-specific types. Keep in sync.
4. **Device specs have ~260 fields** across 16 categories. `DeviceSpec` nests sub-interfaces (e.g., `QuestionnaireHardware`). They are grouped objects, not flat.
5. **The tier engine auto-runs** on spec save and tier definition save. Do not forget this side effect.
6. **Firestore has no joins.** The backend manually fetches related collections. Watch for N+1 patterns.
7. **Two Cloud Functions are exported.** `api` (all Express routes) and `extractDeviceTask` (Cloud Tasks handler for AI extraction). Both in `functions/src/index.ts`.
8. **AI disambiguation (DST-039) is pre-production.** The Anthropic API key is resolved from 1Password at deploy time. If missing or timing out (5s), imports fall back to rule-based validation gracefully.
9. **Questionnaire AI extraction runs via Cloud Tasks, not fire-and-forget.** Each device gets its own task (queue: `extractDeviceTask` in `us-central1`). Tasks are idempotent (CAS on `extractionStatus`), retry on rate limits/timeouts (3 attempts, 60–300s backoff, 300s function timeout, 1800s dispatch deadline). Never use fire-and-forget for extraction — always enqueue via `enqueueExtractionTasks()`.
10. **Questionnaire extraction has real-time status UI (DST-052).** Backend writes `extractionStep`, `extractionCurrentDevice`, `devicesComplete`, `devicesFailed` to the job document. `ExtractionStatusPanel` renders a 4-step stepper, auto-collapses 2s after success, and shows failure banners with Restart/Retry. Failed devices can be retried individually.
11. **The questionnaire review wizard has 4 steps.** Assign Partner(s) → Review Devices → Resolve Conflicts → Sign Off. For multi-partner jobs (DST-055), Step 1 shows interactive `IntakePartnerRow` components. Nothing is committed until the admin completes Step 4.
12. **Notifications are admin-only.** `notifications` collection stores in-app notifications. `NotificationBell` polls every 30 seconds.
13. **Partner resolution uses a shared chain (DST-046).** `partnerResolver` implements exact match → alias lookup → Jaro-Winkler fuzzy match (≥ 0.90).
14. **User role management is in-app (DST-054).** `PATCH /api/users/:id/role` uses a Firestore transaction for admin demotions. Self-demotion returns 403; last-admin demotion returns 409.
15. **Firestore batch chunking.** All batch writes use `createChunkedWriter`/`flushIfNeeded`/`finalCommit` helpers (450-op threshold).
16. **Multi-partner questionnaire support (DST-055).** Three new Firestore collections: `questionnaireIntakePartners`, `questionnaireStagedDevicePartners`, `devicePartnerDeployments`. `isMultiPartner` flag controls UI flow. Approval handler writes deployment records with deterministic IDs (`${deviceId}_${partnerId}`) for idempotent upserts.
17. **Actionable alerts pattern.** For single-key lookups use `exactKey` query param. Alert auto-dismiss is server-side. Partners are fetched in a non-blocking `useEffect` so partner fetch failures never block the alert list.
18. **Telemetry freshness (DST-053).** `lastTelemetryAt` (ISO string) on each device doc. `FreshnessBadge` shows green/amber/red/gray (<48h / 2–7d / 7d+ / null). `getFreshnessState()` and `FreshnessState` type live in `src/lib/format.ts` (not in the component file) to satisfy `react-refresh/only-export-components`.

---

## 3. Code Modification Rules

### Credential Hygiene and Rotation

Frontend (`.env`, prefixed with `VITE_`):
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` — keep in `.env` (gitignored), never in tracked source
- Rotation: remove from tracked files/history, create replacement with same restrictions, update `.env`, redeploy hosting, verify, delete old key

Backend secrets (1Password, via `functions/.env.tpl`):
- `ANTHROPIC_API_KEY` — in 1Password (`Private/DST Anthropic API Key`); resolved via `op inject` at deploy time
- Rotation: update in 1Password, redeploy functions, verify behavior, revoke old secret

Deployer service account key:
- Rerun `op-firebase-setup device-source-of-truth`, confirm deploys work, then delete old IAM key via `gcloud iam service-accounts keys delete`

Do not store API keys as plaintext in source files. Always use `op://` references in `.env.tpl`.

### Security Rules

`firestore.rules` and `storage.rules` control data access. Never relax rules without explicit review. Domain restriction (`@disney.com`, `@disneystreaming.com`) and role-based access are invariants.

### Audit Logging Requirement

Every mutation route must call `diffAndLog()` or `logAuditEntry()` from `functions/src/services/audit.ts`. The audit log is append-only. Never skip audit logging to simplify an implementation.

### Tier Engine Side Effects

After saving device specs, always call `assignTierToDevice(deviceId)`. After saving tier definitions, always call `reassignAllDevices()`. These are not optional — missing them causes stale tier assignments.

### dist/ Is a Build Artifact

Never edit files in `dist/` directly. Run `npm run build` to regenerate. The `check_dist_not_modified` CI script enforces this.

---

## 4. Documentation Rules

- **`AGENTS.md`:** Update when adding new API routes, new Firestore collections, new frontend conventions, or new architectural behaviors.
- **`DEPLOYMENT.md`:** Update when deploy process changes — new targets, environment variable changes, credential rotation steps.
- **`README.md`:** Update when project description, live URL, or major features change.
- **`packages/contracts/src/index.ts`:** Document type changes with inline JSDoc comments. This is the single source of truth for shared types.
- **`rules/repo_rules.md`:** Update when directory structure changes or new invariants are needed.
- **`.ai_context.md`:** Update when high-risk areas, external dependencies, or non-standard directories change.

When adding a new Firestore collection, update the Data Model table in Section 1. When adding a new API route, update the API Routes table in Section 2.

---

## 5. Testing Requirements

```bash
npm test                           # frontend Vitest suite + tracked-file secret scan
cd functions && npm test           # backend Vitest suite + tracked-file secret scan
```

**Tests must not be deleted to force a build to pass.**

Both test suites include a `scripts/check-no-public-secrets.mjs` scan. A failing secret scan means credentials are present in tracked files.

**When adding new behavior:**
- Add tests for new services in `functions/src/services/`
- Add tests for new API route logic
- Add frontend tests for utility logic in `src/lib/`

**Notes:**
- The root `tests/` directory is a standard placeholder per the AI Agent Tooling Standard. Main test suites are configured via `vitest.config.ts` (frontend) and `functions/vitest.config.ts` (backend).
- The `check_spec_test_alignment` CI script is advisory for this repo: `specs/` contains product docs and feature stories, not per-test spec files.

---

## 6. Deployment Process

Deploying requires the [1Password CLI](https://developer.1password.com/docs/cli/) (`op`), `firebase-tools`, `gcloud`, and access to the Private vault.

### Non-Interactive Deploy (Recommended)

Uses Application Default Credentials stored in 1Password. The only interactive step is the 1Password biometric (Touch ID).

```bash
npm run deploy                 # full deploy
npm run deploy:hosting         # hosting only
npm run deploy:functions       # functions only
op-firebase-deploy --only hosting,functions  # any combo
```

`op-firebase-deploy` reads a per-project service account key from 1Password, writes it to a temp file, sets `GOOGLE_APPLICATION_CREDENTIALS`, deploys via `firebase deploy --non-interactive`, and cleans up.

**First-time setup:** `op-firebase-setup device-source-of-truth`

### Manual Deploy (Interactive)

```bash
firebase login
npx firebase deploy
npx firebase deploy --only hosting
npx firebase deploy --only functions
npx firebase deploy --only firestore:rules
npx firebase deploy --only storage
```

### Build Only

```bash
npm run build                      # Frontend: tsc -b && vite build
cd functions && npm run build      # Backend: tsc
```

### Environment Variables

Frontend `.env` (gitignored, prefixed with `VITE_`):
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`

Backend secrets (managed via 1Password, resolved at deploy time):
1. `functions/.env.tpl` contains `op://` references (safe to commit)
2. The `firebase.json` predeploy hook runs `op inject -i functions/.env.tpl -o functions/.env -f`
3. `functions/.env` is gitignored, exists only transiently during deploy
4. Canonical secrets live in 1Password — never store as plaintext

See `DEPLOYMENT.md` for full deployment instructions, 1Password convention, and rotation playbooks.
