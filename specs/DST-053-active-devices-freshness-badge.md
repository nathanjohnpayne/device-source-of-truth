---
spec_id: DST-053-active-devices-freshness-badge
tested: false
reason: "implementation pending"
---

# DST-053 — Active Devices Freshness Badge

**Feature area:** Device Source of Truth (DST)  
**Affects:** Dashboard, Partner detail, Device detail, Region Breakdown, device tables  
**Status:** Proposed  
**Author:** DST Product

---

## Problem

The "Active Devices" figure displayed throughout DST is meaningless without two pieces of context:

1. **When was it last computed?** A count from three days ago is not "current."
2. **What time window does it cover?** A 7-day window and a 30-day window will produce very different numbers for the same device.

Without these anchors, stakeholders—including executives, partner managers, and engineers—cannot reliably compare figures across partners, devices, or time.

---

## Goal

Attach a compact, scannable **freshness badge** to every "Active Devices" figure that communicates:

- The **as-of date** (when the underlying telemetry data was last ingested)
- The **coverage window** (how many days the count spans)
- A **color signal** indicating whether the data is current, aging, or stale

---

## Anatomy of the Badge

The badge is a single inline element that sits directly beneath or beside the active device count. It has three parts:

```
[dot] Updated [relative time] · [N]-day window
```

**Example renders:**

| State   | Badge text                              |
|---------|-----------------------------------------|
| Fresh   | ● Updated 2 hr ago · 28-day window     |
| Aging   | ● Updated 3 days ago · 28-day window   |
| Stale   | ● Updated 9 days ago · 28-day window   |
| No data | ● No data recorded                      |

The dot is a CSS-driven `8px` filled circle — not an emoji or icon component — colored via status tokens.

---

## Color Thresholds

Thresholds are hardcoded for v1 (no configuration infrastructure exists; see Resolved Questions — Q2). Condition is based on elapsed time since `lastTelemetryAt` on the relevant entity.

| State   | Tailwind class  | Hex       | Condition                                           |
|---------|-----------------|-----------|-----------------------------------------------------|
| Fresh   | `bg-green-500`  | `#22c55e` | `lastTelemetryAt` < 48 hours ago                   |
| Aging   | `bg-amber-500`  | `#f59e0b` | 48 hours ago ≤ `lastTelemetryAt` < 7 days ago      |
| Stale   | `bg-red-500`    | `#ef4444` | `lastTelemetryAt` ≥ 7 days ago                     |
| No data | `bg-gray-400`   | `#9ca3af` | `lastTelemetryAt` is null                           |

> **Note:** These thresholds assume a daily telemetry upload cadence. If cadence shifts, the product owner should revisit them.

---

## Visual Specification

### Size and typography

- Badge text: `text-xs` (`12px`), `font-medium`, `text-gray-500`
- Status dot: `w-2 h-2 rounded-full` (`8px × 8px`), vertically centered via `flex items-center`
- Gap between dot and text: `gap-1.5` (`6px`)
- Badge sits `mt-1` below the active device count figure

### UI consistency guardrails

These rules are enforced by `npm run ui:consistency:check` and must be respected:

- **No `bg-blue-600` or `hover:bg-blue-700`** on any badge element — DST's primary color is indigo; status colors are green/amber/red/gray only.
- **No `rounded-md`** on any badge element — use `rounded-full` for dots, `rounded-lg` for any pill container.
- **No inline `toLocaleString()` or `toLocaleDateString()`** — use `formatDate()` and `formatDateTime()` from `src/lib/format.ts` for all date rendering inside tooltips and panels.
- **Icons:** If any icon is needed (e.g., a clock or info glyph), use `lucide-react` exclusively.

---

## Layout by Context

### 1. Dashboard summary tile

The tile currently shows a large count with a label below it. The badge renders as a third line beneath the label.

```
2,875,449
Total Active Devices
● Updated 2 hr ago · 28-day window
```

The badge does not expand the tile height if the tile already has bottom padding ≥ `p-4`.

### 2. Region Breakdown cards

Same three-line pattern. Cards are wider than tall, so horizontal space is not a concern.

```
1,491,569
active devices · 52 devices registered
● Updated 4 hr ago · 28-day window
```

### 3. Partner detail page — header stat

The stat block ("Active Devices / 323,501") renders in a card alongside Total Devices and Spec Coverage. The badge goes beneath the figure.

```
Active Devices
323,501
● Updated 3 days ago · 28-day window
```

### 4. Device detail page — top-right figure

The count (e.g., "268,001 / Active Devices") sits in the upper-right of the device header. The badge renders directly beneath "Active Devices" in the same alignment.

```
268,001
Active Devices
● Updated 6 hr ago · 28-day window
```

### 5. Device table rows (Devices list on partner page)

Table rows are too dense for inline badge text without widening columns or creating visual noise at scale. The solution is a **two-tier approach**: a persistent status dot for scannable at-a-glance signal, backed by a hover micro-panel for full detail on demand.

#### Persistent status dot

A single `8px` color-coded dot sits inline to the right of the numeric count in every Active Devices cell. It is always visible — users do not need to hover to get a freshness signal.

```
ACTIVE DEVICES  ⓘ
91,076  ●          ← green: fresh
75,415  ●          ← green: fresh
47,151  ●          ← amber: aging
34,213  ●          ← red: stale
```

- Dot: `w-2 h-2 rounded-full inline-block ml-2 flex-shrink-0 self-center`
- Column header retains the ⓘ icon. On hover, the header tooltip reads: *"The dot indicates data freshness. Green = updated within 48 hr; amber = 2–7 days; red = 7+ days. Hover any row for full detail."*

#### Hover micro-panel

Hovering anywhere on a table row triggers a floating **micro-panel** anchored to the Active Devices cell. This is a structured card — not a plain text tooltip — because the content has hierarchy that a single string cannot express cleanly.

**Micro-panel layout:**

```
┌──────────────────────────────────────────┐
│  ● Data freshness               [State]  │
│  ──────────────────────────────────────  │
│  Updated    2 hours ago                  │
│             Mar 3, 2026 · 11:42 PM UTC   │
│                                          │
│  Window     28 days                      │
│             Feb 4 – Mar 3, 2026          │
│                                          │
│  Source     Claro                        │
│             claro_br                     │
└──────────────────────────────────────────┘
```

**Micro-panel visual spec:**

- `[State]` is the freshness label ("Fresh," "Aging," "Stale," "No data") rendered in its matching status color
- Container: `w-64 bg-white border border-gray-200 shadow-lg rounded-lg p-3`
- Header row: dot + "Data freshness" label (`text-xs font-semibold text-gray-700`) + state label right-aligned in status color
- Divider: `border-t border-gray-100 my-2`
- Field rows: left label in `text-xs text-gray-400 w-16 flex-shrink-0`; right value stack — primary in `text-xs text-gray-700`, secondary (slug, dates) in `text-xs text-gray-400 font-mono`
- **Source field:** Primary line = human-readable partner name (`partnerName`, e.g., "Claro"); secondary line = partner key slug (`partnerKeyName`, e.g., `claro_br`) in `font-mono`. Both fields are already present on `DeviceWithRelations` in the existing list response — no additional query cost.
- **Date formatting:** Use `formatDateTime()` from `src/lib/format.ts` for the absolute timestamp. Use `formatDate()` for the coverage window date range. Do not call `toLocaleString()` directly.
- Panel appears after **150ms hover delay** to prevent accidental triggers while scanning rows.
- Panel dismisses after **100ms** on mouse-out to prevent flicker when moving between rows.
- **Positioning:** Anchored above the row's Active Devices cell if within `200px` of the viewport bottom; otherwise anchored below. Never clips outside the viewport.
- Renders using the existing DST `Tooltip` component from `src/components/shared/`, extended or wrapped as needed. No new floating layer or z-index context required.

**Micro-panel states:**

| State   | `[State]` label | Dot color      | Notes                                           |
|---------|-----------------|----------------|-------------------------------------------------|
| Fresh   | Fresh           | `text-green-500` | —                                             |
| Aging   | Aging           | `text-amber-500` | —                                             |
| Stale   | Stale           | `text-red-500`   | Consider adding "Check upload status" hint    |
| No data | No data         | `text-gray-400`  | Updated and Source rows show "—"              |

**Known limitation:** Because `lastTelemetryAt` is written at the upload-job level (all devices in one CSV share the same `snapshotDate` and `uploadedAt`), all rows processed in a single telemetry upload will display the same dot color. This is still meaningful — it indicates when a device was last touched by telemetry — but it does not differentiate within a batch. This limitation is noted in the column header tooltip.

**Multi-key edge case:** If a device is associated with multiple partner keys that have different coverage windows, the Window field reads *"Varies (14–28 days)"* and the Source section lists all contributing partner names, comma-separated. If more than three keys contribute, truncate with "+N more." This case is uncommon in the current data model.

---

## Tooltip on Hover (Non-table Contexts)

All badge instances outside the device table support a hover tooltip using the existing DST `Tooltip` component:

> **Data as of:** March 3, 2026 at 11:42 PM UTC  
> **Coverage window:** 28 days (Feb 4–Mar 3, 2026)  
> **Source:** Datadog telemetry

No new component is required for this tooltip. Dates use `formatDate()` and `formatDateTime()` from `src/lib/format.ts`.

---

## Data Requirements

### New field: `lastTelemetryAt` on the `Device` document

No freshness timestamp exists anywhere in the current codebase. The `Device` interface in `packages/contracts/src/index.ts` must be extended:

```typescript
// packages/contracts/src/index.ts — Device interface
lastTelemetryAt: Timestamp | null;
```

This field is written during telemetry upload. The existing upload loop in `functions/src/routes/telemetry.ts` already iterates `deviceCounts` to write `activeDeviceCount` back to each device document. Adding `lastTelemetryAt` to that same `.update()` call is a one-line change:

```typescript
// Existing loop in telemetry.ts (simplified):
for (const [deviceId, count] of Object.entries(deviceCounts)) {
  const devSnap = await db.collection('devices')
    .where('deviceId', '==', deviceId).limit(1).get();
  if (!devSnap.empty) {
    await devSnap.docs[0].ref.update({
      activeDeviceCount: count,
      lastTelemetryAt: admin.firestore.FieldValue.serverTimestamp(), // ← add this
    });
  }
}
```

### New constant: `ACTIVE_DEVICES_WINDOW_DAYS`

`coverage_window_days` does not exist anywhere in the codebase. For v1, introduce a single hardcoded constant:

```typescript
// packages/contracts/src/index.ts
export const ACTIVE_DEVICES_WINDOW_DAYS = 28;
```

The coverage window date range displayed in badges and tooltips is derived client-side:

```
coverageEnd   = lastTelemetryAt ?? today
coverageStart = coverageEnd − ACTIVE_DEVICES_WINDOW_DAYS days
```

### Summary of required data per entity

| Field                        | Type               | Source                              | Used for                                  |
|------------------------------|--------------------|-------------------------------------|-------------------------------------------|
| `lastTelemetryAt`            | `Timestamp \| null` | Written by `telemetry.ts` upload loop | Freshness state, relative time, abs. date |
| `ACTIVE_DEVICES_WINDOW_DAYS` | `number` (const)   | Hardcoded `28`                      | Coverage window display and date range    |
| `partnerName`                | `string \| undefined` | Already in `DeviceWithRelations`  | Micro-panel Source field (primary)        |
| `partnerKeyName`             | `string \| undefined` | Already in `DeviceWithRelations`  | Micro-panel Source field (mono/secondary) |

No new API endpoint is needed. `lastTelemetryAt` is a scalar field on the device document and will be returned by the existing `GET /devices` and `GET /devices/:id` responses once added to the interface.

---

## Behavior

- **Relative time** ("2 hr ago," "3 days ago") is computed client-side from `lastTelemetryAt` at render time. No server round-trip required. Rounds to the nearest meaningful unit: minutes under 60 minutes, hours under 48 hours, days otherwise.
- **Badge updates in real time** when a new telemetry upload completes. No additional subscription is required — `lastTelemetryAt` will surface on the next data refresh cycle.
- **Table row micro-panel** opens after 150ms hover and closes after 100ms on mouse-out. It is also triggered by keyboard focus on the row (Tab/arrow key navigation). Pressing Escape dismisses it.
- If `lastTelemetryAt` is null, the badge renders in the **No data** state (`bg-gray-400` dot, text "No data recorded") with no relative time or coverage window shown.

---

## Accessibility

- Outside of device tables, the status dot is never the sole indicator — the badge text ("Updated X ago") redundantly conveys freshness for color-blind users.
- In device table rows, the persistent dot is color-only. To compensate: every dot cell must include a `title` attribute (e.g., `title="Stale: last updated 9 days ago"`) and the containing `<td>` must carry `aria-label="Active devices: [count], [state] data"`.
- Badge text meets WCAG AA contrast against both white and DST's light-gray tile backgrounds.
- `aria-label` on the non-table badge wrapper: *"Active devices data updated [relative time], covering a [N]-day window."*
- Table row micro-panel is keyboard-accessible: Tab/arrow-key focus triggers it, Escape dismisses it, and it is included in the page's natural focus order so screen reader users can reach the structured content without a mouse.

---

## Implementation Checklist

Changes in dependency order:

1. **`packages/contracts/src/index.ts`** — Add `lastTelemetryAt: Timestamp | null` to the `Device` interface. Add `export const ACTIVE_DEVICES_WINDOW_DAYS = 28`.
2. **`src/lib/types.ts` and `functions/src/types/index.ts`** — Re-export `ACTIVE_DEVICES_WINDOW_DAYS` from `@dst/contracts`.
3. **`functions/src/routes/telemetry.ts`** — In the `deviceCounts` loop, add `lastTelemetryAt: admin.firestore.FieldValue.serverTimestamp()` to the existing `.update()` call.
4. **`src/lib/format.ts`** — Add a `formatRelativeTime(ts: Timestamp | null): string` helper. This keeps all time formatting in the allowed locale-formatting boundary and out of components, consistent with the `ui:consistency:check` guardrail.
5. **`src/components/shared/FreshnessBadge.tsx`** (new) — Accepts `lastTelemetryAt: Timestamp | null`, `windowDays?: number` (defaults to `ACTIVE_DEVICES_WINDOW_DAYS`), and `compact?: boolean`. The `compact` prop renders the dot-only variant for table rows; the full prop renders the dot + text badge for tiles and stat cards.
6. **`src/components/shared/FreshnessMicroPanel.tsx`** (new) — The structured hover panel for table rows. Accepts `lastTelemetryAt`, `partnerName`, `partnerKeyName`. Wraps or extends the existing `Tooltip` component.
7. **Dashboard, Partner detail, Device detail, Region Breakdown pages** — Replace raw active device count displays with `<FreshnessBadge>` beneath each figure.
8. **Device table column on the Partner detail page** — Add `<FreshnessBadge compact>` dot in each Active Devices cell and wrap each row with `<FreshnessMicroPanel>` on hover.
9. **`firestore.rules`** — No change required. `lastTelemetryAt` is a field on `devices`, which already has appropriate read/write rules.
10. **Audit logging** — The telemetry upload route already calls audit logging. Confirm that adding `lastTelemetryAt` to the `.update()` call does not produce excessive audit log noise for high-frequency uploads; if needed, exclude it from `diffAndLog()` using the field-exclusion pattern already used for other high-frequency fields.

---

## Out of Scope (v1)

- Configurable freshness thresholds per partner (no config infrastructure exists; would require building the `config` collection for the first time)
- Per-key `coverage_window_days` overrides (field does not exist on `PartnerKey`; global constant is sufficient for v1)
- Historical freshness trend visualization
- Push notifications when data crosses into stale state (covered by the existing Alerts system)

---

## Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| 1 | Is `coverage_window_days` stored per partner key? | **No.** The field does not exist anywhere in the codebase. Introduce `ACTIVE_DEVICES_WINDOW_DAYS = 28` as a hardcoded constant for v1. |
| 2 | Should thresholds be configurable or hardcoded? | **Hardcode for v1.** The `config` collection was planned but never built; adding configurability would require building that infrastructure from scratch. |
| 3 | Does telemetry upload write `lastTelemetryAt` at the device level? | **No.** Freshness is only tracked on `telemetrySnapshots`. Add `lastTelemetryAt` to the `Device` interface and write it in the existing `deviceCounts` loop in `telemetry.ts`. One-line change. All devices in a single upload batch will share the same timestamp — a known, documented limitation. |
| 4 | Should the micro-panel show the partner key slug or human-readable name? | **Both.** `partnerName` (display name, e.g., "Claro") as primary; `partnerKeyName` (slug, e.g., `claro_br`) in `font-mono` as secondary. Both are already present on `DeviceWithRelations` at no additional query cost. |
