# DST-047 — Import Section: Dependency-Aware Navigation & Setup Guardrails

| Field | Value |
|---|---|
| **Story ID** | DST-047 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T1 — Data Model & Infrastructure |
| **Priority** | P1 |
| **Story Points** | 3 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-036 (Reference Data), DST-038 (Partner Keys), DST-044 (Version Registry), DST-046 (Partner Aliases) |
| **Blocks** | Nothing — UX hardening only |

---

## User Story

As an Admin setting up DST for the first time, I am guided through imports in the correct dependency order so that I cannot run a downstream import against an unpopulated prerequisite and end up with unresolved records that require manual cleanup.

---

## Problem

The current Import sidebar lists **Telemetry Upload first** — the most dependency-heavy import in the system. An Admin following the nav top-to-bottom would upload a Datadog CSV before partner keys, device records, or version mappings exist, producing unresolved partner keys, permanent `NULL` `friendly_version` values, and an unregistered-device alert flood. The correct order is almost exactly the reverse of what the nav implies.

Additionally, two critical prerequisites — Reference Data (DST-036) and Version Registry (DST-044) — live in the Admin section with no indication that they are import prerequisites. An Admin has no way to know they must be seeded before any import runs.

---

## Changes

### 1. Split the Import Section into Two Groups

Replace the single flat **IMPORT** nav group with two groups:

**SETUP IMPORTS** *(run once, in order)*
1. Reference Data *(link to existing Admin > Reference Data — surfaced here as a prerequisite)*
2. Partner Keys
3. All Models Migration

**ONGOING IMPORTS**
4. Intake Requests
5. Telemetry Upload

The Version Registry (Admin > Version Registry) is similarly surfaced as a prerequisite callout on the Telemetry Upload page (see below) — it does not need its own nav entry in the Import section, but its seeded status should be checked.

---

### 2. Numbered Step Indicators in the Setup Group

Each item in **SETUP IMPORTS** renders with a step badge (`1`, `2`, `3`) in the sidebar. Completed steps show a filled green checkmark in place of the number. "Completed" is defined as:

| Step | Completion Condition |
|---|---|
| Reference Data | `field_options` table has ≥ 1 active row |
| Partner Keys | `partner_keys` table has ≥ 1 row |
| All Models Migration | `devices` table has ≥ 1 row |

---

### 3. Prerequisite Banners on Each Import Page

Each import page evaluates its prerequisites on load and renders a banner if any are unmet. Banners are **amber** (warning, import still permitted) or **red** (blocking, import button disabled).

| Import Page | Prerequisite Check | Banner Behavior |
|---|---|---|
| Partner Keys | `field_options` table empty | **Amber** — "Reference Data has not been seeded. Chipset, OS, and region dropdowns will be empty during import. Seed Reference Data first for best results." Link to Reference Data. |
| All Models Migration | `partners` table empty | **Red** — "No partner records exist. All Models Migration requires at least one partner to resolve device ownership. Import Partners first." Import button disabled. |
| All Models Migration | `partner_keys` table empty | **Amber** — "No partner keys are registered. Devices will import successfully but Datadog telemetry cannot be attributed until partner keys are added." |
| Intake Requests | `partners` table empty | **Red** — "No partner records exist. Intake Requests import requires at least one partner for name resolution. Import Partners first." Import button disabled. |
| Telemetry Upload | `partner_keys` table empty | **Red** — "Partner Keys have not been loaded. Telemetry rows cannot be attributed to a partner. Load Partner Keys before uploading." Import button disabled. |
| Telemetry Upload | `devices` table empty | **Red** — "No devices are registered. All uploaded rows will generate Unregistered Device alerts and no counts will be attributed. Complete All Models Migration first." Import button disabled. |
| Telemetry Upload | `core_version_mappings` table empty | **Amber** — "Version Registry is empty. All uploaded rows will have a blank Friendly Version and this cannot be corrected retroactively without re-uploading. Seed the Version Registry first." Link to Admin > Version Registry. |

Blocking banners disable only the **Select File / Import** action. The page remains accessible for review.

---

### 4. "Start Here" Empty State on First Visit

When all three Setup Import steps are incomplete and no import has ever been run, the Import section landing (defaulting to the first item, Reference Data) renders a **"Getting Started" card** above the normal page content:

> **Set up imports in order**
> The three Setup Imports below must be completed before ongoing imports will work correctly. Each step takes 2–5 minutes.
>
> `① Reference Data → ② Partner Keys → ③ All Models Migration`
>
> `[Start with Reference Data →]`

The card is dismissed permanently once all three steps are marked complete and never reappears.

---

### 5. Telemetry Upload Page: Prerequisite Summary Widget

Add a compact **Prerequisites** checklist widget to the Telemetry Upload page, rendered above the file drop zone. It evaluates the four prerequisite conditions and shows a green check or red X next to each:

```
Prerequisites
✅ Partner Keys loaded (47 keys)
✅ Devices registered (136 devices)
⚠️  Version Registry — 0 mappings. Friendly versions will be blank.
✅ Reference Data seeded
```

The widget is read-only and informational. It does not replace the per-condition banners described above — it is a summary for experienced admins who want a quick status check without reading banner text.

---

## Out of Scope

- Enforcing run order between Ongoing Imports (Intake Requests and Telemetry Upload have no dependency on each other and can run in any order once setup is complete).
- Preventing re-runs of Setup Imports after initial completion — idempotent re-imports are valid and should remain accessible.
- Any changes to import parsing, validation logic, or preview behavior — this ticket is nav and UX only.

---

## Acceptance Criteria

- The Import sidebar displays two labeled groups: **Setup Imports** (numbered 1–3) and **Ongoing Imports**.
- Reference Data is accessible from the Setup Imports group as a linked entry (does not duplicate the Admin > Reference Data page; routes to the same URL).
- Completed setup steps show a green checkmark badge in the sidebar; incomplete steps show the step number.
- Every import page evaluates its prerequisites on load and renders the appropriate amber or red banner if conditions are unmet.
- Red-banner conditions disable the file selection and import action; amber-banner conditions do not.
- The "Getting Started" card appears on first visit when all three setup steps are incomplete and is permanently dismissed once all three are complete.
- The Telemetry Upload page renders the Prerequisites summary widget above the file drop zone in all states (met, unmet, and partial).
- No existing import functionality is altered — this ticket adds nav structure and conditional UI only.
