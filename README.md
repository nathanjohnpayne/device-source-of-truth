# Device Source of Truth (DST)

Internal Disney Streaming platform that consolidates NCP/ADK partner device data — hardware specifications, partner relationships, deployment counts, ADK versions, telemetry analytics, and DRM compliance — into a single, authoritative system of record. Replaces data previously scattered across Datadog dashboards, Airtable bases, Google Drive questionnaires, and spreadsheets.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite 7 |
| Backend | Firebase Cloud Functions (Express 5 REST API) |
| Database | Cloud Firestore (13 collections, 90-field device spec schema) |
| Auth | Firebase Authentication (Google OAuth, domain-restricted) |
| Analytics | Google Analytics 4 via Firebase (30+ typed events) |
| Hosting | Firebase Hosting (CDN with API proxy) |

## Features

- **Partner & Device Registry** — manage partners, partner keys (Datadog slugs), and device models with full-text search and filtering
- **Hardware Spec Ingestion** — 90 typed fields across 12 categories (SoC, memory, GPU, codecs, DRM, security, etc.) with completeness tracking
- **Configurable Tier Scoring** — define hardware tiers with threshold rules; devices are auto-classified when specs or tiers change
- **Tier Simulator** — what-if analysis tool to preview how feature requirements affect device eligibility
- **Telemetry Upload** — ingest Datadog CSV exports with anomaly detection (unregistered devices/keys generate alerts)
- **Spec Coverage Reports** — weighted coverage metrics, per-partner breakdowns, CSV/PDF export
- **Audit Log** — append-only, field-level change tracking for every mutation across all entities
- **Role-Based Access Control** — viewer / editor / admin roles enforced on both frontend and backend
- **Airtable Migration** — bulk CSV import of legacy AllModels data with spec mapping and tier assignment
- **Dashboard** — KPI summaries, certification breakdown, tier distribution, and top-device charts

## Quick Start

```bash
# Clone
git clone https://github.com/nathanjohnpayne/device-source-of-truth.git
cd device-source-of-truth

# Install dependencies (frontend + backend)
npm install
cd functions && npm install && cd ..

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

# Deploy everything to Firebase
firebase deploy

# Deploy selectively
firebase deploy --only hosting      # frontend
firebase deploy --only functions    # backend API
firebase deploy --only firestore    # security rules + indexes
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete deployment guide including Firebase Console setup, seed data, custom domains, monitoring, and rollback procedures.

## Project Structure

```
src/                          React frontend
├── pages/                    18 route-level page components (lazy-loaded)
├── components/               Shared UI (DataTable, Badge, Modal, FilterPanel, etc.)
├── hooks/useAuth.tsx         Auth context provider + useAuth() hook
└── lib/
    ├── types.ts              All TypeScript interfaces (408 lines, single source of truth)
    ├── api.ts                Typed HTTP client for /api/* endpoints
    ├── analytics.ts          GA4 event tracking (30 typed events)
    ├── firebase.ts           Firebase SDK initialization
    └── export.ts             CSV/PDF export utilities

functions/src/                Firebase Cloud Functions backend
├── index.ts                  Express app + route mounting
├── middleware/auth.ts        Token verification, domain check, role guard
├── routes/                   11 Express routers (partners, devices, tiers, etc.)
├── services/                 Business logic (audit, tierEngine, specCompleteness)
└── types/index.ts            Backend type definitions

specs/                        Product specification document (877 lines)
docs/                         Technical documentation
```

## Documentation

| Document | Description |
|---|---|
| [AGENTS.md](./AGENTS.md) | AI agent onboarding guide — read this first if using Cursor, Copilot, or Claude |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Complete deployment guide from fresh checkout to production |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Deep technical architecture: data flow, security model, design decisions |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | Firestore schema reference for all 13 collections |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | Full REST API documentation with request/response examples |
| [specs/Device Source of Truth (DST).md](./specs/Device%20Source%20of%20Truth%20(DST).md) | Original product specification |

## Auth & Access

Login requires a `@disney.com` or `@disneystreaming.com` Google account. Domain restriction is enforced on both the frontend (client-side check after OAuth) and the backend (token verification middleware).

| Role | Permissions |
|---|---|
| Viewer | Read all data, run simulations, use search, view reports |
| Editor | + create/edit devices, specs, partners, bulk-import specs |
| Admin | + manage tiers, upload telemetry, manage partner keys, run migrations, dismiss alerts |

Roles are assigned via the `users` Firestore collection. The first admin must be created manually in Firebase Console (see [DEPLOYMENT.md](./DEPLOYMENT.md#seeding-initial-data)).

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics 4 measurement ID |

All three are prefixed with `VITE_` so Vite includes them in the client bundle. These values are safe to expose — Firebase security relies on Auth tokens and Firestore rules, not API key secrecy.

## Firebase Project

- **Project ID:** `device-source-of-truth`
- **Auth Domain:** `device-source-of-truth.firebaseapp.com`
- **Hosting URL:** `https://device-source-of-truth.web.app`
- **Functions Region:** `us-central1`
- **Runtime:** Node.js 22
