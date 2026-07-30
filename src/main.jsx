import React, { useEffect, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { useRoute, navigate, clearRoute } from "./lib/route.js";
import { LanguageProvider } from "./lib/i18n.jsx";
import AccessibilityWidget from "./views/AccessibilityWidget.jsx";
import { getPortalFromPath } from "./lib/portal.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import BrandLoader from "./components/BrandLoader.jsx";

// The three surfaces are split at the top level, because no visitor ever needs
// more than one of them. Landing is the largest file in the repo and a signed-in
// teacher never renders it; the studio shell is bigger still and a first-time
// visitor to "/" never renders that. Statically importing all three put every
// byte of all three in the first request.
//
// Each is behind its own ErrorBoundary already, and the boundary sits OUTSIDE
// Suspense on purpose: a chunk that fails to download (flaky school wifi, a
// stale hashed filename after a deploy) rejects the lazy import, and that has
// to land on the branded retry card rather than an empty page.
const StudioApp = lazy(() => import("./App.jsx"));
const Landing = lazy(() => import("./views/Landing.jsx"));
const PortalSignIn = lazy(() => import("./views/PortalSignIn.jsx"));

// Top-level surface decided entirely by URL pathname (no `#` anywhere):
//   "/"                                → landing page
//   "/dev" | "/superadmin" | "/admin"
//     | "/owner" | "/moe"              → privileged-role sign-in portal
//   anything else (e.g. "/dashboard",
//     "/planner", "/lesson-plans/…")   → studio
//
// Portals live at distinct pathnames so they can be shared as direct
// links without exposing them in the marketing nav. Vercel's SPA
// rewrite (vercel.json) serves /index.html for any path so deep
// links + refreshes work in production.
//
// Old bookmarks pointing at "#/foo" are auto-rewritten to "/foo" by
// the one-time migration in src/lib/route.js on module import.
function Root() {
  // useRoute() returns null for "/" AND for portal paths (route.js
  // filters them out), so this state captures: "are we in the
  // studio?". Anything else falls through to portal or landing.
  const route = useRoute();
  const inStudio = route !== null;
  // Portal detection also updates on popstate so back-button between
  // portal and landing works cleanly (PortalSignIn calls
  // exitPortalToStudio which dispatches popstate after replaceState).
  const [portal, setPortal] = useState(getPortalFromPath);
  useEffect(() => {
    const sync = () => setPortal(getPortalFromPath());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("studio-open", inStudio);
    if (!inStudio && !portal) window.scrollTo(0, 0);
  }, [inStudio, portal]);

  // Portal takes precedence: if pathname is a portal path, render the
  // portal sign-in screen. exitPortalToStudio() replaces the pathname
  // to /dashboard, which falls through to studio rendering below.
  // One boundary per surface, not one around all three. A throw in the
  // studio must not be able to blank the marketing site (or vice versa),
  // and the a11y widget is deliberately outside the surface boundary so
  // zoom/contrast keep working on top of an error screen.
  if (portal) {
    return (
      <>
        <ErrorBoundary name="portal">
          <Suspense fallback={<BrandLoader />}>
            <PortalSignIn portal={portal} />
          </Suspense>
        </ErrorBoundary>
        <ErrorBoundary name="a11y" variant="silent">
          <AccessibilityWidget />
        </ErrorBoundary>
      </>
    );
  }

  return (
    <>
      {inStudio ? (
        <ErrorBoundary name="studio">
          <Suspense fallback={<BrandLoader />}>
            <StudioApp onClose={() => clearRoute()} />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary name="landing">
          <Suspense fallback={<BrandLoader />}>
            <Landing onOpenStudio={() => navigate(["planner"])} />
          </Suspense>
        </ErrorBoundary>
      )}
      <ErrorBoundary name="a11y" variant="silent">
        <AccessibilityWidget />
      </ErrorBoundary>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <Root />
    </LanguageProvider>
  </React.StrictMode>
);
