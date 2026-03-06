import { ACTIVE_DEVICES_WINDOW_DAYS } from '../../lib/types';
import { formatRelativeTime, formatDateTime, formatDate, getFreshnessState, type FreshnessState } from '../../lib/format';
import Tooltip from './Tooltip';

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

const UNIT_INFO: Record<string, { singular: string; ms: number }> = {
  m: { singular: 'minute', ms: 60_000 },
  h: { singular: 'hour', ms: 3_600_000 },
  d: { singular: 'day', ms: 86_400_000 },
  w: { singular: 'week', ms: 604_800_000 },
};

function parseTimeRange(range: string): { label: string; ms: number } | null {
  const match = range.match(/^(\d+)\s*([mhdw])$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const info = UNIT_INFO[match[2].toLowerCase()];
  if (!info) return null;
  return { label: `${num}-${info.singular}`, ms: num * info.ms };
}

function getCoverageRange(lastTelemetryAt: string | null | undefined, windowMs: number) {
  const end = lastTelemetryAt ? new Date(lastTelemetryAt) : new Date();
  const start = new Date(end.getTime() - windowMs);
  return { start: start.toISOString(), end: end.toISOString() };
}

interface FreshnessBadgeProps {
  lastTelemetryAt: string | null | undefined;
  importTimeRange?: string | null;
  windowDays?: number;
  compact?: boolean;
}

export default function FreshnessBadge({
  lastTelemetryAt,
  importTimeRange,
  windowDays = ACTIVE_DEVICES_WINDOW_DAYS,
  compact = false,
}: FreshnessBadgeProps) {
  const state = getFreshnessState(lastTelemetryAt);
  const relativeTime = formatRelativeTime(lastTelemetryAt);
  const dotColor = DOT_COLOR[state];

  const parsed = importTimeRange ? parseTimeRange(importTimeRange) : null;
  const windowLabel = parsed ? `${parsed.label} window` : `${windowDays}-day window`;
  const windowMs = parsed ? parsed.ms : windowDays * 86_400_000;

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

  const { start, end } = getCoverageRange(lastTelemetryAt, windowMs);
  const coverageDays = Math.round(windowMs / 86_400_000);
  const tooltipLines = state === 'no_data'
    ? 'No telemetry data has been uploaded for this entity.'
    : `Data as of: ${formatDateTime(lastTelemetryAt ?? null)}\nCoverage window: ${coverageDays} days (${formatDate(start)}–${formatDate(end)})\nSource: Datadog telemetry`;

  return (
    <Tooltip content={tooltipLines}>
      <span
        className="mt-1 inline-flex items-center gap-1.5"
        aria-label={
          state === 'no_data'
            ? 'Active devices data: no data recorded.'
            : `Active devices data updated ${relativeTime}, covering a ${windowLabel}.`
        }
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
        <span className="text-xs font-medium text-gray-500">
          {state === 'no_data'
            ? 'No data recorded'
            : `Updated ${relativeTime} · ${windowLabel}`}
        </span>
      </span>
    </Tooltip>
  );
}
