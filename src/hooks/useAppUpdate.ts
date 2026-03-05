import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const POLL_INTERVAL_MS = 60 * 1000;

/**
 * Detects a new app version via two independent paths:
 *   1. Service worker (Workbox) — fires when a new SW is waiting.
 *   2. Version polling — compares /version.json against the hash at boot time.
 *
 * Returns `{ updateAvailable, applyUpdate }`.
 *   - `applyUpdate` skips the waiting SW (if present) then reloads.
 */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const bootHashRef = useRef<string | null>(null);
  const detectedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function flagUpdate() {
    if (detectedRef.current) return;
    detectedRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setUpdateAvailable(true);
  }

  const {
    needRefresh: [swNeedsRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      flagUpdate();
    },
    onOfflineReady() {},
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchHash(): Promise<string | null> {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.hash ?? null;
      } catch {
        return null;
      }
    }

    async function init() {
      const hash = await fetchHash();
      if (!cancelled) bootHashRef.current = hash;
    }

    async function poll() {
      if (detectedRef.current) return;
      const latest = await fetchHash();
      if (!cancelled && latest && bootHashRef.current && latest !== bootHashRef.current) {
        flagUpdate();
      }
    }

    init();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function applyUpdate() {
    if (swNeedsRefresh) {
      await updateServiceWorker(true);
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    window.location.replace(window.location.pathname + '?_=' + Date.now());
  }

  return { updateAvailable, applyUpdate };
}
