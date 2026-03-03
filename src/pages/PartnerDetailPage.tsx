import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, ArrowLeft, Monitor, Key } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import DataTable, { type Column } from '../components/shared/DataTable';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import type {
  Partner,
  PartnerKey,
  DeviceWithRelations,
  Region,
} from '../lib/types';

const REGIONS: Region[] = ['NA', 'EMEA', 'LATAM', 'APAC'];

function countryFlag(iso2: string): string {
  if (iso2.length !== 2) return '\u{1F3F3}';
  const cp1 = 0x1f1e6 + iso2.toUpperCase().charCodeAt(0) - 65;
  const cp2 = 0x1f1e6 + iso2.toUpperCase().charCodeAt(1) - 65;
  return String.fromCodePoint(cp1, cp2);
}

const keyColumns: Column<PartnerKey>[] = [
  { header: 'Key', accessor: 'key', sortable: true },
  { header: 'Chipset', accessor: 'chipset', sortable: true },
  { header: 'OEM', accessor: 'oem', sortable: true },
  {
    header: 'Region',
    accessor: 'region',
    render: (row) => row.region ? <Badge variant="info">{row.region}</Badge> : '—',
  },
];

const deviceColumns: Column<DeviceWithRelations>[] = [
  { header: 'Device Name', accessor: 'displayName', sortable: true },
  { header: 'Device ID', accessor: 'deviceId', sortable: true },
  { header: 'Device Type', accessor: 'deviceType', sortable: true },
  { header: 'ADK Version', accessor: 'liveAdkVersion' },
  {
    header: 'Active Devices',
    accessor: 'activeDeviceCount',
    sortable: true,
    render: (row) => (row.activeDeviceCount ?? 0).toLocaleString(),
  },
  {
    header: 'Tier',
    accessor: 'tierName',
    render: (row) =>
      row.tierName ? <Badge variant="info">{row.tierName}</Badge> : '—',
  },
];

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isEditor } = useAuth();

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
  }, [id]);

  const totalDevices = devices.length;
  const activeDevices = devices.reduce((sum, d) => sum + d.activeDeviceCount, 0);
  const specsComplete = devices.filter((d) => d.specCompleteness === 100).length;
  const specCoverage = totalDevices > 0
    ? Math.round((specsComplete / totalDevices) * 100)
    : 0;

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

  if (loading) return <LoadingSpinner />;
  if (error) {
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Devices</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{(totalDevices ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Active Devices</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{(activeDevices ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Spec Coverage</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{specCoverage}%</p>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Key className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Partner Keys</h2>
          <span className="text-sm text-gray-500">({partnerKeys.length})</span>
        </div>
        <DataTable
          columns={keyColumns}
          data={partnerKeys}
          emptyTitle="No partner keys"
          emptyDescription="No keys are associated with this partner yet."
        />
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
    </div>
  );
}
