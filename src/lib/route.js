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

// Sign-in and sign-up are real URLs, not state hidden inside the landing page.
// They belong to the marketing surface, so parsePath() must return null for
// them exactly as it does for portals — otherwise main.jsx would read "/signin"
// as a studio section and render the app shell to a signed-out visitor.
const AUTH_PATHS = new Map([
  ["/signin", "signin"], ["/signin/", "signin"],
  ["/signup", "signup"], ["/signup/", "signup"],
]);

/** "signin" | "signup" for those two paths, null everywhere else. */
export const getAuthModeFromPath = (pathname) =>
  AUTH_PATHS.get(pathname ?? (typeof window === "undefined" ? "" : window.location.pathname)) || null;

// Where to send someone after they sign in. Set when a signed-out visitor is
// bounced off a studio URL, read once on the way back. sessionStorage rather
// than localStorage: it is scoped to this tab and dies with it, so a stale
// intent from last week cannot hijack a later sign-in.
const RETURN_KEY = "murchid.auth.returnTo";

export const rememberReturnTo = (path) => {
  try {
    // Only ever a same-origin path. Storing a full URL here would turn this
    // into an open-redirect: anything that later navigates to the stored value
    // would happily send the user to another site after sign-in.
    if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) {
      sessionStorage.setItem(RETURN_KEY, path);
    }
  } catch { /* private mode — we lose the return path, not the sign-in */ }
};

/** Read the pending destination WITHOUT consuming it — for showing a notice. */
export const peekReturnTo = () => {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
  } catch { return null; }
};

export const takeReturnTo = () => {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
  } catch { return null; }
};

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
  if (AUTH_PATHS.has(norm) || AUTH_PATHS.has(norm + "/")) return null;

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
