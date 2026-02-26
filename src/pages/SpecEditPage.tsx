import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Save, X, Upload, LinkIcon } from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import {
  TextInput,
  NumberInput,
  CheckboxInput,
  SelectInput,
  DateInput,
} from '../components/specs/SpecFormFields';
import type { DeviceSpec, DeviceWithRelations, SpecCategory } from '../lib/types';
import { SPEC_CATEGORIES, SPEC_CATEGORY_LABELS } from '../lib/types';

type FieldType = 'text' | 'number' | 'checkbox' | 'select' | 'date';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  min?: number;
  integer?: boolean;
}

const SOC_VENDOR_OPTIONS = [
  { value: 'Broadcom', label: 'Broadcom' },
  { value: 'Novatek', label: 'Novatek' },
  { value: 'MediaTek', label: 'MediaTek' },
  { value: 'Amlogic', label: 'Amlogic' },
  { value: 'Realtek', label: 'Realtek' },
  { value: 'Other', label: 'Other' },
];

const CATEGORY_FIELDS: Record<SpecCategory, FieldDef[]> = {
  identity: [
    { key: 'deviceModel', label: 'Device Model', type: 'text' },
    { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
    { key: 'brandName', label: 'Brand Name', type: 'text' },
    { key: 'modelYear', label: 'Model Year', type: 'number', integer: true },
    { key: 'deviceCategory', label: 'Device Category', type: 'text' },
  ],
  soc: [
    { key: 'socVendor', label: 'SoC Vendor', type: 'select', options: SOC_VENDOR_OPTIONS },
    { key: 'socModel', label: 'SoC Model', type: 'text' },
    { key: 'cpuArchitecture', label: 'CPU Architecture', type: 'text' },
    { key: 'cpuCores', label: 'CPU Cores', type: 'number', integer: true, min: 0 },
    { key: 'cpuSpeedMhz', label: 'CPU Speed (MHz)', type: 'number', min: 0 },
    { key: 'cpuBenchmarkDmips', label: 'CPU Benchmark (DMIPS)', type: 'number', min: 0 },
    { key: 'is64Bit', label: '64-bit', type: 'checkbox' },
  ],
  os: [
    { key: 'osName', label: 'OS Name', type: 'text' },
    { key: 'osVersion', label: 'OS Version', type: 'text' },
    { key: 'browserEngine', label: 'Browser Engine', type: 'text' },
    { key: 'browserVersion', label: 'Browser Version', type: 'text' },
    { key: 'jsEngineVersion', label: 'JS Engine Version', type: 'text' },
  ],
  memory: [
    { key: 'totalRamMb', label: 'Total RAM (MB)', type: 'number', min: 0 },
    { key: 'appAvailableRamMb', label: 'App Available RAM (MB)', type: 'number', min: 0 },
    { key: 'totalStorageGb', label: 'Total Storage (GB)', type: 'number', min: 0 },
    { key: 'appAvailableStorageMb', label: 'App Available Storage (MB)', type: 'number', min: 0 },
    { key: 'swapMemoryMb', label: 'Swap Memory (MB)', type: 'number', min: 0 },
  ],
  gpu: [
    { key: 'gpuModel', label: 'GPU Model', type: 'text' },
    { key: 'gpuVendor', label: 'GPU Vendor', type: 'text' },
    { key: 'gpuMemoryMb', label: 'GPU Memory (MB)', type: 'number', min: 0 },
    { key: 'openGlVersion', label: 'OpenGL Version', type: 'text' },
    { key: 'openGlEsVersion', label: 'OpenGL ES Version', type: 'text' },
    { key: 'vulkanSupport', label: 'Vulkan Support', type: 'checkbox' },
    { key: 'gpuBenchmark', label: 'GPU Benchmark', type: 'number', min: 0 },
  ],
  streaming: [
    { key: 'adkVersion', label: 'ADK Version', type: 'text' },
    { key: 'adkBuildType', label: 'ADK Build Type', type: 'text' },
    { key: 'htmlVersion', label: 'HTML Version', type: 'text' },
    { key: 'cssVersion', label: 'CSS Version', type: 'text' },
    { key: 'playerType', label: 'Player Type', type: 'text' },
    { key: 'mseSupport', label: 'MSE Support', type: 'checkbox' },
    { key: 'emeSupport', label: 'EME Support', type: 'checkbox' },
  ],
  videoOutput: [
    { key: 'maxResolution', label: 'Max Resolution', type: 'text' },
    { key: 'hdmiVersion', label: 'HDMI Version', type: 'text' },
    { key: 'hdcpVersion', label: 'HDCP Version', type: 'text' },
    { key: 'hdrSupport', label: 'HDR Support', type: 'checkbox' },
    { key: 'hdr10Support', label: 'HDR10 Support', type: 'checkbox' },
    { key: 'hdr10PlusSupport', label: 'HDR10+ Support', type: 'checkbox' },
    { key: 'hlgSupport', label: 'HLG Support', type: 'checkbox' },
    { key: 'dolbyVisionSupport', label: 'Dolby Vision Support', type: 'checkbox' },
    { key: 'dolbyVisionProfiles', label: 'Dolby Vision Profiles', type: 'text' },
    { key: 'displayRefreshRate', label: 'Display Refresh Rate (Hz)', type: 'number', min: 0 },
  ],
  firmware: [
    { key: 'firmwareVersion', label: 'Firmware Version', type: 'text' },
    { key: 'firmwareUpdateMethod', label: 'Firmware Update Method', type: 'text' },
    { key: 'lastFirmwareDate', label: 'Last Firmware Date', type: 'date' },
    { key: 'nextPlannedFirmwareDate', label: 'Next Planned Firmware Date', type: 'date' },
    { key: 'firmwareAutoUpdate', label: 'Firmware Auto-Update', type: 'checkbox' },
    { key: 'eolDate', label: 'End of Life Date', type: 'date' },
  ],
  codecs: [
    { key: 'avcSupport', label: 'AVC (H.264)', type: 'checkbox' },
    { key: 'avcMaxProfile', label: 'AVC Max Profile', type: 'text' },
    { key: 'avcMaxLevel', label: 'AVC Max Level', type: 'text' },
    { key: 'hevcSupport', label: 'HEVC (H.265)', type: 'checkbox' },
    { key: 'hevcMaxProfile', label: 'HEVC Max Profile', type: 'text' },
    { key: 'hevcMaxLevel', label: 'HEVC Max Level', type: 'text' },
    { key: 'av1Support', label: 'AV1 Support', type: 'checkbox' },
    { key: 'vp9Support', label: 'VP9 Support', type: 'checkbox' },
    { key: 'eac3Support', label: 'E-AC-3 (Dolby Digital Plus)', type: 'checkbox' },
    { key: 'ac4Support', label: 'AC-4 Support', type: 'checkbox' },
    { key: 'dolbyAtmosSupport', label: 'Dolby Atmos', type: 'checkbox' },
    { key: 'aacSupport', label: 'AAC Support', type: 'checkbox' },
    { key: 'opusSupport', label: 'Opus Support', type: 'checkbox' },
  ],
  frameRate: [
    { key: 'maxFrameRate', label: 'Max Frame Rate (fps)', type: 'number', min: 0 },
    { key: 'supports24fps', label: '24 fps', type: 'checkbox' },
    { key: 'supports30fps', label: '30 fps', type: 'checkbox' },
    { key: 'supports60fps', label: '60 fps', type: 'checkbox' },
    { key: 'supportsAdaptiveFps', label: 'Adaptive Frame Rate', type: 'checkbox' },
    { key: 'trickPlaySupport', label: 'Trick Play', type: 'checkbox' },
  ],
  drm: [
    { key: 'widevineLevel', label: 'Widevine Level', type: 'text' },
    { key: 'widevineVersion', label: 'Widevine Version', type: 'text' },
    { key: 'playreadyLevel', label: 'PlayReady Level', type: 'text' },
    { key: 'playreadyVersion', label: 'PlayReady Version', type: 'text' },
    { key: 'fairplaySupport', label: 'FairPlay Support', type: 'checkbox' },
    { key: 'hdcpSupport', label: 'HDCP Support', type: 'checkbox' },
    { key: 'hdcp2xSupport', label: 'HDCP 2.x Support', type: 'checkbox' },
    { key: 'secureMediaPipeline', label: 'Secure Media Pipeline', type: 'checkbox' },
    { key: 'attestationType', label: 'Attestation Type', type: 'text' },
  ],
  security: [
    { key: 'secureBootSupport', label: 'Secure Boot', type: 'checkbox' },
    { key: 'teeType', label: 'TEE Type', type: 'text' },
    { key: 'teeVersion', label: 'TEE Version', type: 'text' },
    { key: 'hardwareRootOfTrust', label: 'Hardware Root of Trust', type: 'checkbox' },
    { key: 'secureStorageSupport', label: 'Secure Storage', type: 'checkbox' },
    { key: 'tamperDetection', label: 'Tamper Detection', type: 'checkbox' },
  ],
};

function emptySpec(): Omit<DeviceSpec, 'id' | 'deviceId' | 'updatedAt'> {
  return {
    identity: { deviceModel: null, manufacturer: null, brandName: null, modelYear: null, deviceCategory: null },
    soc: { socVendor: null, socModel: null, cpuArchitecture: null, cpuCores: null, cpuSpeedMhz: null, cpuBenchmarkDmips: null, is64Bit: null },
    os: { osName: null, osVersion: null, browserEngine: null, browserVersion: null, jsEngineVersion: null },
    memory: { totalRamMb: null, appAvailableRamMb: null, totalStorageGb: null, appAvailableStorageMb: null, swapMemoryMb: null },
    gpu: { gpuModel: null, gpuVendor: null, gpuMemoryMb: null, openGlVersion: null, openGlEsVersion: null, vulkanSupport: null, gpuBenchmark: null },
    streaming: { adkVersion: null, adkBuildType: null, htmlVersion: null, cssVersion: null, playerType: null, mseSupport: null, emeSupport: null },
    videoOutput: { maxResolution: null, hdmiVersion: null, hdcpVersion: null, hdrSupport: null, hdr10Support: null, hdr10PlusSupport: null, hlgSupport: null, dolbyVisionSupport: null, dolbyVisionProfiles: null, displayRefreshRate: null },
    firmware: { firmwareVersion: null, firmwareUpdateMethod: null, lastFirmwareDate: null, nextPlannedFirmwareDate: null, firmwareAutoUpdate: null, eolDate: null },
    codecs: { avcSupport: null, avcMaxProfile: null, avcMaxLevel: null, hevcSupport: null, hevcMaxProfile: null, hevcMaxLevel: null, av1Support: null, vp9Support: null, eac3Support: null, ac4Support: null, dolbyAtmosSupport: null, aacSupport: null, opusSupport: null },
    frameRate: { maxFrameRate: null, supports24fps: null, supports30fps: null, supports60fps: null, supportsAdaptiveFps: null, trickPlaySupport: null },
    drm: { widevineLevel: null, widevineVersion: null, playreadyLevel: null, playreadyVersion: null, fairplaySupport: null, hdcpSupport: null, hdcp2xSupport: null, secureMediaPipeline: null, attestationType: null },
    security: { secureBootSupport: null, teeType: null, teeVersion: null, hardwareRootOfTrust: null, secureStorageSupport: null, tamperDetection: null },
  };
}

function countFilledFields(obj: Record<string, unknown>): number {
  return Object.values(obj).filter((v) => v !== null && v !== undefined).length;
}

function SpecSection({
  category,
  label,
  data,
  fields,
  onChange,
  defaultOpen,
}: {
  category: SpecCategory;
  label: string;
  data: Record<string, unknown>;
  fields: FieldDef[];
  onChange: (category: SpecCategory, key: string, value: unknown) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const filled = countFilledFields(data);
  const total = fields.length;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium ${filled === total ? 'text-emerald-600' : filled > 0 ? 'text-amber-600' : 'text-gray-400'}`}
          >
            {filled}/{total} fields
          </span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all ${filled === total ? 'bg-emerald-500' : filled > 0 ? 'bg-amber-500' : 'bg-gray-300'}`}
              style={{ width: `${total ? (filled / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => {
              const val = data[field.key];
              const handleChange = (v: unknown) => onChange(category, field.key, v);

              switch (field.type) {
                case 'text':
                  return (
                    <TextInput
                      key={field.key}
                      label={field.label}
                      value={val as string | null}
                      onChange={handleChange as (v: string | null) => void}
                    />
                  );
                case 'number':
                  return (
                    <NumberInput
                      key={field.key}
                      label={field.label}
                      value={val as number | null}
                      onChange={handleChange as (v: number | null) => void}
                      min={field.min}
                      integer={field.integer}
                    />
                  );
                case 'checkbox':
                  return (
                    <CheckboxInput
                      key={field.key}
                      label={field.label}
                      value={val as boolean | null}
                      onChange={handleChange as (v: boolean | null) => void}
                    />
                  );
                case 'select':
                  return (
                    <SelectInput
                      key={field.key}
                      label={field.label}
                      value={val as string | null}
                      onChange={handleChange as (v: string | null) => void}
                      options={field.options!}
                    />
                  );
                case 'date':
                  return (
                    <DateInput
                      key={field.key}
                      label={field.label}
                      value={val as string | null}
                      onChange={handleChange as (v: string | null) => void}
                    />
                  );
              }
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SpecEditPage() {
  const { id: deviceId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [formData, setFormData] = useState(emptySpec());
  const [questionnaireUrl, setQuestionnaireUrl] = useState('');
  const [questionnaireFile, setQuestionnaireFile] = useState<File | null>(null);

  useEffect(() => {
    if (!deviceId) return;
    trackEvent('spec_form_open', { device_id: deviceId });

    (async () => {
      try {
        const device = await api.devices.get(deviceId);
        setDeviceName(device.displayName);
        setQuestionnaireUrl(device.questionnaireUrl ?? '');

        if (device.spec) {
          const { id: _id, deviceId: _did, updatedAt: _u, ...rest } = device.spec;
          setFormData({ ...emptySpec(), ...rest });
        }
      } catch {
        setError('Failed to load device specifications.');
      } finally {
        setLoading(false);
      }
    })();
  }, [deviceId]);

  const handleFieldChange = useCallback(
    (category: SpecCategory, key: string, value: unknown) => {
      setFormData((prev) => ({
        ...prev,
        [category]: { ...prev[category], [key]: value },
      }));
    },
    [],
  );

  const { filledTotal, totalFields, completionPct } = useMemo(() => {
    let filled = 0;
    let total = 0;
    for (const cat of SPEC_CATEGORIES) {
      const catData = formData[cat] as unknown as Record<string, unknown>;
      const fields = CATEGORY_FIELDS[cat];
      total += fields.length;
      filled += countFilledFields(catData);
    }
    return { filledTotal: filled, totalFields: total, completionPct: total ? Math.round((filled / total) * 100) : 0 };
  }, [formData]);

  const handleSave = async () => {
    if (!deviceId) return;
    setSaving(true);
    setError(null);

    try {
      await api.deviceSpecs.save(deviceId, formData as Partial<DeviceSpec>);

      if (questionnaireUrl || questionnaireFile) {
        await api.devices.update(deviceId, { questionnaireUrl: questionnaireUrl || null } as Partial<DeviceWithRelations>);
      }

      trackEvent('spec_form_save', { device_id: deviceId, category: 'all' });
      navigate(`/devices/${deviceId}`);
    } catch {
      setError('Failed to save specifications. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Device Specs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {deviceName} <span className="font-mono text-gray-400">({deviceId})</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/devices/${deviceId}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Overall Completion</span>
          <span className="text-sm font-semibold text-gray-900">
            {completionPct}% ({filledTotal}/{totalFields} fields)
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all ${completionPct === 100 ? 'bg-emerald-500' : completionPct > 50 ? 'bg-indigo-500' : completionPct > 0 ? 'bg-amber-500' : 'bg-gray-300'}`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Source Questionnaire</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <LinkIcon className="h-3.5 w-3.5" />
              Questionnaire URL
            </label>
            <input
              type="url"
              value={questionnaireUrl}
              onChange={(e) => setQuestionnaireUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Upload className="h-3.5 w-3.5" />
              Upload Questionnaire File
            </label>
            <input
              type="file"
              accept=".pdf,.xls,.xlsx"
              onChange={(e) => setQuestionnaireFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {questionnaireFile && (
              <p className="mt-1 text-xs text-gray-500">Selected: {questionnaireFile.name}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {SPEC_CATEGORIES.map((cat) => {
          const catData = formData[cat] as unknown as Record<string, unknown>;
          const hasData = countFilledFields(catData) > 0;
          return (
            <SpecSection
              key={cat}
              category={cat}
              label={SPEC_CATEGORY_LABELS[cat]}
              data={catData}
              fields={CATEGORY_FIELDS[cat]}
              onChange={handleFieldChange}
              defaultOpen={hasData}
            />
          );
        })}
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
        <button
          onClick={() => navigate(`/devices/${deviceId}`)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Specifications'}
        </button>
      </div>
    </div>
  );
}
