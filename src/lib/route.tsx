"use client";

// Routing compatibility shim — MIGRATION SCAFFOLDING.
//
// Before the Next.js migration this was a hand-rolled pushState router. It
// now delegates to the App Router while keeping its exact public API, so the
// ~8 legacy views that import it keep working untouched:
//
//   useRoute() · navigate() · replace() · clearRoute() · setNavGuard()
//
// Why a shim instead of rewriting the call sites: routes are peeled off one
// at a time (docs/11-nextjs-migration.md §2). During that window, legacy and
// peeled routes must navigate through the SAME history stack — if legacy code
// kept calling history.pushState directly, Next's router state would go stale
// and navigating from a legacy view into a peeled route would render nothing.
//
// Deleted in Phase 4, once every view uses next/navigation directly.
//
// ── Pathname format ──────────────────────────────────────────────────
//   "/"                                → landing page (or portal)
//   "/dashboard"                       → studio dashboard
//   "/lesson-plans/templates"          → lesson plans, templates library
//   "/lesson-plans/edit/42"            → editing draft id 42
//   "/quizzes" | "/quizzes/new" | "/quizzes/edit/3"
//   (homework / activities / presentations share that shape)
//   "/database/students"               → class roster, students tab
//   "/account"                         → account profile (any role)
//
// Portal paths are filtered out here so getRoute() returns null on them —
// they have their own surface (see lib/portal.js and legacy/LegacyRoot.jsx):
//   "/dev" · "/superadmin" · "/admin" · "/owner" · "/moe"

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export interface Route {
  section: string;
  sub: string | null;
  extra: string[];
  raw: string;
}

type NavPart = string | number | null | undefined | false;

// Portal pathnames keep their own dedicated PortalSignIn surface — they're
// NOT studio sections. Kept in sync with src/lib/portal.js. Hardcoded rather
// than imported to avoid a circular dependency.
const PORTAL_PATHS = new Set([
  "/dev",
  "/superadmin",
  "/admin",
  "/owner",
  "/moe",
]);

// One-time migration: old bookmarks pointing at `/#/foo/bar` get rewritten
// in-place to `/foo/bar` so the rest of the app sees a clean pathname. Runs
// once on module import. Back-button stack stays intact (replaceState).
if (typeof window !== "undefined") {
  const h = window.location.hash;
  if (h && h.startsWith("#/")) {
    window.history.replaceState(null, "", h.slice(1) + window.location.search);
  }
}

// ── Router bridge ────────────────────────────────────────────────────
//
// navigate()/replace() are called from plain event handlers, not hooks, so
// they can't call useRouter() themselves. <RouterBridge /> is mounted once
// near the root and parks the router instance here for them to use.
let _router: AppRouterInstance | null = null;

export function RouterBridge() {
  const router = useRouter();
  useEffect(() => {
    _router = router;
    return () => {
      if (_router === router) _router = null;
    };
  }, [router]);
  return null;
}

// ── Navigation guard ─────────────────────────────────────────────────
//
// A view with unsaved state registers a function via setNavGuard(); on every
// navigate / replace / clearRoute the guard receives a `proceed` callback that
// performs the actual navigation. Returning false aborts the immediate
// transition — the guard can call proceed() later (e.g. after the user
// confirms a modal). Only one guard is active at a time; the registering view
// calls the returned cleanup on unmount.
//
// NOTE: this covers in-app navigation only. Browser Back and tab-close bypass
// it entirely — see the popstate buffer + beforeunload handlers in
// views/Studio.jsx, which are independent of this module and still work.
//
// LIMITATION for Phase 3: next/link and a direct useRouter().push() also
// bypass this guard. Peeled routes reachable from a guarded flow must keep
// navigating via navigate()/replace() from this module until a proper
// App Router replacement lands.
type NavGuard = (proceed: () => void) => boolean | void;

let _guard: NavGuard | null = null;

export function setNavGuard(guard: NavGuard) {
  _guard = guard;
  return () => {
    if (_guard === guard) _guard = null;
  };
}

const tryNav = (action: () => void) => {
  if (!_guard) {
    action();
    return;
  }
  if (_guard(action) !== false) action();
};

// ── Path helpers ─────────────────────────────────────────────────────

// Parse a pathname into a route object. Returns null for the home page and
// for portal paths (those have their own surfaces).
export const parsePath = (
  pathname: string | null | undefined
): Route | null => {
  if (!pathname) return null;
  // Normalise trailing slash for stable comparisons.
  const norm =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  if (norm === "" || norm === "/") return null;
  if (PORTAL_PATHS.has(norm)) return null;

  const parts = norm.replace(/^\//, "").split("/").filter(Boolean);
  if (parts.length === 0) return null;
  return {
    section: parts[0],
    sub: parts[1] || null,
    extra: parts.slice(2),
    raw: parts.join("/"),
  };
};

export const getRoute = (): Route | null =>
  typeof window === "undefined" ? null : parsePath(window.location.pathname);

// Build a clean pathname from `parts`, dropping null/undefined/empty entries.
const pathFor = (parts: NavPart[] | undefined): string => {
  const path = (parts || [])
    .filter((p): p is string | number => p != null && p !== "" && p !== false)
    .map(String)
    .join("/");
  return path ? `/${path}` : "/";
};

// Preserve the query string across navigation — the old router appended
// window.location.search on every push and some flows rely on it surviving.
const withSearch = (path: string) => {
  if (typeof window === "undefined") return path;
  return path + window.location.search;
};

// The App Router is the real navigator. The history fallback only matters if
// something navigates before <RouterBridge /> has mounted; without it that
// call would be silently dropped.
const go = (path: string, mode: "push" | "replace") => {
  const href = withSearch(path);
  if (_router) {
    _router[mode](href);
    return;
  }
  if (typeof window === "undefined") return;
  window.history[mode === "push" ? "pushState" : "replaceState"](
    null,
    "",
    href
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
};

// ── Public navigation API ────────────────────────────────────────────

// Replace the current entry without pushing history. For tab switches that
// shouldn't accumulate back-button steps (inner Database / lesson-plans tabs).
export const replace = (parts: NavPart[]) => {
  const next = pathFor(parts);
  if (typeof window !== "undefined" && window.location.pathname === next)
    return;
  tryNav(() => go(next, "replace"));
};

// Push a new history entry. For top-level section changes — the back button
// then returns the user where they were.
export const navigate = (parts: NavPart[]) => {
  const next = pathFor(parts);
  if (typeof window !== "undefined" && window.location.pathname === next)
    return;
  tryNav(() => go(next, "push"));
};

// Return to the landing page from the studio. Pushes "/" so back still works.
export const clearRoute = () => {
  if (typeof window !== "undefined" && window.location.pathname === "/") return;
  tryNav(() => go("/", "push"));
};

// ── Reactive route ───────────────────────────────────────────────────

// usePathname() is the App Router's reactive source of truth — it updates on
// router.push, on browser back/forward, and when a peeled route takes over.
// The old implementation hand-wired popstate + a custom event; that is no
// longer needed and would double-fire.
export function useRoute(): Route | null {
  const pathname = usePathname();
  return useMemo(() => parsePath(pathname), [pathname]);
}
