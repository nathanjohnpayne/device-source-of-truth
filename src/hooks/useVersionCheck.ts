import { useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 60_000;

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.version ?? null;
  } catch {
    return null;
  }
}

export function useVersionCheck(enabled: boolean) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const baselineRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function init() {
      const version = await fetchVersion();
      if (cancelled) return;
      if (version) baselineRef.current = version;
    }

    init();

    timerRef.current = setInterval(async () => {
      const latest = await fetchVersion();
      if (cancelled) return;
      if (!latest || !baselineRef.current) return;
      if (latest !== baselineRef.current) {
        setUpdateAvailable(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled]);

  return updateAvailable;
}
