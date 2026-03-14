# Deployment Guide

> This guide covers deploying the existing project. For **new project setup** (create Firebase project, `firebase init`, first-time credential setup), see `ai_agent_repo_template/DEPLOYMENT.md` in the sibling directory.

This document covers everything needed to deploy the Device Source of Truth (DST) application from a fresh checkout to production, including prerequisite setup, environment configuration, CI/CD considerations, and operational runbooks.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Project Setup](#firebase-project-setup)
3. [Local Development Environment](#local-development-environment)
4. [Building the Application](#building-the-application)
5. [Deploying to Firebase](#deploying-to-firebase)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Seeding Initial Data](#seeding-initial-data)
8. [Firebase Console Configuration](#firebase-console-configuration)
9. [Custom Domain Setup](#custom-domain-setup)
10. [Monitoring and Observability](#monitoring-and-observability)
11. [Rollback Procedures](#rollback-procedures)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 22.x | Cloud Functions runtime + frontend build |
| npm | 10+ | Package management |
| Firebase CLI | 13+ | Deploy to Firebase services |
| 1Password CLI | latest | Non-interactive credential management (`op`) |
| Git | 2.30+ | Version control |

### Install Firebase CLI

```bash
npm install -g firebase-tools
```

Do not run `firebase login`. Authentication is handled entirely through 1Password — see [First-Time Setup](#first-time-setup).

### Access Required

Access to `Private/Firebase Deploy - device-source-of-truth` in 1Password. This item is created by `op-firebase-setup` and contains the service account key used for all deploys.

### Required Firebase Services

These must be enabled in the [Firebase Console](https://console.firebase.google.com/project/device-source-of-truth):

- **Authentication** — with Google sign-in provider enabled
- **Cloud Firestore** — in production mode (not test mode)
- **Cloud Functions** — requires Blaze (pay-as-you-go) billing plan
- **Firebase Hosting** — for serving the SPA
- **Google Analytics** — linked to the Firebase project

### Required GCP APIs

If Cloud Functions or Analytics fail to deploy, ensure these APIs are enabled in [Google Cloud Console](https://console.cloud.google.com/apis/library):

- Cloud Functions API
- Cloud Build API
- Artifact Registry API
- Cloud Run API
- Eventarc API
- Google Analytics Data API

### Cloud Functions Build Service Account (Critical)

2nd gen Cloud Functions use the **default compute service account** as the build service account. This service account must have the following IAM roles or the function deploy will fail with "Could not build the function due to a missing permission on the build service account":

```bash
PROJECT_NUMBER=$(gcloud projects describe device-source-of-truth --format='value(projectNumber)')

gcloud projects add-iam-policy-binding device-source-of-truth \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding device-source-of-truth \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding device-source-of-truth \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding device-source-of-truth \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

IAM changes can take 1-2 minutes to propagate before retrying the deploy.

For this project, the project number is `492056482296`, so the build service account is `492056482296-compute@developer.gserviceaccount.com`.

---

## Firebase Project Setup

### Project Configuration

The project is configured in `.firebaserc`:

```json
{
  "projects": {
    "default": "device-source-of-truth"
  }
}
```

The Firebase project ID is `device-source-of-truth`. All CLI commands will target this project unless overridden with `--project`.

### Authentication Provider

Google sign-in must be configured in Firebase Console > Authentication > Sign-in method:

1. Enable **Google** provider
2. Set the project support email
3. No additional OAuth scopes are required

Domain restriction is enforced in application code (not at the Firebase level). The backend middleware (`functions/src/middleware/auth.ts`) rejects tokens from email addresses outside `@disney.com` and `@disneystreaming.com`. The frontend (`src/hooks/useAuth.tsx`) also validates domains client-side.

---

## Local Development Environment

### 1. Clone and Install

```bash
git clone https://github.com/nathanjohnpayne/device-source-of-truth.git
cd device-source-of-truth

# Install frontend dependencies
npm install

# Install backend dependencies
cd functions && npm install && cd ..
```

### 2. Environment Variables

Copy the example and fill in real values:

```bash
cp .env.example .env
```

The `.env` file requires three values:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_APP_ID=1:492056482296:web:...
VITE_FIREBASE_MEASUREMENT_ID=G-...
```

Find these in Firebase Console > Project Settings > General > Your apps > Web app.

These keys are safe to embed in the client bundle. Firebase security relies on Auth tokens and Firestore rules, not API key secrecy.

### 3. Run the Frontend Dev Server

```bash
npm run dev
```

This starts Vite on `http://localhost:5173` with hot module replacement. The frontend will call the **production** Cloud Functions API at `https://device-source-of-truth.web.app/api/*` unless you configure a local proxy.

### 4. Run Cloud Functions Locally (Optional)

To run the backend locally with the Firebase Emulator:

```bash
# Build the functions first
cd functions && npm run build && cd ..

# Start the emulator suite
firebase emulators:start --only functions,firestore
```

The emulator runs Functions at `http://localhost:5001` and Firestore at `http://localhost:8080`. To point the frontend at the local emulator, add a proxy in `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': 'http://localhost:5001/device-source-of-truth/us-central1/api'
  }
}
```

### 5. Run Functions in Watch Mode

For backend development with auto-recompilation:

```bash
cd functions && npm run dev
```

This runs `tsc --watch` to recompile on file changes. Combined with the emulator, this gives a fast backend development loop.

---

## Building the Application

### Frontend Build

```bash
npm run build
```

This runs `tsc -b` (TypeScript type-checking) followed by `vite build`. The output goes to `dist/` and includes:

- Code-split chunks (firebase, recharts, router are separate bundles)
- Tree-shaken and minified production bundles
- Static assets with content hashes
- `version.json` — auto-generated by the `versionJsonPlugin` Vite plugin with a unique 12-character hex hash per build. The frontend polls this file to detect new deployments and prompt users to refresh.

### Backend Build

```bash
cd functions && npm run build
```

This runs `tsc` and outputs to `functions/dist/`. The Cloud Functions runtime loads `functions/dist/index.js`.

### Full Build (Both)

```bash
npm run build && cd functions && npm run build && cd ..
```

Always build both before deploying. The frontend build is independent of the backend build.

---

## Deploying to Firebase

All deploys use `op-firebase-deploy` for non-interactive 1Password auth. Never run `firebase deploy` directly.

### Deploy Everything

```bash
op-firebase-deploy device-source-of-truth
```

This deploys all four services:
- **Hosting** — uploads `dist/` to Firebase CDN
- **Functions** — deploys the `api` Cloud Function to `us-central1`
- **Firestore Rules** — applies `firestore.rules` to the database
- **Firestore Indexes** — applies `firestore.indexes.json`

The script reads `Private/Firebase Deploy - device-source-of-truth` from 1Password (Touch ID prompt), sets `GOOGLE_APPLICATION_CREDENTIALS`, and runs `firebase deploy --non-interactive`. No browser auth required.

### First-Time Setup

Run once per machine to create the service account key and store it in 1Password:

```bash
op-firebase-setup device-source-of-truth
```

### Selective Deployment

```bash
# Frontend only
op-firebase-deploy device-source-of-truth --only hosting

# Backend only
op-firebase-deploy device-source-of-truth --only functions

# Security rules only
op-firebase-deploy device-source-of-truth --only firestore:rules

# Indexes only
op-firebase-deploy device-source-of-truth --only firestore:indexes

# Hosting + Functions (skip rules)
op-firebase-deploy device-source-of-truth --only hosting,functions
```

### Deployment Targets

| Service | Source | Deployed To |
|---|---|---|
| Hosting | `dist/` | `https://device-source-of-truth.web.app` |
| Functions | `functions/dist/` | `https://us-central1-device-source-of-truth.cloudfunctions.net/api` |
| Firestore Rules | `firestore.rules` | Applied to the Firestore database |
| Firestore Indexes | `firestore.indexes.json` | Applied as composite indexes |

### Hosting Rewrites

`firebase.json` configures two rewrite rules:

1. `/api/**` → proxied to the `api` Cloud Function
2. `**` → falls back to `/index.html` (SPA client-side routing)

This means the SPA and the API share the same domain. API calls from the browser go to `https://device-source-of-truth.web.app/api/*` and are transparently routed to the Cloud Function.

---

## Post-Deployment Verification

After deploying, verify these endpoints:

### 1. Hosting (Frontend)

Open `https://device-source-of-truth.web.app` in a browser. You should see the login page.

### 2. Cloud Function (API)

```bash
# This should return 401 (no auth token) — that's correct behavior
curl -s -o /dev/null -w "%{http_code}" https://device-source-of-truth.web.app/api/partners
# Expected: 401
```

### 3. Firestore Rules

In Firebase Console > Firestore > Rules, verify the deployed rules match `firestore.rules`.

### 4. Authentication Flow

1. Click "Sign in with Google" on the login page
2. Use a `@disney.com` or `@disneystreaming.com` account
3. Verify you reach the dashboard

### 5. Google Analytics

In Firebase Console > Analytics > DebugView, verify `page_view` events are firing from the deployed site.

---

## Seeding Initial Data

The application requires some seed data in Firestore before it is fully functional.

### Create the First Admin User

In Firebase Console > Firestore > Data, manually create a document:

**Collection:** `users`
**Document ID:** (auto-generate or use the user's email)

```json
{
  "email": "your.name@disney.com",
  "role": "admin",
  "displayName": "Your Name",
  "photoUrl": null,
  "lastLogin": "2026-02-25T00:00:00.000Z"
}
```

This user can now log in and access all admin features. Additional users inherit a `viewer` role by default; promote them by editing their `users` document.

### Create Initial Hardware Tiers

Navigate to Admin > Tier Configuration in the UI, or create documents manually:

**Collection:** `hardwareTiers`

```json
{
  "tierName": "Tier 1",
  "tierRank": 1,
  "ramMin": 2048,
  "gpuMin": 256,
  "cpuSpeedMin": 1500,
  "cpuCoresMin": 4,
  "requiredCodecs": ["hevc", "av1", "eac3"],
  "require64Bit": true,
  "version": 1,
  "createdAt": "2026-02-25T00:00:00.000Z",
  "updatedAt": "2026-02-25T00:00:00.000Z"
}
```

Repeat for Tier 2 (lower thresholds) and Tier 3 (baseline). Set `tierRank` to 1, 2, 3 respectively — devices are assigned to the highest (lowest rank number) tier they qualify for.

### Import Existing Data

Use the Admin > Migration page to bulk-import devices from a CSV export of your existing Airtable or AllModels spreadsheet. The migration endpoint maps CSV columns to DST fields and creates `partners`, `partnerKeys`, and `devices` documents.

---

## Firebase Console Configuration

### Firestore Indexes

Currently `firestore.indexes.json` is empty (no composite indexes defined). If queries start returning index-required errors in the Cloud Functions logs, Firestore will provide a direct link to create the needed index. Add the index definition to `firestore.indexes.json` afterward for reproducibility.

### Cloud Functions Configuration

The `api` function runs on:
- **Region:** `us-central1`
- **Runtime:** Node.js 22
- **Timeout:** 60s (default)
- **Memory:** 256MB (default)

To adjust memory or timeout for production workloads:

```bash
firebase functions:config:set ...
```

Or modify the `onRequest` options in `functions/src/index.ts`:

```typescript
export const api = onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 120,
}, app);
```

### CORS

CORS is configured in `functions/src/index.ts` with `cors({ origin: true })`, allowing requests from any origin. For production hardening, restrict to your domain:

```typescript
app.use(cors({ origin: 'https://device-source-of-truth.web.app' }));
```

---

## Custom Domain Setup

To serve DST from a custom domain (e.g., `dst.disneystreaming.com`):

1. Go to Firebase Console > Hosting > Custom Domains
2. Click **Add custom domain**
3. Enter the domain name
4. Add the provided DNS TXT and A/AAAA records in your DNS provider
5. Wait for SSL certificate provisioning (automatic, may take up to 24 hours)

Firebase Hosting will serve the same content on both the custom domain and the `*.web.app` domain.

---

## Monitoring and Observability

### Cloud Functions Logs

```bash
# Stream live logs
firebase functions:log --only api

# View in Cloud Console
# https://console.cloud.google.com/logs?project=device-source-of-truth
```

### Error Monitoring

Cloud Functions errors appear in:
- Firebase Console > Functions > Logs
- Google Cloud Console > Error Reporting

### Google Analytics

The frontend tracks 30+ typed events defined in `src/lib/analytics.ts`. View them in:
- Firebase Console > Analytics > Events
- Firebase Console > Analytics > DebugView (real-time, debug builds only)

Key events to monitor:
- `login` / `login_failed` — authentication health
- `device_register` / `device_update` — write activity
- `telemetry_upload` — data ingestion
- `export` — data export usage

### Firestore Usage

Monitor read/write/delete operations in Firebase Console > Firestore > Usage. Watch for:
- High read counts from list endpoints (pagination should limit these)
- `reassignAllDevices` after tier changes can generate many writes

---

## Rollback Procedures

### Hosting Rollback

Firebase Hosting keeps a history of deployments. To roll back:

1. Go to Firebase Console > Hosting > Release history
2. Click the three-dot menu on the previous release
3. Click "Rollback to this release"

Or via CLI:

```bash
firebase hosting:clone device-source-of-truth:PREVIOUS_VERSION device-source-of-truth:live
```

### Functions Rollback

There is no built-in rollback for Cloud Functions. To roll back:

1. Check out the previous commit: `git checkout <commit-hash>`
2. Rebuild: `cd functions && npm run build`
3. Redeploy: `firebase deploy --only functions`

### Firestore Rules Rollback

Rules are versioned in Git. To roll back:

1. Check out the previous `firestore.rules`
2. Deploy: `firebase deploy --only firestore:rules`

---

## Troubleshooting

### "Permission denied" on deploy

```
Error: Missing permissions required for functions deploy.
```

**Fix:** Ensure the `firebase-deployer` service account key in 1Password (`Private/Firebase Deploy - device-source-of-truth`) is valid. Re-run `op-firebase-setup device-source-of-truth` to regenerate it.

### Functions deploy fails with "Could not build the function due to a missing permission"

```
Build failed with status: FAILURE. Could not build the function due to a missing permission on the build service account.
```

**Fix:** This is the most common deployment issue. 2nd gen Cloud Functions use the default compute service account as the build SA, and it needs explicit IAM roles. Run the `gcloud` commands in the [Cloud Functions Build Service Account](#cloud-functions-build-service-account-critical) section, wait 1-2 minutes for IAM propagation, then retry `firebase deploy --only functions`.

### Functions deploy fails with "Build failed" (other)

```
Error: Failed to create function api
```

**Fix:**
1. Ensure `cd functions && npm run build` succeeds locally with no TypeScript errors
2. Check that `functions/package.json` has `"main": "dist/index.js"`
3. Verify the Blaze billing plan is active (Cloud Functions requires it)

### "API key not valid" in browser console

**Fix:** Verify `.env` contains the correct `VITE_FIREBASE_API_KEY` from Firebase Console > Project Settings.

### Cloud Function returns 401 for valid users

**Possible causes:**
1. No `users` document exists for the email — create one in Firestore
2. The email domain is not `@disney.com` or `@disneystreaming.com`
3. The Firebase Auth token has expired — the client should auto-refresh, but force sign-out/sign-in if needed

### Cloud Function cold starts are slow

The first request after a period of inactivity may take 3-10 seconds. This is normal for Firebase Cloud Functions. To reduce cold starts:

1. Set minimum instances (costs money): modify `onRequest({ minInstances: 1 })`
2. Reduce the function bundle size by auditing `functions/package.json` dependencies

### Firestore "index required" errors

When Cloud Functions logs show:

```
Error: 9 FAILED_PRECONDITION: The query requires an index.
```

Click the URL in the error message to create the index in Firebase Console, then add the definition to `firestore.indexes.json`.

### Vite build warns about large chunks

Warnings about chunk sizes over 500kB are informational. The build uses manual chunk splitting for `firebase`, `recharts`, and `react-router-dom`. These warnings don't affect functionality.
