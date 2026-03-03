# ADK Technical Questionnaire --- Extracted Fields

Source: **GM Disney+ Technical Questionnaire (2024-02-28)**\
Sheet: *3. Tech Questionnaire*

------------------------------------------------------------------------

## 1. Device Identity & Deployment (General)

**Device metadata** - Device model name (customer-facing) - Device model
number - Initial market deployment date - End-of-delivery date (if
discontinued) - Number of active devices - Number of subscribers using
device - Forecasted growth/decline by year - Countries deployed - Other
OTT apps deployed - Connection type (Satellite / Cable / IPTV / OTT)

------------------------------------------------------------------------

## 2. SoC & Hardware Platform

**Chipset** - SoC vendor - SoC model - Chipset revision - SoC reference
software version - SoC customization present (Y/N) - SoC support
contract status

**CPU** - CPU performance / clock speed (DMIPS or GHz) - Number of CPU
cores

**Manufacturer** - STB / OEM manufacturer

------------------------------------------------------------------------

## 3. Operating System & Middleware

**Operating System** - Operating system - OS version - Base OS
customization details

**Middleware** - Middleware provider - Middleware version - Middleware
support contract status - Middleware integration partner/vendor

------------------------------------------------------------------------

## 4. Memory & Storage

### System Memory

-   Total device memory + memory type (e.g., DDR4)
-   RAM available to Disney+ app
-   Linux system memory available

### GPU Memory

-   GPU memory available to applications
-   Texture/graphics memory allocation
-   Shared vs dedicated GPU memory
-   GPU memory reserved for video decode

### Storage

-   Total persistent storage size + type
-   Persistent storage available to apps
-   Non-persistent storage available
-   Maximum application binary size allowed
-   Persistent storage filesystem type
-   Persistent storage limitations (write limits, quotas)

------------------------------------------------------------------------

## 5. GPU & Graphics Stack

-   GPU availability level (shared/dedicated)
-   GPU graphics API/library supported (OpenGL ES, etc.)

------------------------------------------------------------------------

## 6. Streaming & Platform Capabilities

-   OTT streaming interface
-   Maximum sustainable streaming throughput
-   Support for HDMI capability retrieval (EDID)
-   HDMI version supported

------------------------------------------------------------------------

## 7. Video Output & Display

**Output formats** - Supported digital video output modes - Supported
analog video output modes - Supported resolution modes - Native UI
rendering resolution - OTT display restrictions

------------------------------------------------------------------------

## 8. Firmware & Update Lifecycle

-   Firmware updates supported (Y/N)
-   Firmware update frequency
-   Firmware release timeline
-   Emergency update capability
-   Security audit / code-signing process

------------------------------------------------------------------------

## 9. Media Codec Support

### Video

-   AVC (H.264) support
-   HEVC (H.265) support

### Audio

-   E-AC-3 support
-   E-AC-3 with Atmos support

### HDR

-   HDR10 support
-   Dolby Vision support

------------------------------------------------------------------------

## 10. Frame Rate & Playback Controls

-   Supported output refresh rates
-   User refresh-rate settings
-   Automatic frame-rate matching support
-   Frame-rate conversion behavior
-   API access to read output rate
-   API access to set output rate

------------------------------------------------------------------------

## 11. Content Protection / DRM

**Primary DRM** - DRM system used (PlayReady / Widevine) - PlayReady
support + version + security level - Widevine support + version +
security level - PlayReady SL3000 / Widevine L1 support - CBCS support
(PlayReady ≥4.0 / Widevine ≥3.1)

**Output Protection** - Digital video output enabled - Output copy
protection protocol (HDCP version)

**Additional DRM** - Other DRMs supported (with versions)

------------------------------------------------------------------------

## 12. Hardware Security & Trusted Execution

-   Broadcom SAGE security support
-   Secure firmware download support
-   Signed firmware verification
-   Hardware Root of Trust
-   Tamper-resistant chipset
-   Trusted Execution Environment (TEE)

------------------------------------------------------------------------

## Structural Domains Represented

  Domain                Purpose
  --------------------- ----------------------------------------
  Device Identity       Partner inventory + lifecycle tracking
  Hardware Capability   Performance gating + certification
  Platform Software     ADK compatibility surface
  Media Pipeline        Playback certification logic
  Security & DRM        Studio compliance requirements
