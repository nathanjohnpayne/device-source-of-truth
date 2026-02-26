# Data Model Reference

Complete Firestore schema documentation for all 13 collections in the Device Source of Truth (DST) application.

---

## Overview

DST uses Cloud Firestore as its primary datastore. All documents are stored in top-level collections (no sub-collections). Relationships between entities are represented by ID reference fields — Firestore has no foreign keys or joins, so the application layer resolves references at query time.

### Entity Relationship Diagram

```
partners (1)──────────(N) partnerKeys (1)──────────(N) devices
                                                         │
                                                    (1)──┤──(1) deviceSpecs
                                                         │
                                                    (1)──┤──(N) deviceDeployments
                                                         │
                                                    (1)──┤──(N) telemetrySnapshots
                                                         │
                                                    (1)──┤──(N) deviceTierAssignments
                                                         │
                                                         └──(N) auditLog entries

hardwareTiers ←── referenced by devices.tierId
alerts ←── generated from telemetry upload anomalies
users ←── used for auth + role lookup
uploadHistory ←── records telemetry upload metadata
config ←── app-level settings
```

---

## Collections

### `partners`

Canonical partner brands (e.g., Samsung, LG, Roku). A partner can have multiple partner keys and operate in multiple regions.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `displayName` | string | yes | Human-readable partner name (e.g., "Samsung Electronics") |
| `regions` | Region[] | yes | Operating regions: `NA`, `EMEA`, `LATAM`, `APAC` |
| `countriesIso2` | string[] | yes | ISO 3166-1 alpha-2 country codes (e.g., `["US", "CA", "GB"]`) |
| `createdAt` | string (ISO 8601) | auto | Document creation timestamp |
| `updatedAt` | string (ISO 8601) | auto | Last modification timestamp |

**Indexes:** None required (queries filter on `regions` with `array-contains`).

---

### `partnerKeys`

Datadog partner key slugs. Each key maps to one partner and represents a specific chipset/OEM combination used for telemetry grouping.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `key` | string | yes | Unique partner key string (Datadog slug, e.g., `samsung-tizen-mt5867`) |
| `partnerId` | string | yes | Reference to `partners` document ID |
| `chipset` | string | null | no | SoC chipset identifier |
| `oem` | string | null | no | Original equipment manufacturer |
| `region` | Region | null | no | Primary region for this key |
| `countries` | string[] | yes | Countries where this key is active |

**Unique constraint:** `key` should be unique across all documents. Enforced at the application level, not by Firestore.

---

### `devices`

One document per hardware device model. The central entity that ties together specs, deployments, telemetry, and tier assignments.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `displayName` | string | yes | Human-readable device name (e.g., "Samsung UN55TU7000") |
| `deviceId` | string | yes | Unique device identifier (Datadog join key) |
| `partnerKeyId` | string | yes | Reference to `partnerKeys` document ID |
| `deviceType` | DeviceType | yes | `STB`, `Smart TV`, `Stick`, `Console`, `OTT Box`, `Other` |
| `status` | DeviceStatus | yes | `active`, `deprecated`, `device_id_missing` |
| `liveAdkVersion` | string | null | no | Currently deployed ADK version |
| `certificationStatus` | CertificationStatus | yes | `Certified`, `Pending`, `In Review`, `Not Submitted`, `Deprecated` |
| `certificationNotes` | string | null | no | Free-text notes about certification |
| `lastCertifiedDate` | string (ISO 8601) | null | no | Date of last certification |
| `questionnaireUrl` | string | null | no | Google Drive URL for partner questionnaire |
| `questionnaireFileUrl` | string | null | no | Firebase Storage URL for uploaded questionnaire |
| `activeDeviceCount` | number | yes | Denormalized count of active devices from telemetry |
| `specCompleteness` | number | yes | Denormalized percentage (0-100) of filled spec fields |
| `tierId` | string | null | no | Reference to `hardwareTiers` document ID |
| `tierAssignedAt` | string (ISO 8601) | null | no | When the tier was last assigned |
| `createdAt` | string (ISO 8601) | auto | Document creation timestamp |
| `updatedAt` | string (ISO 8601) | auto | Last modification timestamp |

**Unique constraint:** `deviceId` should be unique. Enforced at the application level.

**Denormalized fields:**
- `activeDeviceCount` — updated during telemetry upload
- `specCompleteness` — updated when specs are saved (via `calculateSpecCompleteness()`)
- `tierId` / `tierAssignedAt` — updated by the tier engine

---

### `deviceSpecs`

Hardware specification data for a device. Contains 90 typed fields organized into 12 category sub-objects. One-to-one relationship with `devices` (linked by `deviceId`).

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `deviceId` | string | yes | Reference to `devices` document (by `devices.id`) |
| `identity` | DeviceSpecIdentity | yes | Device identity fields |
| `soc` | DeviceSpecSoc | yes | SoC and CPU fields |
| `os` | DeviceSpecOs | yes | Operating system and browser fields |
| `memory` | DeviceSpecMemory | yes | RAM and storage fields |
| `gpu` | DeviceSpecGpu | yes | GPU and graphics fields |
| `streaming` | DeviceSpecStreaming | yes | ADK and streaming platform fields |
| `videoOutput` | DeviceSpecVideoOutput | yes | Display and HDR fields |
| `firmware` | DeviceSpecFirmware | yes | Firmware lifecycle fields |
| `codecs` | DeviceSpecCodecs | yes | Audio and video codec support fields |
| `frameRate` | DeviceSpecFrameRate | yes | Frame rate capability fields |
| `drm` | DeviceSpecDrm | yes | DRM and content protection fields |
| `security` | DeviceSpecSecurity | yes | Hardware security fields |
| `updatedAt` | string (ISO 8601) | auto | Last modification timestamp |

#### Spec Category: `identity` (5 fields)

| Field | Type | Description |
|---|---|---|
| `deviceModel` | string | null | Model number |
| `manufacturer` | string | null | Manufacturing company |
| `brandName` | string | null | Consumer-facing brand |
| `modelYear` | number | null | Year of manufacture |
| `deviceCategory` | string | null | Category classification |

#### Spec Category: `soc` (7 fields)

| Field | Type | Description |
|---|---|---|
| `socVendor` | SocVendor | null | `Broadcom`, `Novatek`, `MediaTek`, `Amlogic`, `Realtek`, `Other` |
| `socModel` | string | null | SoC model number (e.g., "MT5867") |
| `cpuArchitecture` | string | null | CPU architecture (e.g., "ARM Cortex-A55") |
| `cpuCores` | number | null | Number of CPU cores |
| `cpuSpeedMhz` | number | null | CPU clock speed in MHz |
| `cpuBenchmarkDmips` | number | null | DMIPS benchmark score |
| `is64Bit` | boolean | null | Whether the SoC supports 64-bit |

#### Spec Category: `os` (5 fields)

| Field | Type | Description |
|---|---|---|
| `osName` | string | null | Operating system name (e.g., "Tizen", "webOS") |
| `osVersion` | string | null | OS version string |
| `browserEngine` | string | null | Browser engine (e.g., "Chromium") |
| `browserVersion` | string | null | Browser version |
| `jsEngineVersion` | string | null | JavaScript engine version |

#### Spec Category: `memory` (5 fields)

| Field | Type | Description |
|---|---|---|
| `totalRamMb` | number | null | Total physical RAM in MB |
| `appAvailableRamMb` | number | null | RAM available to the application in MB |
| `totalStorageGb` | number | null | Total storage in GB |
| `appAvailableStorageMb` | number | null | Storage available to the app in MB |
| `swapMemoryMb` | number | null | Swap memory in MB |

#### Spec Category: `gpu` (7 fields)

| Field | Type | Description |
|---|---|---|
| `gpuModel` | string | null | GPU model name |
| `gpuVendor` | string | null | GPU manufacturer |
| `gpuMemoryMb` | number | null | Dedicated GPU memory in MB |
| `openGlVersion` | string | null | OpenGL version supported |
| `openGlEsVersion` | string | null | OpenGL ES version supported |
| `vulkanSupport` | boolean | null | Whether Vulkan is supported |
| `gpuBenchmark` | number | null | GPU benchmark score |

#### Spec Category: `streaming` (7 fields)

| Field | Type | Description |
|---|---|---|
| `adkVersion` | string | null | ADK version installed |
| `adkBuildType` | string | null | ADK build type |
| `htmlVersion` | string | null | HTML spec version supported |
| `cssVersion` | string | null | CSS spec version supported |
| `playerType` | string | null | Media player type |
| `mseSupport` | boolean | null | Media Source Extensions support |
| `emeSupport` | boolean | null | Encrypted Media Extensions support |

#### Spec Category: `videoOutput` (10 fields)

| Field | Type | Description |
|---|---|---|
| `maxResolution` | string | null | Maximum output resolution (e.g., "3840x2160") |
| `hdmiVersion` | string | null | HDMI specification version |
| `hdcpVersion` | string | null | HDCP version supported |
| `hdrSupport` | boolean | null | General HDR support |
| `hdr10Support` | boolean | null | HDR10 support |
| `hdr10PlusSupport` | boolean | null | HDR10+ support |
| `hlgSupport` | boolean | null | HLG support |
| `dolbyVisionSupport` | boolean | null | Dolby Vision support |
| `dolbyVisionProfiles` | string | null | Supported Dolby Vision profiles |
| `displayRefreshRate` | number | null | Display refresh rate in Hz |

#### Spec Category: `firmware` (6 fields)

| Field | Type | Description |
|---|---|---|
| `firmwareVersion` | string | null | Current firmware version |
| `firmwareUpdateMethod` | string | null | Update delivery method (OTA, USB, etc.) |
| `lastFirmwareDate` | string (ISO 8601) | null | Date of last firmware update |
| `nextPlannedFirmwareDate` | string (ISO 8601) | null | Date of next planned update |
| `firmwareAutoUpdate` | boolean | null | Whether auto-update is enabled |
| `eolDate` | string (ISO 8601) | null | End-of-life date |

#### Spec Category: `codecs` (13 fields)

| Field | Type | Description |
|---|---|---|
| `avcSupport` | boolean | null | H.264/AVC support |
| `avcMaxProfile` | string | null | Max AVC profile (e.g., "High") |
| `avcMaxLevel` | string | null | Max AVC level (e.g., "5.1") |
| `hevcSupport` | boolean | null | H.265/HEVC support |
| `hevcMaxProfile` | string | null | Max HEVC profile |
| `hevcMaxLevel` | string | null | Max HEVC level |
| `av1Support` | boolean | null | AV1 codec support |
| `vp9Support` | boolean | null | VP9 codec support |
| `eac3Support` | boolean | null | Enhanced AC-3 (Dolby Digital Plus) support |
| `ac4Support` | boolean | null | AC-4 (Dolby AC-4) support |
| `dolbyAtmosSupport` | boolean | null | Dolby Atmos support |
| `aacSupport` | boolean | null | AAC audio codec support |
| `opusSupport` | boolean | null | Opus audio codec support |

#### Spec Category: `frameRate` (6 fields)

| Field | Type | Description |
|---|---|---|
| `maxFrameRate` | number | null | Maximum supported frame rate (fps) |
| `supports24fps` | boolean | null | 24fps playback support |
| `supports30fps` | boolean | null | 30fps playback support |
| `supports60fps` | boolean | null | 60fps playback support |
| `supportsAdaptiveFps` | boolean | null | Adaptive frame rate support |
| `trickPlaySupport` | boolean | null | Trick play (fast-forward/rewind thumbnails) support |

#### Spec Category: `drm` (9 fields)

| Field | Type | Description |
|---|---|---|
| `widevineLevel` | string | null | Widevine security level (e.g., "L1", "L3") |
| `widevineVersion` | string | null | Widevine CDM version |
| `playreadyLevel` | string | null | PlayReady security level |
| `playreadyVersion` | string | null | PlayReady version |
| `fairplaySupport` | boolean | null | FairPlay Streaming support |
| `hdcpSupport` | boolean | null | HDCP support |
| `hdcp2xSupport` | boolean | null | HDCP 2.x support |
| `secureMediaPipeline` | boolean | null | Secure media pipeline (hardware-protected path) |
| `attestationType` | string | null | Device attestation type |

#### Spec Category: `security` (6 fields)

| Field | Type | Description |
|---|---|---|
| `secureBootSupport` | boolean | null | Secure boot chain support |
| `teeType` | string | null | Trusted Execution Environment type |
| `teeVersion` | string | null | TEE version |
| `hardwareRootOfTrust` | boolean | null | Hardware root of trust |
| `secureStorageSupport` | boolean | null | Secure storage for keys/credentials |
| `tamperDetection` | boolean | null | Hardware tamper detection |

---

### `deviceDeployments`

Many-to-many relationship between devices and partner keys, scoped to a specific country. Tracks where a device model is deployed.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `deviceId` | string | yes | Reference to `devices` document ID |
| `partnerKeyId` | string | yes | Reference to `partnerKeys` document ID |
| `countryIso2` | string | yes | ISO 3166-1 alpha-2 country code |
| `deploymentStatus` | DeploymentStatus | yes | `Active` or `Deprecated` |
| `deployedAdkVersion` | string | null | no | ADK version deployed in this market |

---

### `telemetrySnapshots`

Point-in-time telemetry data from Datadog exports. Each row represents the count of unique devices and events for a specific partner key + device + ADK version combination on a given date.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `partnerKey` | string | yes | Partner key string (matches `partnerKeys.key`) |
| `deviceId` | string | yes | Device identifier (matches `devices.deviceId`) |
| `coreVersion` | string | yes | ADK core version string |
| `uniqueDevices` | number | yes | Count of unique device IDs |
| `eventCount` | number | yes | Total event count |
| `snapshotDate` | string (ISO 8601) | yes | Date of the telemetry snapshot |

---

### `hardwareTiers`

Configurable hardware tier definitions. Devices are evaluated against these tiers (in `tierRank` order) to determine their hardware classification.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `tierName` | string | yes | Display name (e.g., "Tier 1", "Premium") |
| `tierRank` | number | yes | Sort order (1 = highest tier, evaluated first) |
| `ramMin` | number | null | no | Minimum app-available RAM in MB |
| `gpuMin` | number | null | no | Minimum GPU memory in MB |
| `cpuSpeedMin` | number | null | no | Minimum CPU speed in MHz |
| `cpuCoresMin` | number | null | no | Minimum CPU core count |
| `requiredCodecs` | string[] | yes | Codecs the device must support (e.g., `["hevc", "av1"]`) |
| `require64Bit` | boolean | yes | Whether 64-bit SoC is required |
| `version` | number | yes | Incrementing version for change tracking |
| `createdAt` | string (ISO 8601) | auto | Document creation timestamp |
| `updatedAt` | string (ISO 8601) | auto | Last modification timestamp |

---

### `deviceTierAssignments`

Historical record of tier assignments. A new entry is created every time a device's tier changes, enabling trend analysis.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `deviceId` | string | yes | Reference to `devices` document ID |
| `tierId` | string | yes | Reference to `hardwareTiers` document ID |
| `assignedAt` | string (ISO 8601) | yes | Assignment timestamp |
| `trigger` | TierAssignmentTrigger | yes | `spec_update`, `tier_definition_update`, or `manual` |

---

### `auditLog`

Append-only change log. Every field-level mutation to any entity is recorded here by the backend audit service. The Firestore rules make this collection read-only from the client.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `entityType` | AuditEntityType | yes | `partner`, `partnerKey`, `device`, `deviceSpec`, `deployment`, `hardwareTier`, `alert`, `user` |
| `entityId` | string | yes | Document ID of the changed entity |
| `field` | string | yes | Name of the field that changed |
| `oldValue` | string | null | yes | Previous value (serialized as string; objects serialized as JSON) |
| `newValue` | string | null | yes | New value |
| `userId` | string | yes | User ID of the person who made the change |
| `userEmail` | string | yes | Email of the person who made the change |
| `timestamp` | string (ISO 8601) | auto | When the change was recorded |

---

### `alerts`

System-generated alerts from telemetry processing. Created when the upload process encounters unregistered partner keys or device IDs.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `type` | AlertType | yes | `unregistered_device`, `new_partner_key`, `inactive_key` |
| `partnerKey` | string | yes | Partner key string involved |
| `deviceId` | string | null | no | Device identifier (if applicable) |
| `firstSeen` | string (ISO 8601) | yes | First time this anomaly was detected |
| `lastSeen` | string (ISO 8601) | yes | Most recent detection |
| `uniqueDeviceCount` | number | yes | How many unique devices triggered this alert |
| `status` | AlertStatus | yes | `open` or `dismissed` |
| `dismissedBy` | string | null | no | User ID who dismissed |
| `dismissReason` | AlertDismissReason | null | no | `Test Device`, `Duplicate Key`, `Will Register`, `Internal / Deprecated` |
| `dismissedAt` | string (ISO 8601) | null | no | When dismissed |
| `consecutiveMisses` | number | yes | For inactive_key: how many uploads this key has been absent from |

---

### `uploadHistory`

Metadata about each telemetry CSV upload. Used for auditing data ingestion.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `uploadedBy` | string | yes | User ID of the uploader |
| `uploadedByEmail` | string | yes | Email of the uploader |
| `uploadedAt` | string (ISO 8601) | auto | Upload timestamp |
| `fileName` | string | yes | Original file name |
| `rowCount` | number | yes | Total rows in the CSV |
| `successCount` | number | yes | Successfully processed rows |
| `errorCount` | number | yes | Rows with errors |
| `snapshotDate` | string (ISO 8601) | yes | The date the telemetry data represents |
| `errors` | string[] | yes | Error messages (if any) |

---

### `users`

User accounts and role assignments. A document must exist here for a user to be authorized by the backend middleware.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | auto | Firestore document ID |
| `email` | string | yes | User's corporate email address |
| `role` | UserRole | yes | `viewer`, `editor`, or `admin` |
| `displayName` | string | yes | User's display name |
| `photoUrl` | string | null | no | Profile photo URL from Google |
| `lastLogin` | string (ISO 8601) | no | Last login timestamp |

---

### `config`

Application-level configuration. Currently contains telemetry data retention settings.

| Field | Type | Required | Description |
|---|---|---|---|
| `retentionDailyDays` | number | yes | Days to keep daily telemetry snapshots |
| `retentionWeeklyYears` | number | yes | Years to keep weekly rollup data |

---

## Enumerated Types Reference

| Type | Values |
|---|---|
| `UserRole` | `viewer`, `editor`, `admin` |
| `CertificationStatus` | `Certified`, `Pending`, `In Review`, `Not Submitted`, `Deprecated` |
| `DeviceType` | `STB`, `Smart TV`, `Stick`, `Console`, `OTT Box`, `Other` |
| `DeviceStatus` | `active`, `deprecated`, `device_id_missing` |
| `DeploymentStatus` | `Active`, `Deprecated` |
| `SocVendor` | `Broadcom`, `Novatek`, `MediaTek`, `Amlogic`, `Realtek`, `Other` |
| `AlertType` | `unregistered_device`, `new_partner_key`, `inactive_key` |
| `AlertStatus` | `open`, `dismissed` |
| `AlertDismissReason` | `Test Device`, `Duplicate Key`, `Will Register`, `Internal / Deprecated` |
| `TierAssignmentTrigger` | `spec_update`, `tier_definition_update`, `manual` |
| `Region` | `NA`, `EMEA`, `LATAM`, `APAC` |
| `AuditEntityType` | `partner`, `partnerKey`, `device`, `deviceSpec`, `deployment`, `hardwareTier`, `alert`, `user` |

---

## Timestamps

All timestamps are stored as ISO 8601 strings (e.g., `"2026-02-25T18:30:00.000Z"`), not Firestore Timestamp objects. This simplifies serialization between the backend and frontend — the API returns timestamps as plain strings, and the frontend can parse them with `new Date(timestamp)`.
