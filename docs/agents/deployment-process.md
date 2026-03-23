# Deployment Process

Deploying requires `firebase-tools`, `gcloud`, the local `gcloud` wrapper, and access to 1Password both for the shared `Private/GCP ADC` source credential and for backend secrets referenced by `functions/.env.tpl`.

### Non-Interactive Deploy (Recommended)

Uses a shared 1Password-backed GCP ADC source credential plus short-lived service account impersonation. The only routine interactive steps are 1Password unlock/Touch ID and resolving 1Password-backed backend secrets during function deploys.

```bash
npm run deploy                 # full deploy
npm run deploy:hosting         # hosting only
npm run deploy:functions       # functions only
op-firebase-deploy --only hosting,functions  # any combo
```

`op-firebase-deploy` creates a temporary impersonated credential for `firebase-deployer@device-source-of-truth.iam.gserviceaccount.com`, sets `GOOGLE_APPLICATION_CREDENTIALS`, deploys via `firebase deploy --non-interactive`, and cleans up. The Firebase predeploy hook separately resolves `functions/.env.tpl` with `op inject` for backend secrets.

**First-time setup:** make sure 1Password CLI can read `Private/GCP ADC`, then run `op-firebase-setup device-source-of-truth`

### Manual Deploy

```bash
op-firebase-deploy device-source-of-truth
op-firebase-deploy device-source-of-truth --only hosting
op-firebase-deploy device-source-of-truth --only functions
op-firebase-deploy device-source-of-truth --only firestore:rules
op-firebase-deploy device-source-of-truth --only storage
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

See `DEPLOYMENT.md` for full deployment instructions, keyless deploy auth, and runtime-secret rotation playbooks.

---
