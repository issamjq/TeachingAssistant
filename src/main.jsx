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

// Top-level surface decided by URL pathname + hash:
//   pathname /admin | /owner | /moe   → privileged-role sign-in portal
//   no hash, "/"                       → landing page
//   any "#/..."                        → studio
//
// Portals live at distinct pathnames so they can be shared as direct
// links without exposing them in the marketing nav. Vercel's SPA
// rewrite (vercel.json) serves /index.html for any path while preserving
// window.location.pathname, so portal detection is purely client-side.
function Root() {
  const route = useRoute();
  const inStudio = route !== null;
  // Recompute portal on popstate so the back button between portal and
  // landing works cleanly (PortalSignIn calls exitPortalToStudio which
  // dispatches popstate after replaceState).
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

  // Portal takes precedence over landing when on a portal path AND not
  // already inside the studio (so a refresh on /admin#/dashboard, which
  // exitPortalToStudio() would've rewritten to /#/dashboard, doesn't
  // re-render the portal).
  if (portal && !inStudio) {
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
