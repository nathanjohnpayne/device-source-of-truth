# Architecture

Deep technical reference for the Device Source of Truth (DST) system architecture, covering runtime behavior, data flow, security boundaries, and design rationale.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                                    │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  React Router │  │  AuthProvider │  │  Analytics   │  │  API Client│  │
│  │  (lazy pages) │  │  (useAuth)   │  │  (GA4)       │  │  (api.ts)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬─────┘  │
│         │                 │                 │                  │         │
└─────────│─────────────────│─────────────────│──────────────────│─────────┘
          │                 │                 │                  │
          │     Firebase Auth SDK             │       HTTP (Bearer token)
          │       (Google OAuth)              │                  │
          │                 │                 │                  │
┌─────────│─────────────────│─────────────────│──────────────────│─────────┐
│  Firebase Platform        │                 │                  │         │
│                           │                 │                  │         │
│  ┌────────────────────────▼─────────┐   ┌──▼──────────────────▼──────┐  │
│  │  Firebase Authentication         │   │  Firebase Hosting          │  │
│  │  (Google OAuth provider)         │   │  (CDN → SPA + /api proxy) │  │
│  └──────────────────────────────────┘   └─────────┬──────────────────┘  │
│                                                   │ /api/** rewrite     │
│  ┌────────────────────────────────────────────────▼──────────────────┐  │
│  │  Cloud Function: api (Express)                                    │  │
│  │  ┌─────────────┐  ┌────────────────┐  ┌───────────────────────┐  │  │
│  │  │  auth.ts     │  │  routes/*.ts   │  │  services/*.ts        │  │  │
│  │  │  middleware   │→│  11 routers    │→│  audit, tierEngine,   │  │  │
│  │  │  (verify     │  │  (CRUD + biz)  │  │  specCompleteness    │  │  │
│  │  │   token,     │  └────────────────┘  └───────────────────────┘  │  │
│  │  │   domain,    │                                                  │  │
│  │  │   role)      │                                                  │  │
│  │  └─────────────┘                                                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                         │                               │
│  ┌──────────────────────────────────────▼───────────────────────────┐   │
│  │  Cloud Firestore (13 collections)                                │   │
│  │  partners, partnerKeys, devices, deviceSpecs, deviceDeployments, │   │
│  │  telemetrySnapshots, hardwareTiers, deviceTierAssignments,       │   │
│  │  auditLog, alerts, uploadHistory, users, config                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────┐  ┌────────────────────────────────┐   │
│  │  Google Analytics 4          │  │  Firebase Storage (optional)   │   │
│  │  (frontend event tracking)   │  │  (questionnaire file uploads)  │   │
│  └──────────────────────────────┘  └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Request Lifecycle

### 1. Authentication Flow

```
Browser                   Firebase Auth            Cloud Function
  │                           │                         │
  │  signInWithPopup(google)  │                         │
  │ ─────────────────────────>│                         │
  │                           │  OAuth consent screen   │
  │  <─ Firebase ID token ────│                         │
  │                           │                         │
  │  (client validates email domain locally)            │
  │                           │                         │
  │  GET /api/partners        │                         │
  │  Authorization: Bearer <token>                      │
  │ ──────────────────────────────────────────────────> │
  │                           │  verifyIdToken(token)   │
  │                           │ <───────────────────── │
  │                           │  {uid, email, ...}     │
  │                           │ ────────────────────>  │
  │                           │                         │
  │                           │  Check email domain     │
  │                           │  Lookup users collection│
  │                           │  Attach req.user        │
  │                           │                         │
  │  <── JSON response ────────────────────────────────│
```

Token verification happens on every request. The middleware:
1. Extracts the Bearer token from the Authorization header
2. Calls `admin.auth().verifyIdToken()` to validate with Firebase
3. Checks email domain against the allowlist (`@disney.com`, `@disneystreaming.com`)
4. Looks up the user's role from the `users` Firestore collection
5. Attaches `req.user` with `{ uid, email, role, displayName }` for downstream handlers

### 2. API Request Flow

All API calls follow this pattern:

```
Page component
  └─ calls api.devices.list({ page: 1 })
      └─ apiFetch('/devices?page=1')
          ├─ auth.currentUser.getIdToken()  (auto-refreshes expired tokens)
          ├─ fetch('/api/devices?page=1', { headers: { Authorization: Bearer ... } })
          │   └─ Firebase Hosting rewrites /api/** → Cloud Function
          │       └─ authenticate middleware → devices router → Firestore queries
          └─ returns typed PaginatedResponse<DeviceWithRelations>
```

### 3. Data Mutation Flow (with audit logging)

```
Editor clicks "Save" on a device
  └─ api.devices.update(id, { certificationStatus: 'Certified' })
      └─ PUT /api/devices/:id
          └─ devices router handler:
              1. Fetch existing document from Firestore
              2. Apply updates
              3. diffAndLog(entityType, entityId, oldDoc, newDoc, userId, email)
                 └─ For each changed field:
                     └─ Write to auditLog collection:
                        { entityType, entityId, field, oldValue, newValue, userId, timestamp }
              4. Save updated document to Firestore
              5. Return updated document
```

---

## Frontend Architecture

### Component Hierarchy

```
BrowserRouter
  └─ AuthProvider (React Context)
      └─ AppRoutes
          ├─ PageViewTracker (fires GA4 page_view on route change)
          ├─ OnboardingGate (shows WelcomeModal on first login)
          ├─ UpdateToast (polls version.json, prompts refresh on new deploy)
          └─ Suspense (loading fallback for lazy-loaded pages)
              └─ Routes
                  ├─ /login → LoginPage
                  └─ ProtectedRoute → AppShell (sidebar + topbar + Outlet)
                      ├─ / → DashboardPage
                      ├─ /devices → DeviceListPage
                      ├─ /devices/new → EditorRoute → DeviceCreatePage
                      ├─ /devices/:id → DeviceDetailPage
                      ├─ /devices/:id/specs/edit → EditorRoute → SpecEditPage
                      ├─ /partners → PartnerListPage
                      ├─ /partners/:id → PartnerDetailPage
                      ├─ /tiers → TierBrowserPage
                      ├─ /tiers/configure → AdminRoute → TierConfigPage
                      ├─ /tiers/simulate → SimulatorPage
                      ├─ /reports/coverage → SpecCoveragePage
                      ├─ /admin → AdminRoute → AdminPage
                      ├─ /admin/upload → AdminRoute → TelemetryUploadPage
                      ├─ /admin/alerts → AdminRoute → AlertsPage
                      ├─ /admin/audit → AdminRoute → AuditLogPage
                      ├─ /admin/migration → AdminRoute → MigrationPage
                      └─ /admin/readiness → AdminRoute → ReadinessPage
```

### Code Splitting Strategy

All 18 page components are lazy-loaded via `React.lazy()`:

```typescript
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
```

Vite's `manualChunks` configuration splits heavy libraries into separate bundles:

| Chunk | Libraries | Rationale |
|---|---|---|
| `firebase` | firebase/app, auth, firestore, analytics | Large SDK, loaded once |
| `recharts` | recharts | Only needed on dashboard/report pages |
| `router` | react-router-dom | Framework dependency |

### State Management

There is no external state library (no Redux, Zustand, etc.). State is managed with:

- **Auth state:** React Context via `AuthProvider`. The `useAuth()` hook provides `user`, `loading`, `error`, `signIn()`, `signOut()`, `isEditor`, `isAdmin`.
- **Page-level state:** `useState` + `useEffect` in each page component. Data is fetched on mount and stored locally. There is no global cache — navigating away and back re-fetches.
- **Form state:** `useState` for form fields, submitted via `api.*` methods.

This is intentional for a POC/internal tool. If the application grows, consider React Query or SWR for data fetching with caching.

### Auto-Update Notification

The `useVersionCheck` hook polls `/version.json` every 60 seconds after the user authenticates. Each production build generates a unique version hash in `version.json` via a Vite plugin (`versionJsonPlugin` in `vite.config.ts`). When the fetched version differs from the one captured at page load, the `UpdateToast` component slides up from the bottom of the screen, prompting the user to refresh. Once shown, polling stops to avoid repeated notifications. The user can dismiss the toast or click Refresh to reload.

### Analytics Integration

The analytics layer (`src/lib/analytics.ts`) provides:

- **30 typed event names** (`AnalyticsEvent` union type)
- **Type-safe parameters** per event (`AnalyticsParams` mapped type)
- **`trackEvent(name, params)`** — generic tracker, no-ops in development (`import.meta.env.DEV`)
- **`trackPageView(pageName, pagePath)`** — called by `PageViewTracker` on every route change

Events flow through `logEvent()` in `src/lib/firebase.ts` → Firebase Analytics SDK → Google Analytics 4. They are viewable in Firebase Console > Analytics.

---

## Backend Architecture

### Express App Structure

A single Express application is exported as the `api` Cloud Function. All middleware and routes are mounted synchronously at module load time:

```
Express app
  ├─ cors({ origin: true })           — allow cross-origin requests
  ├─ express.json({ limit: '50mb' })  — parse JSON bodies up to 50MB (for CSV data)
  ├─ requestLoggingMiddleware         — attaches req.log, logs request/response lifecycle
  ├─ authenticate (middleware)         — runs on all /api/* routes
  ├─ /api/partners       → partnersRouter
  ├─ /api/partner-keys   → partnerKeysRouter
  ├─ /api/devices        → devicesRouter
  ├─ /api/device-specs   → deviceSpecsRouter
  ├─ /api/tiers          → tiersRouter
  ├─ /api/telemetry      → telemetryRouter
  ├─ /api/alerts         → alertsRouter
  ├─ /api/audit          → auditRouter
  ├─ /api/search         → searchRouter
  ├─ /api/reports        → reportsRouter
  ├─ /api/upload         → uploadRouter
  └─ Global error handler (catches unhandled exceptions)
```

### Service Layer

Business logic that spans multiple routes or requires complex computation is extracted into services:

| Service | File | Responsibility |
|---|---|---|
| **Logger** | `services/logger.ts` | Structured logging utility built on `firebase-functions/logger`. Provides request-scoped logging (`req.log`), standalone logging (`log`), request/response middleware, and error formatting. Integrates with Google Cloud Logging. |
| **Audit** | `services/audit.ts` | `logAuditEntry()` writes a single field change. `diffAndLog()` compares two documents and logs every changed field. |
| **Tier Engine** | `services/tierEngine.ts` | `assignTierToDevice(deviceId)` evaluates a device against all tiers (ordered by rank) and assigns the highest qualifying tier. `reassignAllDevices()` re-evaluates every device after a tier definition change. `previewTierAssignment()` and `simulateEligibility()` are read-only variants for what-if analysis. |
| **Spec Completeness** | `services/specCompleteness.ts` | `calculateSpecCompleteness(spec)` counts non-null fields across all 12 spec categories and returns a percentage (0-100). This value is denormalized onto the `devices` document for query performance. |

### Tier Assignment Algorithm

Tiers are ordered by `tierRank` (ascending: Tier 1 = rank 1 = highest). A device qualifies for a tier if it meets **all** of the tier's minimum thresholds:

```
For each tier (sorted by tierRank ascending):
  if device.memory.appAvailableRamMb >= tier.ramMin
  AND device.gpu.gpuMemoryMb >= tier.gpuMin
  AND device.soc.cpuSpeedMhz >= tier.cpuSpeedMin
  AND device.soc.cpuCores >= tier.cpuCoresMin
  AND (tier.require64Bit implies device.soc.is64Bit)
  AND device supports all tier.requiredCodecs
  → ASSIGN this tier and STOP
```

The first matching tier wins (highest tier the device qualifies for). If no tier matches, the device is unassigned.

Tier assignment triggers:
- **`spec_update`** — when device specs are created or updated
- **`tier_definition_update`** — when any tier's thresholds are modified (triggers `reassignAllDevices()`)

Each assignment is recorded in the `deviceTierAssignments` collection for historical tracking.

---

## Security Model

### Defense in Depth

Security is enforced at three layers:

| Layer | Mechanism | What It Protects |
|---|---|---|
| **Frontend** | Route guards (`ProtectedRoute`, `EditorRoute`, `AdminRoute`) | UI navigation — prevents rendering unauthorized pages |
| **Backend Middleware** | `authenticate()` verifies Firebase token + domain. `requireRole()` checks role. | API endpoints — prevents unauthorized data access/mutation |
| **Firestore Rules** | `isAllowedUser()` checks auth + existence in `users` collection | Direct database access — prevents bypassing the API |

### Domain Restriction

Both the frontend and backend independently enforce domain restrictions:
- **Frontend** (`useAuth.tsx`): After Google sign-in, checks `email.split('@')[1]` against `['disney.com', 'disneystreaming.com']`. Signs out immediately if rejected.
- **Backend** (`auth.ts`): Checks the decoded token's email against `['@disney.com', '@disneystreaming.com']`. Returns 403 if rejected.

### Role Enforcement

Roles are stored in the `users` Firestore collection. The `requireRole()` middleware is applied per-route:

```typescript
router.post('/', requireRole('editor', 'admin'), async (req, res) => { ... });
router.delete('/:id', requireRole('admin'), async (req, res) => { ... });
```

### Firestore Rules

Firestore rules provide a safety net against direct client-side database access. In this architecture, the frontend reads `users` directly (for role resolution), but all other data access goes through the Cloud Function (which uses the Admin SDK and bypasses rules). The rules exist as defense-in-depth.

Notably, `auditLog` is read-only at the rules level — no client can directly write audit entries. All audit writes go through the Admin SDK in Cloud Functions.

---

## Data Flow Diagrams

### Telemetry Upload

```
Admin uploads CSV file
  └─ POST /api/telemetry/upload { csvData, snapshotDate, fileName }
      └─ Parse CSV (PapaParse)
      └─ For each row:
          ├─ Find or note partner key
          ├─ Find or note device
          └─ Create telemetrySnapshot document
      └─ Detect anomalies:
          ├─ Unregistered partner keys → create alerts (type: new_partner_key)
          └─ Unregistered device IDs → create alerts (type: unregistered_device)
      └─ Record uploadHistory entry
      └─ Return { rowCount, successCount, errorCount, errors[] }
```

### Device Spec Update

```
Editor saves spec form
  └─ PUT /api/device-specs/:deviceId { ...specFields }
      └─ Upsert deviceSpecs document
      └─ diffAndLog() → audit entries for each changed field
      └─ calculateSpecCompleteness() → percentage
      └─ Update devices document with new specCompleteness
      └─ assignTierToDevice() → evaluate tier eligibility
          └─ Update devices document with tierId
          └─ Create deviceTierAssignment history entry
```

### Airtable/CSV Migration

```
Admin uploads AllModels CSV
  └─ POST /api/upload/migration { csvData }
      └─ Parse CSV
      └─ For each row:
          ├─ Create or update partner document
          ├─ Create or update partnerKey document
          ├─ Create device document
          ├─ Create deviceSpec document (if spec columns present)
          ├─ Calculate spec completeness
          └─ Assign tier
      └─ Return { success, errors[] }
```

---

## Performance Characteristics

### Firestore Considerations

- **No server-side joins.** The backend manually fetches related collections (e.g., device detail page fetches partner, partnerKey, spec, tier, deployments, telemetry, and audit separately). This is inherent to Firestore's document model.
- **Pagination** is implemented client-side by fetching all matching documents and slicing. For collections with fewer than 10,000 documents, this is acceptable. For scale, switch to Firestore cursor-based pagination.
- **Denormalized fields** (`specCompleteness` on devices, `activeDeviceCount` on devices) avoid expensive aggregation queries at read time.

### Cloud Functions Cold Starts

The `api` function has a cold start of approximately 3-8 seconds (Node.js 22 runtime + Express + Firebase Admin SDK initialization). Subsequent requests within the instance lifecycle are fast (< 100ms for simple queries).

Mitigation options:
1. Set `minInstances: 1` in the function config (incurs constant cost)
2. Schedule a keep-alive ping every 5 minutes from Cloud Scheduler

### Frontend Bundle Size

The Vite build produces ~4 code-split chunks plus per-page chunks:
- `firebase` chunk: ~200KB gzipped
- `recharts` chunk: ~80KB gzipped
- `router` chunk: ~30KB gzipped
- Per-page chunks: 5-20KB each

Pages load on-demand. The initial login page load is minimal.

---

## Logging & Observability

### Backend Logging

All backend logging is built on `firebase-functions/logger`, which integrates directly with Google Cloud Logging. Logs are structured JSON and viewable in both the Firebase Console (Functions > Logs) and Google Cloud Console (Logging > Logs Explorer).

**Log Levels:**

| Level | Usage |
|---|---|
| `debug` | Firestore query details, filter chain results, tier evaluation per-device, spec completeness category breakdown |
| `info` | Request completed, entity created/updated/deleted, bulk operation summaries, tier assignment outcomes |
| `warn` | Validation failures, 4xx responses, missing entities, auth rejections, domain check failures |
| `error` | 5xx responses, unhandled exceptions (with stack traces), Firestore write failures |

**Request-Scoped Logging:**

The `requestLoggingMiddleware` in `services/logger.ts` attaches a `req.log` logger to every request. Each log entry includes:
- `requestId` — 8-character UUID for correlating all logs from a single request
- `method` / `path` — HTTP method and route
- `elapsedMs` — time from request start to response

Every route handler uses `req.log` for contextual logging. Service-layer functions use the standalone `log` object from `logger.ts`.

**What Gets Logged:**

| Layer | Logged Events |
|---|---|
| Request lifecycle | Entry (method, path, query params, user-agent, IP), completion (status code, elapsed ms) |
| Authentication | Token verification attempts, domain validation, user lookup/auto-provisioning, role resolution |
| Route handlers | Entity IDs, filter parameters, result counts, mutations with field lists, user attribution |
| Tier engine | Per-device tier evaluation results, full reassignment distribution summary |
| Spec completeness | Per-category filled/total breakdown |
| Audit service | Diff field count, audit entry writes |
| Telemetry upload | CSV parse results, batch write progress, alert generation counts |
| Bulk operations | Row-by-row error logging, final created/duplicate/error breakdowns |

### Frontend Logging

The `apiFetch` wrapper in `src/lib/api.ts` logs all API interactions to the browser console in development mode (`import.meta.env.DEV`):
- Request start (method + path)
- Response completion (status + elapsed ms)
- Error details (status, error body, network failures)
- Warnings for unauthenticated requests

Frontend logging is suppressed in production builds.

### Viewing Logs

```bash
# Stream live logs from the deployed function
firebase functions:log --only api

# View in Google Cloud Console
# https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_function%22
```

In Cloud Logging, filter by `jsonPayload.service = "DST"` to isolate DST logs. Use `jsonPayload.requestId` to trace a single request across all log entries.

---

## Design Decisions and Trade-offs

| Decision | Rationale | Trade-off |
|---|---|---|
| Single Cloud Function for all routes | Simpler deployment, shared middleware, consistent auth | Single cold start affects all routes |
| Express on Cloud Functions (not callable functions) | Standard REST API, testable with curl/Postman, familiar patterns | Slightly more boilerplate than Firebase callable functions |
| No ORM/ODM (raw Firestore Admin SDK) | Fewer dependencies, full control over queries | Manual serialization/deserialization |
| Types duplicated in frontend and backend | TypeScript `rootDir` constraint prevents sharing across two build roots | Must manually keep `src/lib/types.ts` and `functions/src/types/index.ts` in sync |
| Client-side pagination (fetch all, slice) | Simple implementation, works for current data volumes (<10K docs per collection) | Will not scale to 100K+ documents per collection |
| No caching layer | Firestore is fast enough for internal tool usage | Repeated identical queries hit Firestore each time |
| Audit log is append-only | Complete change history, tamper-resistant | Grows without bound; may need retention policy |
| GA4 for analytics (not custom) | Zero infrastructure, built-in dashboards, free tier is generous | Limited to Firebase Analytics event model |
| Structured logging via `firebase-functions/logger` | Zero setup, automatic Cloud Logging integration, structured JSON, filterable in GCP console | Debug-level logs in high-throughput routes add Firestore read latency logging overhead; may need log level tuning in production |
