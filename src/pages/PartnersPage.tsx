import { useState, useMemo } from 'react';
import { usePartners, useDevices, createPartner, updatePartnerById, deletePartnerById } from '../lib/hooks';
import { logEvent } from '../lib/firebase';
import type { Partner, PartnerStatus } from '../lib/types';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Building2, Users } from 'lucide-react';

const PARTNER_STATUSES: PartnerStatus[] = ['Current', 'Sold', 'Discontinued', 'Spun off'];

const STATUS_COLORS: Record<PartnerStatus, string> = {
  Current: 'bg-green-50 text-green-700 border-green-200',
  Sold: 'bg-red-50 text-red-700 border-red-200',
  Discontinued: 'bg-amber-50 text-amber-700 border-amber-200',
  'Spun off': 'bg-blue-50 text-blue-700 border-blue-200',
};

const COUNTRY_REGION_MAP: Record<string, string> = {
  'United States': 'DOMESTIC',
  'Canada': 'DOMESTIC',
  'Mexico': 'LATAM',
  'Brazil': 'LATAM',
  'Argentina': 'LATAM',
  'Colombia': 'LATAM',
  'Chile': 'LATAM',
  'Peru': 'LATAM',
  'United Kingdom': 'EMEA',
  'Germany': 'EMEA',
  'France': 'EMEA',
  'Italy': 'EMEA',
  'Spain': 'EMEA',
  'Netherlands': 'EMEA',
  'Belgium': 'EMEA',
  'Sweden': 'EMEA',
  'Norway': 'EMEA',
  'Denmark': 'EMEA',
  'Finland': 'EMEA',
  'Poland': 'EMEA',
  'Switzerland': 'EMEA',
  'Austria': 'EMEA',
  'Portugal': 'EMEA',
  'Ireland': 'EMEA',
  'Turkey': 'EMEA',
  'South Africa': 'EMEA',
  'Nigeria': 'EMEA',
  'Kenya': 'EMEA',
  'Egypt': 'EMEA',
  'Israel': 'EMEA',
  'Saudi Arabia': 'EMEA',
  'UAE': 'EMEA',
  'Japan': 'APAC',
  'South Korea': 'APAC',
  'China': 'APAC',
  'India': 'APAC',
  'Australia': 'APAC',
  'New Zealand': 'APAC',
  'Singapore': 'APAC',
  'Malaysia': 'APAC',
  'Thailand': 'APAC',
  'Indonesia': 'APAC',
  'Philippines': 'APAC',
  'Vietnam': 'APAC',
  'Taiwan': 'APAC',
  'Hong Kong': 'APAC',
  'Global': 'GLOBAL',
};

const COUNTRIES = Object.keys(COUNTRY_REGION_MAP).sort();

interface PartnerTreeNode {
  partner: Partner;
  children: PartnerTreeNode[];
}

function buildTree(partners: Partner[]): PartnerTreeNode[] {
  const map = new Map<string, PartnerTreeNode>();
  for (const p of partners) {
    map.set(p.id, { partner: p, children: [] });
  }

  const roots: PartnerTreeNode[] = [];
  for (const node of map.values()) {
    if (node.partner.parentId && map.has(node.partner.parentId)) {
      map.get(node.partner.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: PartnerTreeNode[]) => {
    nodes.sort((a, b) => a.partner.name.localeCompare(b.partner.name));
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);

  return roots;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}


interface AddPartnerFormState {
  name: string;
  parentId: string | null;
  country: string | null;
  region: string | null;
  entityType: string;
  serviceType: string;
  status: PartnerStatus;
  notes: string;
}

const emptyForm: AddPartnerFormState = {
  name: '',
  parentId: null,
  country: null,
  region: null,
  entityType: '',
  serviceType: '',
  status: 'Current',
  notes: '',
};

interface EditState {
  name: string;
  country: string | null;
  entityType: string;
  serviceType: string;
  status: PartnerStatus;
  notes: string;
}

export function PartnersPage() {
  const { partners, loading: partnersLoading } = usePartners();
  const { devices, loading: devicesLoading } = useDevices();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddPartnerFormState>(emptyForm);
  const [addSaving, setAddSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tree = useMemo(() => buildTree(partners), [partners]);

  const deviceCountByOperator = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of devices) {
      const op = d.operator;
      counts.set(op, (counts.get(op) || 0) + 1);
    }
    return counts;
  }, [devices]);

  const childCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of partners) {
      if (p.parentId) {
        counts.set(p.parentId, (counts.get(p.parentId) || 0) + 1);
      }
    }
    return counts;
  }, [partners]);

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function startEdit(partner: Partner) {
    setEditingId(partner.id);
    setEditState({
      name: partner.name,
      country: partner.country,
      entityType: partner.entityType,
      serviceType: partner.serviceType,
      status: partner.status,
      notes: partner.notes,
    });
    logEvent('partner_edit_start', { partner_id: partner.id });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  async function saveEdit() {
    if (!editingId || !editState) return;
    setSaving(true);
    try {
      await updatePartnerById(editingId, {
        name: editState.name,
        country: editState.country,
        entityType: editState.entityType,
        serviceType: editState.serviceType,
        status: editState.status,
        notes: editState.notes,
      });
      logEvent('partner_updated', { partner_id: editingId });
      setEditingId(null);
      setEditState(null);
    } catch (err) {
      console.error('Error updating partner:', err);
    } finally {
      setSaving(false);
    }
  }

  function openAddModal(preSelectedParentId?: string) {
    setAddForm({
      ...emptyForm,
      parentId: preSelectedParentId ?? null,
    });
    setShowAddModal(true);
  }

  function handleAddCountryChange(country: string) {
    const region = country ? (COUNTRY_REGION_MAP[country] || null) : null;
    setAddForm(prev => ({ ...prev, country: country || null, region }));
  }

  async function handleAddSubmit() {
    if (!addForm.name.trim()) return;
    setAddSaving(true);
    try {
      const id = slugify(addForm.name);
      await createPartner({
        name: addForm.name.trim(),
        parentId: addForm.parentId,
        country: addForm.country,
        region: addForm.region,
        entityType: addForm.entityType,
        serviceType: addForm.serviceType,
        status: addForm.status,
        notes: addForm.notes,
      });
      logEvent('partner_created', { partner_id: id, name: addForm.name });
      setShowAddModal(false);
      setAddForm(emptyForm);
    } catch (err) {
      console.error('Error creating partner:', err);
    } finally {
      setAddSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePartnerById(deleteTarget.id);
      logEvent('partner_deleted', { partner_id: deleteTarget.id, name: deleteTarget.name });
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting partner:', err);
    } finally {
      setDeleting(false);
    }
  }

  function renderPartnerRow(node: PartnerTreeNode, depth: number) {
    const { partner, children } = node;
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(partner.id);
    const isEditing = editingId === partner.id;
    const deviceCount = deviceCountByOperator.get(partner.name) || 0;
    const hasChildPartners = (childCountMap.get(partner.id) || 0) > 0;

    return (
      <div key={partner.id}>
        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 transition-colors group"
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          {/* Expand/collapse chevron */}
          <button
            onClick={() => hasChildren && toggleExpand(partner.id)}
            className={`w-5 h-5 flex items-center justify-center shrink-0 ${hasChildren ? 'text-slate-400 hover:text-slate-600' : 'text-transparent'}`}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            ) : (
              <span className="w-4" />
            )}
          </button>

          {isEditing && editState ? (
            /* Inline edit form */
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={editState.name}
                onChange={e => setEditState(prev => prev ? { ...prev, name: e.target.value } : prev)}
                className="px-2 py-1 text-sm border border-slate-300 rounded-md w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Name"
              />
              <input
                type="text"
                value={editState.country || ''}
                onChange={e => setEditState(prev => prev ? { ...prev, country: e.target.value || null } : prev)}
                className="px-2 py-1 text-sm border border-slate-300 rounded-md w-28 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Country"
              />
              <input
                type="text"
                value={editState.entityType}
                onChange={e => setEditState(prev => prev ? { ...prev, entityType: e.target.value } : prev)}
                className="px-2 py-1 text-sm border border-slate-300 rounded-md w-28 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Entity type"
              />
              <input
                type="text"
                value={editState.serviceType}
                onChange={e => setEditState(prev => prev ? { ...prev, serviceType: e.target.value } : prev)}
                className="px-2 py-1 text-sm border border-slate-300 rounded-md w-28 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Service type"
              />
              <select
                value={editState.status}
                onChange={e => setEditState(prev => prev ? { ...prev, status: e.target.value as PartnerStatus } : prev)}
                className="px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {PARTNER_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="text"
                value={editState.notes}
                onChange={e => setEditState(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                className="px-2 py-1 text-sm border border-slate-300 rounded-md w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Notes"
              />
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded-md shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            /* Display row */
            <>
              <button
                onClick={() => hasChildren && toggleExpand(partner.id)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left"
              >
                <Building2 size={16} className="text-slate-400 shrink-0" />
                <span className="font-medium text-slate-800 text-sm truncate">{partner.name}</span>
              </button>

              {partner.country && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                  {partner.country}
                </span>
              )}

              {partner.entityType && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 shrink-0">
                  {partner.entityType}
                </span>
              )}

              {partner.serviceType && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500 shrink-0">
                  {partner.serviceType}
                </span>
              )}

              <span className={`px-2 py-0.5 text-xs rounded-full border shrink-0 ${STATUS_COLORS[partner.status]}`}>
                {partner.status}
              </span>

              {deviceCount > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-50 text-purple-600 border border-purple-100 shrink-0 flex items-center gap-1">
                  <Users size={12} />
                  {deviceCount} {deviceCount === 1 ? 'device' : 'devices'}
                </span>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto">
                <button
                  onClick={() => startEdit(partner)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Edit partner"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => {
                    if (!hasChildPartners) setDeleteTarget(partner);
                  }}
                  disabled={hasChildPartners}
                  className={`p-1.5 rounded-md transition-colors ${
                    hasChildPartners
                      ? 'text-slate-200 cursor-not-allowed'
                      : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title={hasChildPartners ? 'Cannot delete: has child partners' : 'Delete partner'}
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => openAddModal(partner.id)}
                  className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                  title="Add child partner"
                >
                  <Plus size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderPartnerRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const loading = partnersLoading || devicesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Loading partners...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Partners</h1>
        <button
          onClick={() => openAddModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Add Partner
        </button>
      </div>

      {/* Tree view card */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="w-5 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-1">Partner</span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-48 text-right">Details</span>
        </div>

        {/* Tree rows */}
        {tree.length > 0 ? (
          tree.map(node => renderPartnerRow(node, 0))
        ) : (
          <div className="p-8 text-center text-slate-400">
            No partners found. Add one to get started.
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-3">{partners.length} {partners.length === 1 ? 'partner' : 'partners'} total</p>

      {/* Add Partner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Partner</h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">Name</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Partner name"
                  autoFocus
                />
              </div>

              {/* Parent */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">Parent Partner</label>
                <select
                  value={addForm.parentId || ''}
                  onChange={e => setAddForm(prev => ({ ...prev, parentId: e.target.value || null }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">None (top-level)</option>
                  {partners
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
              </div>

              {/* Country & Region */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Country</label>
                  <select
                    value={addForm.country || ''}
                    onChange={e => handleAddCountryChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Region</label>
                  <input
                    type="text"
                    value={addForm.region || ''}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                    placeholder="Auto-populated"
                  />
                </div>
              </div>

              {/* Entity Type & Service Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Entity Type</label>
                  <input
                    type="text"
                    value={addForm.entityType}
                    onChange={e => setAddForm(prev => ({ ...prev, entityType: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Operator, Broadcaster"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Service Type</label>
                  <input
                    type="text"
                    value={addForm.serviceType}
                    onChange={e => setAddForm(prev => ({ ...prev, serviceType: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Pay TV, IPTV, OTT"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">Status</label>
                <select
                  value={addForm.status}
                  onChange={e => setAddForm(prev => ({ ...prev, status: e.target.value as PartnerStatus }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PARTNER_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">Notes</label>
                <textarea
                  value={addForm.notes}
                  onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddForm(emptyForm);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubmit}
                disabled={addSaving || !addForm.name.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addSaving ? 'Adding...' : 'Add Partner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Partner</h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
