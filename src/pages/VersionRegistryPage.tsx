import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Database,
} from 'lucide-react';
import { api } from '../lib/api';
import Badge from '../components/shared/Badge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Modal from '../components/shared/Modal';
import type { CoreVersionMapping, UnmappedVersion, VersionPlatform } from '../lib/types';

function detectPlatform(coreVersion: string): VersionPlatform {
  if (/^dev\+/i.test(coreVersion)) return 'DEV';
  if (/^\d{4}\.\d+/.test(coreVersion)) return 'NCP';
  if (/^\d+\.\d+/.test(coreVersion)) return 'ADK';
  return 'UNKNOWN';
}

const PLATFORM_BADGE: Record<VersionPlatform, 'info' | 'success' | 'warning' | 'default'> = {
  NCP: 'info',
  ADK: 'success',
  DEV: 'warning',
  UNKNOWN: 'default',
};

export default function VersionRegistryPage() {
  const [mappings, setMappings] = useState<CoreVersionMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('true');

  const [addOpen, setAddOpen] = useState(false);
  const [addCoreVersion, setAddCoreVersion] = useState('');
  const [addFriendlyVersion, setAddFriendlyVersion] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editFriendly, setEditFriendly] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [deactivateModal, setDeactivateModal] = useState<CoreVersionMapping | null>(null);
  const [deactivateUsage, setDeactivateUsage] = useState<number | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const [editConfirmModal, setEditConfirmModal] = useState<{ id: string; friendlyVersion: string; notes: string; usageCount: number } | null>(null);

  const [unmapped, setUnmapped] = useState<UnmappedVersion[]>([]);
  const [unmappedOpen, setUnmappedOpen] = useState(false);
  const [unmappedLoading, setUnmappedLoading] = useState(false);

  const [friendlyVersionSuggestions, setFriendlyVersionSuggestions] = useState<string[]>([]);

  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ created: number; skipped: number } | null>(null);

  const loadMappings = useCallback(async () => {
    try {
      const res = await api.versionMappings.list({ platform: platformFilter, active: activeFilter });
      setMappings(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [platformFilter, activeFilter]);

  useEffect(() => {
    setLoading(true);
    loadMappings();
  }, [loadMappings]);

  useEffect(() => {
    api.versionMappings.friendlyVersions().then(res => setFriendlyVersionSuggestions(res.data)).catch(() => {});
  }, [mappings]);

  const detectedPlatform = useMemo(() => {
    if (!addCoreVersion.trim()) return null;
    return detectPlatform(addCoreVersion.trim());
  }, [addCoreVersion]);

  const filteredSuggestions = useMemo(() => {
    if (!addFriendlyVersion.trim()) return [];
    const q = addFriendlyVersion.toLowerCase();
    return friendlyVersionSuggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
  }, [addFriendlyVersion, friendlyVersionSuggestions]);

  const handleAdd = useCallback(async () => {
    if (!addCoreVersion.trim() || !addFriendlyVersion.trim()) return;
    setAddSaving(true);
    setAddError(null);
    try {
      await api.versionMappings.create({
        coreVersion: addCoreVersion.trim(),
        friendlyVersion: addFriendlyVersion.trim(),
        notes: addNotes.trim() || undefined,
      });
      setAddOpen(false);
      setAddCoreVersion('');
      setAddFriendlyVersion('');
      setAddNotes('');
      loadMappings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAddError(msg);
    } finally {
      setAddSaving(false);
    }
  }, [addCoreVersion, addFriendlyVersion, addNotes, loadMappings]);

  const startEdit = (m: CoreVersionMapping) => {
    setEditId(m.id);
    setEditFriendly(m.friendlyVersion);
    setEditNotes(m.notes ?? '');
  };

  const handleEditSave = useCallback(async (mapping: CoreVersionMapping) => {
    if (!editFriendly.trim()) return;
    const friendlyChanged = editFriendly.trim() !== mapping.friendlyVersion;

    if (friendlyChanged) {
      try {
        const usage = await api.versionMappings.usage(mapping.id);
        setEditConfirmModal({
          id: mapping.id,
          friendlyVersion: editFriendly.trim(),
          notes: editNotes,
          usageCount: usage.usageCount,
        });
      } catch {
        setEditConfirmModal({
          id: mapping.id,
          friendlyVersion: editFriendly.trim(),
          notes: editNotes,
          usageCount: 0,
        });
      }
      return;
    }

    setEditSaving(true);
    try {
      await api.versionMappings.update(mapping.id, {
        friendlyVersion: editFriendly.trim(),
        notes: editNotes.trim() || undefined,
      });
      setEditId(null);
      loadMappings();
    } catch {
      // silent
    } finally {
      setEditSaving(false);
    }
  }, [editFriendly, editNotes, loadMappings]);

  const confirmEdit = useCallback(async () => {
    if (!editConfirmModal) return;
    setEditSaving(true);
    try {
      await api.versionMappings.update(editConfirmModal.id, {
        friendlyVersion: editConfirmModal.friendlyVersion,
        notes: editConfirmModal.notes.trim() || undefined,
      });
      setEditConfirmModal(null);
      setEditId(null);
      loadMappings();
    } catch {
      // silent
    } finally {
      setEditSaving(false);
    }
  }, [editConfirmModal, loadMappings]);

  const handleDeactivateCheck = useCallback(async (m: CoreVersionMapping) => {
    setDeactivateModal(m);
    setDeactivateUsage(null);
    try {
      const usage = await api.versionMappings.usage(m.id);
      setDeactivateUsage(usage.usageCount);
    } catch {
      setDeactivateUsage(0);
    }
  }, []);

  const handleDeactivate = useCallback(async () => {
    if (!deactivateModal) return;
    setDeactivateLoading(true);
    try {
      await api.versionMappings.update(deactivateModal.id, { isActive: false });
      setDeactivateModal(null);
      loadMappings();
    } catch {
      // silent
    } finally {
      setDeactivateLoading(false);
    }
  }, [deactivateModal, loadMappings]);

  const handleReactivate = useCallback(async (id: string) => {
    try {
      await api.versionMappings.update(id, { isActive: true });
      loadMappings();
    } catch {
      // silent
    }
  }, [loadMappings]);

  const loadUnmapped = useCallback(async () => {
    setUnmappedLoading(true);
    try {
      const res = await api.versionMappings.unmapped();
      setUnmapped(res.data);
    } catch {
      // silent
    } finally {
      setUnmappedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unmappedOpen) loadUnmapped();
  }, [unmappedOpen, loadUnmapped]);

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const result = await api.versionMappings.seed();
      setSeedResult(result);
      loadMappings();
      if (unmappedOpen) loadUnmapped();
    } catch {
      // silent
    } finally {
      setSeeding(false);
    }
  }, [loadMappings, unmappedOpen, loadUnmapped]);

  const prefillFromUnmapped = (cv: string) => {
    setAddCoreVersion(cv);
    setAddFriendlyVersion('');
    setAddNotes('');
    setAddError(null);
    setAddOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Version Registry</h1>
          <p className="mt-1 text-sm text-gray-500">
            Map internal core version build strings to human-readable friendly version labels
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mappings.length === 0 && !loading && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {seeding ? <LoadingSpinner className="h-4 w-4" /> : <Database className="h-4 w-4" />}
              Seed Defaults
            </button>
          )}
          <button
            onClick={() => { setAddOpen(true); setAddError(null); }}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add Mapping
          </button>
        </div>
      </div>

      {seedResult && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Seeded {seedResult.created} mappings ({seedResult.skipped} already existed).
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Platform</label>
          <select
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All</option>
            <option value="NCP">NCP</option>
            <option value="ADK">ADK</option>
            <option value="DEV">DEV</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      {/* Add Mapping Form */}
      {addOpen && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">New Mapping</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Core Version *</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={addCoreVersion}
                  onChange={e => setAddCoreVersion(e.target.value)}
                  placeholder="e.g. 42.16+17f4b8d.1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                {detectedPlatform && (
                  <Badge variant={PLATFORM_BADGE[detectedPlatform]}>{detectedPlatform}</Badge>
                )}
              </div>
            </div>
            <div className="relative">
              <label className="mb-1 block text-xs font-medium text-gray-600">Friendly Version *</label>
              <input
                type="text"
                value={addFriendlyVersion}
                onChange={e => setAddFriendlyVersion(e.target.value)}
                placeholder="e.g. ADK 3.1.1"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {filteredSuggestions.length > 0 && addFriendlyVersion.trim() && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                  {filteredSuggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => setAddFriendlyVersion(s)}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
              <input
                type="text"
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                placeholder="Optional context"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          {addError && (
            <p className="text-sm text-red-600">{addError}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={addSaving || !addCoreVersion.trim() || !addFriendlyVersion.trim()}
              className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {addSaving ? <LoadingSpinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              Save
            </button>
            <button
              onClick={() => setAddOpen(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Registry Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : mappings.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No version mappings found. Click "Seed Defaults" to populate the initial 17 mappings.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Platform</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Core Version</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Friendly Version</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Active</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mappings.map(m => {
                  const isEditing = editId === m.id;
                  return (
                    <tr key={m.id} className={!m.isActive ? 'bg-gray-50 opacity-60' : ''}>
                      <td className="px-4 py-2.5">
                        <Badge variant={PLATFORM_BADGE[m.platform]}>{m.platform}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-gray-900">{m.coreVersion}</td>
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editFriendly}
                            onChange={e => setEditFriendly(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">{m.friendlyVersion}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        ) : (
                          <span className="text-sm text-gray-500">{m.notes || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={m.isActive ? 'success' : 'default'}>
                          {m.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                        {new Date(m.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditSave(m)}
                              disabled={editSaving}
                              className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                            >
                              {editSaving ? <LoadingSpinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </button>
                            <button onClick={() => setEditId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => startEdit(m)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-600">
                              <Pencil className="h-4 w-4" />
                            </button>
                            {m.isActive ? (
                              <button onClick={() => handleDeactivateCheck(m)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600">
                                <X className="h-4 w-4" />
                              </button>
                            ) : (
                              <button onClick={() => handleReactivate(m.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-emerald-600">
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unmapped Versions */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <button
          onClick={() => setUnmappedOpen(!unmappedOpen)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">Unmapped Versions</h3>
            {unmapped.length > 0 && (
              <Badge variant="warning">{unmapped.length}</Badge>
            )}
          </div>
          {unmappedOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </button>
        {unmappedOpen && (
          <div className="border-t border-gray-200 px-6 py-4">
            {unmappedLoading ? (
              <LoadingSpinner />
            ) : unmapped.length === 0 ? (
              <p className="text-sm text-gray-500">All versions in telemetry and device records have active mappings.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Core Version</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Platform</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Source</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Devices</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Partners</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">First Seen</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unmapped.map(u => (
                      <tr key={u.coreVersion}>
                        <td className="whitespace-nowrap px-4 py-2 font-mono text-sm text-gray-900">{u.coreVersion}</td>
                        <td className="px-4 py-2">
                          <Badge variant={PLATFORM_BADGE[u.platform]}>{u.platform}</Badge>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(u.sources ?? []).map(s => (
                              <Badge key={s} variant={s === 'Telemetry' ? 'info' : s === 'Questionnaire' ? 'success' : 'default'}>{s}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700">{u.deviceCount}</td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700">{u.partnerCount}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{u.firstSeen ?? '—'}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => prefillFromUnmapped(u.coreVersion)}
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            <Plus className="h-3 w-3" /> Add Mapping
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deactivate Modal */}
      <Modal
        open={!!deactivateModal}
        onClose={() => setDeactivateModal(null)}
        title="Deactivate Mapping"
        footer={
          <>
            <button onClick={() => setDeactivateModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleDeactivate} disabled={deactivateLoading} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {deactivateLoading && <LoadingSpinner className="h-4 w-4" />}
              Deactivate
            </button>
          </>
        }
      >
        {deactivateModal && (
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              {deactivateUsage === null ? 'Checking usage...' : `${deactivateUsage} device record(s) are currently on this build.`}
            </p>
            <p>Deactivating will not remove their friendly version label, but this build string will no longer resolve on future uploads.</p>
            <div className="rounded-lg bg-gray-50 p-3 font-mono text-xs">{deactivateModal.coreVersion} → {deactivateModal.friendlyVersion}</div>
          </div>
        )}
      </Modal>

      {/* Edit Confirm Modal */}
      <Modal
        open={!!editConfirmModal}
        onClose={() => setEditConfirmModal(null)}
        title="Confirm Edit"
        footer={
          <>
            <button onClick={() => setEditConfirmModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={confirmEdit} disabled={editSaving} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {editSaving && <LoadingSpinner className="h-4 w-4" />}
              Continue
            </button>
          </>
        }
      >
        {editConfirmModal && (
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              This will also update the friendly version displayed for <span className="font-semibold">{editConfirmModal.usageCount}</span> device record(s) currently on this build.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
