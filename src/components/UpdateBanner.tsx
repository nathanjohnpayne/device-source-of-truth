import { useState } from 'react';
import { useAppUpdate } from '../hooks/useAppUpdate';

const DISMISS_KEY = 'dst_update_dismissed';

export default function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useAppUpdate();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-4 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-900"
    >
      <span className="font-medium">
        A new version of Device Source of Truth is available.
      </span>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={applyUpdate}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 active:bg-indigo-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Refresh
        </button>

        <button
          onClick={() => {
            setDismissed(true);
            try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* noop */ }
          }}
          aria-label="Dismiss update notification"
          className="rounded p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
