// Pathname-backed routing — no library, no `#` in URLs.
//
// Pathname format: `/<section>` or `/<section>/<sub>` or `/<section>/<sub>/<extra>`
//
//   "/"                                → landing page (or portal — see PORTAL_PATHS)
//   "/dashboard"                       → studio dashboard
//   "/lesson-plans/templates"          → lesson plans, templates library
//   "/lesson-plans/new"                → new lesson plan builder
//   "/lesson-plans/edit/42"            → editing draft id 42
//   "/quizzes"                         → quizzes list
//   "/quizzes/new"                     → new quiz builder
//   "/quizzes/edit/3"                  → quiz builder for id 3
//   (homework / activities / presentations follow the same
//    "<section>" + "<section>/new" + "<section>/edit/:id" shape)
//   "/database/students"               → class roster, students tab
//   "/account"                         → account profile (any role)
//
// Portal paths (handled separately by PortalSignIn — see lib/portal.js
// and main.jsx) are filtered out here so `getRoute()` returns null
// when on a portal pathname:
//   "/dev"         → dev portal
//   "/superadmin"  → super admin portal
//   "/admin"       → admin portal
//   "/owner"       → owner portal
//   "/moe"         → MoE portal
//
// Anything that mutates state visible in the URL goes through
// `navigate(...)`, which calls `pushState` and emits a
// `murchid:routechange` event so the `useRoute` hook re-renders. We
// listen to `popstate` too so the browser back/forward buttons feel
// native.
//
// Vercel SPA fallback (vercel.json) serves index.html for every
// non-asset pathname, so deep-linked refreshes work in production.
import { useEffect, useState } from "react";

const EVT = "murchid:routechange";

// Portal pathnames keep their own dedicated PortalSignIn surface —
// they're NOT studio sections. Kept in sync with src/lib/portal.js.
// Hardcoded rather than imported to avoid a circular dependency.
const PORTAL_PATHS = new Set([
  "/dev", "/dev/",
  "/superadmin", "/superadmin/",
  "/admin", "/admin/",
  "/owner", "/owner/",
  "/moe", "/moe/",
]);

// One-time migration: old bookmarks pointing at `/#/foo/bar` get
// rewritten in-place to `/foo/bar` so the rest of the app sees a
// clean pathname. Runs once on module import. Browser back-button
// stack stays intact (replaceState, not pushState).
if (typeof window !== "undefined") {
  const h = window.location.hash;
  if (h && h.startsWith("#/")) {
    const cleanPath = h.slice(1); // "#/foo/bar" → "/foo/bar"
    window.history.replaceState(
      null,
      "",
      cleanPath + window.location.search
    );
  }
}

// Pluggable navigation guard. A view that has unsaved state can register a
// function via setNavGuard(); on every navigate / replace / clearRoute call
// the guard receives a `proceed` callback that performs the actual nav.
// Returning false aborts the immediate transition — the guard can then call
// `proceed()` later (e.g. after the user confirms a custom modal). Returning
// anything else lets the navigation continue synchronously. Only one guard
// is active at a time; the registering view should call the returned
// cleanup function on unmount or when its unsaved state clears.
let _guard = null;
export function setNavGuard(guard) {
  _guard = guard;
  return () => {
    if (_guard === guard) _guard = null;
  };
}
const tryNav = (action) => {
  if (!_guard) { action(); return; }
  const ok = _guard(action);
  if (ok !== false) action();
};

// Parse a pathname into a route object. Returns null for the home
// page and for portal paths (those have their own surfaces).
export const parsePath = (pathname) => {
  if (!pathname) return null;
  // Normalise trailing slash for stable comparisons.
  const norm = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  if (norm === "" || norm === "/") return null;
  if (PORTAL_PATHS.has(norm) || PORTAL_PATHS.has(norm + "/")) return null;

  // Strip the leading "/" and split.
  const parts = norm.replace(/^\//, "").split("/").filter(Boolean);
  if (parts.length === 0) return null;
  return {
    section: parts[0],
    sub: parts[1] || null,
    extra: parts.slice(2),
    raw: parts.join("/"),
  };
};

export const getRoute = () =>
  typeof window === "undefined" ? null : parsePath(window.location.pathname);

const fire = () => window.dispatchEvent(new Event(EVT));

// Build a clean pathname from `parts`. Empty array → "" which we
// translate to "/" at the call site. Filters null/undefined/empty parts.
const pathFor = (parts) => {
  const path = (parts || [])
    .filter((p) => p != null && p !== "")
    .map(String)
    .join("/");
  return path ? `/${path}` : "";
};

// Replace the current pathname without pushing a new history entry. Useful
// when switching tabs that shouldn't accumulate back-button steps (e.g.
// inner Database / lesson-plans tabs).
export const replace = (parts) => {
  const next = pathFor(parts) || "/";
  if (window.location.pathname === next) return;
  tryNav(() => {
    window.history.replaceState(null, "", next + window.location.search);
    fire();
  });
};

// Push a new history entry. Use for top-level section changes — back button
// then returns the user to where they were.
export const navigate = (parts) => {
  const next = pathFor(parts) || "/";
  if (window.location.pathname === next) return;
  tryNav(() => {
    window.history.pushState(null, "", next + window.location.search);
    fire();
  });
};

// Clears the route entirely — used to return to the landing page from the
// studio. Pushes "/" so the back button still works.
export const clearRoute = () => {
  if (window.location.pathname === "/") return;
  tryNav(() => {
    window.history.pushState(null, "", "/" + window.location.search);
    fire();
  });
};

export function useRoute() {
  const [route, setRoute] = useState(() => getRoute());
  useEffect(() => {
    const update = () => setRoute(getRoute());
    window.addEventListener("popstate", update);
    window.addEventListener(EVT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(EVT, update);
    };
  }, []);
  return route;
}
