"use client";

import { useEffect, useRef } from "react";

// Keep a list fresh without a manual refresh.
//
// A screen fetches once on mount, so anything added elsewhere — a lesson
// imported from the library, a quiz built in the studio, a row created on
// another tab or device — didn't appear until the teacher reloaded. This
// revalidates the way SWR/React Query do by default:
//
//   • when the window regains focus (you tabbed back),
//   • when the tab becomes visible again,
//   • and on a gentle interval while the tab is visible.
//
// The refetch is meant to be SILENT — pass a reload that doesn't toggle a
// loading skeleton, so the list updates in place instead of flashing.
//
//   const reload = (silent = false) => { if (!silent) setLoading(true); … };
//   useEffect(() => { reload(); }, []);
//   useAutoRefresh(() => reload(true));
export function useAutoRefresh(
  refetch: () => void,
  { intervalMs = 30_000 }: { intervalMs?: number } = {},
) {
  // Keep the latest callback without re-binding listeners each render.
  const ref = useRef(refetch);
  useEffect(() => {
    ref.current = refetch;
  });

  useEffect(() => {
    // focus and visibilitychange often fire together when returning to a
    // tab — coalesce so we don't fetch twice in the same instant.
    let last = 0;
    const run = () => {
      const now = Date.now();
      if (now - last < 800) return;
      last = now;
      ref.current();
    };
    const onFocus = () => run();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const timer =
      intervalMs > 0
        ? setInterval(() => {
            if (document.visibilityState === "visible") ref.current();
          }, intervalMs)
        : null;

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearInterval(timer);
    };
  }, [intervalMs]);
}
