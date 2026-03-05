import { ACTIVE_DEVICES_WINDOW_DAYS } from '../../lib/types';
import { formatRelativeTime, formatDateTime, formatDate } from '../../lib/format';
import Tooltip from './Tooltip';

type FreshnessState = 'fresh' | 'aging' | 'stale' | 'no_data';

const DOT_COLOR: Record<FreshnessState, string> = {
  fresh: 'bg-green-500',
  aging: 'bg-amber-500',
  stale: 'bg-red-500',
  no_data: 'bg-gray-400',
};

const STATE_LABEL: Record<FreshnessState, string> = {
  fresh: 'Fresh',
  aging: 'Aging',
  stale: 'Stale',
  no_data: 'No data',
};

export function getFreshnessState(lastTelemetryAt: string | null | undefined): FreshnessState {
  if (!lastTelemetryAt) return 'no_data';
  const diffMs = Date.now() - new Date(lastTelemetryAt).getTime();
  if (Number.isNaN(diffMs)) return 'no_data';
  const hours48 = 48 * 60 * 60 * 1000;
  const days7 = 7 * 24 * 60 * 60 * 1000;
  if (diffMs < hours48) return 'fresh';
  if (diffMs < days7) return 'aging';
  return 'stale';
}

function getCoverageRange(lastTelemetryAt: string | null | undefined, windowDays: number) {
  const end = lastTelemetryAt ? new Date(lastTelemetryAt) : new Date();
  const start = new Date(end.getTime() - windowDays * 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

interface FreshnessBadgeProps {
  lastTelemetryAt: string | null | undefined;
  windowDays?: number;
  compact?: boolean;
}

export default function FreshnessBadge({
  lastTelemetryAt,
  windowDays = ACTIVE_DEVICES_WINDOW_DAYS,
  compact = false,
}: FreshnessBadgeProps) {
  const state = getFreshnessState(lastTelemetryAt);
  const relativeTime = formatRelativeTime(lastTelemetryAt);
  const dotColor = DOT_COLOR[state];

  if (compact) {
    const title = state === 'no_data'
      ? 'No data: no telemetry uploaded'
      : `${STATE_LABEL[state]}: last updated ${relativeTime}`;
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`}
        title={title}
        role="img"
        aria-label={title}
      />
    );
  }

  const { start, end } = getCoverageRange(lastTelemetryAt, windowDays);
  const tooltipLines = state === 'no_data'
    ? 'No telemetry data has been uploaded for this entity.'
    : `Data as of: ${formatDateTime(lastTelemetryAt ?? null)}\nCoverage window: ${windowDays} days (${formatDate(start)}–${formatDate(end)})\nSource: Datadog telemetry`;

  return (
    <Tooltip content={tooltipLines}>
      <span
        className="mt-1 inline-flex items-center gap-1.5"
        aria-label={
          state === 'no_data'
            ? 'Active devices data: no data recorded.'
            : `Active devices data updated ${relativeTime}, covering a ${windowDays}-day window.`
        }
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
        <span className="text-xs font-medium text-gray-500">
          {state === 'no_data'
            ? 'No data recorded'
            : `Updated ${relativeTime} · ${windowDays}-day window`}
        </span>
      </span>
    </Tooltip>
  );
}
