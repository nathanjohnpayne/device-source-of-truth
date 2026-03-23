# Testing Requirements

```bash
npm test                           # frontend Vitest suite + tracked-file secret scan
cd functions && npm test           # backend Vitest suite + tracked-file secret scan
```

**Tests must not be deleted to force a build to pass.**

Both test suites include a `scripts/check-no-public-secrets.mjs` scan. A failing secret scan means credentials are present in tracked files.

**When adding new behavior:**
- Add tests for new services in `functions/src/services/`
- Add tests for new API route logic
- Add frontend tests for utility logic in `src/lib/`

**Notes:**
- The root `tests/` directory is a standard placeholder per the AI Agent Tooling Standard. Main test suites are configured via `vitest.config.ts` (frontend) and `functions/vitest.config.ts` (backend).
- The `check_spec_test_alignment` CI script is advisory for this repo: `specs/` contains product docs and feature stories, not per-test spec files.

---
