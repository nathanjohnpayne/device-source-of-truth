import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import type { PartnerKey, DeviceType, Region } from '../lib/types';

const DEVICE_TYPES: DeviceType[] = ['STB', 'Smart TV', 'Stick', 'Console', 'OTT Box', 'Other'];
const REGIONS: Region[] = ['NA', 'EMEA', 'LATAM', 'APAC'];

interface FormState {
  deviceId: string;
  displayName: string;
  partnerKeyId: string;
  deviceType: DeviceType;
  region: Region | '';
  countriesIso2: string;
  liveAdkVersion: string;
}

const INITIAL: FormState = {
  deviceId: '',
  displayName: '',
  partnerKeyId: '',
  deviceType: 'STB',
  region: '',
  countriesIso2: '',
  liveAdkVersion: '',
};

export default function DeviceCreatePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [partnerKeys, setPartnerKeys] = useState<PartnerKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.partnerKeys
      .list({ pageSize: 1000 })
      .then((res) => setPartnerKeys(res.data))
      .catch(() => {})
      .finally(() => setLoadingKeys(false));
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.deviceId.trim()) errs.deviceId = 'Device ID is required';
    if (!form.displayName.trim()) errs.displayName = 'Display name is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);
    try {
      const countries = form.countriesIso2
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const created = await api.devices.create({
        deviceId: form.deviceId.trim(),
        displayName: form.displayName.trim(),
        partnerKeyId: form.partnerKeyId || undefined,
        deviceType: form.deviceType,
        liveAdkVersion: form.liveAdkVersion || null,
        countriesIso2: countries,
      } as Record<string, unknown>);
      navigate(`/devices/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldErrors((prev) => ({ ...prev, deviceId: 'This Device ID is already taken' }));
      } else {
        setError(err instanceof Error ? err.message : 'Failed to register device');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  if (loadingKeys) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button
        onClick={() => navigate('/devices')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Devices
      </button>

      <h1 className="text-2xl font-bold text-gray-900">Register New Device</h1>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Device ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.deviceId}
            onChange={set('deviceId')}
            placeholder="e.g. samsung-tizen-2024-ue55"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 ${
              fieldErrors.deviceId
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
            }`}
          />
          {fieldErrors.deviceId && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.deviceId}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Display Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.displayName}
            onChange={set('displayName')}
            placeholder="e.g. Samsung Tizen 2024 UE55"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 ${
              fieldErrors.displayName
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
            }`}
          />
          {fieldErrors.displayName && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.displayName}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Partner Key</label>
          <select
            value={form.partnerKeyId}
            onChange={set('partnerKeyId')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">— Select Partner Key —</option>
            {partnerKeys.map((pk) => (
              <option key={pk.id} value={pk.id}>
                {pk.key} {pk.chipset ? `(${pk.chipset})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Device Type</label>
            <select
              value={form.deviceType}
              onChange={set('deviceType')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Region</label>
            <select
              value={form.region}
              onChange={set('region')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">— Select Region —</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Countries (ISO 3166-1 alpha-2)</label>
          <input
            type="text"
            value={form.countriesIso2}
            onChange={set('countriesIso2')}
            placeholder="US, GB, DE"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Live ADK Version</label>
          <input
            type="text"
            value={form.liveAdkVersion}
            onChange={set('liveAdkVersion')}
            placeholder="e.g. 7.3.1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={() => navigate('/devices')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Registering...' : 'Register Device'}
          </button>
        </div>
      </form>
    </div>
  );
}
