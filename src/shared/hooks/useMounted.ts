"use client";

import { useSyncExternalStore } from "react";

// Nothing to subscribe to — the value never changes after hydration, so the
// subscribe callback is a no-op that returns an empty unsubscribe.
const subscribe = () => () => {};
const getSnapshot = () => true; // client
const getServerSnapshot = () => false; // server / hydration pass

/**
 * False on the server and through hydration; true once running on the client.
 *
 * Guards `createPortal(…, document.body)`. A portal cannot be server-rendered,
 * and reaching for `document` during render throws outright once a route is
 * genuinely server-rendered (which is what peeling a route does).
 *
 * Checking `typeof document === "undefined"` instead is NOT equivalent: the
 * server would render nothing while the very first client render produces the
 * portal, and React reports that as a hydration mismatch and discards the
 * subtree. Gating here keeps both first renders identical.
 *
 * Built on useSyncExternalStore rather than useState + useEffect. That's the
 * purpose-built primitive for "this value differs between server and client":
 * React reads getServerSnapshot while hydrating and getSnapshot after, with no
 * state update and so no second render pass.
 *
 *     const mounted = useMounted();
 *     if (!mounted) return null;
 *     return createPortal(<Modal />, document.body);
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
