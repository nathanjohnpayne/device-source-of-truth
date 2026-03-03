import admin from 'firebase-admin';
import { log } from './logger.js';

interface SeedOption {
  displayValue: string;
  isOtherTrigger?: boolean;
}

interface SeedKey {
  dropdownKey: string;
  displayLabel: string;
  options: SeedOption[];
}

const SEED_DATA: SeedKey[] = [
  {
    dropdownKey: 'yes_no',
    displayLabel: 'Yes / No',
    options: [{ displayValue: 'Yes' }, { displayValue: 'No' }],
  },
  {
    dropdownKey: 'yes_no_unknown',
    displayLabel: 'Yes / No / Unknown',
    options: [{ displayValue: 'Yes' }, { displayValue: 'No' }, { displayValue: 'Unknown' }],
  },
  {
    dropdownKey: 'yes_no_na',
    displayLabel: 'Yes / No / N/A',
    options: [{ displayValue: 'Yes' }, { displayValue: 'No' }, { displayValue: 'N/A' }],
  },
  {
    dropdownKey: 'yes_no_unknown_na',
    displayLabel: 'Yes / No / Unknown / N/A',
    options: [
      { displayValue: 'Yes' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
      { displayValue: 'N/A' },
    ],
  },
  {
    dropdownKey: 'yes_no_partial_unknown',
    displayLabel: 'Yes / No / Partial / Unknown',
    options: [
      { displayValue: 'Yes' },
      { displayValue: 'No' },
      { displayValue: 'Partial' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'yes_no_partial_na',
    displayLabel: 'Yes / No / Partial / N/A',
    options: [
      { displayValue: 'Yes' },
      { displayValue: 'No' },
      { displayValue: 'Partial' },
      { displayValue: 'N/A (non-Broadcom SoC)' },
    ],
  },
  {
    dropdownKey: 'connection_type',
    displayLabel: '1.10 Type of Connection',
    options: [
      { displayValue: 'Satellite' },
      { displayValue: 'Cable' },
      { displayValue: 'IPTV' },
      { displayValue: 'OTT (Broadband)' },
      { displayValue: 'Hybrid (Satellite + OTT)' },
      { displayValue: 'Hybrid (Cable + OTT)' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'soc_vendor',
    displayLabel: '2.1 SoC Vendor',
    options: [
      { displayValue: 'Broadcom' },
      { displayValue: 'Amlogic' },
      { displayValue: 'MediaTek' },
      { displayValue: 'Realtek' },
      { displayValue: 'HiSilicon (Huawei)' },
      { displayValue: 'Qualcomm' },
      { displayValue: 'STMicroelectronics' },
      { displayValue: 'Sigma Designs' },
      { displayValue: 'Intel' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'software_architecture',
    displayLabel: '2.3 Software Architecture',
    options: [
      { displayValue: '32-bit' },
      { displayValue: '64-bit' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'support_contract_status',
    displayLabel: '2.6 SoC Support Contract',
    options: [
      { displayValue: 'Yes — Active' },
      { displayValue: 'Yes — Expired' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'cpu_cores',
    displayLabel: '2.8 Number of CPU Cores',
    options: [
      { displayValue: 'Single-core' },
      { displayValue: 'Dual-core' },
      { displayValue: 'Quad-core' },
      { displayValue: 'Hexa-core' },
      { displayValue: 'Octa-core' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'operating_system',
    displayLabel: '2.10 Operating System',
    options: [
      { displayValue: 'Linux' },
      { displayValue: 'Android' },
      { displayValue: 'Android TV' },
      { displayValue: 'Google TV' },
      { displayValue: 'RTOS' },
      { displayValue: 'Tizen' },
      { displayValue: 'webOS' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'os_customization',
    displayLabel: '2.12 OS Customizations',
    options: [
      { displayValue: 'Yes — custom Kernel' },
      { displayValue: 'Yes — other OS customizations' },
      { displayValue: 'No' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'middleware_provider',
    displayLabel: '2.13 Middleware Provider',
    options: [
      { displayValue: 'Wyplay' },
      { displayValue: 'Metrological' },
      { displayValue: 'Comcast RDK' },
      { displayValue: 'Liberty Global' },
      { displayValue: 'Opera' },
      { displayValue: 'Nagra' },
      { displayValue: 'Ericsson' },
      { displayValue: 'Espial' },
      { displayValue: 'None' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'middleware_contract',
    displayLabel: '2.15 Middleware Contract',
    options: [
      { displayValue: 'Yes — Active' },
      { displayValue: 'Yes — Expired' },
      { displayValue: 'No' },
      { displayValue: 'N/A (no middleware)' },
    ],
  },
  {
    dropdownKey: 'video_delivery',
    displayLabel: '2.17 Video Delivery Support',
    options: [
      { displayValue: 'OTT only' },
      { displayValue: 'IPTV only' },
      { displayValue: 'Both OTT and IPTV' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'memory_type',
    displayLabel: '2.18b Device Memory Type',
    options: [
      { displayValue: 'DDR3' },
      { displayValue: 'DDR4' },
      { displayValue: 'DDR5' },
      { displayValue: 'LPDDR3' },
      { displayValue: 'LPDDR4' },
      { displayValue: 'LPDDR4X' },
      { displayValue: 'LPDDR5' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'gpu_memory_sharing',
    displayLabel: '2.23 GPU Memory Sharing',
    options: [
      { displayValue: 'Dedicated' },
      { displayValue: 'Shared with system memory' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'storage_type',
    displayLabel: '2.25b Persistent Storage Type',
    options: [
      { displayValue: 'eMMC' },
      { displayValue: 'NAND Flash' },
      { displayValue: 'NOR Flash' },
      { displayValue: 'UFS' },
      { displayValue: 'SSD' },
      { displayValue: 'HDD' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'filesystem_type',
    displayLabel: '2.29 Filesystem Type',
    options: [
      { displayValue: 'ext4' },
      { displayValue: 'ext3' },
      { displayValue: 'ext2' },
      { displayValue: 'FAT32' },
      { displayValue: 'exFAT' },
      { displayValue: 'NTFS' },
      { displayValue: 'JFFS2' },
      { displayValue: 'UBIFS' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'gpu_availability',
    displayLabel: '2.31a GPU Availability Level',
    options: [
      { displayValue: 'SoC' },
      { displayValue: 'Driver' },
      { displayValue: 'Middleware' },
      { displayValue: 'Application Layer' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'gpu_graphics_library',
    displayLabel: '2.32 GPU Graphics Library',
    options: [
      { displayValue: 'OpenGL ES 2.0' },
      { displayValue: 'OpenGL ES 3.0' },
      { displayValue: 'OpenGL ES 3.1' },
      { displayValue: 'OpenGL ES 3.2' },
      { displayValue: 'Vulkan 1.0' },
      { displayValue: 'Vulkan 1.1' },
      { displayValue: 'Vulkan 1.2' },
      { displayValue: 'DirectX' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'streaming_interface',
    displayLabel: '2.34 OTT Streaming Interface',
    options: [
      { displayValue: 'DOCSIS' },
      { displayValue: 'Ethernet' },
      { displayValue: 'Wi-Fi' },
      { displayValue: 'MoCA' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'ethernet_type',
    displayLabel: '2.34a Ethernet Port Present?',
    options: [
      { displayValue: 'Yes — Gigabit (1000BaseT)' },
      { displayValue: 'Yes — Fast Ethernet (100BaseT)' },
      { displayValue: 'No' },
    ],
  },
  {
    dropdownKey: 'moca_version',
    displayLabel: '2.34d MoCA Present?',
    options: [
      { displayValue: 'Yes — MoCA 1.1' },
      { displayValue: 'Yes — MoCA 2.0' },
      { displayValue: 'Yes — MoCA 2.5' },
      { displayValue: 'No' },
    ],
  },
  {
    dropdownKey: 'hdmi_version',
    displayLabel: '2.37 HDMI Version',
    options: [
      { displayValue: 'HDMI 1.4' },
      { displayValue: 'HDMI 2.0' },
      { displayValue: 'HDMI 2.0a' },
      { displayValue: 'HDMI 2.0b' },
      { displayValue: 'HDMI 2.1' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'ui_resolution',
    displayLabel: '2.40 STB UI Native Render Resolution',
    options: [
      { displayValue: '480p' },
      { displayValue: '576p' },
      { displayValue: '720p' },
      { displayValue: '1080p' },
      { displayValue: '2160p (4K)' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'firmware_support',
    displayLabel: '3.1 Firmware Support Status',
    options: [
      { displayValue: 'Yes' },
      { displayValue: 'No' },
      { displayValue: 'Limited / Best-effort only' },
    ],
  },
  {
    dropdownKey: 'firmware_frequency',
    displayLabel: '3.2 Firmware Update Frequency',
    options: [
      { displayValue: 'Weekly' },
      { displayValue: 'Monthly' },
      { displayValue: 'Quarterly' },
      { displayValue: 'As needed / Ad hoc' },
      { displayValue: 'No longer updated' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'firmware_emergency',
    displayLabel: '3.4 Emergency Firmware Update',
    options: [
      { displayValue: 'Yes' },
      { displayValue: 'No' },
      { displayValue: 'Limited' },
    ],
  },
  {
    dropdownKey: 'codec_support',
    displayLabel: '4.x Codec Support Level',
    options: [
      { displayValue: 'Yes — Hardware Decode' },
      { displayValue: 'Yes — Software Decode' },
      { displayValue: 'Yes — Both' },
      { displayValue: 'No' },
      { displayValue: 'Partial' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'frame_rate_adjust',
    displayLabel: '5.3 Frame Rate Adjustment',
    options: [
      { displayValue: 'Yes — automatic' },
      { displayValue: 'Yes — user-controlled' },
      { displayValue: 'No' },
      { displayValue: 'Partial' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'frame_rate_convert',
    displayLabel: '5.4 Frame Rate Conversion',
    options: [
      { displayValue: 'Yes — always' },
      { displayValue: 'Yes — configurable' },
      { displayValue: 'No' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'drm_system',
    displayLabel: '6.1 DRM System',
    options: [
      { displayValue: 'PlayReady' },
      { displayValue: 'Widevine' },
      { displayValue: 'Both' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'encryption_scheme',
    displayLabel: 'Encryption Scheme',
    options: [
      { displayValue: 'CTR' },
      { displayValue: 'CBCS' },
      { displayValue: 'Both' },
      { displayValue: 'Other', isOtherTrigger: true },
      { displayValue: 'N/A' },
    ],
  },
  {
    dropdownKey: 'playready_version',
    displayLabel: '6.2b PlayReady Version',
    options: [
      { displayValue: '2.0' },
      { displayValue: '2.5' },
      { displayValue: '3.0' },
      { displayValue: '4.0' },
      { displayValue: '4.3' },
      { displayValue: 'N/A' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'playready_security_level',
    displayLabel: '6.2c PlayReady Security Level',
    options: [
      { displayValue: 'SL2000' },
      { displayValue: 'SL3000' },
      { displayValue: 'Other', isOtherTrigger: true },
      { displayValue: 'N/A' },
    ],
  },
  {
    dropdownKey: 'widevine_security_level',
    displayLabel: '6.3b Widevine Security Level',
    options: [
      { displayValue: 'L1' },
      { displayValue: 'L2' },
      { displayValue: 'L3' },
      { displayValue: 'Other', isOtherTrigger: true },
      { displayValue: 'N/A' },
    ],
  },
  {
    dropdownKey: 'drm_hw_level',
    displayLabel: '6.4 DRM Hardware Level',
    options: [
      { displayValue: 'PlayReady SL3000 only' },
      { displayValue: 'Widevine L1 only' },
      { displayValue: 'Both' },
      { displayValue: 'Neither' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'cbcs_support',
    displayLabel: '6.5 CBCS Support',
    options: [
      { displayValue: 'Yes — PlayReady 4.0+ with CBCS' },
      { displayValue: 'Yes — Widevine 3.1+ with CBCS' },
      { displayValue: 'Yes — Both' },
      { displayValue: 'No' },
      { displayValue: 'Partial' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'hdcp_version',
    displayLabel: '6.8 HDCP Version',
    options: [
      { displayValue: 'HDCP 1.4' },
      { displayValue: 'HDCP 2.0' },
      { displayValue: 'HDCP 2.2' },
      { displayValue: 'HDCP 2.3' },
      { displayValue: 'None' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'secure_boot_jtag',
    displayLabel: '6.22 Secure Boot / JTAG / DRAM',
    options: [
      { displayValue: 'Yes — All three' },
      { displayValue: 'Yes — Partial' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'ursr_modification',
    displayLabel: '7.2 URSR/Kernel/Toolchain Modified?',
    options: [
      { displayValue: 'Yes — URSR modified' },
      { displayValue: 'Yes — Kernel modified' },
      { displayValue: 'Yes — Toolchain modified' },
      { displayValue: 'Yes — Multiple' },
      { displayValue: 'No' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'audio_detection_api',
    displayLabel: '7.5 Audio Detection API',
    options: [
      { displayValue: 'Yes — Stereo only' },
      { displayValue: 'Yes — Stereo + 5.1' },
      { displayValue: 'Yes — Stereo + 5.1 + Atmos' },
      { displayValue: 'No' },
      { displayValue: 'Partial' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'playback_encryption',
    displayLabel: '8.6 Playback Encryption Type',
    options: [
      { displayValue: 'CTR' },
      { displayValue: 'CBCS' },
      { displayValue: 'Both CTR and CBCS' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'mse_cmaf_support',
    displayLabel: '8.7 E-AC-3 via MSE',
    options: [
      { displayValue: 'Yes — Both native and CMAF' },
      { displayValue: 'Yes — Native only' },
      { displayValue: 'Yes — CMAF only' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'eac3_decode_mode',
    displayLabel: '8.8 E-AC-3 Decode Mode',
    options: [
      { displayValue: 'On-device decode only' },
      { displayValue: 'Bitstream (passthrough) only' },
      { displayValue: 'Both' },
      { displayValue: 'N/A (E-AC-3 not supported)' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'atmos_support',
    displayLabel: '8.9 Dolby Atmos Supported?',
    options: [
      { displayValue: 'Yes — On-device decode' },
      { displayValue: 'Yes — Bitstream output' },
      { displayValue: 'Yes — Both' },
      { displayValue: 'No' },
      { displayValue: 'Model-dependent' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'playready_cdm_version',
    displayLabel: '8.11 PlayReady CDM Version',
    options: [
      { displayValue: '2.0' },
      { displayValue: '2.5' },
      { displayValue: '3.0' },
      { displayValue: '3.1' },
      { displayValue: 'N/A (4.0 or later)' },
      { displayValue: 'N/A (not supported)' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'cbcs_confirmed',
    displayLabel: 'CBCS Confirmed',
    options: [
      { displayValue: 'Yes' },
      { displayValue: 'No' },
      { displayValue: 'N/A (below 4.0)' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'widevine_cdm_category',
    displayLabel: '8.13b Widevine CDM Category',
    options: [
      { displayValue: 'Below 3.1 (no CBCS)' },
      { displayValue: '3.1+ (with CBCS)' },
      { displayValue: 'N/A (not supported)' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'hdr_transform',
    displayLabel: '9.5 HDR Transform',
    options: [
      { displayValue: 'Yes — SDR to HDR upmap' },
      { displayValue: 'Yes — HDR to SDR downmap' },
      { displayValue: 'Yes — Between HDR formats' },
      { displayValue: 'Yes — All of the above' },
      { displayValue: 'No' },
      { displayValue: 'Partial' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'hdr_mode_switch',
    displayLabel: '9.6 HDR Mode-Switch Behavior',
    options: [
      { displayValue: 'Always mode-switches for HDR content' },
      { displayValue: 'Always HDR with SDR upmapped' },
      { displayValue: 'User-configurable' },
      { displayValue: 'No mode switch — fixed mode' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'video_range_render',
    displayLabel: '9.7 Video Range Rendering',
    options: [
      { displayValue: 'Renders content native video range' },
      { displayValue: 'Always converts to HDR' },
      { displayValue: 'User-configurable' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'color_space',
    displayLabel: '9.10 Color Space',
    options: [
      { displayValue: 'BT.709 (SDR)' },
      { displayValue: 'BT.2020 (HDR)' },
      { displayValue: 'DCI-P3' },
      { displayValue: 'sRGB' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'hdr_compositing',
    displayLabel: '9.13 HDR Compositing',
    options: [
      { displayValue: 'Yes — SDR graphics' },
      { displayValue: 'Yes — HDR graphics' },
      { displayValue: 'Yes — Both' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'graphics_plane_resolution',
    displayLabel: '9.14 Graphics Plane Resolution',
    options: [
      { displayValue: '720p' },
      { displayValue: '1080p' },
      { displayValue: '2160p (4K)' },
      { displayValue: 'Matches video resolution' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'audio_sync_settings',
    displayLabel: '10.7 Audio Sync Settings',
    options: [
      { displayValue: 'Fixed (no adjustment)' },
      { displayValue: 'User-adjustable (ms offset)' },
      { displayValue: 'Automatic' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'voltage_range',
    displayLabel: '11.1 Voltage Range',
    options: [
      { displayValue: '100-120 V / 60 Hz' },
      { displayValue: '220-240 V / 50 Hz' },
      { displayValue: 'Universal (100-240 V)' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'bluetooth_version',
    displayLabel: '11.2b Bluetooth Version',
    options: [
      { displayValue: 'Bluetooth 4.0' },
      { displayValue: 'Bluetooth 4.1' },
      { displayValue: 'Bluetooth 4.2' },
      { displayValue: 'Bluetooth 5.0' },
      { displayValue: 'Bluetooth 5.1' },
      { displayValue: 'Bluetooth 5.2' },
      { displayValue: 'Bluetooth 5.3' },
      { displayValue: 'N/A' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'web_engine',
    displayLabel: '12.1 Web Engine',
    options: [
      { displayValue: 'Chromium' },
      { displayValue: 'WebKit' },
      { displayValue: 'Blink' },
      { displayValue: 'Gecko' },
      { displayValue: 'Cobalt' },
      { displayValue: 'WPE WebKit' },
      { displayValue: 'Opera' },
      { displayValue: 'Custom / Proprietary' },
      { displayValue: 'N/A (native app)' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'mse_support',
    displayLabel: '12.3 MSE Support',
    options: [
      { displayValue: 'Yes — Full MSE support' },
      { displayValue: 'Yes — Partial MSE support' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'js_engine',
    displayLabel: '12.5 JavaScript Engine',
    options: [
      { displayValue: 'V8' },
      { displayValue: 'JavaScriptCore (JSC)' },
      { displayValue: 'SpiderMonkey' },
      { displayValue: 'Hermes' },
      { displayValue: 'JerryScript' },
      { displayValue: 'Custom / Proprietary' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'webgl_support',
    displayLabel: '12.8 WebGL Support',
    options: [
      { displayValue: 'Yes — WebGL 1.0' },
      { displayValue: 'Yes — WebGL 2.0' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'pcm_channels',
    displayLabel: '13.1 PCM Output Channels',
    options: [
      { displayValue: 'Stereo (2.0)' },
      { displayValue: '5.1' },
      { displayValue: '7.1' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'dolby_audio_support',
    displayLabel: '13.4 Dolby Audio',
    options: [
      { displayValue: 'Yes — Dolby Digital (AC-3)' },
      { displayValue: 'Yes — Dolby Digital Plus (E-AC-3)' },
      { displayValue: 'Yes — Dolby Atmos' },
      { displayValue: 'Yes — Multiple Dolby formats' },
      { displayValue: 'No' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'dts_audio_support',
    displayLabel: '13.5 DTS Audio',
    options: [
      { displayValue: 'Yes — DTS' },
      { displayValue: 'Yes — DTS-HD' },
      { displayValue: 'Yes — DTS:X' },
      { displayValue: 'Yes — Multiple' },
      { displayValue: 'No' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'bt_audio_support',
    displayLabel: '13.6 Bluetooth Audio',
    options: [
      { displayValue: 'Yes — A2DP' },
      { displayValue: 'Yes — aptX' },
      { displayValue: 'Yes — aptX HD' },
      { displayValue: 'Yes — LDAC' },
      { displayValue: 'No' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'audio_background_behavior',
    displayLabel: '13.7 Audio When App Backgrounded',
    options: [
      { displayValue: 'Audio stops' },
      { displayValue: 'Audio continues (background)' },
      { displayValue: 'Audio ducks (reduced volume)' },
      { displayValue: 'Operator-configurable' },
      { displayValue: 'Unknown' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'tts_api',
    displayLabel: '14.1 TTS API',
    options: [
      { displayValue: 'Yes — Platform TTS API exposed to apps' },
      { displayValue: 'Yes — System TTS only (not app-accessible)' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'caption_rendering',
    displayLabel: '14.3 Caption Rendering',
    options: [
      { displayValue: 'On-device (platform rendered)' },
      { displayValue: 'App-rendered' },
      { displayValue: 'Both supported' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'ad_track_support',
    displayLabel: '14.4 AD Track Support',
    options: [
      { displayValue: 'Yes — Selectable via app' },
      { displayValue: 'Yes — Device settings only' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'focus_management_api',
    displayLabel: '14.6 Focus Management API',
    options: [
      { displayValue: 'Yes — Standard platform API' },
      { displayValue: 'Yes — Custom API' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'deep_link_support',
    displayLabel: '15.1 Deep Link Support',
    options: [
      { displayValue: 'Yes — Full deep link support' },
      { displayValue: 'Yes — App launch only (no content deep link)' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'home_screen_integration',
    displayLabel: '15.3 Home Screen Integration',
    options: [
      { displayValue: 'Yes — App tiles / icons' },
      { displayValue: 'Yes — Curated content rows' },
      { displayValue: 'Yes — Both' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'continue_watching',
    displayLabel: '15.4 Continue Watching Row',
    options: [
      { displayValue: 'Yes — Platform-native Continue Watching row' },
      { displayValue: 'Yes — App supplies content via platform API' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'universal_search',
    displayLabel: '15.5 Universal Search',
    options: [
      { displayValue: 'Yes — Disney+ content indexed in platform search' },
      { displayValue: 'Yes — Supported but not yet integrated' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'recommendations_tiles',
    displayLabel: '15.6 Recommendation Tiles',
    options: [
      { displayValue: 'Yes — Platform pulls from app API' },
      { displayValue: 'Yes — Operator-curated only' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'app_autostart',
    displayLabel: '15.7 App Autostart',
    options: [
      { displayValue: 'Yes — App can be set to autolaunch' },
      { displayValue: 'Yes — App preloaded in background' },
      { displayValue: 'No' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'ui_frame_rate',
    displayLabel: '16.4 UI Target Frame Rate',
    options: [
      { displayValue: '60 fps' },
      { displayValue: '30 fps' },
      { displayValue: 'Variable' },
      { displayValue: 'Other', isOtherTrigger: true },
    ],
  },
  {
    dropdownKey: 'concurrent_streams',
    displayLabel: '16.5 Concurrent Streams',
    options: [
      { displayValue: 'Yes — Full concurrent decode supported' },
      { displayValue: 'Yes — Limited (describe below)' },
      { displayValue: 'No — Single stream only' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'memory_background',
    displayLabel: '16.6 App Memory Backgrounded',
    options: [
      { displayValue: 'App suspended and kept in memory' },
      { displayValue: 'App suspended — may be killed under memory pressure' },
      { displayValue: 'App always terminated on background' },
      { displayValue: 'Operator-configurable' },
      { displayValue: 'Unknown' },
    ],
  },
  {
    dropdownKey: 'benchmark_available',
    displayLabel: '16.7 Benchmark Data Available?',
    options: [
      { displayValue: 'Yes — Will provide' },
      { displayValue: 'Yes — Available on request' },
      { displayValue: 'No' },
      { displayValue: 'N/A' },
    ],
  },
];

export async function seedFieldOptions(userEmail = 'system@disney.com'): Promise<{ created: number; skipped: number }> {
  const db = admin.firestore();
  let created = 0;
  let skipped = 0;

  for (const seed of SEED_DATA) {
    const existing = await db
      .collection('fieldOptions')
      .where('dropdownKey', '==', seed.dropdownKey)
      .limit(1)
      .get();

    if (!existing.empty) {
      skipped += seed.options.length;
      log.debug('Skipping existing dropdown key', { dropdownKey: seed.dropdownKey });
      continue;
    }

    const batch = db.batch();
    seed.options.forEach((opt, index) => {
      const docRef = db.collection('fieldOptions').doc();
      const now = new Date().toISOString();
      batch.set(docRef, {
        dropdownKey: seed.dropdownKey,
        displayLabel: seed.displayLabel,
        displayValue: opt.displayValue,
        sortOrder: index + 1,
        isActive: true,
        isOtherTrigger: opt.isOtherTrigger ?? false,
        createdAt: now,
        createdBy: userEmail,
        updatedAt: now,
        updatedBy: userEmail,
      });
      created++;
    });

    await batch.commit();
    log.info('Seeded dropdown key', { dropdownKey: seed.dropdownKey, optionCount: seed.options.length });
  }

  log.info('Seed complete', { created, skipped });
  return { created, skipped };
}

export { SEED_DATA };
