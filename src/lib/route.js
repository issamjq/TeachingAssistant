// URL-hash-backed routing — no library needed.
//
// Hash format: `#/<section>` or `#/<section>/<sub>` or `#/<section>/<sub>/<extra>`
//
//   ""                                 → landing page
//   "#/dashboard"                      → studio dashboard
//   "#/lesson-plans/templates"         → lesson plans, templates library
//   "#/lesson-plans/new"               → new lesson plan builder
//   "#/lesson-plans/edit/42"           → editing draft id 42
//   "#/quizzes"                        → quizzes list
//   "#/quizzes/new"                    → new quiz builder
//   "#/quizzes/edit/3"                 → quiz builder for id 3
//   (homework / activities / presentations follow the same
//    "<section>" + "<section>/new" + "<section>/edit/:id" shape)
//   "#/database/students"              → class roster, students tab
//   "#/account"                        → account profile (any role)
//   "#/admin"                          → admin console (admin role)
//   "#/dev"                            → dev console (dev role)
//
// Anything that mutates state visible in the URL goes through `navigate(...)`,
// which calls `pushState` and emits a `mudir:routechange` event so the
// `useRoute` hook re-renders. We listen to `popstate` too so the browser
// back/forward buttons feel native.
import { useEffect, useState } from "react";

const EVT = "mudir:routechange";

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

export const parseHash = (hash) => {
  const m = hash.match(/^#\/?(.*)$/);
  if (!m || !m[1]) return null;
  const parts = m[1].split("/").filter(Boolean);
  if (parts.length === 0) return null;
  return {
    section: parts[0],
    sub: parts[1] || null,
    extra: parts.slice(2),
    raw: m[1],
  };
};

export const getRoute = () =>
  typeof window === "undefined" ? null : parseHash(window.location.hash);

const fire = () => window.dispatchEvent(new Event(EVT));

// Replace the current hash without pushing a new history entry. Useful when
// switching tabs that shouldn't accumulate back-button steps (e.g. inner
// Database / lesson-plans tabs).
export const replace = (parts) => {
  const next = pathFor(parts);
  if (window.location.hash === next) return;
  tryNav(() => {
    window.history.replaceState(null, "", next || window.location.pathname + window.location.search);
    fire();
  });
};

// Push a new history entry. Use for top-level section changes — back button
// then returns the user to where they were.
export const navigate = (parts) => {
  const next = pathFor(parts);
  if (window.location.hash === next) return;
  tryNav(() => {
    window.history.pushState(null, "", next || window.location.pathname + window.location.search);
    fire();
  });
};

// Clears the hash entirely — used to return to the landing page from the studio.
export const clearRoute = () => {
  if (!window.location.hash) return;
  tryNav(() => {
    window.history.pushState(null, "", window.location.pathname + window.location.search);
    fire();
  });
};

const pathFor = (parts) => {
  const path = (parts || []).filter((p) => p != null && p !== "").map(String).join("/");
  return path ? `#/${path}` : "";
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
