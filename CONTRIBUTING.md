# Contributing

## Overview

Device Source of Truth (DST) is an internal Disney Streaming tool that manages real partner device data used across engineering teams. Contributions must be correct, well-tested, and thoughtful about the data model. The Firestore schema, role system, and tier engine are shared infrastructure — changes in these areas require careful review.

## Branch Naming

| Type | Format | Example |
|------|--------|---------|
| New feature | `feature/<short-description>` | `feature/freshness-badge-compact` |
| Bug fix | `fix/<short-description>` | `fix/tier-reassignment-after-spec-save` |
| Maintenance | `chore/<short-description>` | `chore/update-firebase-sdk` |

## Commit Message Format

Use imperative present tense. Keep the subject line under 72 characters.

```
Add compact prop to FreshnessBadge component
Fix audit log missing oldValue on partner key delete
Update questionnaire extraction retry endpoint
```

For changes to the data model, API contracts, or Firestore rules, include a body explaining the reasoning.

## Pull Request Process

1. Branch from `main`
2. Run `npm test` (frontend) and `cd functions && npm test` (backend) before opening a PR
3. Run all `scripts/ci/` checks locally
4. Open a PR against `main` with a clear title and description
5. For changes to Firestore rules, role system, or tier engine: include manual test steps in the PR description
6. At least one human review is required before merge

## Code Style

**Frontend:**
- TypeScript throughout — no `any` without justification
- Tailwind CSS utility classes only (no CSS modules)
- Use `api.*` from `src/lib/api.ts` for all API calls (auto-attaches Auth token)
- Use `lucide-react` for icons, `recharts` for charts
- Date formatting: always use `formatDate()`, `formatDateTime()`, or `formatRelativeTime()` from `src/lib/format.ts`
- Analytics: always use `trackEvent()` from `src/lib/analytics.ts`

**Backend:**
- All routes in `functions/src/routes/*.ts` export a default Express `Router`
- Always call `diffAndLog()` or `logAuditEntry()` on every mutation
- After saving specs, call `assignTierToDevice()` and `calculateSpecCompleteness()`
- ES module imports: use `.js` extensions
- Error handling: wrap in try/catch, return `{ error, detail }` with appropriate status codes

**Types:**
- Add shared types to `packages/contracts/src/index.ts` first
- Re-export in both `src/lib/types.ts` and `functions/src/types/index.ts`

## Testing

```bash
# Frontend tests
npm test

# Backend tests
cd functions && npm test
```

Both suites include a tracked-file secret scan. A failing secret scan means credentials are present in tracked files.

**When adding new behavior:**
- Add tests for new business logic in `functions/src/services/`
- Add tests for new API endpoints
- Add frontend tests for any utility logic

**Tests must not be deleted to force a build to pass.**

## Agent Contributions

AI agent contributions must follow `AGENTS.md`. All agent-proposed changes require human review before merge. Agents must not:
- Autonomously merge PRs
- Modify `firestore.rules` or `storage.rules` without explicit instruction
- Change role validation logic without explicit instruction
- Relax access controls or auth requirements

## Questions

Open an issue on GitHub or contact the repo owner directly.
