import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, GripVertical, Plus, Search, Trash2, RotateCcw, Pencil } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import { formatDate } from '../lib/format';
import { useImportPrerequisites } from '../hooks/useImportPrerequisites';
import InlineNotice from '../components/shared/InlineNotice';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Modal from '../components/shared/Modal';
import type { FieldOption, FieldOptionKeyInfo } from '../lib/types';

function GettingStartedCard() {
  const prereqs = useImportPrerequisites();
  if (prereqs.loading) return null;
  if (prereqs.fieldOptionsSeeded || prereqs.partnerKeysLoaded || prereqs.devicesRegistered) return null;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
      <h2 className="text-lg font-semibold text-indigo-900">Set up imports in order</h2>
      <p className="mt-1 text-sm text-indigo-700">
        The three Setup Imports below must be completed before ongoing imports will work correctly. Each step takes 2–5 minutes.
      </p>
      <div className="mt-4 flex items-center gap-2 text-sm font-medium text-indigo-800">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold">1</span>
        Reference Data
        <ArrowRight className="h-4 w-4 text-indigo-400" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold">2</span>
        Partner Keys
        <ArrowRight className="h-4 w-4 text-indigo-400" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold">3</span>
        All Models Migration
      </div>
      <Link
        to="/admin/reference-data"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Start with Reference Data
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function SortableOptionRow({
  option,
  onUpdate,
  onDelete,
}: {
  option: FieldOption;
  onUpdate: (id: string, data: Partial<FieldOption>) => void;
  onDelete: (option: FieldOption) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: option.id,
  });
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(option.displayValue);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== option.displayValue) {
      onUpdate(option.id, { displayValue: editValue.trim() });
    }
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        option.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
      }`}
    >
      <button
        type="button"
        className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {editing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSaveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveEdit();
            if (e.key === 'Escape') {
              setEditValue(option.displayValue);
              setEditing(false);
            }
          }}
          autoFocus
          className="flex-1 rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditValue(option.displayValue);
            setEditing(true);
          }}
          className="flex flex-1 items-center gap-1.5 text-left text-sm text-gray-900 hover:text-indigo-600"
        >
          {option.displayValue}
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100" />
        </button>
      )}

      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <input
          type="checkbox"
          checked={option.isOtherTrigger}
          onChange={(e) => onUpdate(option.id, { isOtherTrigger: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
        />
        Other trigger
      </label>

      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <input
          type="checkbox"
          checked={option.isActive}
          onChange={(e) => onUpdate(option.id, { isActive: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
        />
        Active
      </label>

      <button
        type="button"
        onClick={() => onDelete(option)}
        className="text-gray-400 hover:text-red-500"
        title="Soft-delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function OptionEditor({
  dropdownKey,
  onBack,
}: {
  dropdownKey: string;
  onBack: () => void;
}) {
  const [options, setOptions] = useState<FieldOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayLabel, setDisplayLabel] = useState('');
  const [editingLabel, setEditingLabel] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState('');
  const [addingOption, setAddingOption] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FieldOption | null>(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState<number | null>(null);
  const [undoState, setUndoState] = useState<{ options: FieldOption[]; timeout: ReturnType<typeof setTimeout> } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadOptions = useCallback(async () => {
    try {
      const res = await api.fieldOptions.getOptions(dropdownKey);
      const sorted = res.data.sort((a, b) => a.sortOrder - b.sortOrder);
      setOptions(sorted);
      if (sorted.length > 0) setDisplayLabel(sorted[0].displayLabel);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [dropdownKey]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const activeOptions = options.filter((o) => o.isActive);
  const inactiveOptions = options.filter((o) => !o.isActive);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activeOptions.findIndex((o) => o.id === active.id);
    const newIndex = activeOptions.findIndex((o) => o.id === over.id);
    const reordered = arrayMove(activeOptions, oldIndex, newIndex);

    const previousOptions = [...options];
    setOptions([...reordered, ...inactiveOptions]);

    if (undoState) clearTimeout(undoState.timeout);

    const timeout = setTimeout(async () => {
      try {
        await api.fieldOptions.reorder(dropdownKey, reordered.map((o) => o.id));
        setUndoState(null);
        trackEvent('field_option_reorder', { dropdown_key: dropdownKey });
      } catch {
        setOptions(previousOptions);
      }
    }, 5000);

    setUndoState({ options: previousOptions, timeout });
  };

  const handleUndo = () => {
    if (undoState) {
      clearTimeout(undoState.timeout);
      setOptions(undoState.options);
      setUndoState(null);
    }
  };

  const handleUpdateOption = async (id: string, data: Partial<FieldOption>) => {
    try {
      await api.fieldOptions.updateOption(id, data);
      setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...data } : o)));
      trackEvent('field_option_update', { dropdown_key: dropdownKey, option_id: id });
    } catch {
      // handled
    }
  };

  const handleDeleteClick = async (option: FieldOption) => {
    setDeleteTarget(option);
    setDeleteUsageCount(null);
    try {
      const res = await api.fieldOptions.getUsage(option.id);
      setDeleteUsageCount(res.usageCount);
    } catch {
      setDeleteUsageCount(0);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.fieldOptions.deleteOption(deleteTarget.id);
      setOptions((prev) =>
        prev.map((o) => (o.id === deleteTarget.id ? { ...o, isActive: false } : o)),
      );
      trackEvent('field_option_delete', { dropdown_key: dropdownKey, option_id: deleteTarget.id });
    } catch {
      // handled
    }
    setDeleteTarget(null);
  };

  const handleAddOption = async () => {
    if (!newOptionValue.trim()) return;
    try {
      const result = await api.fieldOptions.createOption({
        dropdownKey,
        displayLabel,
        displayValue: newOptionValue.trim(),
        isOtherTrigger: false,
      });
      setOptions((prev) => [...prev, result]);
      setNewOptionValue('');
      setAddingOption(false);
      trackEvent('field_option_create', { dropdown_key: dropdownKey });
    } catch {
      // handled
    }
  };

  const handleSaveLabel = async () => {
    setEditingLabel(false);
    if (options.length > 0 && displayLabel !== options[0].displayLabel) {
      for (const opt of options) {
        await api.fieldOptions.updateOption(opt.id, { displayLabel });
      }
      setOptions((prev) => prev.map((o) => ({ ...o, displayLabel })));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <p className="text-xs font-mono text-gray-400">{dropdownKey}</p>
          {editingLabel ? (
            <input
              type="text"
              value={displayLabel}
              onChange={(e) => setDisplayLabel(e.target.value)}
              onBlur={handleSaveLabel}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel()}
              autoFocus
              className="mt-0.5 rounded border border-indigo-300 px-2 py-1 text-lg font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          ) : (
            <button
              onClick={() => setEditingLabel(true)}
              className="mt-0.5 flex items-center gap-1.5 text-lg font-bold text-gray-900 hover:text-indigo-600"
            >
              {displayLabel || dropdownKey}
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {undoState && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm">
          <span className="text-amber-800">Options reordered. Saving in 5 seconds...</span>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1 font-medium text-amber-700 hover:text-amber-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo
          </button>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Active Options ({activeOptions.length})
        </h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={activeOptions.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {activeOptions.map((option) => (
                <SortableOptionRow
                  key={option.id}
                  option={option}
                  onUpdate={handleUpdateOption}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {addingOption ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddOption();
                if (e.key === 'Escape') {
                  setAddingOption(false);
                  setNewOptionValue('');
                }
              }}
              placeholder="Option value..."
              autoFocus
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleAddOption}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add
            </button>
            <button
              onClick={() => {
                setAddingOption(false);
                setNewOptionValue('');
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingOption(true)}
            className="mt-3 flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add Option
          </button>
        )}
      </div>

      {inactiveOptions.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700">
            Inactive Options ({inactiveOptions.length})
          </summary>
          <div className="space-y-1.5 border-t border-gray-100 p-4">
            {inactiveOptions.map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              >
                <span>{option.displayValue}</span>
                <button
                  onClick={() => handleUpdateOption(option.id, { isActive: true })}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Reactivate
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Deactivate Option"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {deleteUsageCount === null ? (
              'Checking usage...'
            ) : deleteUsageCount > 0 ? (
              <>
                <strong>{deleteUsageCount}</strong> device record{deleteUsageCount !== 1 ? 's' : ''} use
                the value &ldquo;{deleteTarget?.displayValue}&rdquo;. Deactivating will hide this option
                from future dropdowns. Existing records are not affected.
              </>
            ) : (
              <>
                No device records use &ldquo;{deleteTarget?.displayValue}&rdquo;. It will be hidden
                from future dropdowns.
              </>
            )}
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleteUsageCount === null}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Deactivate
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function ReferenceDataPage() {
  const [keys, setKeys] = useState<FieldOptionKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedNotice, setSeedNotice] = useState<{
    severity: 'error' | 'success';
    message: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.fieldOptions.listKeys();
        setKeys(res.data);
      } catch {
        // handled
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedKey]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedNotice(null);
    try {
      const result = await api.fieldOptions.seed();
      setSeedNotice({
        severity: 'success',
        message: `Seed complete: ${result.created} created, ${result.skipped} skipped.`,
      });
      try {
        const res = await api.fieldOptions.listKeys();
        setKeys(res.data);
      } catch {
        // Index may still be building — reload the page after a moment
      }
    } catch {
      setSeedNotice({
        severity: 'error',
        message: 'Failed to seed field options.',
      });
    } finally {
      setSeeding(false);
    }
  };

  if (selectedKey) {
    return (
      <OptionEditor
        dropdownKey={selectedKey}
        onBack={() => setSelectedKey(null)}
      />
    );
  }

  const filteredKeys = keys.filter(
    (k) =>
      k.dropdownKey.toLowerCase().includes(search.toLowerCase()) ||
      k.displayLabel.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <GettingStartedCard />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reference Data</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage dropdown options for questionnaire fields
          </p>
        </div>
        {keys.length === 0 && (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {seeding ? 'Seeding...' : 'Seed Default Options'}
          </button>
        )}
      </div>

      {seedNotice && (
        <InlineNotice
          severity={seedNotice.severity}
          message={seedNotice.message}
        />
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search dropdown keys or labels..."
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Dropdown Key
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Field Label
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                Options
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                Active
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredKeys.map((key) => (
              <tr
                key={key.dropdownKey}
                onClick={() => setSelectedKey(key.dropdownKey)}
                className="cursor-pointer hover:bg-indigo-50"
              >
                <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-gray-900">
                  {key.dropdownKey}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{key.displayLabel}</td>
                <td className="px-4 py-3 text-center text-sm text-gray-600">{key.optionCount}</td>
                <td className="px-4 py-3 text-center text-sm text-gray-600">{key.activeCount}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-400">
                  {formatDate(key.updatedAt ?? null)}
                </td>
              </tr>
            ))}
            {filteredKeys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                  {search ? 'No matching dropdown keys found.' : 'No dropdown keys configured yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
