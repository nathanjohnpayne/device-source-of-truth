# DST-035 — STB Questionnaire: Full 16-Section Field Schema & Form Extension

| Field | Value |
|---|---|
| **Story ID** | DST-035 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T3 — Hardware Spec Ingestion |
| **Priority** | P1 |
| **Story Points** | 13 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-036 (Dropdown Option Management must be complete first) |
| **Blocks** | DST-012 (replaces / supersedes existing 90-field spec form) |

---

## User Story

As a Certification Specialist or TAM, I can enter all fields from the Disney STB Technical Questionnaire directly into DST across all 16 sections, with the same dropdown options I currently see in the spreadsheet, so that questionnaire data is structured, searchable, and no longer locked in emailed Excel files.

---

## Background

The Disney STB Technical Questionnaire (`Disney_STB_Questionnaire.xlsx`) is the canonical data-collection instrument sent to all NCP/ADK partner STB integrators. It contains 16 sections and approximately 170 individual fields. The existing DST spec form (DST-012) was scoped to 90 fields from the earlier GM questionnaire template. This story fully supersedes DST-012 by mapping every field in the STB questionnaire to a typed DST column, migrating the form UI to the 16-section structure, and wiring all dropdown fields to the managed option lists introduced in DST-036.

---

## Field Specification by Section

Input types: `Text` = free-text string | `Dropdown` = managed list (see DST-036) | `Number` = numeric | `Date` = date picker | `Yes/No` = boolean toggle

---

### Section 1 — General

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 1.1 | Model Name (customer-facing) | Text | |
| 1.2 | Model Number | Text | |
| 1.3 | Date STB Initially Deployed to Market | Date | |
| 1.4 | Date STB Deliveries Stopped | Date / Text | |
| 1.5 | Active Devices in Use — Monthly Average | Text | |
| 1.6 | Total Installed Base (subscribers) | Text | |
| 1.7 | Forecasted Growth/Decline — Next 3 Years | Text | |
| 1.8 | Countries Where Device Is Deployed | Text | |
| 1.9 | 3rd Party Apps Deployed & Dev Method | Text | |
| 1.10 | Type of Connection | Dropdown | `connection_type` |
| 1.10a | Type of Connection — Other (specify) | Text | |

---

### Section 2 — Hardware

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 2.1 | SoC Vendor | Dropdown | `soc_vendor` |
| 2.1a | SoC Vendor — Other (specify) | Text | |
| 2.2 | SoC Model & Chipset Revision | Text | |
| 2.3 | Software Architecture | Dropdown | `software_architecture` |
| 2.3a | Software Architecture — Other (specify) | Text | |
| 2.4 | SoC Base Reference Software Version | Text | |
| 2.5 | Customizations to SoC Base Reference Software? | Dropdown | `yes_no` |
| 2.5a | SoC Customizations — If Yes, describe | Text | |
| 2.6 | Active SoC Support Contract? | Dropdown | `support_contract_status` |
| 2.6a | SoC Support Contract Expiration Date | Date / Text | |
| 2.7a | CPU Clock Rate (GHz) | Number | |
| 2.7b | CPU DMIPS Rating | Text | |
| 2.8 | Number of CPU Cores | Dropdown | `cpu_cores` |
| 2.8a | CPU Cores — Other (specify) | Text | |
| 2.9 | STB Manufacturer | Text | |
| 2.10 | Operating System | Dropdown | `operating_system` |
| 2.10a | Operating System — Other (specify) | Text | |
| 2.11 | OS Version | Text | |
| 2.12 | Customizations to Base OS / Different Kernel? | Dropdown | `os_customization` |
| 2.12a | OS Customization — If Yes, describe | Text | |
| 2.13 | Middleware Provider | Dropdown | `middleware_provider` |
| 2.13a | Middleware Provider — Other (specify) | Text | |
| 2.14 | Middleware Version | Text | |
| 2.15 | Middleware Support Contract Active? | Dropdown | `middleware_contract` |
| 2.15a | Middleware Contract Expiration Date | Date / Text | |
| 2.16 | Middleware Integration Company & Support Origin | Text | |
| 2.17 | Video Delivery Support | Dropdown | `video_delivery` |
| 2.17a | Video Delivery — Other (specify) | Text | |
| 2.18a | Device Memory Total Size (GB) | Number | |
| 2.18b | Device Memory Type | Dropdown | `memory_type` |
| 2.18b_o | Memory Type — Other (specify) | Text | |
| 2.19 | RAM Available to Disney+ App (GB) | Number | |
| 2.20 | Linux System Memory Available to Disney+ App (MB) | Number | |
| 2.21 | GPU Memory Available to Disney+ App (MB) | Number | |
| 2.22 | GPU Texture/Graphics Memory Allocated (MB) | Number | |
| 2.23 | GPU Texture/Graphics Memory: Shared or Dedicated? | Dropdown | `gpu_memory_sharing` |
| 2.23a | GPU Memory Sharing — Other (specify) | Text | |
| 2.24 | GPU Memory Reserved for Disney (MB) | Number | |
| 2.25a | Total Persistent Storage Size (GB) | Number | |
| 2.25b | Persistent Storage Type | Dropdown | `storage_type` |
| 2.25b_o | Storage Type — Other (specify) | Text | |
| 2.26 | Persistent Storage Available to Disney+ App (MB) | Number | |
| 2.27 | Non-Persistent Storage Available to Disney+ App (MB) | Number | |
| 2.28 | Maximum Application Binary Size Supported (MB) | Number | |
| 2.29 | Persistent Storage Filesystem Type | Dropdown | `filesystem_type` |
| 2.29a | Filesystem Type — Other (specify) | Text | |
| 2.30 | Persistent Storage Usage Limitations? | Dropdown | `yes_no` |
| 2.30a | Storage Limitations — If Yes, describe | Text | |
| 2.31a | GPU Availability Level | Dropdown | `gpu_availability` |
| 2.31b | GPU Available for App Use? | Dropdown | `yes_no_unknown` |
| 2.32 | GPU Graphics Library Supported | Dropdown | `gpu_graphics_library` |
| 2.32a | GPU Graphics Library — Other (specify) | Text | |
| 2.33 | OTT Apps Confirmed Using OpenGL ES 2.0? | Dropdown | `yes_no_unknown` |
| 2.33a | OpenGL ES 2.0 Apps — If Yes, name apps | Text | |
| 2.34 | OTT Streaming Interface | Dropdown | `streaming_interface` |
| 2.34a_o | OTT Streaming Interface — Other (specify) | Text | |
| 2.34a | Ethernet Port Present? | Dropdown | `ethernet_type` |
| 2.34b | Wi-Fi Standards Supported (list all) | Text | |
| 2.34c | Wi-Fi Bands Supported (list all) | Text | |
| 2.34d | MoCA Present? | Dropdown | `moca_version` |
| 2.35 | Maximum Sustainable Streaming Throughput (Mbps) | Number | |
| 2.36 | Device Supports Retrieval of HDMI Capabilities? | Dropdown | `yes_no_partial_unknown` |
| 2.37 | HDMI Version Supported | Dropdown | `hdmi_version` |
| 2.37a | HDMI Version — Other (specify) | Text | |
| 2.38 | Digital Video Output Modes Supported (list all) | Text | |
| 2.39 | Analog Video Output Modes Supported (list all) | Text | |
| 2.40 | STB UI Native Render Resolution | Dropdown | `ui_resolution` |
| 2.40a | UI Resolution — Other (specify) | Text | |
| 2.41 | OTT App Restrictions on STB Device | Text | |

---

### Section 3 — Firmware Updates

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 3.1 | STB Still Supported via Firmware Updates? | Dropdown | `firmware_support` |
| 3.2 | Frequency of Firmware Updates | Dropdown | `firmware_frequency` |
| 3.2a | Firmware Frequency — Other (specify) | Text | |
| 3.3a | Time to Release — Internal Lead Time | Text | |
| 3.3b | Time to Release — Rollout Duration to Homes | Text | |
| 3.4 | Emergency Firmware Update Capability? | Dropdown | `firmware_emergency` |
| 3.4a | Emergency Update — Time to deploy | Text | |
| 3.5 | Security Audits / Code Signing Required? | Dropdown | `yes_no` |
| 3.5a | Code Signing — If Yes, describe process and timeline | Text | |

---

### Section 4 — Media Codec Support

All codec fields share the dropdown key `codec_support`: Yes — Hardware Decode | Yes — Software Decode | Yes — Both | No | Partial | Unknown.

This section renders as a compact grid (one row per codec, one dropdown per row) rather than individual full-width form fields.

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 4.1 | AVC / H.264 (video) | Dropdown | `codec_support` |
| 4.2 | HEVC / H.265 (video) | Dropdown | `codec_support` |
| 4.3 | E-AC-3 / Dolby Digital Plus (audio) | Dropdown | `codec_support` |
| 4.4 | E-AC-3 with Atmos (audio) — Optional | Dropdown | `codec_support` |
| 4.5 | HDR10 | Dropdown | `codec_support` |
| 4.6 | HDR10+ | Dropdown | `codec_support` |
| 4.7 | AV1 | Dropdown | `codec_support` |
| 4.8 | Dolby Vision Supported? | Dropdown | `yes_no_partial_unknown` |
| 4.8a | Dolby Vision Version (e.g. 8.1) | Text | |

---

### Section 5 — Supported Output Frame Rates

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 5.1 | Video Output Refresh Rates Supported (list all) | Text | |
| 5.2 | User Settings for Output Refresh Rate (list all) | Text | |
| 5.3 | Device Adjusts Output Rate to Match Content? | Dropdown | `frame_rate_adjust` |
| 5.3a | Frame Rate Adjustment — Other (specify) | Text | |
| 5.4 | Device Converts Content Frame Rate to Fixed Output? | Dropdown | `frame_rate_convert` |
| 5.4a | Fixed Output Rate — If Yes, which fixed rate? | Text | |
| 5.5 | Apps Can Programmatically Determine Output Refresh Rate? | Dropdown | `yes_no_partial_unknown` |
| 5.6 | Apps Can Programmatically Set Output Refresh Rate? | Dropdown | `yes_no_partial_unknown` |

---

### Section 6 — Content Protection & Security

Fields 6.15–6.22 render as a compact checklist table (one row per feature, Yes / No / Unknown per row), not individual full-width fields.

Field 8.15 (see Section 8) is conditionally shown: hidden when 6.2c (PlayReady Security Level) = SL3000 or is not yet set.

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 6.1 | DRM to Be Used for Disney+ | Dropdown | `drm_system` |
| 6.1a | DRM Encryption Scheme (CTR / CBCS / Both) | Dropdown | `encryption_scheme` |
| 6.2a | PlayReady Supported? | Dropdown | `yes_no` |
| 6.2b | PlayReady Version | Dropdown | `playready_version` |
| 6.2c | PlayReady Security Level | Dropdown | `playready_security_level` |
| 6.2d | PlayReady Encryption Scheme | Dropdown | `encryption_scheme` |
| 6.3a | Widevine Supported? | Dropdown | `yes_no` |
| 6.3b | Widevine Security Level | Dropdown | `widevine_security_level` |
| 6.3c | Widevine Version | Text | |
| 6.3d | Widevine Encryption Scheme | Dropdown | `encryption_scheme` |
| 6.4 | PlayReady SL3000 and/or Widevine L1 Supported? | Dropdown | `drm_hw_level` |
| 6.5 | PlayReady 4.0+ / Widevine 3.1+ with CBCS? | Dropdown | `cbcs_support` |
| 6.6 | Multi-Key CTR Supported? | Dropdown | `yes_no_unknown` |
| 6.6a | Multi-Key CTR — Max keys simultaneously bound | Number | |
| 6.7 | Digital Video Output? | Dropdown | `yes_no` |
| 6.8 | Digital Video Output Copy Protection Protocol | Dropdown | `hdcp_version` |
| 6.8a | HDCP Type (if applicable) | Text | |
| 6.9 | Other DRMs Supported (version and type) | Text | |
| 6.10 | Broadcom SAGE Security Coprocessor | Dropdown | `yes_no_unknown_na` |
| 6.11 | Secure Firmware Download | Dropdown | `yes_no_unknown` |
| 6.12 | Signed Firmware / Secure Boot | Dropdown | `yes_no_unknown` |
| 6.13 | Hardware Root of Trust for DRM Certificate Chain | Dropdown | `yes_no_unknown` |
| 6.14 | Tamper Resistant Code | Dropdown | `yes_no_unknown` |
| 6.15 | Trusted Execution Environment (TEE) | Dropdown | `yes_no_unknown` |
| 6.16 | Secure Video Path | Dropdown | `yes_no_unknown` |
| 6.17 | Rooted Device Protection | Dropdown | `yes_no_unknown` |
| 6.18 | App Code Signing | Dropdown | `yes_no_unknown` |
| 6.19 | Installation Restrictions / Sideloading Restricted | Dropdown | `yes_no_unknown` |
| 6.20 | Digital Output Protection Enforcement | Dropdown | `yes_no_unknown` |
| 6.21 | Encrypted Audio | Dropdown | `yes_no_unknown` |
| 6.22 | Secure Boot / JTAG Disabled / DRAM Scrambling | Dropdown | `secure_boot_jtag` |

---

### Section 7 — Native (ADK / Broadcom-Specific)

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 7.1 | SoC Toolchain & Ref Software ADK Port Possible? | Dropdown | `yes_no_partial_unknown` |
| 7.2 | URSR, Kernel or Toolchain Modified? | Dropdown | `ursr_modification` |
| 7.2a | Toolchain Modification — Other (specify) | Text | |
| 7.3 | Direct Access to Broadcom Nexus Video APIs? | Dropdown | `yes_no_partial_na` |
| 7.4 | Sage API Access Offered? | Dropdown | `yes_no_unknown_na` |
| 7.5 | Audio Detection API (Stereo, 5.1, Atmos)? | Dropdown | `audio_detection_api` |
| 7.6 | DRM Implementation Uses Broadcom Reference API? | Dropdown | `yes_no_partial_na` |

---

### Section 8 — Video Playback

Fields 8.15a–8.15f are hidden by default. They are shown automatically when field 6.2c (PlayReady Security Level) is set to any value other than SL3000.

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 8.1 | AVC Bitrate Limitations | Text | |
| 8.2 | AVC Frame Rate / Resolution Limitations | Text | |
| 8.3 | HEVC Bitrate Limitations | Text | |
| 8.4 | HEVC Frame Rate / Resolution Limitations | Text | |
| 8.5 | E-AC-3 Bitrate Limitations | Text | |
| 8.6 | Playback Encryption Type | Dropdown | `playback_encryption` |
| 8.6a | Playback Encryption — Other (specify) | Text | |
| 8.7 | E-AC-3 via MSE: Native and CMAF Supported? | Dropdown | `mse_cmaf_support` |
| 8.8 | E-AC-3: On-Device Decode, Bitstream, or Both? | Dropdown | `eac3_decode_mode` |
| 8.9 | Dolby Atmos Supported? | Dropdown | `atmos_support` |
| 8.10 | Dolby Vision Profiles Supported (list all) | Text | |
| 8.10a | Dolby Vision IDK/SDK Version | Text | |
| 8.11 | PlayReady CDM Version (if below 4.0) | Dropdown | `playready_cdm_version` |
| 8.12 | PlayReady 4.0+ CDM: CBCS Confirmed? | Dropdown | `cbcs_confirmed` |
| 8.13a | Widevine CDM Version (if below 3.1) | Text | |
| 8.13b | Widevine CDM Category | Dropdown | `widevine_cdm_category` |
| 8.14 | Widevine 3.1 CDM: CBCS Confirmed? | Dropdown | `cbcs_confirmed` |
| 8.15a | Security: Secure Boot (if PlayReady not SL3000) | Dropdown | `yes_no_na` |
| 8.15b | Security: Hardware Root of Trust | Dropdown | `yes_no_na` |
| 8.15c | Security: Secure Key Storage | Dropdown | `yes_no_na` |
| 8.15d | Security: Secure Decryption (TEE) | Dropdown | `yes_no_na` |
| 8.15e | Security: Secure Video Path | Dropdown | `yes_no_na` |
| 8.15f | Security: HDCP (if digital output) | Dropdown | `yes_no_na` |
| 8.16 | HTML5/Platform API for Capability Detection | Text | |

---

### Section 9 — UHD HDR

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 9.1 | HDR Technologies Supported (list all) | Text | |
| 9.2 | % UHD Subscribers with UHD-Capable Displays | Number | |
| 9.3 | Device Supports HDR-Native UI? | Dropdown | `yes_no_partial_unknown` |
| 9.4 | API for Display Video Range Capabilities? | Dropdown | `yes_no_partial_unknown` |
| 9.4a | Display Range API — If Yes, describe | Text | |
| 9.5 | SDR-HDR Upmap / Downmap / Format Transform? | Dropdown | `hdr_transform` |
| 9.5a | HDR Transform — Other (specify) | Text | |
| 9.6 | HDR Mode-Switch Behavior | Dropdown | `hdr_mode_switch` |
| 9.6a | HDR Mode-Switch — Other (specify) | Text | |
| 9.7 | Device Rendering Behavior for Video Range | Dropdown | `video_range_render` |
| 9.7a | Video Range Render — Other (specify) | Text | |
| 9.8 | Operator Help Resources for HDR Setup | Text | |
| 9.9 | HDR-Related User Settings at Device Level | Text | |
| 9.10 | Color Space Used to Render the UI | Dropdown | `color_space` |
| 9.10a | Color Space — Other (specify) | Text | |
| 9.11 | Existing Apps That Support HDR on Device? | Dropdown | `yes_no_unknown` |
| 9.11a | HDR Apps — If Yes, list apps | Text | |
| 9.12 | Public HDR Support Resource Links | Text | |
| 9.13 | SDR/HDR Graphics Composited with HDR Video? | Dropdown | `hdr_compositing` |
| 9.14 | App Graphics Plane Resolution During Playback | Dropdown | `graphics_plane_resolution` |
| 9.14a | Graphics Plane Resolution — Other (specify) | Text | |

---

### Section 10 — Global Device Audio/Video Output Control

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 10.1 | Display Output Resolution/Mode Settings (list all) | Text | |
| 10.2 | Video Decode Feature Settings (list all) | Text | |
| 10.3 | Audio Decode Feature Settings (list all) | Text | |
| 10.4 | Video Output Aspect Ratio Settings (list all) | Text | |
| 10.5 | UI Resolution Settings (list all) | Text | |
| 10.6 | Alternate Audio Path / Output Settings (list all) | Text | |
| 10.7 | Audio Output Synchronization Settings | Dropdown | `audio_sync_settings` |
| 10.7a | Audio Sync — If adjustable, range and step values | Text | |

---

### Section 11 — Other

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 11.1 | Voltage Range | Dropdown | `voltage_range` |
| 11.1a | Voltage Range — Other (specify) | Text | |
| 11.2 | Remote Control Unit (RCU) Type (list all) | Text | |
| 11.2a | Bluetooth Present on Device? | Dropdown | `yes_no` |
| 11.2b | Bluetooth Version | Dropdown | `bluetooth_version` |
| 11.2b_o | Bluetooth Version — Other (specify) | Text | |
| 11.2c | Bluetooth Profiles Supported (list all) | Text | |
| 11.2d | Bluetooth Used For (list all) | Text | |
| 11.3 | Other Video Outputs Supported (list all) | Text | |
| 11.4 | Other Audio Outputs Supported (list all) | Text | |
| 11.5 | Other Video Output Interface Protection | Text | |
| 11.6 | Other Video Outputs Where Disney+ Expected | Text | |

---

### Section 12 — App Runtime / Web Engine

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 12.1 | HTML5 Browser / Web Engine Used | Dropdown | `web_engine` |
| 12.1a | Web Engine Version | Text | |
| 12.2 | ADK Version Supported | Text | |
| 12.3 | MSE (Media Source Extensions) Supported? | Dropdown | `mse_support` |
| 12.3a | MSE — If Partial, describe limitations | Text | |
| 12.4 | EME (Encrypted Media Extensions) Supported? | Dropdown | `yes_no_partial_unknown` |
| 12.4a | EME — If Partial, describe limitations | Text | |
| 12.5 | JavaScript Engine | Dropdown | `js_engine` |
| 12.5a | JavaScript Engine Version | Text | |
| 12.6 | Known JavaScript Engine Limitations | Text | |
| 12.7 | WebAssembly (WASM) Supported? | Dropdown | `yes_no_partial_unknown` |
| 12.8 | WebGL Supported? | Dropdown | `webgl_support` |
| 12.9 | Web Crypto API Supported? | Dropdown | `yes_no_partial_unknown` |

---

### Section 13 — Audio Capabilities

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 13.1 | PCM Output Maximum Channel Count | Dropdown | `pcm_channels` |
| 13.1a | PCM Channels — Other (specify) | Text | |
| 13.2 | Supported Audio Sample Rates (list all) | Text | |
| 13.3 | Supported Audio Bit Depths (list all) | Text | |
| 13.4 | Dolby Audio Supported? | Dropdown | `dolby_audio_support` |
| 13.4a | Dolby Audio — Other (specify) | Text | |
| 13.5 | DTS Audio Supported? | Dropdown | `dts_audio_support` |
| 13.5a | DTS Audio — Other (specify) | Text | |
| 13.6 | Bluetooth Audio Output Supported? | Dropdown | `bt_audio_support` |
| 13.6a | Bluetooth Audio — Other (specify) | Text | |
| 13.7 | Audio Behavior When Disney+ App Backgrounded | Dropdown | `audio_background_behavior` |
| 13.7a | Audio Background — Other (specify) | Text | |

---

### Section 14 — Accessibility

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 14.1 | Text-to-Speech (TTS) API Available? | Dropdown | `tts_api` |
| 14.1a | TTS API — If Yes, describe API or engine | Text | |
| 14.2 | Closed Caption / Subtitle Formats (list all) | Text | |
| 14.3 | Caption Rendering: On-Device or App-Rendered? | Dropdown | `caption_rendering` |
| 14.4 | Audio Description (AD) Track Support? | Dropdown | `ad_track_support` |
| 14.6 | Focus Management / D-Pad Navigation API? | Dropdown | `focus_management_api` |

---

### Section 15 — Platform & Home Screen Integration

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 15.1 | Deep Link Support into Disney+ App? | Dropdown | `deep_link_support` |
| 15.1a | Deep Link — If Yes, describe scheme or format | Text | |
| 15.2 | Voice Assistant Integration (list all) | Text | |
| 15.3 | Home Screen / Launcher Integration? | Dropdown | `home_screen_integration` |
| 15.3a | Home Screen Integration — If Yes, describe | Text | |
| 15.4 | Continue Watching Row on Home Screen? | Dropdown | `continue_watching` |
| 15.4a | Continue Watching — If Yes, describe API or feed | Text | |
| 15.5 | Universal Search / Discovery Integration? | Dropdown | `universal_search` |
| 15.5a | Universal Search — If Yes, describe data format | Text | |
| 15.6 | Recommendations / Editorial Tiles on Home Screen? | Dropdown | `recommendations_tiles` |
| 15.7 | App Autostart / Preload Supported? | Dropdown | `app_autostart` |

---

### Section 16 — Performance Benchmarks

| Field ID | Question / Field | Input Type | Dropdown Key |
|---|---|---|---|
| 16.1 | App Cold Start Time (launch to interactive UI) | Text | |
| 16.2 | App Warm Start Time (background to interactive UI) | Text | |
| 16.3 | Time to First Frame (TTFF) for Video Playback | Text | |
| 16.4 | UI Target Frame Rate | Dropdown | `ui_frame_rate` |
| 16.4a | UI Target Frame Rate — Other (specify) | Text | |
| 16.5 | Concurrent Stream Handling | Dropdown | `concurrent_streams` |
| 16.5a | Concurrent Streams — If Limited, describe | Text | |
| 16.6 | App Memory Behavior When Backgrounded | Dropdown | `memory_background` |
| 16.7 | Performance Benchmarks / Lab Data Available? | Dropdown | `benchmark_available` |

---

## Database Changes

New columns are added to `device_specs`. Naming convention: `s<section>_<field_id>_<short_slug>` (e.g., `s01_1_1_model_name`, `s02_2_1_soc_vendor`).

| Type | Storage |
|---|---|
| Dropdown fields | `VARCHAR(100)` — stores `display_value` from `field_options` (DST-036) |
| Numeric fields | `NUMERIC(10,2)` — units documented in column comment |
| Date fields | `DATE` with companion `_note VARCHAR(100)` for fields that also accept "N/A" |
| Text fields | `TEXT`, nullable |
| "Other" fields | Named `<parent_field_id>_other`; only shown in UI when parent = "Other" |
| Migration | Idempotent `ALTER TABLE` script; existing rows default to `NULL` for all new columns |

---

## Form / UI Requirements

- Sections rendered as collapsible accordion panels with section number and title. All collapsed by default; the first section containing an incomplete required field auto-expands on load.
- Each section header shows a completion pill, e.g., "3 / 11 fields completed."
- Dropdown fields are rendered as `<select>` populated from `field_options` for that `dropdown_key`. Options are fetched on form load. Admins see a pencil icon next to each dropdown label that opens the DST-036 Reference Data editor inline.
- "Other (specify)" text fields are hidden by default and shown only when the parent dropdown value is "Other." They are automatically cleared when the parent dropdown changes away from "Other."
- Numeric fields display a unit label (e.g., "GB," "MB," "GHz") as inline suffix text, not embedded in the field label.
- Date fields use a date picker. Fields that accept "N/A" as a value show a checkbox ("N/A / Not applicable") that replaces the date picker with the text value.
- Section 4 (codecs) renders as a compact grid: one row per codec, one dropdown per row.
- Sections 6.15–6.22 (security checklist) render as a compact table with Yes / No / Unknown per row.
- Section 8.15 (PlayReady non-SL3000 security aspects) is hidden by default and shown automatically when 6.2c (PlayReady Security Level) is set to any value other than "SL3000."
- Partial saves are supported at any time. A global "Unsaved changes" banner is shown, with an auto-save confirmation modal on navigation away.
- Form is accessible: all fields have labels, ARIA attributes, and keyboard navigation in section/field order.

---

## Acceptance Criteria

- All 170 fields in the STB questionnaire have a corresponding typed column in `device_specs` and an input control in the spec entry form.
- All 89 dropdown fields are wired to a `dropdown_key` in `field_options` (DST-036) and render the correct seeded options on first deploy.
- "Other (specify)" fields hide and show correctly based on parent dropdown value; clearing "Other" hides and clears the companion text field.
- Section 8.15 security fields are hidden when PlayReady Security Level is SL3000 or not yet set, and visible otherwise.
- The codec grid (Section 4) and security checklist (Sections 6.15–6.22) render as compact tables.
- Existing device records with pre-existing spec data are not affected; new columns are nullable and default to `NULL`.
- Spec completion percentage on the device record and device list view correctly counts against the 170-field total.
- All new fields appear in CSV export (DST-029) with section-prefixed headers matching the questionnaire.
- Migration script is idempotent and runs without error against the seeded development database.

## Out of Scope

- AI-assisted auto-extraction of fields from uploaded XLS files (Phase 2 backlog).
- Automatic PDF generation of a filled-in questionnaire from DST data (Phase 2 backlog).
- Per-field validation rules (e.g., "RAM must be ≥ 1 GB") — addressed in a separate story if needed.

---

---

# DST-036 — Reference Data Admin: Dropdown Option Management

| Field | Value |
|---|---|
| **Story ID** | DST-036 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T1 — Data Model & Infrastructure |
| **Priority** | P1 (must be complete before DST-035) |
| **Story Points** | 5 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-001 (database schema), DST-003 (auth — Admin role required) |
| **Blocks** | DST-035 (STB Questionnaire Field Extension) |

---

## User Story

As an Admin, I can add, rename, reorder, and remove dropdown options for any controlled-vocabulary field without a code deploy so that the spec entry form stays current as questionnaire options evolve — for example, when a new SoC vendor is certified or a DRM version is deprecated.

---

## Background & Design Rationale

DST has 89 distinct dropdown lists across the 16 questionnaire sections. These lists will change over time: new SoC vendors emerge, Bluetooth versions increment, DRM security levels are added or deprecated. Hardcoding options in the frontend or in application constants creates a code-deploy dependency for every option change. This story introduces a `field_options` table as the single source of truth for all controlled vocabularies and an Admin UI to manage them without engineering involvement.

---

## Database Schema

New table: `field_options`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `dropdown_key` | VARCHAR(80) | Stable machine identifier, e.g., `soc_vendor`, `codec_support`. Matches `dropdown_key` in DST-035 field spec. Not editable after creation. |
| `display_label` | VARCHAR(200) | Human-readable field label shown in Admin UI, e.g., "SoC Vendor." Editable. |
| `display_value` | VARCHAR(200) | The option string stored in `device_specs` and shown in form dropdowns, e.g., "Broadcom." Editable — see rename behavior note below. |
| `sort_order` | INTEGER | Controls render order in the dropdown. Editable via drag-and-drop. Auto-assigned as `max(sort_order) + 1` within the key on creation. |
| `is_active` | BOOLEAN | Soft-delete flag. Inactive options are hidden from the form dropdown but preserved in existing `device_specs` rows. Defaults to `TRUE`. |
| `is_other_trigger` | BOOLEAN | If `TRUE`, selecting this option shows the companion "Other (specify)" text field. Typically set on options whose `display_value` is "Other." |
| `created_at` | TIMESTAMPTZ | Set on insert. |
| `created_by` | VARCHAR(100) | Email of the Admin who created the option. |
| `updated_at` | TIMESTAMPTZ | Updated on any edit. |
| `updated_by` | VARCHAR(100) | Email of the Admin who last modified the option. |

Indexes: `(dropdown_key, sort_order)` and `(dropdown_key, display_value)` unique where `is_active = TRUE`.

**Rename behavior:** If `display_value` is edited on an existing option, existing `device_specs` rows that stored the old value are _not_ automatically updated. The Admin UI warns: "X device records use the current value. Renaming will not update those records. Consider adding a new option instead." This is intentional — historical values are preserved for audit purposes.

---

## Admin UI — Reference Data Manager

Location: Admin panel > Reference Data (new top-level section, visible to Admin role only).

**List view — all dropdown keys**

- Table: Dropdown Key | Field Label | Option Count | Last Updated | Actions.
- Searchable by key name or field label.
- Clicking a row opens the Option Editor for that key.

**Option Editor — per dropdown key**

- Displays the `dropdown_key` (read-only), field label (editable inline), and a list of all options for that key.
- Each option row shows: drag handle | `display_value` (editable inline) | `is_other_trigger` toggle | `is_active` toggle | Delete button.
- Drag-and-drop reorder updates `sort_order`. Changes save immediately with an undo toast for 5 seconds.
- "+ Add Option" button appends a new blank row in edit mode. Saving is required before navigating away.
- Delete button shows a confirmation modal: "X device records use this value. Deleting will set `is_active = false`. Existing records are not affected. Confirm?" Soft-delete only — no hard deletes from this UI.
- Inactive options are shown in a collapsed "Inactive options" accordion at the bottom of the list and can be reactivated.
- Full edit history for each option is accessible in a side panel (who changed what, when).

---

## Seed Data — All Dropdown Keys and Initial Options

All options seeded as `is_active = TRUE`. Options whose `display_value` is "Other" (or equivalent) seeded as `is_other_trigger = TRUE`.

| Dropdown Key | Field | Seeded Options |
|---|---|---|
| `yes_no` | Various boolean fields | Yes \| No |
| `yes_no_unknown` | Various tri-state fields | Yes \| No \| Unknown |
| `yes_no_na` | Security checklist fields (8.15x) | Yes \| No \| N/A |
| `yes_no_unknown_na` | Fields with all four states | Yes \| No \| Unknown \| N/A |
| `yes_no_partial_unknown` | HDMI, API, HDR, WebX fields | Yes \| No \| Partial \| Unknown |
| `yes_no_partial_na` | Broadcom-specific fields | Yes \| No \| Partial \| N/A (non-Broadcom SoC) |
| `connection_type` | 1.10 Type of Connection | Satellite \| Cable \| IPTV \| OTT (Broadband) \| Hybrid (Satellite + OTT) \| Hybrid (Cable + OTT) \| Other |
| `soc_vendor` | 2.1 SoC Vendor | Broadcom \| Amlogic \| MediaTek \| Realtek \| HiSilicon (Huawei) \| Qualcomm \| STMicroelectronics \| Sigma Designs \| Intel \| Other |
| `software_architecture` | 2.3 Software Architecture | 32-bit \| 64-bit \| Other |
| `support_contract_status` | 2.6 SoC Support Contract | Yes — Active \| Yes — Expired \| No \| Unknown |
| `cpu_cores` | 2.8 Number of CPU Cores | Single-core \| Dual-core \| Quad-core \| Hexa-core \| Octa-core \| Other |
| `operating_system` | 2.10 Operating System | Linux \| Android \| Android TV \| Google TV \| RTOS \| Tizen \| webOS \| Other |
| `os_customization` | 2.12 OS Customizations | Yes — custom Kernel \| Yes — other OS customizations \| No \| Other |
| `middleware_provider` | 2.13 Middleware Provider | Wyplay \| Metrological \| Comcast RDK \| Liberty Global \| Opera \| Nagra \| Ericsson \| Espial \| None \| Other |
| `middleware_contract` | 2.15 Middleware Contract | Yes — Active \| Yes — Expired \| No \| N/A (no middleware) |
| `video_delivery` | 2.17 Video Delivery Support | OTT only \| IPTV only \| Both OTT and IPTV \| Other |
| `memory_type` | 2.18b Device Memory Type | DDR3 \| DDR4 \| DDR5 \| LPDDR3 \| LPDDR4 \| LPDDR4X \| LPDDR5 \| Other |
| `gpu_memory_sharing` | 2.23 GPU Memory Sharing | Dedicated \| Shared with system memory \| Other |
| `storage_type` | 2.25b Persistent Storage Type | eMMC \| NAND Flash \| NOR Flash \| UFS \| SSD \| HDD \| Other |
| `filesystem_type` | 2.29 Filesystem Type | ext4 \| ext3 \| ext2 \| FAT32 \| exFAT \| NTFS \| JFFS2 \| UBIFS \| Other |
| `gpu_availability` | 2.31a GPU Availability Level | SoC \| Driver \| Middleware \| Application Layer \| Other |
| `gpu_graphics_library` | 2.32 GPU Graphics Library | OpenGL ES 2.0 \| OpenGL ES 3.0 \| OpenGL ES 3.1 \| OpenGL ES 3.2 \| Vulkan 1.0 \| Vulkan 1.1 \| Vulkan 1.2 \| DirectX \| Other |
| `streaming_interface` | 2.34 OTT Streaming Interface | DOCSIS \| Ethernet \| Wi-Fi \| MoCA \| Other |
| `ethernet_type` | 2.34a Ethernet Port Present? | Yes — Gigabit (1000BaseT) \| Yes — Fast Ethernet (100BaseT) \| No |
| `moca_version` | 2.34d MoCA Present? | Yes — MoCA 1.1 \| Yes — MoCA 2.0 \| Yes — MoCA 2.5 \| No |
| `hdmi_version` | 2.37 HDMI Version | HDMI 1.4 \| HDMI 2.0 \| HDMI 2.0a \| HDMI 2.0b \| HDMI 2.1 \| Other |
| `ui_resolution` | 2.40 STB UI Native Render Resolution | 480p \| 576p \| 720p \| 1080p \| 2160p (4K) \| Other |
| `firmware_support` | 3.1 Firmware Support Status | Yes \| No \| Limited / Best-effort only |
| `firmware_frequency` | 3.2 Firmware Update Frequency | Weekly \| Monthly \| Quarterly \| As needed / Ad hoc \| No longer updated \| Other |
| `firmware_emergency` | 3.4 Emergency Firmware Update | Yes \| No \| Limited |
| `codec_support` | 4.x All codec fields | Yes — Hardware Decode \| Yes — Software Decode \| Yes — Both \| No \| Partial \| Unknown |
| `frame_rate_adjust` | 5.3 Frame Rate Adjustment | Yes — automatic \| Yes — user-controlled \| No \| Partial \| Other |
| `frame_rate_convert` | 5.4 Frame Rate Conversion | Yes — always \| Yes — configurable \| No \| Other |
| `drm_system` | 6.1 DRM System | PlayReady \| Widevine \| Both \| Other |
| `encryption_scheme` | 6.1a / 6.2d / 6.3d Encryption Scheme | CTR \| CBCS \| Both \| Other \| N/A |
| `playready_version` | 6.2b PlayReady Version | 2.0 \| 2.5 \| 3.0 \| 4.0 \| 4.3 \| N/A \| Other |
| `playready_security_level` | 6.2c PlayReady Security Level | SL2000 \| SL3000 \| Other \| N/A |
| `widevine_security_level` | 6.3b Widevine Security Level | L1 \| L2 \| L3 \| Other \| N/A |
| `drm_hw_level` | 6.4 DRM Hardware Level | PlayReady SL3000 only \| Widevine L1 only \| Both \| Neither \| Unknown |
| `cbcs_support` | 6.5 CBCS Support | Yes — PlayReady 4.0+ with CBCS \| Yes — Widevine 3.1+ with CBCS \| Yes — Both \| No \| Partial \| Unknown |
| `hdcp_version` | 6.8 HDCP Version | HDCP 1.4 \| HDCP 2.0 \| HDCP 2.2 \| HDCP 2.3 \| None \| Other |
| `secure_boot_jtag` | 6.22 Secure Boot / JTAG / DRAM | Yes — All three \| Yes — Partial \| No \| Unknown |
| `ursr_modification` | 7.2 URSR/Kernel/Toolchain Modified? | Yes — URSR modified \| Yes — Kernel modified \| Yes — Toolchain modified \| Yes — Multiple \| No \| Other |
| `audio_detection_api` | 7.5 Audio Detection API | Yes — Stereo only \| Yes — Stereo + 5.1 \| Yes — Stereo + 5.1 + Atmos \| No \| Partial \| Unknown |
| `playback_encryption` | 8.6 Playback Encryption Type | CTR \| CBCS \| Both CTR and CBCS \| Other |
| `mse_cmaf_support` | 8.7 E-AC-3 via MSE | Yes — Both native and CMAF \| Yes — Native only \| Yes — CMAF only \| No \| Unknown |
| `eac3_decode_mode` | 8.8 E-AC-3 Decode Mode | On-device decode only \| Bitstream (passthrough) only \| Both \| N/A (E-AC-3 not supported) \| Unknown |
| `atmos_support` | 8.9 Dolby Atmos Supported? | Yes — On-device decode \| Yes — Bitstream output \| Yes — Both \| No \| Model-dependent \| Unknown |
| `playready_cdm_version` | 8.11 PlayReady CDM Version | 2.0 \| 2.5 \| 3.0 \| 3.1 \| N/A (4.0 or later) \| N/A (not supported) \| Other |
| `cbcs_confirmed` | 8.12 / 8.14 CBCS Confirmed | Yes \| No \| N/A (below 4.0) \| Unknown |
| `widevine_cdm_category` | 8.13b Widevine CDM Category | Below 3.1 (no CBCS) \| 3.1+ (with CBCS) \| N/A (not supported) \| Unknown |
| `hdr_transform` | 9.5 HDR Transform | Yes — SDR to HDR upmap \| Yes — HDR to SDR downmap \| Yes — Between HDR formats \| Yes — All of the above \| No \| Partial \| Other |
| `hdr_mode_switch` | 9.6 HDR Mode-Switch Behavior | Always mode-switches for HDR content \| Always HDR with SDR upmapped \| User-configurable \| No mode switch — fixed mode \| Other |
| `video_range_render` | 9.7 Video Range Rendering | Renders content native video range \| Always converts to HDR \| User-configurable \| Other |
| `color_space` | 9.10 Color Space | BT.709 (SDR) \| BT.2020 (HDR) \| DCI-P3 \| sRGB \| Other |
| `hdr_compositing` | 9.13 HDR Compositing | Yes — SDR graphics \| Yes — HDR graphics \| Yes — Both \| No \| Unknown |
| `graphics_plane_resolution` | 9.14 Graphics Plane Resolution | 720p \| 1080p \| 2160p (4K) \| Matches video resolution \| Other |
| `audio_sync_settings` | 10.7 Audio Sync Settings | Fixed (no adjustment) \| User-adjustable (ms offset) \| Automatic \| Other |
| `voltage_range` | 11.1 Voltage Range | 100-120 V / 60 Hz \| 220-240 V / 50 Hz \| Universal (100-240 V) \| Other |
| `bluetooth_version` | 11.2b Bluetooth Version | Bluetooth 4.0 \| Bluetooth 4.1 \| Bluetooth 4.2 \| Bluetooth 5.0 \| Bluetooth 5.1 \| Bluetooth 5.2 \| Bluetooth 5.3 \| N/A \| Other |
| `web_engine` | 12.1 Web Engine | Chromium \| WebKit \| Blink \| Gecko \| Cobalt \| WPE WebKit \| Opera \| Custom / Proprietary \| N/A (native app) \| Other |
| `mse_support` | 12.3 MSE Support | Yes — Full MSE support \| Yes — Partial MSE support \| No \| Unknown |
| `js_engine` | 12.5 JavaScript Engine | V8 \| JavaScriptCore (JSC) \| SpiderMonkey \| Hermes \| JerryScript \| Custom / Proprietary \| Other |
| `webgl_support` | 12.8 WebGL Support | Yes — WebGL 1.0 \| Yes — WebGL 2.0 \| No \| Unknown |
| `pcm_channels` | 13.1 PCM Output Channels | Stereo (2.0) \| 5.1 \| 7.1 \| Other |
| `dolby_audio_support` | 13.4 Dolby Audio | Yes — Dolby Digital (AC-3) \| Yes — Dolby Digital Plus (E-AC-3) \| Yes — Dolby Atmos \| Yes — Multiple Dolby formats \| No \| Other |
| `dts_audio_support` | 13.5 DTS Audio | Yes — DTS \| Yes — DTS-HD \| Yes — DTS:X \| Yes — Multiple \| No \| Other |
| `bt_audio_support` | 13.6 Bluetooth Audio | Yes — A2DP \| Yes — aptX \| Yes — aptX HD \| Yes — LDAC \| No \| Other |
| `audio_background_behavior` | 13.7 Audio When App Backgrounded | Audio stops \| Audio continues (background) \| Audio ducks (reduced volume) \| Operator-configurable \| Unknown \| Other |
| `tts_api` | 14.1 TTS API | Yes — Platform TTS API exposed to apps \| Yes — System TTS only (not app-accessible) \| No \| Unknown |
| `caption_rendering` | 14.3 Caption Rendering | On-device (platform rendered) \| App-rendered \| Both supported \| Unknown |
| `ad_track_support` | 14.4 AD Track Support | Yes — Selectable via app \| Yes — Device settings only \| No \| Unknown |
| `focus_management_api` | 14.6 Focus Management API | Yes — Standard platform API \| Yes — Custom API \| No \| Unknown |
| `deep_link_support` | 15.1 Deep Link Support | Yes — Full deep link support \| Yes — App launch only (no content deep link) \| No \| Unknown |
| `home_screen_integration` | 15.3 Home Screen Integration | Yes — App tiles / icons \| Yes — Curated content rows \| Yes — Both \| No \| Unknown |
| `continue_watching` | 15.4 Continue Watching Row | Yes — Platform-native Continue Watching row \| Yes — App supplies content via platform API \| No \| Unknown |
| `universal_search` | 15.5 Universal Search | Yes — Disney+ content indexed in platform search \| Yes — Supported but not yet integrated \| No \| Unknown |
| `recommendations_tiles` | 15.6 Recommendation Tiles | Yes — Platform pulls from app API \| Yes — Operator-curated only \| No \| Unknown |
| `app_autostart` | 15.7 App Autostart | Yes — App can be set to autolaunch \| Yes — App preloaded in background \| No \| Unknown |
| `ui_frame_rate` | 16.4 UI Target Frame Rate | 60 fps \| 30 fps \| Variable \| Other |
| `concurrent_streams` | 16.5 Concurrent Streams | Yes — Full concurrent decode supported \| Yes — Limited (describe below) \| No — Single stream only \| Unknown |
| `memory_background` | 16.6 App Memory Backgrounded | App suspended and kept in memory \| App suspended — may be killed under memory pressure \| App always terminated on background \| Operator-configurable \| Unknown |
| `benchmark_available` | 16.7 Benchmark Data Available? | Yes — Will provide \| Yes — Available on request \| No \| N/A |

---

## Acceptance Criteria

- `field_options` table exists with all columns specified above. Schema migration is idempotent.
- All 89 dropdown keys listed in the Seed Data section exist in the table with their full option sets on first deploy.
- Admin panel > Reference Data shows a searchable list of all dropdown keys with option counts.
- Option Editor allows adding, renaming, reordering (drag-and-drop), and soft-deleting options. All changes take effect in the spec entry form immediately without a page reload.
- Renaming an option that has existing `device_specs` records shows a warning with the record count before saving.
- Soft-deleted options are hidden from the form dropdown but visible in the inactive accordion section of the Option Editor, and preserved in any `device_specs` rows that used them.
- The `is_other_trigger` flag correctly shows and hides companion "Other" text fields in the spec form when toggled.
- Every change to `field_options` is recorded in the audit log table with user, timestamp, old value, and new value.
- Non-Admin users cannot see the Reference Data section or call the write endpoints for `field_options`.
