# Repository Rules

## Structure Invariants

The following files must always exist at the repository root and must never be deleted or moved:

- `README.md`
- `AGENTS.md`
- `DEPLOYMENT.md`
- `CONTRIBUTING.md`
- `.ai_context.md`

The following directories must always exist:

- `rules/` — contains this file and other binding constraints
- `plans/` — execution and rollout plans
- `specs/` — product specifications and feature stories
- `tests/` — test placeholder (main suites in root vitest.config.ts and functions/)
- `functions/` — Cloud Functions v2 backend
- `src/` — React frontend source
- `packages/contracts/` — canonical shared types (monorepo package)
- `scripts/ci/` — CI enforcement scripts
- `docs/` — extended documentation

The following tool config directories must contain only configuration — no instruction prose:

- `.claude/` — Claude Code config only
- `.cursor/` — Cursor config and `.mdc` rule files only; `.cursor/plans/` is Cursor-internal task tracking (machine-generated `.plan.md` files are permitted as Cursor-internal state)
- `.vscode/` — `tasks.json` and other VS Code config only

**Documented non-standard directories:**

- `dist/` — Vite build output. Never edit manually — always regenerate via `npm run build`.
- `config/` — Application configuration files. Documented in `.ai_context.md`.
- `mappings/` — Data mapping files. Documented in `.ai_context.md`.
- `.github/` — GitHub Actions CI/CD. Standard practice for GitHub-hosted repos.

## Forbidden Patterns

- **Never edit `dist/` directly.** It is a Vite build artifact. Always run `npm run build` to regenerate.
- **Never commit secrets.** `.env`, `functions/.env`, and service account keys must never be committed. Use `op://` references in `functions/.env.tpl` for runtime provider secrets. The `npm test` suite includes a secret scan that fails on detected credentials.
- **Never relax Firestore or Storage security rules** without explicit review. Owner-scoped rules and domain-restricted auth are invariants.
- **No instruction files in tool folders.** `.claude/`, `.cursor/`, and `.vscode/` must not contain plain `.md` or `.txt` instruction files. Cursor `.mdc` rule files and machine-generated `.plan.md` files in `.cursor/plans/` are permitted.
- **No duplicate documentation.** If a concept is documented in `AGENTS.md` or a canonical root file, it must not be redefined in a conflicting location.
- **No new top-level directories** without explicit justification documented in `AGENTS.md` or a `plans/` entry.
- **Tests must not be deleted to force a build to pass.**
- **Always audit-log mutations.** Call `diffAndLog()` or `logAuditEntry()` from `functions/src/services/audit.ts` on every state-changing API request.

## CI Enforcement

The following checks are implemented in `scripts/ci/` and must pass before any commit is merged:

1. `check_required_root_files` — Verifies README.md, AGENTS.md, DEPLOYMENT.md, CONTRIBUTING.md, and .ai_context.md all exist at repository root
2. `check_no_tool_folder_instructions` — Verifies .claude/, .cursor/, and .vscode/ contain no plain .md or .txt instruction files (excludes .mdc and .plan.md as valid tool formats)
3. `check_no_forbidden_top_level_dirs` — Verifies no forbidden top-level directories exist (e.g., tool-instructions/, ai-rules/, agent-config/)
4. `check_dist_not_modified` — Verifies dist/ files were not directly modified
5. `check_spec_test_alignment` — Verifies every file in specs/ has a corresponding test file in tests/ (advisory for this repo — specs are product docs, not per-test spec files)
6. `check_duplicate_docs` — Verifies no documentation topic is duplicated between root files and tool folders
7. `check_review_policy_exists` — Verifies .github/review-policy.yml and REVIEW_POLICY.md both exist

Additionally, `npm test` and `cd functions && npm test` include secret scans that must pass on every commit.
