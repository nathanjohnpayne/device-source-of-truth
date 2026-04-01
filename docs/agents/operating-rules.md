# Agent Operating Rules

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

## Production Log Access

The `api` Cloud Function (2nd gen, Cloud Run-backed) is the single backend entry point. All logs flow through Google Cloud Logging.

### Quick Commands

#### Recent logs (human-readable, newest first)
```
firebase functions:log
```

#### Errors only (last 24h)
```
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND severity>=ERROR' --limit 20 --format=json --project=device-source-of-truth
```

#### HTTP 4xx/5xx responses
```
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND jsonPayload.statusCode>=400' --limit 20 --format=json --project=device-source-of-truth
```

#### Logs for a specific API route (regex match)
```
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND jsonPayload.path=~"/api/ROUTE_PREFIX"' --limit 20 --format=json --project=device-source-of-truth
```

#### Logs for a specific request ID
```
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND jsonPayload.requestId="REQUEST_ID"' --limit 50 --format=json --project=device-source-of-truth
```

#### Logs within a time window
```
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND timestamp>="2026-03-04T00:00:00Z" AND timestamp<="2026-03-04T23:59:59Z"' --limit 50 --format=json --project=device-source-of-truth
```

#### Logs mentioning a specific user email
```
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND jsonPayload.email="USER@disneystreaming.com"' --limit 20 --format=json --project=device-source-of-truth
```

#### Slow requests (> 1000ms)
```
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="api" AND jsonPayload.elapsedMs>1000' --limit 20 --format=json --project=device-source-of-truth
```

### Log Structure

Every request is logged with structured JSON containing:
- `requestId` — unique per request, trace across auth/handler/completion logs
- `method` — HTTP method
- `path` — full API path (e.g., `/api/devices`)
- `statusCode` — HTTP response status (on completion log)
- `elapsedMs` — request duration in ms (on completion log)
- `email` — authenticated user email (on auth log)
- `role` — user role: viewer/editor/admin (on auth log)
- `service` — always "DST"
- `error` — error object with `errorMessage`, `errorName`, `stack` (on error logs)

### Firestore Data Inspection

For direct Firestore queries during debugging, use the Firebase console or:
```
gcloud firestore documents list --collection=COLLECTION_NAME --project=device-source-of-truth --limit=5
```

### Firebase Hosting Logs

For frontend hosting/CDN issues:
```
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="device-source-of-truth"' --limit 10 --format=json --project=device-source-of-truth
```

### Tips

- Use `--format=json` for full structured data; use `--format="table(timestamp,severity,jsonPayload.message,jsonPayload.path,jsonPayload.statusCode)"` for a compact table view.
- Combine filters with `AND`. Use `=~` for regex matching on string fields.
- The `firebase functions:log` command is simpler but less filterable than `gcloud logging read`.
- For real-time tailing, use `gcloud logging tail` (requires beta component).
