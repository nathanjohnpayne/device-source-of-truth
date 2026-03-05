export function formatDate(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '\u2014';
  return new Intl.NumberFormat(undefined).format(value);
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'No data recorded';
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'No data recorded';
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 48) return `${hours} hr ago`;

  const days = Math.floor(diffMs / 86_400_000);
  return `${days} days ago`;
}
