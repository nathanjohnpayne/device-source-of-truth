### DST-TDI-002 Rev C: UI Drift Remediation (Execution-Ready)

### Summary
- Keep phased rollout and sizing from Rev B.
- Lock the last open decision: filter UX standardization policy (when to use `FilterPanel` vs custom inline patterns).
- Preserve strict token compliance for controls/actions, with semantic blue allowed for info/data semantics.

### Execution Update (2026-03-05)
- Branch implementation started for Phase 0 + foundational Phase 1 work.
- Completed in code:
  - Added `ui:consistency:check` + baseline workflow (`scripts/ui-consistency-check.mjs`, `config/ui-consistency-baseline.json`).
  - Wired consistency check into CI (`.github/workflows/test.yml` frontend job).
  - Added shared primitives: `Button`, `IconButton`, `InlineNotice`, `WorkflowStepper`, `PageHeader`.
  - Added `formatNumber()` in shared formatter utilities.
  - Migrated core shared shell usage to tokenized controls (`AppShell`, `UpdateBanner`, `DataTable`, `Modal`, `FilterPanel`, `TimeRangeDropdown`).
  - Replaced browser `alert()` usage with inline notices in migration/intake/telemetry/reference-data flows.
  - Replaced duplicated 3-step indicators in `MigrationPage`, `TelemetryUploadPage`, and `IntakeImportPage` with `WorkflowStepper`.
  - Replaced 4-step questionnaire review indicator with `WorkflowStepper` wizard mode.
- Remaining work aligns to Phases 2-4 below (broader route migration, spec-form cleanup, visual regression harness).

### Implementation Changes
1. **Phase 0 (2-3 days): Guardrails**
- Add `ui:consistency:check` (`rg` + Node) with baseline + delta-only CI enforcement.
- Block new uses of `alert(`, direct locale formatting in pages/components, non-token primary/destructive classes, and non-allowlisted `rounded-md`.

2. **Phase 1a (4-5 days): Minimal Foundations**
- Add shared `Button` and `IconButton`.
- Add `formatNumber`; route date/time/number formatting through shared helpers.
- Normalize shared component actions (modal/table/filter/update banner) to tokenized buttons.

3. **Phase 1b (4-6 days): Targeted Primitives**
- Add `WorkflowStepper` (`linear3`, `wizard4`), `InlineNotice`, and `PageHeader`.
- Pilot in one 3-step flow and one 4-step flow before broad migration.

4. **Phase 2 (3-4 weeks): High-Churn Admin Flows**
- Prerequisite refactors: split `PartnerKeyRegistry` by tab and `QuestionnaireReview` by step.
- Migrate Intake/Migration/Telemetry/Partner Key/Questionnaire/Version flows to shared primitives.
- Replace browser alerts with inline/modal notices.

5. **Phase 3 (2-3 weeks): Remaining Routes + Spec Form**
- Migrate remaining catalog/report/config pages.
- Explicitly remediate `SpecFormFields` control tokens and `rounded-md` drift.

6. **Phase 4 (1-1.5 weeks): Visual Hardening**
- Add Playwright route snapshots (desktop + mobile), deterministic API mocking, pinned Linux/font runner, gated snapshot updates.

### Filter UX Decision Matrix (Locked)
1. Use `FilterPanel` for dense list pages with **3+ filters** and chip/clear-all behavior.
2. Use inline filter bars for **1-2 high-frequency controls** (e.g., search + one select).
3. Use segmented/tab controls for mutually exclusive state filters (e.g., Alerts status tabs).
4. Apply shared input/select/button tokens in all three patterns; consistency is token-level, not one-component-only.

### Test Plan
1. Unit tests for new primitives and formatters.
2. Smoke updates on migrated flows.
3. Playwright visual regression for phase gates.
4. Manual mobile/a11y checklist per phase.

### Assumptions
- Total effort remains ~7-11 weeks (1 FE) or ~4-6 weeks (2 FEs).
- No backend/schema/API changes.
- Raw tables remain acceptable for specialized matrix/read-only layouts; shared table shell is required for paginated/searchable list views.
