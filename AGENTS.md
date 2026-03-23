# AGENTS.md --- Device Source of Truth (DST)

Platform-agnostic instructions for AI coding agents working on the DST codebase. Read the relevant sub-file(s) before making changes.

## Sections

1. **[Repository Overview](docs/agents/repository-overview.md)** --- Architecture, directory structure, Firestore data model (28 collections)
2. **[Agent Operating Rules](docs/agents/operating-rules.md)** --- Key files, API routes, role system, frontend/backend conventions, common tasks
3. **[Code Modification Rules](docs/agents/code-modification-rules.md)** --- Credential hygiene, security rules, audit logging, tier engine side effects
4. **[Documentation Rules](docs/agents/documentation-rules.md)** --- Which docs to update and when
5. **[Testing Requirements](docs/agents/testing-requirements.md)** --- Vitest suites (frontend + backend), secret scanning
6. **[Deployment Process](docs/agents/deployment-process.md)** --- 1Password-backed deploy, environment variables, build commands
7. **[Code Review Requirements](docs/agents/code-review-requirements.md)** --- Self-review, external review triggers, enforcement
