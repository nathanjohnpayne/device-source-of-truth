import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

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

  const {
    needRefresh: [swNeedsRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      setUpdateAvailable(true);
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
      const latest = await fetchHash();
      if (!cancelled && latest && bootHashRef.current && latest !== bootHashRef.current) {
        setUpdateAvailable(true);
      }
    }

    init();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function applyUpdate() {
    if (swNeedsRefresh) {
      await updateServiceWorker(true);
    } else {
      window.location.reload();
    }
  }

  return { updateAvailable, applyUpdate };
}
