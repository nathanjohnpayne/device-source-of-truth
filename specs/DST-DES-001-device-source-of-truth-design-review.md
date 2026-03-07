# Device Source of Truth --- Design Improvements

Author: Nathan Payne\
System: Device Source of Truth (DST)\
Area: UI/UX and Product Design Improvements\
Status: Proposed Improvements

------------------------------------------------------------------------

# 1. Global Navigation Improvements

## Problem

The current navigation structure mixes **system configuration**, **data
ingestion**, and **reporting** functions. This makes it harder for
operators to mentally model workflows.

Example: - Reference Data - Partner Keys - Data Migration

These items appear under **Setup Imports**, but they function more like
**system configuration**.

## Recommendation

Reorganize navigation into clearer operational groupings.

### Proposed Navigation Structure

Core - Dashboard - Devices - Partners - Hardware Tiers

Reporting - Spec Coverage

Data Ingestion - Intake Requests - Telemetry Upload - Questionnaires -
Data Migration

Configuration - Reference Data - Partner Keys

Administration - Users - Alerts - Audit Log - Version Registry -
Readiness Checklist - Danger Zone

------------------------------------------------------------------------

## Active Navigation Styling

### Problem

The active page highlight has low contrast against the sidebar.

### Fix

Improve visual clarity.

Active item background: #4F46E5\
Text: White\
Left indicator bar: 4px accent

------------------------------------------------------------------------

# 2. Dashboard Improvements

The dashboard should prioritize **operational insight**, not just
metrics.

## Spec Coverage Card

### Current

Spec Coverage (weighted) --- 2%

### Problem

"Weighted" is ambiguous.

### Fix

Add explanation.

Spec Coverage --- 2%\
Weighted by active device population

Tooltip: Percentage of active device population with full hardware
specification coverage.

------------------------------------------------------------------------

## Certification Status Card

### Current

0 Certification Status\
0 pending · 172 uncertified

### Problem

The primary metric shows **0**, which implies success rather than risk.

### Fix

Invert the hierarchy.

Certification Status

172 Uncertified\
0 Pending

------------------------------------------------------------------------

## Top Devices Table

### Current Columns

Device\
Partner\
Active Devices\
Tier

### Problem

Tier column appears empty.

### Fix

Display explicit fallback.

Tier: Unassigned

------------------------------------------------------------------------

## ADK Version Chart

### Current Issues

-   Inconsistent labels
-   Hard to read

### Fix

Normalize formatting.

3.0.1 (plugin 4.2.21)\
3.1.1\
3.1.0\
Unknown

Also sort descending by population.

------------------------------------------------------------------------

# 3. Device Catalog Improvements

This is the **primary operational screen**.

## Filter Organization

### Current

Partner \| Region \| Device Type \| Certification \| Tier \| Spec Status

### Problem

Too many horizontal filters reduce scanability.

### Fix

Group filters by domain.

Partner Context - Partner - Region

Device Attributes - Device Type - Tier

Quality Signals - Certification - Spec Status

------------------------------------------------------------------------

## Spec Coverage Column

### Current

0% (red)

### Problem

Color alone communicates state.

### Fix

0% --- Missing Specs\
45% --- Partial\
100% --- Complete

------------------------------------------------------------------------

## Device ID Visibility

### Problem

Device ID is visually weak.

### Fix

Use monospace styling.

Example:

EOSv1 (TV 360)\
dcx960

------------------------------------------------------------------------

## ADK Version Formatting

### Current

ADK 3.0.1+plugin-4.2.21

### Fix

Option A ADK Version \| Plugin

Option B

3.0.1\
plugin 4.2.21

------------------------------------------------------------------------

## Add Chipset / SoC Column

Chipset information is critical for performance and codec compatibility.

Proposed Column

SoC / Platform

Example values MediaTek\
Amlogic\
Novatek\
Broadcom

------------------------------------------------------------------------

# 4. Hardware Tiers Page

Current state shows 100% Uncategorized which provides little operational
value.

## Replace Donut Chart

Instead prioritize devices requiring classification.

Example

Devices Missing Tier Classification

EOSv1 (TV 360) --- 266,086 active devices\
MB181 G36 --- 193,758 active devices\
Apollo --- 184,489 active devices

Sorted by population.

------------------------------------------------------------------------

## Display Tier Criteria

Users must understand how tiers are assigned.

Example

Tier 1 • AV1 decode\
• 2GB RAM\
• ADK ≥ 3.1

Tier 2 • HEVC decode\
• 1GB RAM\
• ADK ≥ 3.0

Tier 3 • H264 only\
• \<1GB RAM

------------------------------------------------------------------------

# 5. Partners Page Improvements

## Column Hierarchy

Current

Partner Keys\
Devices\
Active Devices

Fix

Active Devices\
Devices\
Partner Keys

------------------------------------------------------------------------

## Region vs Country Redundancy

Current

Regions\
Countries

Fix

Regions\
Country Count

Hover reveals full list.

------------------------------------------------------------------------

## Flag Density

Current rows with many flags create visual noise.

Fix

🇧🇪 🇨🇭 🇩🇪 +9

Hover reveals full list.

------------------------------------------------------------------------

# 6. Visual System Improvements

## Chart Color System

Charts currently reuse the same purple.

Recommendation

Primary: Purple\
Secondary: Blue\
Accent: Teal\
Warning: Orange\
Critical: Red

------------------------------------------------------------------------

## Table Row Height

Current: \~36px\
Recommended: \~44px

Improves readability in dense datasets.

------------------------------------------------------------------------

## Metric Typography

Increase prominence of key numbers.

Example

2,860,741\
Total Active Devices

Recommended size: 32--36px
