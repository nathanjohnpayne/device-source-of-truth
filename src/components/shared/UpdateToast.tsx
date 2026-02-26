import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useVersionCheck } from '../../hooks/useVersionCheck';

export default function UpdateToast() {
  const { user } = useAuth();
  const updateAvailable = useVersionCheck(!!user);
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-slide-up">
      <div className="flex items-center gap-4 rounded-lg bg-gray-900 px-5 py-3 shadow-xl ring-1 ring-white/10">
        <p className="text-sm text-gray-100">
          A new version of Device Source of Truth is available
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-md p-1 text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
