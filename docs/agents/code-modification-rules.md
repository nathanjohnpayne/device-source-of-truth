# Code Modification Rules

### Credential Hygiene and Rotation

Frontend (`.env`, prefixed with `VITE_`):
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` — keep in `.env` (gitignored), never in tracked source
- Rotation: remove from tracked files/history, create replacement with same restrictions, update `.env`, redeploy hosting, verify, delete old key

Backend secrets (1Password, via `functions/.env.tpl`):
- `ANTHROPIC_API_KEY` — in 1Password (`Private/DST Anthropic API Key`); resolved via `op inject` at deploy time
- Rotation: update in 1Password, redeploy functions, verify behavior, revoke old secret

Deploy auth maintenance:
- The 1Password-first deploy-auth model is a deliberate repository invariant. Do not switch this repo back to ADC-first, routine browser-login, `firebase login`, or long-lived deploy-key auth without explicit human approval.
- Routine deploy auth should use the shared `Private/GCP ADC` source credential through the 1Password CLI. If that credential itself needs rotation, refresh it once and update the item.
- If impersonation bindings or deploy IAM drift, rerun `op-firebase-setup device-source-of-truth`

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
