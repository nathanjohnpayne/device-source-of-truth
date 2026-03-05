import { useState, useRef, useEffect, useCallback } from 'react';
import { ACTIVE_DEVICES_WINDOW_DAYS } from '../../lib/types';
import { formatRelativeTime, formatDateTime, formatDate, getFreshnessState } from '../../lib/format';

const DOT_BG: Record<string, string> = {
  fresh: 'bg-green-500',
  aging: 'bg-amber-500',
  stale: 'bg-red-500',
  no_data: 'bg-gray-400',
};

const STATE_TEXT_COLOR: Record<string, string> = {
  fresh: 'text-green-600',
  aging: 'text-amber-600',
  stale: 'text-red-600',
  no_data: 'text-gray-400',
};

const STATE_LABEL: Record<string, string> = {
  fresh: 'Fresh',
  aging: 'Aging',
  stale: 'Stale',
  no_data: 'No data',
};

interface FreshnessMicroPanelProps {
  lastTelemetryAt: string | null | undefined;
  partnerName?: string;
  partnerKeyName?: string;
  windowDays?: number;
  children: React.ReactNode;
}

export default function FreshnessMicroPanel({
  lastTelemetryAt,
  partnerName,
  partnerKeyName,
  windowDays = ACTIVE_DEVICES_WINDOW_DAYS,
  children,
}: FreshnessMicroPanelProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const state = getFreshnessState(lastTelemetryAt);

  const show = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    enterTimer.current = setTimeout(() => setVisible(true), 150);
  }, []);

  const hide = useCallback(() => {
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    leaveTimer.current = setTimeout(() => setVisible(false), 100);
  }, []);

  useEffect(() => {
    return () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!visible || !triggerRef.current || !panelRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const placeAbove = spaceBelow < 200 && triggerRect.top > panelRect.height + 8;
    setPosition({
      top: placeAbove
        ? triggerRect.top - panelRect.height - 4
        : triggerRect.bottom + 4,
      left: Math.max(8, Math.min(
        triggerRect.left,
        window.innerWidth - panelRect.width - 8,
      )),
    });
  }, [visible]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setVisible(false);
      if (enterTimer.current) clearTimeout(enterTimer.current);
    }
  }, []);

  const coverageEnd = lastTelemetryAt ? new Date(lastTelemetryAt) : new Date();
  const coverageStart = new Date(coverageEnd.getTime() - windowDays * 86_400_000);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="relative"
    >
      {children}
      {visible && (
        <div
          ref={panelRef}
          className="fixed z-[60] w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
          style={{ top: position.top, left: position.left }}
          onMouseEnter={show}
          onMouseLeave={hide}
          role="tooltip"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${DOT_BG[state]}`} />
              <span className="text-xs font-semibold text-gray-700">Data freshness</span>
            </div>
            <span className={`text-xs font-semibold ${STATE_TEXT_COLOR[state]}`}>
              {STATE_LABEL[state]}
            </span>
          </div>

          <div className="my-2 border-t border-gray-100" />

          {state === 'no_data' ? (
            <div className="space-y-2">
              <FieldRow label="Updated" primary="—" />
              <FieldRow label="Source" primary="—" />
            </div>
          ) : (
            <div className="space-y-2">
              <FieldRow
                label="Updated"
                primary={formatRelativeTime(lastTelemetryAt)}
                secondary={formatDateTime(lastTelemetryAt ?? null)}
              />
              <FieldRow
                label="Window"
                primary={`${windowDays} days`}
                secondary={`${formatDate(coverageStart.toISOString())} – ${formatDate(coverageEnd.toISOString())}`}
              />
              <FieldRow
                label="Source"
                primary={partnerName || '—'}
                secondary={partnerKeyName}
                monoSecondary
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  label,
  primary,
  secondary,
  monoSecondary,
}: {
  label: string;
  primary: string;
  secondary?: string | null;
  monoSecondary?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="w-16 flex-shrink-0 text-xs text-gray-400">{label}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-700">{primary}</p>
        {secondary && (
          <p className={`text-xs text-gray-400 ${monoSecondary ? 'font-mono' : ''}`}>
            {secondary}
          </p>
        )}
      </div>
    </div>
  );
}
