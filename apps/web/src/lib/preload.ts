/**
 * Idle-time route preloading.
 *
 * The heavy page chunks (Masters, Report, QC, Settings, …) are lazy-loaded on
 * route change. Once the authenticated shell has mounted we warm the browser's
 * module cache for the biggest / most-visited ones during idle time, so the
 * first navigation to them resolves instantly instead of showing a loader.
 *
 * The dynamic imports here resolve to the same module instances as the
 * `React.lazy(() => import(...))` call sites in App.tsx (ESM caches by URL),
 * so this never double-loads a chunk.
 */

type Loader = () => Promise<unknown>;

// Heaviest + most-visited chunks (from production build output).
// Masters and Report are the two 100 KB+ chunks; QC is a daily workflow screen.
const HEAVY_PAGES: Loader[] = [
  () => import("../pages/MastersPage"),
  () => import("../pages/ReportPage"),
  () => import("../pages/QcPage"),
  () => import("../pages/SystemSettingsPage"),
  () => import("../pages/PathologistReviewPage"),
  () => import("../pages/GeneralSettingsPage"),
  () => import("../pages/InventoryPage"),
];

let started = false;

/** Fetch the heavy route chunks once, during a browser idle slot. */
export function preloadHeavyPages(): void {
  if (started) return;
  started = true;

  const run = () => {
    for (const load of HEAVY_PAGES) {
      load().catch(() => {
        // Preload is best-effort — a failed warm-up must never break the app.
      });
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 3000 });
  } else {
    // Safari < 18 / older engines: fall back to a short delay after mount.
    setTimeout(run, 1200);
  }
}
