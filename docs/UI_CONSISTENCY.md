# UI Consistency Guardrails

This document tracks the active UI drift prevention rules introduced in DST-TDI-002 Rev C.

## Guardrail Commands

```bash
npm run ui:consistency:check
npm run ui:consistency:baseline
```

The check is **delta-only**. Existing drift is baselined in `config/ui-consistency-baseline.json`; CI fails only when new drift is introduced.

## Enforced Checks

1. No `alert()` usage in app code.
2. No direct `toLocaleDateString()` in pages/components.
3. No direct `toLocaleString()` in pages/components.
4. No unallowlisted `rounded-md` drift.
5. No blue primary action tokens (`bg-blue-600`, `hover:bg-blue-700`).

## Allowed Exceptions

- Semantic blue for informational data visuals (for example, info badges/charts) remains valid.
- `src/lib/format.ts` is the allowed locale-formatting boundary.

## Filter UX Matrix

1. Use `FilterPanel` for dense list pages with 3+ filters and clear-all/chip behavior.
2. Use inline filter bars for 1-2 high-frequency controls.
3. Use segmented/tab controls for mutually exclusive state filters.
4. Enforce token consistency across all patterns; do not force a single component pattern everywhere.
