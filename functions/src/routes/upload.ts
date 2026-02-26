import { Router } from 'express';
import admin from 'firebase-admin';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { requireRole } from '../middleware/auth.js';
import { calculateSpecCompleteness } from '../services/specCompleteness.js';
import { assignTierToDevice } from '../services/tierEngine.js';
import { formatError } from '../services/logger.js';

const router = Router();

router.post('/migration', requireRole('admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { csvData } = req.body;

    if (!csvData) {
      req.log?.warn('Migration upload failed: missing csvData');
      res.status(400).json({ error: 'csvData is required' });
      return;
    }

    req.log?.info('Starting device migration', { csvLength: csvData.length, userId: req.user!.uid });

    const parsed = Papa.parse<Record<string, string>>(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      req.log?.warn('Migration CSV parse errors', { errorCount: parsed.errors.length, errors: parsed.errors.slice(0, 5).map((e) => e.message) });
      res.status(400).json({
        error: 'CSV parse errors',
        detail: parsed.errors.map((e) => e.message),
      });
      return;
    }

    req.log?.info('Migration CSV parsed', { rowCount: parsed.data.length });

    const now = new Date().toISOString();
    let created = 0;
    let duplicates = 0;
    let errored = 0;
    const errors: string[] = [];

    for (const row of parsed.data) {
      try {
        const deviceId = row['device_id'] || row['deviceId'] || '';
        if (!deviceId) {
          errored++;
          errors.push('Row missing device_id');
          continue;
        }

        const existing = await db.collection('devices').where('deviceId', '==', deviceId).limit(1).get();
        if (!existing.empty) {
          duplicates++;
          continue;
        }

        await db.collection('devices').add({
          displayName: row['display_name'] || row['displayName'] || deviceId,
          deviceId,
          partnerKeyId: row['partner_key'] || row['partnerKeyId'] || '',
          deviceType: row['device_type'] || row['deviceType'] || 'Other',
          status: 'active',
          liveAdkVersion: row['adk_version'] || null,
          certificationStatus: row['certification_status'] || 'Not Submitted',
          certificationNotes: row['certification_notes'] || null,
          lastCertifiedDate: null,
          questionnaireUrl: row['questionnaire_url'] || null,
          questionnaireFileUrl: null,
          activeDeviceCount: parseInt(row['active_device_count'] || '0') || 0,
          specCompleteness: 0,
          tierId: null,
          tierAssignedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        created++;
      } catch (rowErr) {
        errored++;
        errors.push(`Error on device: ${String(rowErr)}`);
        req.log?.warn('Migration row error', { error: String(rowErr) });
      }
    }

    req.log?.info('Device migration complete', {
      totalRows: parsed.data.length,
      created,
      duplicates,
      errored,
      errorSample: errors.slice(0, 5),
    });

    res.json({
      success: true,
      totalRows: parsed.data.length,
      created,
      duplicates,
      errored,
      errors: errors.slice(0, 100),
    });
  } catch (err) {
    req.log?.error('Migration failed', formatError(err));
    res.status(500).json({ error: 'Migration failed', detail: String(err) });
  }
});

router.post('/bulk-specs', requireRole('editor', 'admin'), async (req, res) => {
  try {
    const db = admin.firestore();
    const { csvData, fileData, fileType } = req.body;

    let rows: Record<string, string>[];

    if (csvData) {
      req.log?.info('Starting bulk spec import from CSV', { csvLength: csvData.length, userId: req.user!.uid });
      const parsed = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true,
      });
      rows = parsed.data;
    } else if (fileData && fileType === 'xlsx') {
      req.log?.info('Starting bulk spec import from XLSX', { fileDataLength: fileData.length, userId: req.user!.uid });
      const buffer = Buffer.from(fileData, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName]);
    } else {
      req.log?.warn('Bulk spec import failed: missing data source');
      res.status(400).json({ error: 'csvData or fileData (with fileType) is required' });
      return;
    }

    req.log?.info('Bulk spec data parsed', { rowCount: rows.length });

    let matched = 0;
    let notFound = 0;
    let errored = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const deviceId = row['device_id'] || row['deviceId'] || '';
        if (!deviceId) {
          errored++;
          errors.push('Row missing device_id');
          continue;
        }

        const deviceSnap = await db.collection('devices').where('deviceId', '==', deviceId).limit(1).get();
        if (deviceSnap.empty) {
          notFound++;
          errors.push(`Device not found: ${deviceId}`);
          continue;
        }

        const docId = deviceSnap.docs[0].id;
        const specData = {
          deviceId: docId,
          identity: {
            deviceModel: row['device_model'] || null,
            manufacturer: row['manufacturer'] || null,
            brandName: row['brand_name'] || null,
            modelYear: row['model_year'] ? parseInt(row['model_year']) : null,
            deviceCategory: row['device_category'] || null,
          },
          soc: {
            socVendor: row['soc_vendor'] || null,
            socModel: row['soc_model'] || null,
            cpuArchitecture: row['cpu_architecture'] || null,
            cpuCores: row['cpu_cores'] ? parseInt(row['cpu_cores']) : null,
            cpuSpeedMhz: row['cpu_speed_mhz'] ? parseInt(row['cpu_speed_mhz']) : null,
            cpuBenchmarkDmips: row['cpu_benchmark_dmips'] ? parseInt(row['cpu_benchmark_dmips']) : null,
            is64Bit: row['is_64_bit'] === 'true' ? true : row['is_64_bit'] === 'false' ? false : null,
          },
          os: {
            osName: row['os_name'] || null,
            osVersion: row['os_version'] || null,
            browserEngine: row['browser_engine'] || null,
            browserVersion: row['browser_version'] || null,
            jsEngineVersion: row['js_engine_version'] || null,
          },
          memory: {
            totalRamMb: row['total_ram_mb'] ? parseInt(row['total_ram_mb']) : null,
            appAvailableRamMb: row['app_available_ram_mb'] ? parseInt(row['app_available_ram_mb']) : null,
            totalStorageGb: row['total_storage_gb'] ? parseFloat(row['total_storage_gb']) : null,
            appAvailableStorageMb: row['app_available_storage_mb'] ? parseInt(row['app_available_storage_mb']) : null,
            swapMemoryMb: row['swap_memory_mb'] ? parseInt(row['swap_memory_mb']) : null,
          },
          gpu: {
            gpuModel: row['gpu_model'] || null,
            gpuVendor: row['gpu_vendor'] || null,
            gpuMemoryMb: row['gpu_memory_mb'] ? parseInt(row['gpu_memory_mb']) : null,
            openGlVersion: row['opengl_version'] || null,
            openGlEsVersion: row['opengl_es_version'] || null,
            vulkanSupport: row['vulkan_support'] === 'true' ? true : row['vulkan_support'] === 'false' ? false : null,
            gpuBenchmark: row['gpu_benchmark'] ? parseInt(row['gpu_benchmark']) : null,
          },
          streaming: {
            adkVersion: row['adk_version'] || null,
            adkBuildType: row['adk_build_type'] || null,
            htmlVersion: row['html_version'] || null,
            cssVersion: row['css_version'] || null,
            playerType: row['player_type'] || null,
            mseSupport: row['mse_support'] === 'true' ? true : row['mse_support'] === 'false' ? false : null,
            emeSupport: row['eme_support'] === 'true' ? true : row['eme_support'] === 'false' ? false : null,
          },
          videoOutput: {
            maxResolution: row['max_resolution'] || null,
            hdmiVersion: row['hdmi_version'] || null,
            hdcpVersion: row['hdcp_version'] || null,
            hdrSupport: row['hdr_support'] === 'true' ? true : row['hdr_support'] === 'false' ? false : null,
            hdr10Support: row['hdr10_support'] === 'true' ? true : row['hdr10_support'] === 'false' ? false : null,
            hdr10PlusSupport: row['hdr10_plus_support'] === 'true' ? true : row['hdr10_plus_support'] === 'false' ? false : null,
            hlgSupport: row['hlg_support'] === 'true' ? true : row['hlg_support'] === 'false' ? false : null,
            dolbyVisionSupport: row['dolby_vision_support'] === 'true' ? true : row['dolby_vision_support'] === 'false' ? false : null,
            dolbyVisionProfiles: row['dolby_vision_profiles'] || null,
            displayRefreshRate: row['display_refresh_rate'] ? parseInt(row['display_refresh_rate']) : null,
          },
          firmware: {
            firmwareVersion: row['firmware_version'] || null,
            firmwareUpdateMethod: row['firmware_update_method'] || null,
            lastFirmwareDate: row['last_firmware_date'] || null,
            nextPlannedFirmwareDate: row['next_planned_firmware_date'] || null,
            firmwareAutoUpdate: row['firmware_auto_update'] === 'true' ? true : row['firmware_auto_update'] === 'false' ? false : null,
            eolDate: row['eol_date'] || null,
          },
          codecs: {
            avcSupport: row['avc_support'] === 'true' ? true : row['avc_support'] === 'false' ? false : null,
            avcMaxProfile: row['avc_max_profile'] || null,
            avcMaxLevel: row['avc_max_level'] || null,
            hevcSupport: row['hevc_support'] === 'true' ? true : row['hevc_support'] === 'false' ? false : null,
            hevcMaxProfile: row['hevc_max_profile'] || null,
            hevcMaxLevel: row['hevc_max_level'] || null,
            av1Support: row['av1_support'] === 'true' ? true : row['av1_support'] === 'false' ? false : null,
            vp9Support: row['vp9_support'] === 'true' ? true : row['vp9_support'] === 'false' ? false : null,
            eac3Support: row['eac3_support'] === 'true' ? true : row['eac3_support'] === 'false' ? false : null,
            ac4Support: row['ac4_support'] === 'true' ? true : row['ac4_support'] === 'false' ? false : null,
            dolbyAtmosSupport: row['dolby_atmos_support'] === 'true' ? true : row['dolby_atmos_support'] === 'false' ? false : null,
            aacSupport: row['aac_support'] === 'true' ? true : row['aac_support'] === 'false' ? false : null,
            opusSupport: row['opus_support'] === 'true' ? true : row['opus_support'] === 'false' ? false : null,
          },
          frameRate: {
            maxFrameRate: row['max_frame_rate'] ? parseInt(row['max_frame_rate']) : null,
            supports24fps: row['supports_24fps'] === 'true' ? true : row['supports_24fps'] === 'false' ? false : null,
            supports30fps: row['supports_30fps'] === 'true' ? true : row['supports_30fps'] === 'false' ? false : null,
            supports60fps: row['supports_60fps'] === 'true' ? true : row['supports_60fps'] === 'false' ? false : null,
            supportsAdaptiveFps: row['supports_adaptive_fps'] === 'true' ? true : row['supports_adaptive_fps'] === 'false' ? false : null,
            trickPlaySupport: row['trick_play_support'] === 'true' ? true : row['trick_play_support'] === 'false' ? false : null,
          },
          drm: {
            widevineLevel: row['widevine_level'] || null,
            widevineVersion: row['widevine_version'] || null,
            playreadyLevel: row['playready_level'] || null,
            playreadyVersion: row['playready_version'] || null,
            fairplaySupport: row['fairplay_support'] === 'true' ? true : row['fairplay_support'] === 'false' ? false : null,
            hdcpSupport: row['hdcp_support'] === 'true' ? true : row['hdcp_support'] === 'false' ? false : null,
            hdcp2xSupport: row['hdcp_2x_support'] === 'true' ? true : row['hdcp_2x_support'] === 'false' ? false : null,
            secureMediaPipeline: row['secure_media_pipeline'] === 'true' ? true : row['secure_media_pipeline'] === 'false' ? false : null,
            attestationType: row['attestation_type'] || null,
          },
          security: {
            secureBootSupport: row['secure_boot_support'] === 'true' ? true : row['secure_boot_support'] === 'false' ? false : null,
            teeType: row['tee_type'] || null,
            teeVersion: row['tee_version'] || null,
            hardwareRootOfTrust: row['hardware_root_of_trust'] === 'true' ? true : row['hardware_root_of_trust'] === 'false' ? false : null,
            secureStorageSupport: row['secure_storage_support'] === 'true' ? true : row['secure_storage_support'] === 'false' ? false : null,
            tamperDetection: row['tamper_detection'] === 'true' ? true : row['tamper_detection'] === 'false' ? false : null,
          },
          updatedAt: new Date().toISOString(),
        };

        const existingSpec = await db.collection('deviceSpecs').where('deviceId', '==', docId).limit(1).get();
        if (existingSpec.empty) {
          await db.collection('deviceSpecs').add(specData);
        } else {
          await db.collection('deviceSpecs').doc(existingSpec.docs[0].id).set(specData);
        }

        const completeness = calculateSpecCompleteness(specData as unknown as import('../types/index.js').DeviceSpec);
        await db.collection('devices').doc(docId).update({
          specCompleteness: completeness,
          updatedAt: new Date().toISOString(),
        });

        await assignTierToDevice(docId);
        matched++;
      } catch (rowErr) {
        errored++;
        errors.push(`Error: ${String(rowErr)}`);
        req.log?.warn('Bulk spec row error', { deviceId: row['device_id'] || row['deviceId'], error: String(rowErr) });
      }
    }

    req.log?.info('Bulk spec import complete', {
      totalRows: rows.length,
      matched,
      notFound,
      errored,
      errorSample: errors.slice(0, 5),
    });

    res.json({
      success: true,
      totalRows: rows.length,
      matched,
      notFound,
      errored,
      errors: errors.slice(0, 100),
    });
  } catch (err) {
    req.log?.error('Bulk spec import failed', formatError(err));
    res.status(500).json({ error: 'Bulk spec import failed', detail: String(err) });
  }
});

router.get('/migration/template', (req, res) => {
  req.log?.debug('Serving migration template');
  const headers = [
    'device_id',
    'display_name',
    'partner_key',
    'device_type',
    'adk_version',
    'certification_status',
    'certification_notes',
    'questionnaire_url',
    'active_device_count',
  ];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="migration_template.csv"');
  res.send(headers.join(',') + '\n');
});

router.get('/bulk-specs/template', (req, res) => {
  req.log?.debug('Serving bulk specs template');
  const headers = [
    'device_id',
    'device_model', 'manufacturer', 'brand_name', 'model_year', 'device_category',
    'soc_vendor', 'soc_model', 'cpu_architecture', 'cpu_cores', 'cpu_speed_mhz', 'cpu_benchmark_dmips', 'is_64_bit',
    'os_name', 'os_version', 'browser_engine', 'browser_version', 'js_engine_version',
    'total_ram_mb', 'app_available_ram_mb', 'total_storage_gb', 'app_available_storage_mb', 'swap_memory_mb',
    'gpu_model', 'gpu_vendor', 'gpu_memory_mb', 'opengl_version', 'opengl_es_version', 'vulkan_support', 'gpu_benchmark',
    'adk_version', 'adk_build_type', 'html_version', 'css_version', 'player_type', 'mse_support', 'eme_support',
    'max_resolution', 'hdmi_version', 'hdcp_version', 'hdr_support', 'hdr10_support', 'hdr10_plus_support', 'hlg_support', 'dolby_vision_support', 'dolby_vision_profiles', 'display_refresh_rate',
    'firmware_version', 'firmware_update_method', 'last_firmware_date', 'next_planned_firmware_date', 'firmware_auto_update', 'eol_date',
    'avc_support', 'avc_max_profile', 'avc_max_level', 'hevc_support', 'hevc_max_profile', 'hevc_max_level', 'av1_support', 'vp9_support', 'eac3_support', 'ac4_support', 'dolby_atmos_support', 'aac_support', 'opus_support',
    'max_frame_rate', 'supports_24fps', 'supports_30fps', 'supports_60fps', 'supports_adaptive_fps', 'trick_play_support',
    'widevine_level', 'widevine_version', 'playready_level', 'playready_version', 'fairplay_support', 'hdcp_support', 'hdcp_2x_support', 'secure_media_pipeline', 'attestation_type',
    'secure_boot_support', 'tee_type', 'tee_version', 'hardware_root_of_trust', 'secure_storage_support', 'tamper_detection',
  ];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bulk_specs_template.csv"');
  res.send(headers.join(',') + '\n');
});

export default router;
