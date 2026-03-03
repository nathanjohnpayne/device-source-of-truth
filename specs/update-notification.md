# Update Notification — Override

Detects new versions via both service worker and version polling, surfaces a dismissible banner. Three files to add, two lines to wire up.

---

## How It Works

- **Service worker path:** `vite-plugin-pwa` registers a Workbox SW. When Workbox detects a new SW waiting to activate, it fires an event. The hook catches it and calls `skipWaiting()` + `location.reload()` on confirmation.
- **Polling path:** At build time, Vite writes `public/version.json` containing the current build hash. A hook polls that endpoint every 5 minutes. If the hash differs from the one the app booted with, it flags an update.
- **Banner:** Shown when either path fires. Sticks to the top of the viewport. Dismissible (hides for the session), with a "Refresh" button that reloads.

---

## 1. Vite Plugin — `vite.config.ts`

Add `vite-plugin-pwa` and the version-file plugin.

```bash
npm i -D vite-plugin-pwa
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Plugin } from "vite";

/** Writes public/version.json at build time so the poller can detect stale clients. */
function versionPlugin(): Plugin {
  return {
    name: "version-json",
    buildStart() {
      const version = { hash: Date.now().toString(36) };
      writeFileSync(
        resolve(__dirname, "public/version.json"),
        JSON.stringify(version)
      );
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    versionPlugin(),
    VitePWA({
      registerType: "prompt", // <-- do NOT use "autoUpdate"; we want manual control
      injectRegister: "auto",
      workbox: {
        // Cache the shell; everything else network-first
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      manifest: {
        name: "Device Source of Truth",
        short_name: "DST",
        theme_color: "#ffffff",
      },
    }),
  ],
});
```

> **`registerType: "prompt"` is required.** `"autoUpdate"` silently reloads the page mid-session, which is bad UX and will break in-progress workflows.

---

## 2. Hook — `src/hooks/useAppUpdate.ts`

```ts
import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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

  // ── Path 1: Service worker ──────────────────────────────────────────────────
  const {
    needRefresh: [swNeedsRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      setUpdateAvailable(true);
    },
    onOfflineReady() {
      // Optional: could show "App ready to work offline" toast here
    },
  });

  // ── Path 2: Version polling ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchHash(): Promise<string | null> {
      try {
        // Cache-bust so CDN/browser never returns the stale file
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
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

  // ── Apply update ────────────────────────────────────────────────────────────
  async function applyUpdate() {
    if (swNeedsRefresh) {
      // Tell the waiting SW to take control, then reload
      await updateServiceWorker(true);
    } else {
      window.location.reload();
    }
  }

  return { updateAvailable, applyUpdate };
}
```

---

## 3. Component — `src/components/UpdateBanner.tsx`

```tsx
import { useState } from "react";
import { useAppUpdate } from "@/hooks/useAppUpdate";

/**
 * Sticks to the top of the viewport when a new version is available.
 * Dismissible for the session (banner hides, update still applies on next reload).
 */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useAppUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="
        fixed inset-x-0 top-0 z-50
        flex items-center justify-between gap-4
        bg-white border-b border-neutral-200 shadow-sm
        px-4 py-3
        text-sm text-neutral-800
      "
    >
      <span className="font-medium">
        A new version of Device Source of Truth is available.
      </span>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={applyUpdate}
          className="
            rounded-md bg-indigo-600 px-4 py-1.5
            text-sm font-semibold text-white
            hover:bg-indigo-500 active:bg-indigo-700
            transition-colors focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-indigo-600
          "
        >
          Refresh
        </button>

        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notification"
          className="
            rounded p-1 text-neutral-400
            hover:text-neutral-600 hover:bg-neutral-100
            transition-colors focus-visible:outline-2
            focus-visible:outline-offset-2 focus-visible:outline-neutral-400
          "
        >
          {/* Close icon — inline so there's no icon library dependency */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

---

## 4. Wire Up — `src/App.tsx` (or root layout)

Two lines:

```tsx
import { UpdateBanner } from "@/components/UpdateBanner";

export default function App() {
  return (
    <>
      <UpdateBanner />
      {/* rest of app */}
    </>
  );
}
```

---

## Notes

**TypeScript path for `virtual:pwa-register/react`**

Add to `vite-env.d.ts` (or any `.d.ts` in `src/`):

```ts
/// <reference types="vite-plugin-pwa/react" />
```

**Content-Security-Policy**

If Override sets a CSP header, service workers require `script-src 'self'`. The SW file Vite emits (`sw.js`) is always same-origin, so no changes are needed unless you currently block `'self'`.

**Dev environment**

Service workers don't register in `vite dev` by default. To test SW behavior locally:

```bash
vite build && vite preview
```

The version poller works in dev without any changes.

**If Override doesn't use a SW yet**

The polling path works entirely independently. You can skip `vite-plugin-pwa` and the `useRegisterSW` block in the hook and the banner will still work via polling alone. Just remove the `swNeedsRefresh` branch from `applyUpdate` (it becomes `window.location.reload()` unconditionally).
