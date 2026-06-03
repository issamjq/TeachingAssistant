import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import StudioApp from "./App.jsx";
import Landing from "./views/Landing.jsx";
import PortalSignIn from "./views/PortalSignIn.jsx";
import { useRoute, navigate, clearRoute } from "./lib/route.js";
import { LanguageProvider } from "./lib/i18n.jsx";
import AccessibilityWidget from "./views/AccessibilityWidget.jsx";
import { getPortalFromPath } from "./lib/portal.js";

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
  if (portal) {
    return (
      <>
        <PortalSignIn portal={portal} />
        <AccessibilityWidget />
      </>
    );
  }

  return (
    <>
      {inStudio ? (
        <StudioApp onClose={() => clearRoute()} />
      ) : (
        <Landing onOpenStudio={() => navigate(["planner"])} />
      )}
      <AccessibilityWidget />
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
