# Deployment Guide

> This guide covers deploying the existing project. For **new project setup** (create Firebase project, `firebase init`, first-time credential setup), see `mergepath/DEPLOYMENT.md` in the sibling directory.

This document covers everything needed to deploy the Device Source of Truth (DST) application from a fresh checkout to production, including prerequisite setup, environment configuration, CI/CD considerations, and operational runbooks.

---

## New Machine Setup

Run these steps on any new or temporary machine. Tell your AI agent:

> "Set up this machine for development. Run the new machine setup from DEPLOYMENT.md."

### 1. Install system tools

```bash
# 1Password CLI
brew install --cask 1password-cli

# Firebase CLI
npm install -g firebase-tools

# Google Cloud SDK
brew install google-cloud-sdk

# GitHub CLI
brew install gh
```

### 2. Authenticate

```bash
# 1Password — enables biometric unlock for op CLI
# (Follow the prompts to sign in and enable Touch ID)
op signin

# GitHub CLI
gh auth login

# Google Cloud — use 1Password-backed ADC (no interactive login needed
# if op is authenticated and the GCP ADC item exists in 1Password)
```

### 3. Install deploy scripts

```bash
# Clone the template repo if not already present
git clone https://github.com/nathanjohnpayne/mergepath.git ~/Documents/GitHub/mergepath

# Install canonical helper scripts
mkdir -p ~/.local/bin
cp ~/Documents/GitHub/mergepath/scripts/gcloud/gcloud ~/.local/bin/
cp ~/Documents/GitHub/mergepath/scripts/firebase/op-firebase-deploy ~/.local/bin/
cp ~/Documents/GitHub/mergepath/scripts/firebase/op-firebase-setup ~/.local/bin/
chmod +x ~/.local/bin/gcloud ~/.local/bin/op-firebase-deploy ~/.local/bin/op-firebase-setup

# Ensure PATH includes ~/.local/bin
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

### 4. Clone and bootstrap all repos

```bash
cd ~/Documents/GitHub

for repo in friends-and-family-billing device-platform-reporting device-source-of-truth swipewatch nathanpaynedotcom overridebroadway; do
  git clone "https://github.com/nathanjohnpayne/$repo.git" 2>/dev/null || (cd "$repo" && git pull)
  cd "$repo"
  ./scripts/bootstrap.sh    # restores .env.local from 1Password via op inject
  cd ..
done
```

The bootstrap script for each repo:
- Resolves `op://` references in `.env.tpl` → writes `.env.local` (via `op inject`)
- Runs `npm install`
- Runs `npm run build` (if applicable)

### 5. Verify

```bash
# Quick check that each repo's local config was restored
for repo in friends-and-family-billing device-platform-reporting device-source-of-truth overridebroadway; do
  echo "=== $repo ==="
  ls ~/Documents/GitHub/$repo/.env* 2>/dev/null || echo "  (no env files expected)"
done
```

---

## Returning to Your Main Machine

When you return from a temporary machine, tell your agent:

> "Sync any changes from this session back. Run the return-to-main workflow from DEPLOYMENT.md."

### 1. On the temporary machine (before leaving)

```bash
cd ~/Documents/GitHub
for repo in friends-and-family-billing device-platform-reporting device-source-of-truth swipewatch nathanpaynedotcom overridebroadway; do
  cd "$repo"
  # Push any local config changes to 1Password
  ./scripts/bootstrap.sh --sync
  # Ensure all code changes are committed and pushed
  git status
  cd ..
done
```

### 2. On the main machine (when you return)

```bash
cd ~/Documents/GitHub
for repo in friends-and-family-billing device-platform-reporting device-source-of-truth swipewatch nathanpaynedotcom overridebroadway; do
  cd "$repo"
  git pull                          # get code changes from the temp machine
  ./scripts/bootstrap.sh --force    # re-resolve .env.tpl from 1Password (latest values)
  cd ..
done
```

The `--force` flag overwrites existing `.env.local` files with freshly resolved
values from 1Password. This ensures you pick up any secrets that were updated
on the temporary machine via `--sync`.

### Conflict resolution

If both machines modified the same 1Password item:
- 1Password keeps the latest write (last-writer-wins)
- The `.env.tpl` templates are in git, so structural changes merge normally
- For true conflicts, compare with `op item get <id>` and resolve manually

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
| Google Cloud SDK (`gcloud`) | latest | 1Password-backed source credential bootstrap, impersonation setup, and Google API access |
| 1Password CLI | latest | Shared GCP source credential access plus runtime secret materialization for `functions/.env.tpl` |
| Git | 2.30+ | Version control |

### Install Firebase CLI

```bash
npm install -g firebase-tools
```

Do not run `firebase login`. Authentication is handled through a shared 1Password-backed GCP ADC source credential plus service account impersonation — see [First-Time Setup](#first-time-setup).

This 1Password-first source-credential model is a deliberate project decision. Do not replace it with ADC-first day-to-day docs, routine browser-login steps, or long-lived deploy keys unless a human explicitly asks for that change.

### Access Required

Access to the project SA key in `op://Firebase/device-source-of-truth — Firebase Deployer SA Key` (preferred for CI/headless) or the shared 1Password source credential `op://Private/c2v6emkwppjzjjaq2bdqk3wnlm/credential`, or another explicit `GOOGLE_APPLICATION_CREDENTIALS` file. Permission to impersonate `firebase-deployer@device-source-of-truth.iam.gserviceaccount.com` (skipped when using the project SA key directly). If you are deploying functions, you also need access to the Anthropic secret referenced by `functions/.env.tpl`.

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

## Machine User Setup (New Project)

When creating a new repository from this template, complete these steps to enable the AI agent cross-review system. All steps are manual (human-only) unless noted.

### 1. Add machine users as collaborators

Go to the new repo → Settings → Collaborators → Invite each:

- `nathanpayne-claude` — Write access
- `nathanpayne-codex` — Write access
- `nathanpayne-cursor` — Write access

### 2. Accept collaborator invitations

Log into each machine user account and accept the invitation:

- https://github.com/notifications (as `nathanpayne-claude`)
- https://github.com/notifications (as `nathanpayne-codex`)
- https://github.com/notifications (as `nathanpayne-cursor`)

Alternatively, use `gh` CLI or the invite URL directly: `https://github.com/{owner}/{repo}/invitations`

**Note:** Fine-grained PATs cannot accept invitations via API. Use the browser or a classic PAT with `repo` scope.

### 3. Store PATs as repository secrets

Go to the new repo → Settings → Secrets and variables → Actions → New repository secret. Add:

| Secret name | Value | PAT type |
|---|---|---|
| `REVIEWER_ASSIGNMENT_TOKEN` | PAT for `nathanjohnpayne` | Fine-grained OK (owns repo) |

Or use the CLI (faster):

```bash
gh secret set REVIEWER_ASSIGNMENT_TOKEN --repo {owner}/{repo} --body "$(op read 'op://Private/sm5kopwk6t6p3xmu2igesndzhe/token')"
```

**Reviewer identity PATs (`nathanpayne-claude`, `nathanpayne-codex`,
`nathanpayne-cursor`) are intentionally NOT stored as repo CI secrets.**
Phase 2 internal self-peer review runs in the agent's own session: the
agent switches its Git identity to its reviewer account with a PAT
read directly from 1Password (`op read 'op://Private/<item-id>/token'`)
and posts the review with that PAT. See REVIEW_POLICY.md § Phase 2 and
each repo's `CLAUDE.md` / `AGENTS.md` for the identity-switch procedure.

**Do NOT add `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `CLAUDE_PAT` /
`CODEX_PAT` / `CURSOR_PAT` as repo secrets.** An earlier iteration of
`agent-review.yml` had an `invoke-reviewer` job that ran the Claude
Code CLI headlessly as a CI-side reviewer; this was the wrong flow
(parallel to the authoring session, stale-API-key failure surface,
duplicate work) and was removed. Phase 2 now lives entirely inside
the authoring agent's session.

### 4. Configure branch protection

Go to the new repo → Settings → Branches → Add branch protection rule for `main`:

1. **Require pull request reviews before merging:** Yes
2. **Required number of approving reviews:** 1
3. **Dismiss stale pull request approvals when new commits are pushed:** Yes
4. **Require status checks to pass before merging:** Yes
   - Add `Self-Review Required`
   - Add `Label Gate`
5. **Do not allow bypassing the above settings:** Disabled (so Nathan can force-merge in emergencies)

Or use the CLI:

```bash
gh api --method PUT "repos/{owner}/{repo}/branches/main/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      {"context": "Self-Review Required"},
      {"context": "Label Gate"}
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null
}
EOF
```

**Note:** Branch protection requires the repo to be public, or requires GitHub Pro/Team for private repos.

**Known issue:** The `Self-Review Required` and `Label Gate` status checks are
configured as required but may never report if the CI workflows that post them
(`pr-review-policy.yml`) fail silently due to misconfigured repository secrets.
This blocks all merges. Workarounds:
- Fix the CI secrets so status checks report, **or**
- Use the GitHub web UI "Merge without waiting for requirements" bypass checkbox

The `--admin` flag on `gh pr merge` does **not** bypass required status checks —
it only bypasses review requirements. The break-glass hook (`BREAK_GLASS_ADMIN=1`)
only bypasses the Claude Code PreToolUse guard, not GitHub's branch protection API.

### 5. Create required labels

The workflows expect these labels to exist. Create them if they don't:

```bash
gh label create "needs-external-review" --color "D93F0B" --description "Blocks merge until external reviewer approves" --repo {owner}/{repo}
gh label create "needs-human-review" --color "B60205" --description "Agent disagreement — requires human review" --repo {owner}/{repo}
gh label create "policy-violation" --color "000000" --description "Review policy violation detected" --repo {owner}/{repo}
gh label create "audit" --color "FBCA04" --description "Weekly PR audit report" --repo {owner}/{repo}
```

### 6. Verify setup

Run these checks after completing the steps above:

```bash
REPO="{owner}/{repo}"

# Check collaborators
echo "=== Collaborators ==="
gh api "repos/$REPO/collaborators" --jq '.[].login'

# Check secrets exist
echo "=== Secrets ==="
gh secret list --repo "$REPO"

# Check branch protection
echo "=== Branch Protection ==="
DEFAULT=$(gh api "repos/$REPO" --jq '.default_branch')
gh api "repos/$REPO/branches/$DEFAULT/protection/required_status_checks" --jq '.checks[].context'

# Check labels
echo "=== Labels ==="
gh label list --repo "$REPO" --search "needs-external-review"
gh label list --repo "$REPO" --search "needs-human-review"
gh label list --repo "$REPO" --search "policy-violation"
```

### Token type: classic PATs required

Machine user reviewer identities (nathanpayne-claude, etc.) are **collaborators**,
not repo owners. GitHub fine-grained PATs on personal accounts only cover repos
owned by the token account — they cannot access collaborator repos. The "All
repositories" scope in fine-grained PATs means all repos the account *owns* (zero
for collaborators), not repos they collaborate on.

**Use classic PATs with `repo` scope for all reviewer identities.** This is stored
in 1Password with the field name `token` (not `credential` or `password`).

1Password item IDs (all classic PATs with `ghp_` prefix, field `token`, vault `Private`):

| Reviewer Identity | 1Password Item ID | `op read` command |
|---|---|---|
| `nathanpayne-claude` | `pvbq24vl2h6gl7yjclxy2hbote` | `op read "op://Private/pvbq24vl2h6gl7yjclxy2hbote/token"` |
| `nathanpayne-cursor` | `bslrih4spwxgookzfy6zedz5g4` | `op read "op://Private/bslrih4spwxgookzfy6zedz5g4/token"` |
| `nathanpayne-codex` | `o6ekjxjjl5gq6rmcneomrjahpu` | `op read "op://Private/o6ekjxjjl5gq6rmcneomrjahpu/token"` |
| `nathanjohnpayne` | `sm5kopwk6t6p3xmu2igesndzhe` | `op read "op://Private/sm5kopwk6t6p3xmu2igesndzhe/token"` |

Use the item ID (not the item title) to avoid shell issues with parentheses in
1Password item names like `GitHub PAT (pr-review-claude)`.

### Reviewer PAT quick check

Before asking a reviewer identity to approve a PR, verify the token with
`gh api user` and then reuse the same explicit `GH_TOKEN` override for
`gh pr review`:

```bash
# Example: verify the Claude reviewer identity before approving a PR
GH_TOKEN="$(op read 'op://Private/pvbq24vl2h6gl7yjclxy2hbote/token')" \
  gh api user --jq '.login'
# expected: nathanpayne-claude

GH_TOKEN="$(op read 'op://Private/pvbq24vl2h6gl7yjclxy2hbote/token')" \
  gh pr review <PR#> --repo <owner/repo> --approve --body "Review comment"
```

- Use the item ID from the table above for your agent identity. Do not use the 1Password item title.
- If `gh auth status` still shows `nathanjohnpayne`, that is okay.
  `GH_TOKEN=...` overrides the ambient login for that command.
- On local interactive machines, the `op read` command itself may trigger the
  1Password biometric prompt even if `op whoami` says you are not signed in.
- `Review Can not approve your own pull request` means the wrong GitHub
  identity is still being used. Check the table above and verify you are using
  your agent's item ID, not the author identity's.

### Token rotation (as needed)

The current PATs are set to never expire. If you ever need to rotate
a reviewer identity PAT (`nathanpayne-claude`, `nathanpayne-codex`,
`nathanpayne-cursor`):

1. Generate a new **classic** PAT with `repo` scope for the machine user account
2. Update the `token` field on the corresponding 1Password item
3. Revoke the old token in GitHub
4. Verify agent access still works: `GH_TOKEN="$(op read 'op://Private/<item-id>/token')" gh api user`

Note: reviewer identity PATs are NOT stored as repo CI secrets. They are
read from 1Password per-session by the authoring agent for the in-session
identity switch, so rotation does not require updating any repo secrets.

The `REVIEWER_ASSIGNMENT_TOKEN` repo secret (Nathan's PAT used by the
Agent Review Pipeline workflow) follows a similar process but also
needs a `gh secret set REVIEWER_ASSIGNMENT_TOKEN --repo {owner}/{repo}`
call on every repo after rotating the 1Password item.

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

All deploys use `op-firebase-deploy` for non-interactive service account impersonation. Never run `firebase deploy` directly.

### Deploy Everything

```bash
op-firebase-deploy device-source-of-truth
```

This deploys all four services:
- **Hosting** — uploads `dist/` to Firebase CDN
- **Functions** — deploys the `api` Cloud Function to `us-central1`
- **Firestore Rules** — applies `firestore.rules` to the database
- **Firestore Indexes** — applies `firestore.indexes.json`

The script reads source credentials from `GOOGLE_APPLICATION_CREDENTIALS`, then the project SA key from `op://Firebase/device-source-of-truth — Firebase Deployer SA Key`, then `op://Private/c2v6emkwppjzjjaq2bdqk3wnlm/credential`, then `~/.config/gcloud/application_default_credentials.json`. If the source credential is a `service_account` key matching the target deployer SA, it uses direct auth (no impersonation, faster). Otherwise it creates a temporary `impersonated_service_account` credential for `firebase-deployer@device-source-of-truth.iam.gserviceaccount.com`, sets `GOOGLE_APPLICATION_CREDENTIALS`, and runs `firebase deploy --non-interactive`. If functions are part of the deploy, the predeploy hook also resolves `functions/.env.tpl` with `op inject`.

### First-Time Setup

Run once per machine to configure impersonation:

```bash
op-firebase-setup device-source-of-truth
```

If `op://Private/c2v6emkwppjzjjaq2bdqk3wnlm/credential` does not exist yet, seed it once by running `gcloud auth application-default login`, then copy the resulting `~/.config/gcloud/application_default_credentials.json` into the 1Password item `Private/GCP ADC`, field `credential`.

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
3. Redeploy: `op-firebase-deploy device-source-of-truth --only functions`

### Firestore Rules Rollback

Rules are versioned in Git. To roll back:

1. Check out the previous `firestore.rules`
2. Deploy: `op-firebase-deploy device-source-of-truth --only firestore:rules`

### CI/CD & Headless Deploy

For headless environments (Claude Code cloud tasks, GitHub Actions, etc.) where
1Password biometric auth is unavailable, use the project SA key directly:

```bash
# Pull the SA key from 1Password (one-time, requires biometric)
op document get "device-source-of-truth — Firebase Deployer SA Key" \
  --vault Firebase --out-file ~/firebase-keys/device-source-of-truth-sa-key.json

# Deploy with the SA key
GOOGLE_APPLICATION_CREDENTIALS=~/firebase-keys/device-source-of-truth-sa-key.json op-firebase-deploy device-source-of-truth
```

The SA key (`op://Firebase/device-source-of-truth — Firebase Deployer SA Key`, item ID `ruiswfa5hwpwbkfz5vy462woky`) is a `service_account` credential for `firebase-deployer@device-source-of-truth.iam.gserviceaccount.com`. When `op-firebase-deploy` detects that the source credential already matches the target deployer SA, it skips impersonation and uses direct auth (faster).

For Claude Code cloud scheduled tasks:
1. Retrieve the key: `op document get "device-source-of-truth — Firebase Deployer SA Key" --vault Firebase`
2. Copy the JSON contents
3. In the task's cloud environment, add: `FIREBASE_SA_KEY=<paste JSON>`
4. Add a setup script:
   ```bash
   echo "$FIREBASE_SA_KEY" > /tmp/sa-key.json
   export GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json
   ```

---

## Troubleshooting

### "Permission denied" on deploy

```
Error: Missing permissions required for functions deploy.
```

**Fix:** For headless environments, verify the project SA key in `op://Firebase/device-source-of-truth — Firebase Deployer SA Key` is accessible via `GOOGLE_APPLICATION_CREDENTIALS`. For interactive environments, ensure the shared `Private/GCP ADC` source credential is current and impersonation setup is current. Refresh the source credential once if needed, then rerun `op-firebase-setup device-source-of-truth`.

### Functions deploy fails with "Could not build the function due to a missing permission"

```
Build failed with status: FAILURE. Could not build the function due to a missing permission on the build service account.
```

**Fix:** This is the most common deployment issue. 2nd gen Cloud Functions use the default compute service account as the build SA, and it needs explicit IAM roles. Run the `gcloud` commands in the [Cloud Functions Build Service Account](#cloud-functions-build-service-account-critical) section, wait 1-2 minutes for IAM propagation, then retry `op-firebase-deploy device-source-of-truth --only functions`.

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
