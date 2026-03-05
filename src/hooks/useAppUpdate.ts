import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const POLL_INTERVAL_MS = 60 * 1000;
const DISMISSED_HASH_KEY = 'dst_update_dismissed_hash';

function readDismissedHash(): string | null {
  try { return localStorage.getItem(DISMISSED_HASH_KEY); } catch { return null; }
}

/**
 * Detects a new app version via two independent paths:
 *   1. Service worker (Workbox) — fires when a new SW is waiting.
 *   2. Version polling — compares /version.json against the hash at boot time.
 *
 * Dismiss is tied to a specific deploy hash so the banner reappears on every
 * new deploy, but the user only needs to press Refresh once regardless of how
 * many deploys happened while they were away.
 */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const bootHashRef = useRef<string | null>(null);
  const latestHashRef = useRef<string | null>(null);
  const dismissedHashRef = useRef<string | null>(readDismissedHash());

  function evaluateUpdate(hash: string) {
    latestHashRef.current = hash;
    const isDifferentFromBoot = hash !== bootHashRef.current;
    const isDismissed = hash === dismissedHashRef.current;
    setUpdateAvailable(isDifferentFromBoot && !isDismissed);
  }

  const {
    needRefresh: [swNeedsRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      if (latestHashRef.current) {
        evaluateUpdate(latestHashRef.current);
      } else {
        setUpdateAvailable(true);
      }
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
      if (!cancelled && hash) {
        bootHashRef.current = hash;
        const dismissed = dismissedHashRef.current;
        if (dismissed && dismissed !== hash) {
          localStorage.removeItem(DISMISSED_HASH_KEY);
          dismissedHashRef.current = null;
        }
      }
    }

    async function poll() {
      const latest = await fetchHash();
      if (!cancelled && latest && bootHashRef.current && latest !== bootHashRef.current) {
        evaluateUpdate(latest);
      }
    }

    init();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const dismiss = useCallback(() => {
    const hash = latestHashRef.current;
    if (hash) {
      dismissedHashRef.current = hash;
      try { localStorage.setItem(DISMISSED_HASH_KEY, hash); } catch { /* noop */ }
    }
    setUpdateAvailable(false);
  }, []);

  async function applyUpdate() {
    try { localStorage.removeItem(DISMISSED_HASH_KEY); } catch { /* noop */ }
    if (swNeedsRefresh) {
      await updateServiceWorker(true);
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    window.location.replace(window.location.pathname + '?_=' + Date.now());
  }

  return { updateAvailable, applyUpdate, dismiss };
}
