import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, Save } from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import Badge from '../components/shared/Badge';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import type { HardwareTier } from '../lib/types';

const CODEC_OPTIONS = [
  { value: 'avc', label: 'AVC (H.264)' },
  { value: 'hevc', label: 'HEVC (H.265)' },
  { value: 'av1', label: 'AV1' },
  { value: 'vp9', label: 'VP9' },
  { value: 'eac3', label: 'E-AC-3' },
  { value: 'ac4', label: 'AC-4' },
  { value: 'dolbyAtmos', label: 'Dolby Atmos' },
  { value: 'aac', label: 'AAC' },
  { value: 'opus', label: 'Opus' },
];

const CODEC_LABEL_MAP: Record<string, string> = Object.fromEntries(
  CODEC_OPTIONS.map((c) => [c.value, c.label]),
);

interface TierFormData {
  tierName: string;
  tierRank: number;
  ramMin: number | null;
  gpuMin: number | null;
  cpuSpeedMin: number | null;
  cpuCoresMin: number | null;
  requiredCodecs: string[];
  require64Bit: boolean;
}

const emptyForm = (): TierFormData => ({
  tierName: '',
  tierRank: 1,
  ramMin: null,
  gpuMin: null,
  cpuSpeedMin: null,
  cpuCoresMin: null,
  requiredCodecs: [],
  require64Bit: false,
});

interface PreviewResult {
  tierName: string;
  deviceCount: number;
  activeDeviceCount: number;
}

export default function TierConfigPage() {
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<HardwareTier[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TierFormData>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<HardwareTier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult[] | null>(null);

  const loadTiers = async () => {
    try {
      const res = await api.tiers.list();
      setTiers(res.data.sort((a, b) => a.tierRank - b.tierRank));
    } catch {
      setError('Failed to load tier definitions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTiers();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (tier: HardwareTier) => {
    setEditingId(tier.id);
    setForm({
      tierName: tier.tierName,
      tierRank: tier.tierRank,
      ramMin: tier.ramMin,
      gpuMin: tier.gpuMin,
      cpuSpeedMin: tier.cpuSpeedMin,
      cpuCoresMin: tier.cpuCoresMin,
      requiredCodecs: [...tier.requiredCodecs],
      require64Bit: tier.require64Bit,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const validate = (): string | null => {
    if (!form.tierName.trim()) return 'Tier name is required.';
    const rankConflict = tiers.find(
      (t) => t.tierRank === form.tierRank && t.id !== editingId,
    );
    if (rankConflict)
      return `Rank ${form.tierRank} is already used by "${rankConflict.tierName}".`;
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    setFormError(null);

    try {
      if (editingId) {
        await api.tiers.update(editingId, form as Partial<HardwareTier>);
      } else {
        await api.tiers.create(form as Partial<HardwareTier>);
      }
      trackEvent('tier_definition_save', { tier_name: form.tierName });
      setModalOpen(false);
      await loadTiers();
    } catch {
      setFormError('Failed to save tier definition.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.tiers.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadTiers();
    } catch {
      setError('Failed to delete tier.');
    } finally {
      setDeleting(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreview(null);
    try {
      const draftTier: HardwareTier = {
        id: editingTier ?? 'draft',
        tierName: form.tierName,
        tierRank: form.tierRank,
        ramMin: form.ramMin,
        gpuMin: form.gpuMin,
        cpuSpeedMin: form.cpuSpeedMin,
        cpuCoresMin: form.cpuCoresMin,
        requiredCodecs: form.requiredCodecs,
        require64Bit: form.require64Bit,
        version: 0,
        createdAt: '',
        updatedAt: '',
      };

      const previewTiers = editingTier
        ? tiers.map((t) => (t.id === editingTier ? draftTier : t))
        : [...tiers, draftTier];

      const res = await api.tiers.preview(previewTiers);
      const results: PreviewResult[] = Object.values(res).map((entry) => ({
        tierName: entry.tierName,
        deviceCount: entry.count,
        activeDeviceCount: 0,
      }));

      setPreview(results);
      trackEvent('tier_preview', { tier_count: results.length });
    } catch {
      setPreview([]);
    } finally {
      setPreviewing(false);
    }
  };

  const toggleCodec = (codec: string) => {
    setForm((prev) => ({
      ...prev,
      requiredCodecs: prev.requiredCodecs.includes(codec)
        ? prev.requiredCodecs.filter((c) => c !== codec)
        : [...prev.requiredCodecs, codec],
    }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tier Configuration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Define hardware capability tiers and their thresholds
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add Tier
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {tiers.length === 0 ? (
        <EmptyState
          title="No tiers defined"
          description="Create your first hardware tier to start categorizing devices."
          action={
            <button
              onClick={openCreate}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Create First Tier
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{tier.tierName}</h3>
                  <Badge variant="info">Rank {tier.tierRank}</Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {tier.ramMin != null && <span>RAM ≥ {tier.ramMin.toLocaleString()} MB</span>}
                  {tier.gpuMin != null && <span>GPU ≥ {tier.gpuMin.toLocaleString()} MB</span>}
                  {tier.cpuSpeedMin != null && <span>CPU ≥ {tier.cpuSpeedMin.toLocaleString()} MHz</span>}
                  {tier.cpuCoresMin != null && <span>Cores ≥ {tier.cpuCoresMin}</span>}
                  {tier.require64Bit && <span>64-bit</span>}
                  {tier.requiredCodecs.length > 0 && (
                    <span>Codecs: {tier.requiredCodecs.map((c) => CODEC_LABEL_MAP[c] ?? c).join(', ')}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(tier)}
                  className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(tier)}
                  className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Tier' : 'Create Tier'}
        wide
        footer={
          <>
            <button
              onClick={handlePreview}
              disabled={previewing || !form.tierName.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Eye className="h-4 w-4" />
              {previewing ? 'Previewing…' : 'Preview Impact'}
            </button>
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
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
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tier Name *
              </label>
              <input
                type="text"
                value={form.tierName}
                onChange={(e) => setForm((f) => ({ ...f, tierName: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tier Rank * <span className="font-normal text-gray-400">(lower = higher)</span>
              </label>
              <input
                type="number"
                value={form.tierRank}
                min={1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tierRank: parseInt(e.target.value) || 1 }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">RAM Min (MB)</label>
              <input
                type="number"
                value={form.ramMin ?? ''}
                min={0}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    ramMin: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">GPU Min (MB)</label>
              <input
                type="number"
                value={form.gpuMin ?? ''}
                min={0}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    gpuMin: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                CPU Speed Min
              </label>
              <input
                type="number"
                value={form.cpuSpeedMin ?? ''}
                min={0}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cpuSpeedMin: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                CPU Cores Min
              </label>
              <input
                type="number"
                value={form.cpuCoresMin ?? ''}
                min={0}
                step={1}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cpuCoresMin: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Required Codecs / Features
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {CODEC_OPTIONS.map((codec) => (
                <label key={codec.value} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.requiredCodecs.includes(codec.value)}
                    onChange={() => toggleCodec(codec.value)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {codec.label}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.require64Bit}
              onChange={(e) => setForm((f) => ({ ...f, require64Bit: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Require 64-bit
          </label>

          {preview && (
            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-4">
              <h4 className="mb-2 text-sm font-semibold text-indigo-900">
                Preview Impact
              </h4>
              {preview.length === 0 ? (
                <p className="text-sm text-indigo-700">No matching data available.</p>
              ) : (
                <div className="space-y-1 text-sm">
                  {preview.map((p) => (
                    <div
                      key={p.tierName}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-900">{p.tierName}</span>
                      <span className="text-gray-600">
                        {(p.deviceCount ?? 0).toLocaleString()} devices · {(p.activeDeviceCount ?? 0).toLocaleString()} active
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Tier"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Are you sure you want to delete <strong>{deleteTarget?.tierName}</strong>? Devices
          assigned to this tier will become uncategorized.
        </p>
      </Modal>
    </div>
  );
}
