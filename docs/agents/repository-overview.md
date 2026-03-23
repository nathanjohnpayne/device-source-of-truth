# Repository Overview

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
