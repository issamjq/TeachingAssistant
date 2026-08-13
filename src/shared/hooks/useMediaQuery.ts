"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query currently matches.
 *
 * A media query is external state, not React state, so it is read with
 * useSyncExternalStore rather than an effect that calls setState. That
 * matters for more than lint: the server and the hydrating client both
 * get `false`, and React reads the real value once hydration is done —
 * so a component that renders a different tree per breakpoint gets a
 * correct second paint instead of a hydration mismatch.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
