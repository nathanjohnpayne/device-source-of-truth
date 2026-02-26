import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import DataTable, { type Column } from '../components/shared/DataTable';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import type { PartnerWithStats, Region } from '../lib/types';

const REGIONS: Region[] = ['NA', 'EMEA', 'LATAM', 'APAC'];

const FLAG_FALLBACK = '\u{1F3F3}';

function countryFlag(iso2: string): string {
  if (iso2.length !== 2) return FLAG_FALLBACK;
  const cp1 = 0x1f1e6 + iso2.toUpperCase().charCodeAt(0) - 65;
  const cp2 = 0x1f1e6 + iso2.toUpperCase().charCodeAt(1) - 65;
  return String.fromCodePoint(cp1, cp2);
}

const columns: Column<PartnerWithStats>[] = [
  { header: 'Display Name', accessor: 'displayName', sortable: true },
  {
    header: 'Regions',
    accessor: 'regions',
    render: (row) => (
      <div className="flex flex-wrap gap-1">
        {row.regions.map((r) => (
          <Badge key={r} variant="info">{r}</Badge>
        ))}
      </div>
    ),
  },
  {
    header: 'Countries',
    accessor: 'countriesIso2',
    render: (row) => (
      <div className="flex flex-wrap gap-1">
        {row.countriesIso2.map((c) => (
          <span key={c} className="text-sm">{countryFlag(c)} {c}</span>
        ))}
      </div>
    ),
  },
  {
    header: 'Partner Keys',
    accessor: 'partnerKeyCount',
    sortable: true,
    render: (row) => (row.partnerKeyCount ?? 0).toLocaleString(),
  },
  {
    header: 'Devices',
    accessor: 'deviceCount',
    sortable: true,
    render: (row) => (row.deviceCount ?? 0).toLocaleString(),
  },
  {
    header: 'Active Devices',
    accessor: 'activeDeviceCount',
    sortable: true,
    render: (row) => (row.activeDeviceCount ?? 0).toLocaleString(),
  },
];

export default function PartnerListPage() {
  const navigate = useNavigate();
  const { isEditor } = useAuth();

  const [partners, setPartners] = useState<PartnerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ displayName: '', regions: [] as Region[], countriesIso2: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.partners.list({ pageSize: 500 })
      .then((res) => setPartners(res.data as PartnerWithStats[]))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = partners;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.displayName.toLowerCase().includes(q));
    }
    if (regionFilter) {
      result = result.filter((p) => p.regions.includes(regionFilter as Region));
    }
    return result;
  }, [partners, search, regionFilter]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const countries = formData.countriesIso2
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const created = await api.partners.create({
        displayName: formData.displayName,
        regions: formData.regions,
        countriesIso2: countries,
      });
      setModalOpen(false);
      setFormData({ displayName: '', regions: [], countriesIso2: '' });
      navigate(`/partners/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create partner');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
          <p className="mt-1 text-sm text-gray-500">
            {filtered.length.toLocaleString()} partner{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isEditor && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Partner
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search partners..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => navigate(`/partners/${row.id}`)}
        emptyTitle="No partners found"
        emptyDescription="Try adjusting your search or filters."
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Partner"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formData.displayName || submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create'}
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
              placeholder="e.g. Samsung Electronics"
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
              placeholder="US, GB, DE"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
