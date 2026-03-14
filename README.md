# Device Source of Truth (DST)

Internal Disney Streaming platform that consolidates NCP/ADK partner device data — hardware specifications, partner relationships, deployment counts, ADK versions, telemetry analytics, and DRM compliance — into a single, authoritative system of record. Replaces data previously scattered across Datadog dashboards, Airtable bases, Google Drive questionnaires, and spreadsheets.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite 7 |
| Backend | Firebase Cloud Functions (Express 5 REST API) |
| AI | Anthropic Claude API (pre-production/testing — DST-039) |
| Database | Cloud Firestore (28 collections, ~260 typed device spec fields) |
| Auth | Firebase Authentication (Google OAuth, domain-restricted) |
| Analytics | Google Analytics 4 via Firebase (30+ typed events) |
| Hosting | Firebase Hosting (CDN with API proxy) |

## Features

- **Partner & Device Registry** — manage partners, partner keys (Datadog slugs), and device models with full-text search and filtering
- **Hardware Spec Ingestion** — ~260 typed fields across 16 category groups (SoC, memory, GPU, codecs, DRM, security, questionnaire intake, and more) with completeness tracking
- **Configurable Tier Scoring** — define hardware tiers with threshold rules; devices are auto-classified when specs or tiers change
- **Tier Simulator** — what-if analysis tool to preview how feature requirements affect device eligibility
- **Telemetry Upload** — ingest Datadog CSV exports with anomaly detection (unregistered devices/keys generate alerts)
- **Spec Coverage Reports** — weighted coverage metrics, per-partner breakdowns, CSV/PDF export
- **Audit Log** — append-only, field-level change tracking for every mutation across all entities
- **Role-Based Access Control** — viewer / editor / admin roles enforced on both frontend and backend
- **Partner Key Registry** — manage Datadog manifest key → partner mappings with CSV import, batch rollback, and enrichment attributes (chipset, OEM, OS, regions)
- **Airtable Intake Import** — parse and import Airtable Intake Request CSVs with preview, normalization, partner matching, and batch rollback
- **AI-Assisted Import Disambiguation** — Claude-powered resolution of ambiguous CSV fields (country codes, regions, partner names) with batched clarification questions, confidence scoring, and graceful fallback (pre-production/testing — DST-039)
- **Airtable Migration** — bulk CSV import of legacy AllModels data with spec mapping, tier assignment, history, and rollback
- **Reference Data Management** — controlled vocabulary administration for dropdown fields (regions, chipsets, OS, request types)
- **Auto-Update Notification** — polls for new deployments and prompts users to refresh when a new version is available
- **Structured Logging** — request-scoped logging with timing, context propagation, and Cloud Logging integration for production troubleshooting
- **Dashboard** — KPI summaries, certification breakdown, tier distribution, and top-device charts

## Quick Start

```bash
# Clone
git clone https://github.com/nathanjohnpayne/device-source-of-truth.git
cd device-source-of-truth

# Install dependencies (frontend + backend)
npm install
cd functions && npm install && cd ..

# Deploy maintainers: one-time 1Password/Firebase auth bootstrap
op-firebase-setup device-source-of-truth

# Configure environment
cp .env.example .env
# Fill in VITE_FIREBASE_API_KEY, VITE_FIREBASE_APP_ID, VITE_FIREBASE_MEASUREMENT_ID
# (find these in Firebase Console > Project Settings > Web app)

# Start frontend dev server
npm run dev

# (Optional) Build and start Firebase emulator for local backend
cd functions && npm run build && cd ..
firebase emulators:start --only functions,firestore
```

The frontend runs at `http://localhost:5173`. By default it calls the production API; see [DEPLOYMENT.md](./DEPLOYMENT.md) for local emulator setup.

## Build & Deploy

```bash
# Build frontend + backend
npm run build && cd functions && npm run build && cd ..

# Deploy everything to Firebase via 1Password auth
npm run deploy

# Deploy selectively
npm run deploy:hosting              # frontend
npm run deploy:functions            # backend API
op-firebase-deploy --only firestore # security rules + indexes
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete deployment guide including Firebase Console setup, seed data, custom domains, monitoring, and rollback procedures.

## 1Password Deploy & Secret Flow

- Deploy maintainers need `op`, `firebase-tools`, `gcloud`, and access to the `Private` vault in 1Password.
- `op-firebase-setup device-source-of-truth` creates `firebase-deployer@device-source-of-truth.iam.gserviceaccount.com`, grants deploy roles, and stores the JSON key in `Private/Firebase Deploy - device-source-of-truth`.
- `npm run deploy`, `npm run deploy:hosting`, and `npm run deploy:functions` call `op-firebase-deploy`, which reads `Private/Firebase Deploy - device-source-of-truth` from 1Password and sets `GOOGLE_APPLICATION_CREDENTIALS`. No browser auth required.
- Backend/provider secrets use committed `op://` references in [`functions/.env.tpl`](./functions/.env.tpl) and are resolved at deploy time with `op inject`.
- Questionnaire workbook parsing uses the official SheetJS Community Edition tarball in [`functions/package.json`](./functions/package.json) because the public npm `xlsx` package remains pinned to the older 0.18.5 release line.
- Future APIs or services should follow the same pattern: commit only a template such as `.env.tpl`, `config.runtime.tpl`, or `functions/.env.tpl`, keep the resolved file gitignored, and materialize it with `op inject -i <template> -o <runtime-file> -f`.

## UI Consistency Guardrails

```bash
# Check for new UI drift against baseline
npm run ui:consistency:check

# Refresh baseline after intentional remediation work
npm run ui:consistency:baseline
```

Current checks enforce delta-only drift protection for:
- `alert()` usage in app code
- direct `toLocaleDateString()` / `toLocaleString()` in pages/components
- non-allowlisted `rounded-md` token drift
- blue primary action tokens (`bg-blue-600` / `hover:bg-blue-700`)

Baseline file: [`config/ui-consistency-baseline.json`](./config/ui-consistency-baseline.json)

## Project Structure

```
src/                          React frontend
├── pages/                    28 route-level page components (lazy-loaded)
├── components/               Shared UI (DataTable, Badge, Modal, FilterPanel, etc.)
├── hooks/
│   ├── useAuth.tsx          Auth context provider + useAuth() hook
│   └── useAppUpdate.ts      Dual-path update detection (SW + version polling)
└── lib/
    ├── types.ts              All TypeScript interfaces (791 lines, single source of truth)
    ├── api.ts                Typed HTTP client for /api/* endpoints
    ├── analytics.ts          GA4 event tracking (30 typed events)
    ├── firebase.ts           Firebase SDK initialization
    └── export.ts             CSV/PDF export utilities

functions/src/                Firebase Cloud Functions backend
├── index.ts                  Express app + route mounting + request logging middleware
├── middleware/auth.ts        Token verification, domain check, role guard
├── routes/                   18 Express routers (partners, devices, tiers, intake, questionnaire review, admin config, etc.)
├── services/
│   ├── logger.ts             Structured logging (Cloud Logging integration)
│   ├── audit.ts              Append-only field-level change tracking
│   ├── tierEngine.ts         Hardware tier assignment engine
│   ├── specCompleteness.ts   Spec completeness calculator
│   ├── intakeParser.ts       Airtable CSV parser and normalizer
│   ├── aiDisambiguate.ts     AI disambiguation service (Anthropic Claude, pre-production)
│   └── seedFieldOptions.ts   Reference data seeding
└── types/index.ts            Backend type definitions

specs/                        Product specs and feature stories
docs/                         Technical documentation
```

## Documentation

| Document | Description |
|---|---|
| [AGENTS.md](./AGENTS.md) | AI agent onboarding guide — read this first if using Cursor, Copilot, or Claude |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Complete deployment guide from fresh checkout to production |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Deep technical architecture: data flow, security model, design decisions |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | Core Firestore schema reference for the primary catalog, telemetry, and admin collections |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | Core REST API reference for the primary CRUD, upload, and reporting endpoints |
| [docs/UI_CONSISTENCY.md](./docs/UI_CONSISTENCY.md) | UI drift guardrails and filter UX standardization matrix |
| [specs/DST-TDI-002-UI-Drift-Remediation-PLAN.md](./specs/DST-TDI-002-UI-Drift-Remediation-PLAN.md) | UI/UX consistency remediation roadmap (Rev C) |
| [specs/Device Source of Truth (DST).md](./specs/Device%20Source%20of%20Truth%20(DST).md) | Original product specification |
| [specs/DST-037](./specs/DST-037-airtable-intake-import.md) | Airtable Intake Request Import |
| [specs/DST-038](./specs/DST-038-partner-key-registry.md) | Partner Key Registry |
| [specs/DST-039](./specs/DST-039-ai-import-disambiguation.md) | AI-Assisted Import Disambiguation |

## Auth & Access

Login requires a `@disney.com` or `@disneystreaming.com` Google account. Domain restriction is enforced on both the frontend (client-side check after OAuth) and the backend (token verification middleware).

| Role | Permissions |
|---|---|
| Viewer | Read all data, run simulations, use search, view reports |
| Editor | + create/edit devices, specs, partners, bulk-import specs |
| Admin | + manage tiers, upload telemetry, manage partner keys, import intake requests, run migrations, dismiss alerts, rollback imports |

Roles are assigned via the `users` Firestore collection. The first admin must be created manually in Firebase Console (see [DEPLOYMENT.md](./DEPLOYMENT.md#seeding-initial-data)).

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics 4 measurement ID |

All three are prefixed with `VITE_` so Vite includes them in the client bundle. They are not the auth boundary, but hardcoding real values in tracked source is still poor security posture: public exposure creates abuse/noise risk and triggers Google alerts. Keep them in local `.env` files and keep browser-key restrictions enabled in Google Cloud Credentials.

**Backend** (in `functions/.env`, gitignored):

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for AI disambiguation (DST-039, pre-production/testing) |

The AI disambiguation feature falls back gracefully to rule-based validation if this key is missing or the API is unavailable.

## Credential Hygiene & Rotation

If a Firebase browser key is exposed:

1. Remove it from tracked files and rewrite public git history if needed.
2. Create a replacement key in Google Cloud Credentials with the same referrer/API restrictions.
3. Update `.env`, redeploy hosting, verify the live app uses the new key, then delete the old key.

If `ANTHROPIC_API_KEY` or a deployer service-account key is exposed, rotate it in 1Password immediately, redeploy, and explicitly delete the old provider/IAM key.

`npm test` and `cd functions && npm test` both include tracked-file secret scans so committed API keys, OAuth tokens, and private keys fail the standard test workflow.

## Firebase Project

- **Project ID:** `device-source-of-truth`
- **Auth Domain:** `device-source-of-truth.firebaseapp.com`
- **Hosting URL:** `https://device-source-of-truth.web.app`
- **Functions Region:** `us-central1`
- **Runtime:** Node.js 22
