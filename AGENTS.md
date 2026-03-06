# AGENTS.md — AI Agent Onboarding Guide

This file is for AI coding assistants (Cursor, Copilot, Claude, etc.) working on the Device Source of Truth (DST) codebase. Read this before making changes.

## What This Project Is

DST is an internal Disney Streaming tool that consolidates NCP/ADK partner device data — hardware specs, partner relationships, deployment counts, ADK versions, and DRM compliance — into a single queryable system of record. It replaces data scattered across Datadog, Airtable, Google Drive, and spreadsheets.

The product spec lives in `specs/Device Source of Truth (DST).md` (877 lines). Read it for full business context.

## Architecture Overview

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

## Directory Structure

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
│   │   ├── useAppUpdate.ts      ← Dual-path update detection (SW + version polling)
│   │   ├── useAIPassStatus.ts   ← AI pass status reducer for import disambiguation (DST-051)
│   │   ├── useFieldOptions.tsx  ← Field options context provider for spec dropdowns
│   │   └── useImportPrerequisites.tsx ← Shared context for prerequisite checks (partners/keys exist)
│   └── lib/
│       ├── firebase.ts           ← Firebase client SDK init (Auth, Firestore, Analytics)
│       ├── api.ts                ← Typed fetch wrapper for /api/* endpoints
│       ├── analytics.ts          ← Typed GA4 event tracking (no-op in dev)
│       ├── analyticsParams.ts   ← GA4 event parameter definitions
│       ├── analyticsRoutes.ts   ← Route path → analytics page title mapping
│       ├── export.ts             ← CSV/PDF export utilities
│       ├── format.ts             ← Shared formatting helpers (formatDate, formatDateTime, formatNumber, formatRelativeTime, getFreshnessState)
│       ├── questionnaireFields.ts ← Questionnaire field key → DST spec field mappings
│       └── types.ts              ← Frontend-layer TypeScript interfaces (re-exports from @dst/contracts + frontend-only types)
│
├── functions/                    ← Firebase Cloud Functions (backend)
│   ├── src/
│   │   ├── index.ts              ← Express app + extractDeviceTask Cloud Tasks function
│   │   ├── middleware/auth.ts    ← Token verification, domain check, role guard
│   │   ├── routes/               ← 18 Express routers (partners, devices, users, disambiguate, questionnaireIntake, versionMappings, partnerAliases, etc.)
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
│   ├── favicon.svg               ← SVG favicon (device-cloud icon, indigo fill)
│   └── og-image.png             ← Open Graph social preview image (2400×1260 PNG)
├── specs/                        ← Product specs and feature stories
├── firebase.json                 ← Hosting rewrites + functions + firestore config
├── firestore.rules               ← Firestore security rules (27 collections)
├── storage.rules                 ← Firebase Storage security rules (questionnaire files)
├── firestore.indexes.json        ← Composite index definitions (currently empty)
├── .env / .env.example           ← Firebase API keys (3 vars, all VITE_ prefixed)
├── .env.op                       ← 1Password references for deploy auth (op:// URIs, safe to commit)
├── functions/.env.tpl            ← 1Password secret references (op:// URIs, safe to commit)
└── vite.config.ts                ← Vite + Tailwind + code-split config
```

## Key Files to Read First

1. **`packages/contracts/src/index.ts`** — The canonical source of truth for all shared data types and Zod schemas. Every Firestore entity, every API request/response shape, every spec category is defined here. `src/lib/types.ts` and `functions/src/types/index.ts` re-export from this package. Read this first.
2. **`functions/src/index.ts`** — Express app structure and all route mounts.
3. **`functions/src/middleware/auth.ts`** — How authentication and role-based access control works.
4. **`src/App.tsx`** — All client-side routes and their auth guards (ProtectedRoute, EditorRoute, AdminRoute).
5. **`src/hooks/useAuth.tsx`** — How the frontend resolves the current user and their role.

## Data Model (Firestore Collections)

| Collection | Purpose | Key Fields |
|---|---|---|
| `partners` | Canonical partner brands | displayName, regions[], countriesIso2[] |
| `partnerKeys` | Datadog slugs → partner mapping | key (unique), partnerId, chipset, oem |
| `devices` | One row per hardware model | deviceId (unique, Datadog join key), partnerKeyId, certificationStatus, activeDeviceCount, lastTelemetryAt, specCompleteness, tierId |
| `deviceSpecs` | ~260 typed hardware spec fields | deviceId (1:1), 16 category sub-objects (general, hardware, firmwareUpdates, mediaCodec, frameRates, contentProtection, native, videoPlayback, uhdHdr, audioVideoOutput, other, appRuntime, audioCapabilities, accessibility, platformIntegration, performanceBenchmarks) |
| `deviceDeployments` | Many-to-many: device × partner × country | deviceId, partnerKeyId, countryIso2, deploymentStatus |
| `telemetrySnapshots` | Periodic Datadog field counts | partnerKey, deviceId, coreVersion, uniqueDevices, snapshotDate |
| `hardwareTiers` | Tier definitions (Tier 1/2/3) | tierName, tierRank, ramMin, gpuMin, requiredCodecs[] |
| `deviceTierAssignments` | Tier assignment history | deviceId, tierId, trigger |
| `auditLog` | Append-only change log | entityType, entityId, field, oldValue, newValue, userId |
| `alerts` | Unregistered device/key alerts | type, partnerKey, deviceId, status, dismissReason |
| `uploadHistory` | Telemetry upload log | uploadedBy, fileName, rowCount, successCount |
| `users` | Role assignments (managed in-app by admins) | email, role (viewer/editor/admin), displayName, photoUrl, lastLogin, updatedAt, updatedBy |
| `config` | App-level settings | retentionDailyDays, retentionWeeklyYears |
| `fieldOptions` | Controlled vocabulary dropdown options | dropdownKey, displayLabel, displayValue, sortOrder, isActive |
| `partnerKeyImportBatches` | Partner key CSV import history | importedBy, fileName, keyCount, status |
| `intakeRequests` | Airtable intake request records | requestType, partnerName, region, tamOwner, batchId |
| `intakeRequestPartners` | Intake request → partner links | intakeRequestId, partnerId, matchType |
| `intakeImportHistory` | Intake CSV import history | importedBy, fileName, rowCount, status |
| `questionnaireIntakeJobs` | Questionnaire file upload/parse/extraction jobs | fileName, fileStoragePath, submitterPartnerId, isMultiPartner, questionnaireFormat, status, aiExtractionMode, extractionStep, extractionCurrentDevice, devicesComplete, devicesFailed, tasksEnqueued, notificationSentAt |
| `questionnaireStagedDevices` | Devices detected from a questionnaire file | intakeJobId, rawHeaderLabel, platformType, matchedDeviceId, reviewStatus, extractionStatus (pending/processing/complete/failed), extractionProcessingAt |
| `questionnaireStagedFields` | Individual Q/A pairs extracted per device | stagedDeviceId, dstFieldKey, rawQuestionText, extractedValue, conflictStatus, resolution |
| `deviceQuestionnaireSources` | Links devices to the questionnaire jobs that populated their specs | deviceId, intakeJobId, partnerId, fieldsImported, fieldsOverridden |
| `questionnaireIntakePartners` | Detected operating brands per multi-partner intake job | intakeJobId, partnerId, rawDetectedName, detectionSource, matchConfidence, reviewStatus, deviceCount |
| `questionnaireStagedDevicePartners` | Per-device partner deployment links within a staged intake | stagedDeviceId, intakePartnerId, countries, certificationStatus, certificationAdkVersion, partnerModelName, reviewStatus |
| `devicePartnerDeployments` | Committed device × partner deployment records | deviceId, partnerId, countries, partnerModelName, certificationStatus, certificationAdkVersion, active, sourceIntakeJobId |
| `notifications` | In-app notifications for admins | recipientRole, title, body, link, read |
| `coreVersionMappings` | Core version → friendly version lookup | coreVersion, friendlyVersion, platform, isActive |
| `partnerAliases` | Alternative partner names → canonical partner | alias, partnerId, resolutionType, contextRules, isActive |

## API Routes

All routes are prefixed with `/api` and require a valid Firebase Auth Bearer token. The `authenticate` middleware in `functions/src/middleware/auth.ts` runs on every request.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /partners | any | List partners with stats |
| POST | /partners | editor+ | Create partner |
| GET | /partners/:id | any | Partner detail |
| PUT | /partners/:id | editor+ | Update partner |
| DELETE | /partners/:id | admin | Delete partner |
| GET | /partner-keys | any | List partner keys |
| POST | /partner-keys | admin | Create partner key |
| GET | /devices | any | List devices (paginated, filterable, searchable) |
| POST | /devices | editor+ | Register new device |
| GET | /devices/:id | any | Full device detail (joins specs, tier, deployments, telemetry) |
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
| GET | /alerts | any | List alerts |
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
| POST | /import/disambiguate | admin | AI disambiguation pass on parsed import rows (DST-039, pre-production) |
| POST | /import/disambiguate/resolve | admin | Apply admin answers to AI clarification questions (DST-039, pre-production) |
| POST | /questionnaire-intake | editor+ | Upload questionnaire file (base64), create job, parse, optionally trigger AI extraction |
| GET | /questionnaire-intake | any | List questionnaire intake jobs (paginated, filterable) |
| GET | /questionnaire-intake/:id | any | Get intake job detail with staged device summaries |
| POST | /questionnaire-intake/:id/trigger-extraction | editor+ | Manually trigger AI extraction on an intake job |
| GET | /questionnaire-intake/:id/staged-devices | any | All staged devices with their extracted fields |
| GET | /questionnaire-intake/:id/download | any | Generate signed URL for source file download |
| GET | /questionnaire-intake/:id/review | any | Full review state (devices + all fields with conflict info) |
| PATCH | /questionnaire-intake/:id | admin | Update intake job (partner assignment) |
| PATCH | /questionnaire-intake/:id/staged-devices/:deviceId | admin | Update staged device (approve/reject, match, identity fields) |
| PATCH | /questionnaire-intake/:id/staged-devices/:deviceId/fields/:fieldId | admin | Update field resolution or override extracted value |
| PATCH | /questionnaire-intake/:id/staged-devices/:deviceId/resolve-all | admin | Bulk resolve all pending conflicts to use_new |
| POST | /questionnaire-intake/:id/approve | admin | Commit approved devices to catalog (atomic transaction) |
| POST | /questionnaire-intake/:id/reject | admin | Reject entire intake job |
| POST | /questionnaire-intake/:id/retry-device/:deviceId | editor+ | Retry AI extraction for a single failed device (DST-052) |
| GET | /questionnaire-intake/notifications/list | any | List in-app notifications |
| PATCH | /questionnaire-intake/notifications/:id/read | any | Mark notification as read |
| PATCH | /questionnaire-intake/:id/intake-partners/:intakePartnerId | admin | Update intake partner (assign partner, confirm/reject, merge duplicates) |
| PUT | /questionnaire-intake/:id/staged-devices/:deviceId/deployments | admin | Replace partner deployment links for a staged device |
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

## Role System

Three roles, checked by `requireRole()` middleware on the backend and `useAuth()` on the frontend:

| Role | Can Do |
|---|---|
| `viewer` | Read all data, run simulations, use search |
| `editor` | Everything viewer can do + create/edit devices, specs, partners |
| `admin` | Everything editor can do + manage tiers, upload telemetry, manage partner keys, import intake requests, run migrations, dismiss alerts, rollback imports, review/approve/reject questionnaire imports, manage user roles |

Roles are stored in the `users` Firestore collection. A user doc is auto-provisioned with `role: 'viewer'` on first login via the `authenticate` middleware. Admins can change roles in-app via the User Management page (`/admin/users`). Guardrails prevent self-demotion (403) and last-admin removal (409, enforced via Firestore transaction). Role changes take effect on the affected user's next API request; the frontend reflects the change on their next page load.

## Frontend Conventions

- **Routing:** All routes defined in `src/App.tsx`. Pages are lazy-loaded via `React.lazy()` for code splitting.
- **Auth guards:** `ProtectedRoute` (requires login), `EditorRoute` (requires editor+), `AdminRoute` (requires admin). These wrap route elements in `App.tsx`.
- **State management:** No external state library. `useState` + `useEffect` for data fetching. Auth state via React Context (`AuthProvider`).
- **API calls:** Always use `api.*` from `src/lib/api.ts`. It auto-attaches the Firebase Auth Bearer token.
- **Styling:** Tailwind CSS utility classes only. No CSS modules, no styled-components. `src/index.css` contains a critical un-layered `appearance: none` reset for `<button>` elements — see item 13 in "Things to Watch Out For".
- **Icons:** `lucide-react` exclusively.
- **Charts:** `recharts` for all data visualizations.
- **Shared components:** `DataTable`, `Badge`, `Modal`, `FilterPanel`, `EmptyState`, `LoadingSpinner`, `Tooltip`, `ClarificationPanel`, `Logo`, `AIPassStatusPanel`, `ExtractionStatusPanel`, `PrerequisiteBanner`, `VersionInput`, `FreshnessBadge`, `FreshnessMicroPanel` in `src/components/shared/`. `LoadingSpinner` accepts an `inline` prop for use inside buttons without the default `p-12` wrapper. `Logo` renders the device-cloud SVG inline with `fill="currentColor"` for flexible coloring. `AIPassStatusPanel` shows import AI pass progress (DST-051). `ExtractionStatusPanel` shows questionnaire AI extraction progress with per-device retry (DST-052). `PrerequisiteBanner` warns when required data (partners/keys) is missing before import flows. `VersionInput` renders a core-version text input with friendly-version resolution. `FreshnessBadge` renders a color-coded dot + text badge for telemetry data freshness (DST-053); accepts `compact` prop for dot-only mode in table cells. `FreshnessMicroPanel` renders a structured hover card with freshness details for device table rows (150ms show / 100ms hide delay, keyboard accessible).
- **Responsive shell:** `AppShell` is mobile-responsive. Below `lg:` the sidebar collapses off-screen and a hamburger menu in the topbar opens it as a slide-over overlay. Above `lg:` the sidebar is always visible.
- **Update banner:** `UpdateBanner` in `src/components/UpdateBanner.tsx` detects new versions via service worker (Workbox/PWA) and version polling. It renders inside `AppShell`'s fixed header wrapper (above the topbar) so it reserves vertical space instead of overlapping navigation.
- **Date formatting:** Use `formatDate()`, `formatDateTime()`, and `formatRelativeTime()` from `src/lib/format.ts` for all date/time display. Use `getFreshnessState()` from the same file for freshness classification. Do not use inline `toLocaleString()` or page-local formatters.
- **Analytics:** Use `trackEvent()` from `src/lib/analytics.ts`. Events are no-ops in development mode.
- **Exports:** Use `exportToCsv()` and `exportToPdf()` from `src/lib/export.ts`.
- **Destructive actions:** Confirm buttons for delete, rollback, reject, or dismiss actions must use `bg-red-600 hover:bg-red-700` (not primary indigo).
- **Button tokens:** Use `rounded-lg` (not `rounded-md`) and `bg-indigo-600 hover:bg-indigo-700` for primary buttons consistently.

## Backend Conventions

- **All routes** in `functions/src/routes/*.ts` export a default Express `Router`.
- **Firestore access:** Always use `admin.firestore()` (server-side Admin SDK, bypasses security rules).
- **Audit logging:** Call `diffAndLog()` or `logAuditEntry()` from `functions/src/services/audit.ts` on every mutation.
- **Tier recalculation:** After saving device specs, call `assignTierToDevice(deviceId)`. After saving tier definitions, call `reassignAllDevices()`.
- **Spec completeness:** After saving specs, call `calculateSpecCompleteness()` and update the `specCompleteness` field on the device doc.
- **ESM:** The backend uses ES modules. All imports must use `.js` extensions (e.g., `import { foo } from './bar.js'`).
- **Error handling:** Wrap route handlers in try/catch, return `{ error, detail }` JSON with appropriate status codes.

## Common Tasks

### Adding a new Firestore collection
1. Add the TypeScript interface to `packages/contracts/src/index.ts`
2. Re-export the type in both `src/lib/types.ts` and `functions/src/types/index.ts`
3. Add Firestore rules for the collection in `firestore.rules`
4. Create the route file in `functions/src/routes/`
5. Mount the router in `functions/src/index.ts`
6. Add API client methods in `src/lib/api.ts`

### Adding a new page
1. Create the page component in `src/pages/`
2. Add the route in `src/App.tsx` (with appropriate auth guard)
3. Add a lazy import at the top of `App.tsx`
4. Add a nav item in `src/components/layout/AppShell.tsx` if it should appear in the sidebar
5. Track page views automatically (handled by `PageViewTracker` in App.tsx)

### Adding a new API endpoint
1. Add the route handler in the appropriate `functions/src/routes/*.ts` file
2. Use `requireRole()` middleware if the endpoint requires specific permissions
3. Add audit logging for mutations via `diffAndLog()` or `logAuditEntry()`
4. Add the corresponding method in `src/lib/api.ts`

## Build & Deploy

Deploying requires the [1Password CLI](https://developer.1password.com/docs/cli/) (`op`) to be installed and authenticated. Two auth flows exist:

### Non-interactive deploy (recommended — no browser prompts)

Uses Application Default Credentials stored in 1Password. Run via npm or the VS Code/Cursor command palette (`Tasks: Run Build Task` → **Deploy (1Password auth)**):

```bash
npm run deploy                 # full deploy
npm run deploy:hosting         # hosting only
npm run deploy:functions       # functions only
op-firebase-deploy --only hosting,functions  # any combo
```

`op-firebase-deploy` is a global script (`~/.local/bin/op-firebase-deploy`) that reads ADC from 1Password, validates the token, auto-refreshes if stale (opens browser + updates 1Password automatically), writes credentials to a temp file, deploys via `firebase deploy --non-interactive`, and cleans up. Does not depend on `firebase login` or `gcloud auth login` sessions. Works for any Firebase project.

**1Password setup:** Item "GCP ADC" in the Private vault with:
- `credential` — Application Default Credentials JSON (from `gcloud auth application-default login`), or a service account key JSON
- `project` — the GCP/Firebase project ID (e.g., `device-source-of-truth`)

### Manual deploy (interactive — requires browser login)

```bash
firebase login
npx firebase deploy
npx firebase deploy --only hosting
npx firebase deploy --only functions
npx firebase deploy --only firestore:rules
npx firebase deploy --only storage
```

### Build only (no deploy)

```bash
npm run build                      # Frontend: tsc -b && vite build
cd functions && npm run build      # Backend: tsc
```

## Environment Variables

Frontend (in `.env`, prefixed with `VITE_`):
- `VITE_FIREBASE_API_KEY` — Firebase Web API key
- `VITE_FIREBASE_APP_ID` — Firebase Web App ID
- `VITE_FIREBASE_MEASUREMENT_ID` — Google Analytics measurement ID

These are safe to expose in the client bundle (Firebase security is handled by Auth + Firestore rules, not API key secrecy).

Backend secrets (managed via 1Password):
- `ANTHROPIC_API_KEY` — Anthropic API key for AI disambiguation (DST-039) and questionnaire extraction (DST-047). Falls back gracefully if not set.

Secret management flow:
1. `functions/.env.tpl` contains `op://` secret references (safe to commit — no actual secrets).
2. The `firebase.json` functions predeploy hook runs `op inject -i functions/.env.tpl -o functions/.env -f` to resolve references at deploy time.
3. `functions/.env` is gitignored and only exists transiently during deploy.
4. The canonical secret lives in **1Password** (Private vault → "DST Anthropic API Key").
5. Never store API keys as plaintext in source files. Always use `op://` references in `.env.tpl`.

Deploy auth (managed via 1Password):
1. `op-firebase-deploy` (global script at `~/.local/bin/`) reads ADC from 1Password, validates the token, and runs `firebase deploy --non-interactive`.
2. The ADC credential lives in **1Password** (Private vault → "GCP ADC" → `credential` field).
3. The script writes ADC to a temp file (umask 077), sets `GOOGLE_APPLICATION_CREDENTIALS`, deploys, and deletes the temp file on exit.
4. **Self-healing auth:** Before deploying, the script exchanges the refresh token with Google's token endpoint. If stale, it automatically runs `gcloud auth application-default login` and updates the 1Password item — no manual `op item edit` needed.
5. Project ID is auto-detected from `.firebaserc` or passed as an argument. The script does not call `gcloud config set project` or depend on `gcloud auth login` / `firebase login` sessions.
6. `.env.op` is a legacy fallback — `op-firebase-deploy` does not require it.
7. A `firebase-deployer` service account exists in the project with deploy roles (`firebase.admin`, `cloudfunctions.admin`, `iam.serviceAccountUser`, `artifactregistry.writer`, `run.admin`). Two GCP org policies block service account keys entirely: `iam.disableServiceAccountKeyCreation` (blocks Google-generated keys) and `iam.disableServiceAccountKeyUpload` (blocks user-provided keys). If both policies are ever lifted, generate a key and store it in 1Password for permanent non-interactive deploys (service account keys never expire).

## Things to Watch Out For

1. **Two separate `package.json` files.** Root is for the frontend, `functions/package.json` is for the backend. Install deps in the right one.
2. **Two separate `tsconfig` setups.** Frontend uses `tsconfig.app.json` (erasableSyntaxOnly, no class property syntax in constructors). Backend uses `functions/tsconfig.json` (standard ESNext).
3. **Types are defined in three places.** `packages/contracts/src/index.ts` is the canonical source for shared types. `src/lib/types.ts` and `functions/src/types/index.ts` re-export from `@dst/contracts` and add their own layer-specific types. Keep re-exports in sync when adding new contract types.
4. **Device specs have ~260 fields** across 16 categories. The `DeviceSpec` interface nests sub-interfaces (e.g., `QuestionnaireHardware`, `QuestionnaireContentProtection`). These are NOT flat — they're grouped objects. Category names follow the `Questionnaire*` naming convention from the partner questionnaire format.
5. **The tier engine auto-runs** on spec save and tier definition save. Don't forget this side effect when modifying those flows.
6. **Firestore has no joins.** The backend manually fetches related collections. Watch for N+1 query patterns.
7. **Two Cloud Functions are exported.** `api` handles all Express routes under `/api/*`. `extractDeviceTask` is a Cloud Tasks handler (`onTaskDispatched`) for per-device AI extraction. Both are in `functions/src/index.ts`.
8. **AI disambiguation (DST-039) is pre-production/testing.** The Anthropic API key is resolved from 1Password at deploy time (see Environment Variables). If the key is missing or the API times out (5s), imports fall back to rule-based validation gracefully. The AI pass runs between CSV parsing and the validation preview.
9. **Questionnaire intake (DST-047/048) uses Firebase Storage.** Uploaded questionnaire files are stored at `questionnaires/{jobId}/{filename}` via `admin.storage().bucket()`. The `storage.rules` file restricts reads to authenticated users; writes are admin-SDK only.
10. **Questionnaire AI extraction runs via Cloud Tasks, not fire-and-forget.** Each device gets its own `extractDeviceTask` Cloud Task (queue: `extractDeviceTask` in `us-central1`). Tasks are idempotent (CAS on `extractionStatus`), retry on rate limits/timeouts (3 attempts, 60-300s backoff, 300s function timeout, 1800s dispatch deadline), and finalize the job via Firestore transaction when all devices reach a terminal state. Notifications are deduped via `notificationSentAt`. The GET `/:id` endpoint has self-healing recovery for devices stuck in `processing` > 15 minutes (using per-device `extractionProcessingAt`). Never use fire-and-forget patterns for extraction — always enqueue via `enqueueExtractionTasks()`.
10a. **Questionnaire extraction has real-time status UI (DST-052).** The backend writes `extractionStep` (1=Reading spreadsheet, 2=Extracting fields, 3=Validating values, 4=Done), `extractionCurrentDevice`, `devicesComplete`, and `devicesFailed` to the job document as extraction progresses. The frontend `ExtractionStatusPanel` component renders a 4-step stepper during extraction, auto-collapses 2s after success, and shows failure/partial-failure banners with Restart/Retry buttons. The active device card shows an indigo pulse animation. Failed devices can be retried individually via `POST /:id/retry-device/:deviceId` without re-processing successful ones.
11. **The questionnaire review wizard has 4 steps.** Assign Partner(s) → Review Devices → Resolve Conflicts → Sign Off. For multi-partner jobs (DST-055), Step 1 shows interactive `IntakePartnerRow` components for each detected brand with Confirm/Reject controls; the submitter is optional. Nothing is committed to the catalog until the admin completes Step 4. The `POST /:id/approve` endpoint uses chunked Firestore batches (450-op limit) that write specs, create device records, write deployment records, log audit entries, and trigger tier/completeness recalculation.
12. **Notifications are admin-only for now.** The `notifications` collection stores in-app notifications written by the backend when intake jobs reach `pending_review`. The `NotificationBell` component in `AppShell.tsx` polls every 30 seconds.
13. **Tailwind v4 `appearance: button` override.** Tailwind CSS 4 applies `appearance: button` to `<button>` elements via its preflight, which on macOS Safari/Chrome renders rounded system-styled buttons. `src/index.css` contains an un-layered `button { appearance: none; }` reset that must load after Tailwind's `@import`. Do not remove it or move it inside a `@layer` — un-layered styles have higher specificity than Tailwind's layered preflight.
14. **Partner resolution uses a shared chain (DST-046).** The `partnerResolver` service implements exact match → alias lookup → Jaro-Winkler fuzzy match (≥ 0.90). Both AllModels migration and partner key CSV import use this shared resolver. The `partnerAliasResolver` service manages alias CRUD and seeding.
15. **User role management is in-app (DST-054).** Admins manage roles via `UserManagementPage` at `/admin/users`. The `PATCH /api/users/:id/role` route uses a Firestore transaction for admin demotions to prevent concurrent requests from removing all admins. Self-demotion returns 403; last-admin demotion returns 409. Every role change is audit-logged with `entityType: 'user'`. The `User` type includes `updatedAt` and `updatedBy` for provenance. The page uses an inline segmented role selector (not a dropdown) with per-button loading state.
16. **Firestore batch chunking.** All batch writes that could exceed Firestore's 500-op limit use `createChunkedWriter`/`flushIfNeeded`/`finalCommit` helpers (450-op threshold) in `functions/src/routes/questionnaireIntake.ts`. This applies to the upload handler, legacy migration, multi-partner batch persistence, and the approve/commit handler.
17. **Multi-partner questionnaire support (DST-055).** Questionnaires from umbrella organizations (e.g., Liberty Global) contain devices for multiple operating brands. The parser detects multi-partner signals via certs sheet parsing and model name brand mentions, resolving brands against the partner alias registry. Three new Firestore collections store the relationships: `questionnaireIntakePartners` (detected brands per job), `questionnaireStagedDevicePartners` (per-device deployment links during review), and `devicePartnerDeployments` (committed deployments). The `isMultiPartner` flag on the job controls UI flow: Step 1 shows interactive brand resolution instead of a single partner picker. The approval handler writes deployment records with deterministic IDs (`${deviceId}_${partnerId}`) for idempotent upserts. Legacy single-partner jobs are migrated to the submitter model on-read via `migrateJobToSubmitterModel()`. The list endpoint normalizes legacy `partnerId` to `submitterPartnerId` in responses. All mutation endpoints validate job-scope ownership (intake partner and staged device belong to the URL's `:id`). 12 Liberty Global alias seeds cover known brand variations.
18. **Telemetry freshness (DST-053).** `lastTelemetryAt` (ISO string) is written to each device doc during telemetry upload. The `FreshnessBadge` component shows a green/amber/red/gray dot (< 48h / 2–7d / 7d+ / null) on Dashboard, Partner detail, Device detail, and region cards. The badge label shows the actual data coverage window (e.g., "14-day window") derived from the most recent upload's `importTimeRange` field in `uploadHistory`. The dashboard API fetches the latest `uploadHistory` doc and returns `importTimeRange` alongside `lastTelemetryAt`; `FreshnessBadge` accepts an optional `importTimeRange` prop (e.g., `"14d"`, `"7d"`, `"24h"`) and parses it for the label and coverage date range. When no upload exists, it falls back to `ACTIVE_DEVICES_WINDOW_DAYS = 28` (hardcoded in contracts). The `FreshnessMicroPanel` provides a structured hover card in device table rows (still uses the hardcoded fallback). All devices in a single upload batch share the same timestamp — this is a known, documented limitation. The `getFreshnessState()` utility and `FreshnessState` type live in `src/lib/format.ts` (not in the component file) to satisfy `react-refresh/only-export-components`.
