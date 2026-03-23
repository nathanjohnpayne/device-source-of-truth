# Documentation Rules

- **`AGENTS.md` / `docs/agents/`:** Update the relevant sub-file when adding new API routes, new Firestore collections, new frontend conventions, or new architectural behaviors. Update the index (`AGENTS.md`) only when adding or removing a section.
- **`DEPLOYMENT.md`:** Update when deploy process changes — new targets, environment variable changes, credential rotation steps.
- **`README.md`:** Update when project description, live URL, or major features change.
- **`packages/contracts/src/index.ts`:** Document type changes with inline JSDoc comments. This is the single source of truth for shared types.
- **`rules/repo_rules.md`:** Update when directory structure changes or new invariants are needed.
- **`.ai_context.md`:** Update when high-risk areas, external dependencies, or non-standard directories change.

When adding a new Firestore collection, update the Data Model table in [Repository Overview](repository-overview.md). When adding a new API route, update the API Routes table in [Agent Operating Rules](operating-rules.md).

---
