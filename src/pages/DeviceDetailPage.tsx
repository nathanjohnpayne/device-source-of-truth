import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDevice } from '../lib/hooks';
import { deleteDeviceById } from '../lib/hooks';
import { logEvent } from '../lib/firebase';
import { ScoreBadge } from '../components/devices/ScoreBadge';
import { ArrowLeft, AlertTriangle, Check, X, Pencil, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const HARDWARE_OS_OPTIONS = ['Linux', 'Android', 'iOS'];
const PLATFORM_OPTIONS = ['Android TV', 'Tizen', 'Titan OS', 'TiVo OS', 'Vega OS', 'webOS', 'Linux'];

function EditableText({ value, fieldKey, onSave, className }: {
  value: string;
  fieldKey: string;
  onSave: (field: string, value: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  function startEdit() {
    setEditValue(value);
    setEditing(true);
  }

  function save() {
    onSave(fieldKey, editValue);
    logEvent('edit_device_field', { field: fieldKey });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        />
        <button onClick={save} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
      </div>
    );
  }

  return (
    <span className={`group/edit inline-flex items-center gap-2 ${className || ''}`}>
      {value}
      <button onClick={startEdit} className="opacity-0 group-hover/edit:opacity-100 transition-opacity text-slate-400 hover:text-blue-600">
        <Pencil size={12} />
      </button>
    </span>
  );
}

function SelectRow({ label, value, options, fieldKey, onSave }: {
  label: string;
  value: string | null;
  options: string[];
  fieldKey: string;
  onSave: (field: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  function startEdit() {
    setEditValue(value || '');
    setEditing(true);
  }

  function save(val: string) {
    onSave(fieldKey, val);
    logEvent('edit_device_field', { field: fieldKey });
    setEditing(false);
  }

  return (
    <div className="flex items-start py-2 border-b border-slate-50 group">
      <span className="text-sm text-slate-500 w-56 shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <select
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          >
            <option value="">—</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <button onClick={() => save(editValue)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Save</button>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      ) : (
        <span className="text-sm text-slate-800 flex items-center gap-2 flex-1">
          {value || <span className="text-slate-300">N/A</span>}
          <button onClick={startEdit} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600">
            <Pencil size={12} />
          </button>
        </span>
      )}
    </div>
  );
}

function BoolField({ value }: { value: boolean }) {
  return value
    ? <span className="inline-flex items-center gap-1 text-green-700"><Check size={14} /> Yes</span>
    : <span className="inline-flex items-center gap-1 text-slate-400"><X size={14} /> No</span>;
}

function SpecRow({ label, value, conflict, fieldKey, onSave }: {
  label: string;
  value: React.ReactNode;
  conflict?: boolean;
  fieldKey?: string;
  onSave?: (field: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  function startEdit() {
    if (!fieldKey || !onSave) return;
    setEditValue(typeof value === 'string' ? value : String(value ?? ''));
    setEditing(true);
  }

  function save() {
    if (fieldKey && onSave) {
      onSave(fieldKey, editValue);
      logEvent('edit_device_field', { field: fieldKey });
    }
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  return (
    <div className="flex items-start py-2 border-b border-slate-50 group">
      <span className="text-sm text-slate-500 w-56 shrink-0 flex items-center gap-1">
        {conflict && <AlertTriangle size={12} className="text-amber-500" />}
        {label}
      </span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <input
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          />
          <button onClick={save} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Save</button>
          <button onClick={cancel} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      ) : (
        <span className="text-sm text-slate-800 flex items-center gap-2 flex-1">
          {value || <span className="text-slate-300">N/A</span>}
          {fieldKey && onSave && (
            <button onClick={startEdit} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600">
              <Pencil size={12} />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

function BoolSpecRow({ label, value, conflict, fieldKey, onSave }: {
  label: string;
  value: boolean;
  conflict?: boolean;
  fieldKey?: string;
  onSave?: (field: string, value: boolean) => void;
}) {
  return (
    <div className="flex items-start py-2 border-b border-slate-50 group">
      <span className="text-sm text-slate-500 w-56 shrink-0 flex items-center gap-1">
        {conflict && <AlertTriangle size={12} className="text-amber-500" />}
        {label}
      </span>
      <span className="text-sm text-slate-800 flex items-center gap-2">
        <BoolField value={value} />
        {fieldKey && onSave && (
          <button
            onClick={() => { onSave(fieldKey, !value); logEvent('edit_device_field', { field: fieldKey }); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-600 hover:text-blue-800"
          >
            Toggle
          </button>
        )}
      </span>
    </div>
  );
}

export function DeviceDetailPage() {
  const { id } = useParams();
  const { device, loading, updateDevice } = useDevice(id);
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (device) {
      logEvent('view_device', { device_id: device.id, operator: device.operator });
    }
  }, [device]);

  async function handleSave(field: string, value: string | boolean) {
    if (!device) return;
    try {
      await updateDevice({ [field]: value });
    } catch (err) {
      console.error('Error updating device:', err);
    }
  }

  async function handleDelete() {
    if (!device) return;
    setDeleting(true);
    try {
      await deleteDeviceById(device.id);
      logEvent('delete_device', { device_id: device.id, model: device.modelName });
      navigate('/devices');
    } catch (err) {
      console.error('Error deleting device:', err);
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-slate-400">Loading device...</p></div>;
  }

  if (!device) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Device not found.</p>
        <Link to="/devices" className="text-blue-600 text-sm mt-2 inline-block">Back to devices</Link>
      </div>
    );
  }

  const conflictFields = new Set(device.conflicts.map(c => c.split(':')[0]));

  const scoreChartData = [
    { name: 'Hardware', score: device.scoreBreakdown.hardware, max: 25, color: '#3b82f6' },
    { name: 'Codec', score: device.scoreBreakdown.codec, max: 20, color: '#8b5cf6' },
    { name: 'DRM', score: device.scoreBreakdown.drm, max: 20, color: '#06b6d4' },
    { name: 'Display', score: device.scoreBreakdown.display, max: 20, color: '#f59e0b' },
    { name: 'Security', score: device.scoreBreakdown.security, max: 15, color: '#10b981' },
  ];

  return (
    <div className="p-8 max-w-5xl">
      <Link to="/devices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Back to devices
      </Link>

      <div className="flex items-start gap-6 mb-8">
        <ScoreBadge score={device.deviceScore} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <EditableText value={device.modelName} fieldKey="modelName" onSave={handleSave} />
          </h1>
          <p className="text-slate-500">
            <Link to="/partners" className="hover:text-blue-600 hover:underline transition-colors">{device.operator}</Link>
            {' '}&middot; {device.deviceType} &middot; {device.platform}
          </p>
          {device.modelNumber && (
            <p className="text-sm text-slate-400 mt-1">
              Model: <EditableText value={device.modelNumber} fieldKey="modelNumber" onSave={handleSave} className="text-slate-400" />
            </p>
          )}
          {device.conflicts.length > 0 && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertTriangle size={12} /> {device.conflicts.length} data conflicts from multiple sources
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to={`/compare?ids=${device.id}`}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Add to Compare
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} className="inline mr-1" /> Delete
          </button>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Score Breakdown</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={scoreChartData} layout="vertical">
            <XAxis type="number" domain={[0, 25]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
            <Tooltip formatter={(value) => [`${value}`, 'Score']} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {scoreChartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* General Info */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">General Information</h2>
          <SpecRow label="Manufacturer" value={device.manufacturer} fieldKey="manufacturer" onSave={handleSave} />
          <SpecRow label="Deployment Date" value={device.deploymentDate} fieldKey="deploymentDate" onSave={handleSave} />
          <SpecRow label="Delivery End Date" value={device.deliveryEndDate} fieldKey="deliveryEndDate" onSave={handleSave} />
          <SpecRow label="Active Devices" value={device.activeDeviceCount} fieldKey="activeDeviceCount" onSave={handleSave} />
          <SpecRow label="Subscribers" value={device.subscriberCount} fieldKey="subscriberCount" onSave={handleSave} />
          <SpecRow label="Countries" value={device.countries.join(', ')} />
          <SpecRow label="Connection Type" value={device.connectionType} fieldKey="connectionType" onSave={handleSave} />
          <SpecRow label="Region" value={device.region} fieldKey="region" onSave={handleSave} />
          <SpecRow label="Live ADK Version" value={device.liveAdkVersion} fieldKey="liveAdkVersion" onSave={handleSave} />
          <SpecRow label="64-bit" value={device.is64Bit ? 'Yes' : 'No'} />
          <SpecRow label="Performance Category" value={
            device.performanceCategory ? (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                device.performanceCategory === 'High' ? 'bg-green-100 text-green-700' :
                device.performanceCategory === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                device.performanceCategory === 'Low' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-500'
              }`}>{device.performanceCategory}</span>
            ) : null
          } />
          <SpecRow label="3rd Party Apps" value={device.thirdPartyApps.join(', ')} />
        </div>

        {/* Hardware */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Hardware</h2>
          <SpecRow label="SoC Vendor" value={device.socVendor} conflict={conflictFields.has('socVendor')} fieldKey="socVendor" onSave={handleSave} />
          <SpecRow label="SoC Model" value={device.socModel} conflict={conflictFields.has('socModel')} fieldKey="socModel" onSave={handleSave} />
          <SpecRow label="CPU Speed" value={device.cpuSpeedDmips ? `${device.cpuSpeedDmips.toLocaleString()} DMIPS` : null} conflict={conflictFields.has('cpuSpeedDmips')} fieldKey="cpuSpeedDmips" onSave={handleSave} />
          <SpecRow label="CPU Cores" value={device.cpuCores} fieldKey="cpuCores" onSave={handleSave} />
          <SelectRow label="Hardware OS" value={device.hardwareOs} options={HARDWARE_OS_OPTIONS} fieldKey="hardwareOs" onSave={handleSave} />
          <SelectRow label="Platform" value={device.platform} options={PLATFORM_OPTIONS} fieldKey="platform" onSave={handleSave} />
          <SpecRow label="OS Detail" value={`${device.osName || ''} ${device.osVersion || ''}`.trim()} conflict={conflictFields.has('osName')} />
          <SpecRow label="Memory" value={device.memoryCapacityGb ? `${device.memoryCapacityGb} GB ${device.memoryType || ''}` : null} conflict={conflictFields.has('memoryCapacityGb')} />
          <SpecRow label="RAM for Disney+" value={device.ramForDisneyMb ? `${device.ramForDisneyMb} MB` : null} />
          <SpecRow label="Storage" value={device.storageCapacityGb ? `${device.storageCapacityGb} GB ${device.storageType || ''}` : null} />
          <SpecRow label="HDMI" value={device.hdmiVersion} fieldKey="hdmiVersion" onSave={handleSave} />
        </div>

        {/* Codec Support */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Media Codec Support</h2>
          <BoolSpecRow label="H.264 / AVC" value={device.supportsH264} fieldKey="supportsH264" onSave={(f, v) => handleSave(f, v)} />
          <BoolSpecRow label="H.265 / HEVC" value={device.supportsH265} fieldKey="supportsH265" onSave={(f, v) => handleSave(f, v)} conflict={conflictFields.has('supportsH265')} />
          <BoolSpecRow label="E-AC-3" value={device.supportsEAC3} fieldKey="supportsEAC3" onSave={(f, v) => handleSave(f, v)} />
          <BoolSpecRow label="Dolby Atmos" value={device.supportsDolbyAtmos} fieldKey="supportsDolbyAtmos" onSave={(f, v) => handleSave(f, v)} />
          <SpecRow label="Max Resolution" value={device.maxVideoResolution} conflict={conflictFields.has('maxVideoResolution')} fieldKey="maxVideoResolution" onSave={handleSave} />
          <SpecRow label="Max Frame Rate" value={device.maxFrameRate ? `${device.maxFrameRate} fps` : null} fieldKey="maxFrameRate" onSave={handleSave} />
        </div>

        {/* HDR */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Display Capabilities</h2>
          <BoolSpecRow label="HDR10" value={device.supportsHDR10} fieldKey="supportsHDR10" onSave={(f, v) => handleSave(f, v)} conflict={conflictFields.has('supportsHDR10')} />
          <BoolSpecRow label="Dolby Vision" value={device.supportsDolbyVision} fieldKey="supportsDolbyVision" onSave={(f, v) => handleSave(f, v)} conflict={conflictFields.has('supportsDolbyVision')} />
          <SpecRow label="DV Profiles" value={device.dolbyVisionProfiles.join(', ')} />
          <BoolSpecRow label="HLG" value={device.supportsHLG} fieldKey="supportsHLG" onSave={(f, v) => handleSave(f, v)} />
          <BoolSpecRow label="HDR10+" value={device.supportsHDR10Plus} fieldKey="supportsHDR10Plus" onSave={(f, v) => handleSave(f, v)} />
        </div>

        {/* DRM & Security */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">DRM & Content Protection</h2>
          <SpecRow label="PlayReady Version" value={device.playReadyVersion} fieldKey="playReadyVersion" onSave={handleSave} />
          <SpecRow label="PlayReady Level" value={device.playReadySecurityLevel} conflict={conflictFields.has('playReadySecurityLevel')} fieldKey="playReadySecurityLevel" onSave={handleSave} />
          <SpecRow label="Widevine Version" value={device.widevineVersion} fieldKey="widevineVersion" onSave={handleSave} />
          <SpecRow label="Widevine Level" value={device.widevineSecurityLevel} conflict={conflictFields.has('widevineSecurityLevel')} fieldKey="widevineSecurityLevel" onSave={handleSave} />
          <SpecRow label="HDCP" value={device.hdcpVersion} fieldKey="hdcpVersion" onSave={handleSave} />
        </div>

        {/* Security */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Security Features</h2>
          <BoolSpecRow label="Secure Boot" value={device.supportsSecureBoot} fieldKey="supportsSecureBoot" onSave={(f, v) => handleSave(f, v)} />
          <BoolSpecRow label="TEE" value={device.supportsTEE} fieldKey="supportsTEE" onSave={(f, v) => handleSave(f, v)} />
          <BoolSpecRow label="Secure Video Path" value={device.supportsSecureVideoPath} fieldKey="supportsSecureVideoPath" onSave={(f, v) => handleSave(f, v)} />
        </div>
      </div>

      {/* Sales Data */}
      {device.salesData && device.salesData.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mt-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Sales & Market Data</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Region</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Country</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Brands</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Devices</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Activated</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Forecast</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-slate-500">D+ Remote</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-slate-500">D+ Preinstall</th>
                </tr>
              </thead>
              <tbody>
                {device.salesData.map((entry, idx) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-2 px-3">{entry.region}</td>
                    <td className="py-2 px-3">{entry.country}</td>
                    <td className="py-2 px-3">{entry.brands}</td>
                    <td className="py-2 px-3 text-right">{entry.currentDeviceCount?.toLocaleString() || 'N/A'}</td>
                    <td className="py-2 px-3 text-right">{entry.activatedCount?.toLocaleString() || 'N/A'}</td>
                    <td className="py-2 px-3 text-right">{entry.forecastNextYear?.toLocaleString() || 'N/A'}</td>
                    <td className="py-2 px-3 text-center"><BoolField value={entry.disneyPlusOnRemote} /></td>
                    <td className="py-2 px-3 text-center"><BoolField value={entry.disneyPlusPreinstalled} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source Files & Conflicts */}
      <div className="mt-6 space-y-4">
        {device.conflicts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1">
              <AlertTriangle size={14} /> Data Conflicts
            </h3>
            <ul className="text-xs text-amber-700 space-y-1">
              {device.conflicts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-slate-400">
          <p>Source files: {device.sourceFiles.join(', ')}</p>
          <p>Last updated: {device.lastUpdated} &middot; Imported: {device.importedAt}</p>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Device</h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete <strong>{device.modelName}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
