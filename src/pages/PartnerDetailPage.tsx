import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, ArrowLeft, Monitor, Key, Plus, Power, PowerOff } from 'lucide-react';
import { api } from '../lib/api';
import { formatNumber, getFreshnessState } from '../lib/format';
import { useAuth } from '../hooks/useAuth';
import DataTable, { type Column } from '../components/shared/DataTable';
import Badge from '../components/shared/Badge';
import FreshnessBadge from '../components/shared/FreshnessBadge';
import FreshnessMicroPanel from '../components/shared/FreshnessMicroPanel';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import type {
  Partner,
  PartnerKey,
  PartnerKeyRegion,
  DeviceWithRelations,
  Region,
} from '../lib/types';

const REGIONS: Region[] = ['NA', 'EMEA', 'LATAM', 'APAC'];
const PK_REGIONS: PartnerKeyRegion[] = ['APAC', 'EMEA', 'LATAM', 'DOMESTIC', 'GLOBAL'];

function countryFlag(iso2: string): string {
  if (iso2.length !== 2) return '\u{1F3F3}';
  const cp1 = 0x1f1e6 + iso2.toUpperCase().charCodeAt(0) - 65;
  const cp2 = 0x1f1e6 + iso2.toUpperCase().charCodeAt(1) - 65;
  return String.fromCodePoint(cp1, cp2);
}

type DeviceRow = DeviceWithRelations & { lastTelemetryAt?: string | null };

const deviceColumns: Column<DeviceWithRelations>[] = [
  { header: 'Device Name', accessor: 'displayName', sortable: true },
  { header: 'Device ID', accessor: 'deviceId', sortable: true },
  { header: 'Device Type', accessor: 'deviceType', sortable: true },
  { header: 'ADK Version', accessor: 'liveAdkVersion' },
  {
    header: 'Active Devices',
    accessor: 'activeDeviceCount',
    sortable: true,
    cellProps: (row) => ({
      'aria-label': `Active devices: ${formatNumber(row.activeDeviceCount ?? 0)}, ${getFreshnessState((row as DeviceRow).lastTelemetryAt).replace('_', ' ')} data`,
    }),
    render: (row) => (
      <FreshnessMicroPanel
        lastTelemetryAt={(row as DeviceRow).lastTelemetryAt}
        partnerName={row.partnerName}
        partnerKeyName={row.partnerKeyName}
      >
        <span className="inline-flex items-center gap-2">
          {(row.activeDeviceCount ?? 0).toLocaleString()}
          <FreshnessBadge
            compact
            lastTelemetryAt={(row as DeviceRow).lastTelemetryAt}
          />
        </span>
      </FreshnessMicroPanel>
    ),
  },
  {
    header: 'Tier',
    accessor: 'tierName',
    render: (row) =>
      row.tierName ? <Badge variant="info">{row.tierName}</Badge> : '—',
  },
];

const EMPTY_KEY_FORM = {
  key: '',
  chipset: '',
  oem: '',
  kernel: '',
  os: '',
  countries: '',
  regions: [] as PartnerKeyRegion[],
};

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isEditor, isAdmin } = useAuth();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerKeys, setPartnerKeys] = useState<PartnerKey[]>([]);
  const [devices, setDevices] = useState<DeviceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    regions: [] as Region[],
    countriesIso2: '',
  });
  const [saving, setSaving] = useState(false);

  // Key management state
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<PartnerKey | null>(null);
  const [keyForm, setKeyForm] = useState(EMPTY_KEY_FORM);
  const [savingKey, setSavingKey] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState<PartnerKey | null>(null);
  const [toggling, setToggling] = useState(false);
  const [partnerDeployments, setPartnerDeployments] = useState<(import('../lib/types').DevicePartnerDeployment & { deviceDisplayName?: string })[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    Promise.all([
      api.partners.get(id),
      api.partnerKeys.list({ partnerId: id, pageSize: 500 }),
      api.devices.list({ partnerId: id, pageSize: 500 }),
    ])
      .then(([p, keys, devs]) => {
        setPartner(p);
        setPartnerKeys(keys.data);
        setDevices(devs.data);
        setFormData({
          displayName: p.displayName,
          regions: p.regions ?? [],
          countriesIso2: (p.countriesIso2 ?? []).join(', '),
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    api.questionnaireIntake.getPartnerDeployments(id)
      .then(setPartnerDeployments)
      .catch(() => {});
  }, [id]);

  const totalDevices = devices.length;
  const activeDevices = devices.reduce((sum, d) => sum + d.activeDeviceCount, 0);
  const specsComplete = devices.filter((d) => d.specCompleteness === 100).length;
  const specCoverage = totalDevices > 0
    ? Math.round((specsComplete / totalDevices) * 100)
    : 0;
  const latestDeviceTelemetry = devices.reduce<string | null>((latest, d) => {
    const t = (d as DeviceWithRelations & { lastTelemetryAt?: string | null }).lastTelemetryAt;
    if (t && (!latest || t > latest)) return t;
    return latest;
  }, null);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const countries = formData.countriesIso2
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const updated = await api.partners.update(id, {
        displayName: formData.displayName,
        regions: formData.regions,
        countriesIso2: countries,
      });
      setPartner(updated);
      setEditOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const toggleRegion = (r: Region) => {
    setFormData((prev) => ({
      ...prev,
      regions: prev.regions.includes(r)
        ? prev.regions.filter((x) => x !== r)
        : [...prev.regions, r],
    }));
  };

  const openAddKey = () => {
    setEditingKey(null);
    setKeyForm(EMPTY_KEY_FORM);
    setKeyModalOpen(true);
  };

  const openEditKey = (pk: PartnerKey) => {
    setEditingKey(pk);
    setKeyForm({
      key: pk.key,
      chipset: pk.chipset ?? '',
      oem: pk.oem ?? '',
      kernel: pk.kernel ?? '',
      os: pk.os ?? '',
      countries: (pk.countries ?? []).join(', '),
      regions: pk.regions ?? [],
    });
    setKeyModalOpen(true);
  };

  const handleSaveKey = async () => {
    if (!id) return;
    setSavingKey(true);
    try {
      const countries = keyForm.countries
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const payload = {
        key: keyForm.key,
        partnerId: id,
        chipset: keyForm.chipset || null,
        oem: keyForm.oem || null,
        kernel: keyForm.kernel || null,
        os: keyForm.os || null,
        countries,
        regions: keyForm.regions,
      };

      if (editingKey) {
        const updated = await api.partnerKeys.update(editingKey.id, payload);
        setPartnerKeys((prev) => prev.map((k) => (k.id === editingKey.id ? updated : k)));
      } else {
        const created = await api.partnerKeys.create(payload as Partial<PartnerKey>);
        setPartnerKeys((prev) => [...prev, created]);
      }
      setKeyModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleToggleActive = async (pk: PartnerKey) => {
    setToggling(true);
    try {
      const updated = await api.partnerKeys.update(pk.id, { isActive: !pk.isActive } as Partial<PartnerKey>);
      setPartnerKeys((prev) => prev.map((k) => (k.id === pk.id ? updated : k)));
      setDeactivateConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update key');
    } finally {
      setToggling(false);
    }
  };

  const toggleKeyRegion = (r: PartnerKeyRegion) => {
    setKeyForm((prev) => ({
      ...prev,
      regions: prev.regions.includes(r)
        ? prev.regions.filter((x) => x !== r)
        : [...prev.regions, r],
    }));
  };

  if (loading) return <LoadingSpinner />;
  if (error && !partner) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!partner) {
    return <EmptyState title="Partner not found" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <button
          onClick={() => navigate('/partners')}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Partners
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{partner.displayName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(partner.regions ?? []).map((r) => (
                <Badge key={r} variant="info">{r}</Badge>
              ))}
              {(partner.countriesIso2 ?? []).map((c) => (
                <span key={c} className="text-sm text-gray-600">
                  {countryFlag(c)} {c}
                </span>
              ))}
            </div>
          </div>
          {isEditor && (
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Devices</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{(totalDevices ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Active Devices</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{(activeDevices ?? 0).toLocaleString()}</p>
          <FreshnessBadge lastTelemetryAt={latestDeviceTelemetry} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Spec Coverage</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{specCoverage}%</p>
        </div>
      </div>

      {/* Partner Keys section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Partner Keys</h2>
            <span className="text-sm text-gray-500">({partnerKeys.length})</span>
          </div>
          {isAdmin && (
            <button
              onClick={openAddKey}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add Key
            </button>
          )}
        </div>

        {partnerKeys.length === 0 ? (
          <EmptyState
            title="No partner keys"
            description="No keys are associated with this partner yet."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Key</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Countries</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Region</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Chipset</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">OEM</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Kernel</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">OS</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Active</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Source</th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {partnerKeys.map((pk) => (
                    <tr key={pk.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{pk.key}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{(pk.countries ?? []).join(', ') || '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        {(pk.regions ?? []).map((r) => (
                          <Badge key={r} variant="info" className="mr-1">{r}</Badge>
                        ))}
                        {!(pk.regions?.length) && '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{pk.chipset ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{pk.oem ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{pk.kernel ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{pk.os ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {pk.isActive !== false ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="danger">Inactive</Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {pk.source === 'csv_import' ? 'CSV' : 'Manual'}
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditKey(pk)}
                              className="text-indigo-600 hover:text-indigo-800"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (pk.isActive !== false) {
                                  setDeactivateConfirm(pk);
                                } else {
                                  handleToggleActive(pk);
                                }
                              }}
                              className={pk.isActive !== false ? 'text-amber-600 hover:text-amber-800' : 'text-emerald-600 hover:text-emerald-800'}
                              title={pk.isActive !== false ? 'Deactivate' : 'Activate'}
                            >
                              {pk.isActive !== false ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Devices</h2>
          <span className="text-sm text-gray-500">({devices.length})</span>
        </div>
        <DataTable
          columns={deviceColumns}
          data={devices}
          onRowClick={(row) => navigate(`/devices/${row.id}`)}
          emptyTitle="No devices"
          emptyDescription="No devices registered for this partner yet."
        />
      </section>

      {/* Partner Deployments (DST-055) */}
      {partnerDeployments.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Monitor className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Deployed Devices</h2>
            <span className="text-sm text-gray-500">({partnerDeployments.length})</span>
          </div>
          <DataTable<typeof partnerDeployments[number]>
            columns={[
              { header: 'Device', accessor: 'deviceDisplayName', sortable: true,
                render: (row) => (
                  <button
                    className="font-medium text-indigo-600 hover:underline"
                    onClick={(e) => { e.stopPropagation(); navigate(`/devices/${row.deviceId}`); }}
                  >
                    {row.deviceDisplayName ?? row.deviceId}
                  </button>
                )},
              { header: 'Markets', accessor: 'countries',
                render: (row) => row.countries?.length ? row.countries.join(', ') : '—' },
              { header: 'Cert Status', accessor: 'certificationStatus',
                render: (row) => row.certificationStatus ? row.certificationStatus.replace(/_/g, ' ') : '—' },
              { header: 'ADK', accessor: 'certificationAdkVersion',
                render: (row) => row.certificationAdkVersion ?? '—' },
              { header: 'Active', accessor: 'active',
                render: (row) => row.active ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="default">Inactive</Badge>
                )},
            ]}
            data={partnerDeployments}
            onRowClick={(row) => navigate(`/devices/${row.deviceId}`)}
            emptyTitle="No deployed devices"
            emptyDescription="No deployed device records for this partner."
          />
        </section>
      )}

      {/* Edit Partner Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Partner"
        footer={
          <>
            <button
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.displayName || saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Display Name</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData((p) => ({ ...p, displayName: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Regions</label>
            <div className="flex flex-wrap gap-3">
              {REGIONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.regions.includes(r)}
                    onChange={() => toggleRegion(r)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Countries (ISO 3166-1 alpha-2)</label>
            <input
              type="text"
              value={formData.countriesIso2}
              onChange={(e) => setFormData((p) => ({ ...p, countriesIso2: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </Modal>

      {/* Add/Edit Key Modal */}
      <Modal
        open={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        title={editingKey ? 'Edit Partner Key' : 'Add Partner Key'}
        wide
        footer={
          <>
            <button
              onClick={() => setKeyModalOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveKey}
              disabled={!keyForm.key || savingKey}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingKey ? 'Saving...' : editingKey ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Partner Key *</label>
            <input
              type="text"
              value={keyForm.key}
              onChange={(e) => setKeyForm((p) => ({ ...p, key: e.target.value }))}
              disabled={!!editingKey}
              placeholder="e.g. vodafone_es"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Chipset</label>
            <input
              type="text"
              value={keyForm.chipset}
              onChange={(e) => setKeyForm((p) => ({ ...p, chipset: e.target.value }))}
              placeholder="e.g. Amlogic"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">OEM</label>
            <input
              type="text"
              value={keyForm.oem}
              onChange={(e) => setKeyForm((p) => ({ ...p, oem: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Kernel</label>
            <input
              type="text"
              value={keyForm.kernel}
              onChange={(e) => setKeyForm((p) => ({ ...p, kernel: e.target.value }))}
              placeholder="e.g. Linux"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">OS</label>
            <input
              type="text"
              value={keyForm.os}
              onChange={(e) => setKeyForm((p) => ({ ...p, os: e.target.value }))}
              placeholder="e.g. TiVo OS"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Countries (ISO 3166-1 alpha-2, comma-separated)</label>
            <input
              type="text"
              value={keyForm.countries}
              onChange={(e) => setKeyForm((p) => ({ ...p, countries: e.target.value }))}
              placeholder="e.g. US, GB, DE"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Regions</label>
            <div className="flex flex-wrap gap-3">
              {PK_REGIONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={keyForm.regions.includes(r)}
                    onChange={() => toggleKeyRegion(r)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirmation Modal */}
      <Modal
        open={!!deactivateConfirm}
        onClose={() => setDeactivateConfirm(null)}
        title="Deactivate Partner Key"
        footer={
          <>
            <button
              onClick={() => setDeactivateConfirm(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => deactivateConfirm && handleToggleActive(deactivateConfirm)}
              disabled={toggling}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {toggling ? 'Deactivating...' : 'Deactivate'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Are you sure you want to deactivate the key <strong>{deactivateConfirm?.key}</strong>?
          </p>
          <div className="rounded-md bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Deactivating this key will exclude its devices from active counts. The key is
              retained for historical telemetry lookups.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
