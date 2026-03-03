import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { ChevronDown, ChevronRight, Save, X, Upload, LinkIcon, Pencil, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import { useAuth } from '../hooks/useAuth';
import { FieldOptionsProvider, useFieldOptions } from '../hooks/useFieldOptions';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Modal from '../components/shared/Modal';
import {
  TextInput,
  NumberInputWithUnit,
  DropdownInput,
  DateInput,
  DateOrTextInput,
  CodecGrid,
  SecurityChecklist,
} from '../components/specs/SpecFormFields';
import { QUESTIONNAIRE_SECTIONS, buildEmptySpec } from '../lib/questionnaireFields';
import type { QuestionnaireFieldDef, QuestionnaireSectionDef } from '../lib/questionnaireFields';
import type { DeviceSpec, SpecCategory } from '../lib/types';

function countFilledFields(obj: Record<string, unknown>): number {
  return Object.values(obj).filter((v) => v !== null && v !== undefined && v !== '').length;
}

function SpecSection({
  section,
  data,
  allFormData,
  onChange,
  defaultOpen,
}: {
  section: QuestionnaireSectionDef;
  data: Record<string, unknown>;
  allFormData: Record<string, Record<string, unknown>>;
  onChange: (section: SpecCategory, key: string, value: unknown) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { getActiveOptions, isOtherTrigger } = useFieldOptions();
  const { isAdmin } = useAuth();

  const filled = countFilledFields(data);
  const total = section.fields.length;

  const isFieldVisible = useCallback(
    (field: QuestionnaireFieldDef): boolean => {
      if (field.parentField) {
        const parentValue = data[field.parentField] as string | null;
        if (!parentValue) return false;
        const parentDef = section.fields.find((f) => f.key === field.parentField);
        if (parentDef?.dropdownKey) {
          return isOtherTrigger(parentDef.dropdownKey, parentValue);
        }
        return parentValue === 'Yes';
      }
      if (field.conditionalOn) {
        const { section: condSection, field: condField, operator, value } = field.conditionalOn;
        const condSectionData = allFormData[condSection] as Record<string, unknown> | undefined;
        const condValue = condSectionData?.[condField] as string | null;
        if (!condValue) return false;
        if (operator === 'notEquals') return condValue !== value;
        if (operator === 'equals') return condValue === value;
      }
      return true;
    },
    [data, allFormData, section.fields, isOtherTrigger],
  );

  const compactGridFields = section.fields.filter((f) => f.compactGrid && f.dropdownKey);
  const checklistFields = compactGridFields.length > 0 && section.key === 'contentProtection'
    ? section.fields.filter((f) => f.compactGrid)
    : [];
  const codecGridFields = compactGridFields.length > 0 && section.key === 'mediaCodec'
    ? section.fields.filter((f) => f.compactGrid)
    : [];
  const regularFields = section.fields.filter((f) => !f.compactGrid);

  const handleFieldChange = (key: string, value: unknown) => {
    onChange(section.key, key, value);
    const field = section.fields.find((f) => f.key === key);
    if (field?.dropdownKey) {
      const childFields = section.fields.filter((f) => f.parentField === key);
      for (const child of childFields) {
        if (!isOtherTrigger(field.dropdownKey, value as string | null)) {
          onChange(section.key, child.key, null);
        }
      }
    }
  };

  const renderField = (field: QuestionnaireFieldDef) => {
    if (!isFieldVisible(field)) return null;
    const val = data[field.key];

    switch (field.type) {
      case 'text':
        return (
          <TextInput
            key={field.key}
            label={field.label}
            value={val as string | null}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        );
      case 'number':
        if (field.unit) {
          return (
            <NumberInputWithUnit
              key={field.key}
              label={field.label}
              value={val as number | null}
              onChange={(v) => handleFieldChange(field.key, v)}
              unit={field.unit}
            />
          );
        }
        return (
          <NumberInputWithUnit
            key={field.key}
            label={field.label}
            value={val as number | null}
            onChange={(v) => handleFieldChange(field.key, v)}
            unit=""
          />
        );
      case 'dropdown':
        if (!field.dropdownKey) return null;
        return (
          <div key={field.key}>
            <div className="flex items-center gap-1.5">
              <DropdownInput
                label={field.label}
                value={val as string | null}
                onChange={(v) => handleFieldChange(field.key, v)}
                fieldOptions={getActiveOptions(field.dropdownKey)}
              />
              {isAdmin && (
                <a
                  href={`/admin/reference-data`}
                  className="mt-5 text-gray-400 hover:text-indigo-600"
                  title={`Edit ${field.dropdownKey} options`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        );
      case 'date':
        return (
          <DateInput
            key={field.key}
            label={field.label}
            value={val as string | null}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        );
      case 'dateOrText':
        return (
          <DateOrTextInput
            key={field.key}
            label={field.label}
            value={val as string | null}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        );
      default:
        return null;
    }
  };

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
          <h3 className="text-sm font-semibold text-gray-900">
            {section.number}. {section.title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium ${
              filled === total
                ? 'text-emerald-600'
                : filled > 0
                  ? 'text-amber-600'
                  : 'text-gray-400'
            }`}
          >
            {filled}/{total} fields
          </span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all ${
                filled === total
                  ? 'bg-emerald-500'
                  : filled > 0
                    ? 'bg-amber-500'
                    : 'bg-gray-300'
              }`}
              style={{ width: `${total ? (filled / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-6">
          {codecGridFields.length > 0 && (
            <CodecGrid
              fields={codecGridFields}
              data={data}
              fieldOptions={getActiveOptions(codecGridFields[0].dropdownKey!)}
              onChange={(key, value) => handleFieldChange(key, value)}
            />
          )}

          {checklistFields.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {regularFields
                  .filter((f) => !f.compactGrid)
                  .slice(0, regularFields.findIndex((f) => f.fieldId === '6.15'))
                  .map(renderField)}
              </div>
              <SecurityChecklist
                fields={checklistFields}
                data={data}
                fieldOptions={getActiveOptions(checklistFields[0].dropdownKey!)}
                onChange={(key, value) => handleFieldChange(key, value)}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {regularFields
                  .filter(
                    (f) =>
                      !f.compactGrid &&
                      regularFields.indexOf(f) >=
                        regularFields.findIndex((rf) => rf.fieldId === '6.22'),
                  )
                  .map(renderField)}
              </div>
            </>
          )}

          {codecGridFields.length === 0 && checklistFields.length === 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {regularFields.map(renderField)}
            </div>
          )}

          {codecGridFields.length > 0 && checklistFields.length === 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {regularFields.filter((f) => !f.compactGrid).map(renderField)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpecEditForm() {
  const { id: deviceId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [formData, setFormData] = useState<Record<string, Record<string, unknown>>>(buildEmptySpec());
  const [questionnaireUrl, setQuestionnaireUrl] = useState('');
  const [questionnaireFile, setQuestionnaireFile] = useState<File | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const initialData = useRef<string>('');

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setShowLeaveModal(true);
    }
  }, [blocker.state]);

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
          const merged: Record<string, Record<string, unknown>> = { ...buildEmptySpec() };
          for (const sectionKey of Object.keys(merged)) {
            const section = (rest as Record<string, unknown>)[sectionKey];
            if (section && typeof section === 'object') {
              merged[sectionKey] = {
                ...merged[sectionKey],
                ...(section as Record<string, unknown>),
              };
            }
          }
          setFormData(merged);
          initialData.current = JSON.stringify(merged);
        } else {
          initialData.current = JSON.stringify(buildEmptySpec());
        }
      } catch {
        setError('Failed to load device specifications.');
      } finally {
        setLoading(false);
      }
    })();
  }, [deviceId]);

  const handleFieldChange = useCallback(
    (section: SpecCategory, key: string, value: unknown) => {
      setFormData((prev) => {
        const updated = {
          ...prev,
          [section]: { ...prev[section], [key]: value },
        };
        setIsDirty(JSON.stringify(updated) !== initialData.current);
        return updated;
      });
    },
    [],
  );

  const { filledTotal, totalFields, completionPct } = useMemo(() => {
    let filled = 0;
    let total = 0;
    for (const section of QUESTIONNAIRE_SECTIONS) {
      const catData = formData[section.key] ?? {};
      total += section.fields.length;
      filled += countFilledFields(catData);
    }
    return {
      filledTotal: filled,
      totalFields: total,
      completionPct: total ? Math.round((filled / total) * 100) : 0,
    };
  }, [formData]);

  const handleSave = async () => {
    if (!deviceId) return;
    setSaving(true);
    setError(null);

    try {
      await api.deviceSpecs.save(deviceId, formData as unknown as Partial<DeviceSpec>);

      if (questionnaireUrl || questionnaireFile) {
        await api.devices.update(deviceId, { questionnaireUrl: questionnaireUrl || null } as Record<string, unknown>);
      }

      setIsDirty(false);
      initialData.current = JSON.stringify(formData);
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
      {isDirty && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          You have unsaved changes. Save before navigating away.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">STB Questionnaire</h1>
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
            className={`h-full rounded-full transition-all ${
              completionPct === 100
                ? 'bg-emerald-500'
                : completionPct > 50
                  ? 'bg-indigo-500'
                  : completionPct > 0
                    ? 'bg-amber-500'
                    : 'bg-gray-300'
            }`}
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
        {QUESTIONNAIRE_SECTIONS.map((section) => {
          const catData = (formData[section.key] ?? {}) as Record<string, unknown>;
          const hasData = countFilledFields(catData) > 0;
          return (
            <SpecSection
              key={section.key}
              section={section}
              data={catData}
              allFormData={formData}
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

      <Modal
        open={showLeaveModal}
        onClose={() => {
          setShowLeaveModal(false);
          if (blocker.state === 'blocked') blocker.reset();
        }}
        title="Unsaved Changes"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            You have unsaved changes. Are you sure you want to leave this page?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowLeaveModal(false);
                if (blocker.state === 'blocked') blocker.reset();
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Stay
            </button>
            <button
              onClick={() => {
                setShowLeaveModal(false);
                setIsDirty(false);
                if (blocker.state === 'blocked') blocker.proceed();
              }}
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Leave
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function SpecEditPage() {
  return (
    <FieldOptionsProvider>
      <SpecEditForm />
    </FieldOptionsProvider>
  );
}
