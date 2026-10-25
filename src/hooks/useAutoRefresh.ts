import { useEffect, useRef } from 'react';

/** How often the data is re-read while the app is on screen. */
export const AUTO_REFRESH_MS = 60_000;
/** Coming back to the app re-reads it, but not more often than this. */
const MIN_GAP_MS = 10_000;

/**
 * Keeps on-screen data fresh: re-reads it when the app comes back to the
 * foreground and every minute while it is visible, so content other members
 * add (videos, cromos, dates) shows up without leaving the page.
 */
export function useAutoRefresh(refresh: () => Promise<void>, enabled = true): void {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    let running = false;
    const run = (force: boolean) => {
      if (document.visibilityState !== 'visible' || running) return;
      if (!force && Date.now() - last < MIN_GAP_MS) return;
      running = true;
      last = Date.now();
      void latest.current().finally(() => {
        running = false;
      });
    };
    const onVisible = () => run(false);
    const timer = window.setInterval(() => run(true), AUTO_REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled]);
}
