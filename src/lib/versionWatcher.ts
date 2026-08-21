import { useEffect } from 'react';

const CHECK_INTERVAL_MS = 60_000;

/**
 * Watches for a newer deploy and reloads the page automatically when one
 * shows up - fixes the "I forgot to refresh this tab" problem, since a
 * page that's already open never re-fetches index.html on its own.
 *
 * Works by polling version.json (emitted at build time by vite.config.ts,
 * containing the current commit hash) and comparing it to the hash this
 * tab was actually built from. Checks on an interval, and immediately
 * whenever the tab regains focus - that covers both "left it running in
 * the background" and "came back after a while" without needing a
 * websocket or service worker.
 *
 * A full reload is safe here even mid-game: all game state lives in
 * Firestore, so reloading just re-subscribes and redraws the current
 * state rather than losing anything.
 */
export function useVersionWatcher() {
  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}version.json?_=${Date.now()}`,
          { cache: 'no-store' },
        );
        if (!response.ok) return;

        const { sha } = (await response.json()) as { sha?: string };
        if (!cancelled && sha && sha !== __BUILD_SHA__) {
          window.location.reload();
        }
      } catch {
        // Offline, or version.json doesn't exist (e.g. local dev, which
        // doesn't emit it) - just skip this check, nothing to do about it.
      }
    }

    const intervalId = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    }

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
