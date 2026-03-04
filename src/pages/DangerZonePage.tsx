import { useState } from 'react';
import { AlertTriangle, XCircle, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/analytics';
import Modal from '../components/shared/Modal';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const CONFIRMATION_PHRASE = 'Delete All Data';

export default function DangerZonePage() {
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const isConfirmed = confirmText === CONFIRMATION_PHRASE;

  const handleClearAll = async () => {
    setClearing(true);
    setError(null);
    try {
      const res = await api.upload.clearAll();
      const summaryText = Object.entries(res.deleted)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      setResult(summaryText || 'Nothing to delete');
      trackEvent('migration_run', { row_count: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setClearing(false);
      setShowModal(false);
      setConfirmText('');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Danger Zone</h1>
        <p className="mt-1 text-sm text-gray-500">
          Irreversible destructive operations for resetting DST data.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Proceed with caution</p>
            <p className="mt-1">
              Actions on this page permanently delete data and cannot be undone.
              Make sure you have a backup or are certain before proceeding.
            </p>
          </div>
        </div>
      </div>

      {result && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm text-emerald-800">
            <p className="font-medium">Data cleared successfully</p>
            <p className="mt-1">{result}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-red-200 bg-white">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-red-700">Clear All Data</h2>
              <p className="mt-1 text-sm text-gray-500">
                Permanently delete all devices, partners, partner keys, telemetry snapshots,
                alerts, and audit logs. Use this before a fresh re-import.
              </p>
            </div>
            <button
              onClick={() => { setShowModal(true); setConfirmText(''); setResult(null); }}
              className="ml-4 inline-flex shrink-0 items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Data
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setConfirmText(''); }}
        title="Confirm Destructive Action"
        footer={
          <>
            <button
              onClick={() => { setShowModal(false); setConfirmText(''); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAll}
              disabled={!isConfirmed || clearing}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {clearing && <LoadingSpinner className="h-4 w-4" />}
              Clear All Data
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
              <div className="text-sm text-red-800">
                <p className="font-medium">This action cannot be undone.</p>
                <p className="mt-1">
                  This will permanently delete <span className="font-semibold">all</span> devices,
                  partners, partner keys, telemetry snapshots, alerts, and audit logs from the system.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-input" className="block text-sm font-medium text-gray-700">
              Type <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-red-700">{CONFIRMATION_PHRASE}</span> to confirm
            </label>
            <input
              id="confirm-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              autoComplete="off"
              className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
