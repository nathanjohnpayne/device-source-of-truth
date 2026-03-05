import { useAppUpdate } from '../hooks/useAppUpdate';
import Button, { IconButton } from './shared/Button';

export default function UpdateBanner() {
  const { updateAvailable, applyUpdate, dismiss } = useAppUpdate();

  if (!updateAvailable) return null;

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
        <Button
          onClick={applyUpdate}
          size="sm"
          className="font-semibold"
        >
          Refresh
        </Button>

        <IconButton
          onClick={dismiss}
          aria-label="Dismiss update notification"
          label="Dismiss update notification"
          variant="ghost"
          className="h-8 w-8 text-neutral-400 hover:text-neutral-600"
          icon={<svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>}
        />
      </div>
    </div>
  );
}
