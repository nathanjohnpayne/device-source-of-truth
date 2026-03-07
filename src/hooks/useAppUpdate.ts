import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const POLL_INTERVAL_MS = 60 * 1000;
const DISMISSED_HASH_KEY = 'dst_update_dismissed_hash';

function readDismissedHash(): string | null {
  try { return localStorage.getItem(DISMISSED_HASH_KEY); } catch { return null; }
}

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

/**
 * Detects a new app version via two independent paths:
 *   1. Service worker (Workbox) — fires when a new SW is waiting.
 *   2. Version polling — compares /version.json against the build-time hash.
 *
 * The build hash is injected at compile time via Vite `define`, so it's
 * available synchronously — no async fetch race with the SW callback.
 */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const latestHashRef = useRef<string | null>(null);
  const dismissedHashRef = useRef<string | null>(readDismissedHash());

  const bootHash = __APP_VERSION_HASH__;

  function evaluateUpdate(serverHash: string) {
    latestHashRef.current = serverHash;
    const isDifferentFromBoot = serverHash !== bootHash;
    const isDismissed = serverHash === dismissedHashRef.current;
    setUpdateAvailable(isDifferentFromBoot && !isDismissed);
  }

  const {
    needRefresh: [swNeedsRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      fetchHash().then((hash) => {
        if (hash) {
          evaluateUpdate(hash);
        } else {
          setUpdateAvailable(true);
        }
      });
    },
    onOfflineReady() {},
  });

  useEffect(() => {
    let cancelled = false;

    const dismissed = dismissedHashRef.current;
    if (dismissed && dismissed !== bootHash) {
      localStorage.removeItem(DISMISSED_HASH_KEY);
      dismissedHashRef.current = null;
    }

    async function poll() {
      const latest = await fetchHash();
      if (!cancelled && latest && latest !== bootHash) {
        evaluateUpdate(latest);
      }
    }

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
