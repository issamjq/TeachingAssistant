"use client";

import React, { useEffect, useState } from "react";
import StudioApp from "../App.jsx";
import Landing from "../views/Landing.jsx";
import PortalSignIn from "../views/PortalSignIn.jsx";
import { useRoute, navigate, clearRoute } from "../lib/route.js";
import { LanguageProvider } from "../lib/i18n.jsx";
import AccessibilityWidget from "../views/AccessibilityWidget.jsx";
import { getPortalFromPath } from "../lib/portal.js";

// ─────────────────────────────────────────────────────────────────────
// MIGRATION SCAFFOLDING — this file is temporary.
//
// This is the body of the old src/main.jsx, minus the createRoot() call
// (Next owns mounting now). It is rendered by app/[[...slug]]/page.tsx,
// which catches every pathname the App Router has no real segment for.
//
// As routes are peeled off into app/(marketing|portal|studio)/* during
// Phase 3, they stop reaching this component. When the last one is
// peeled, this file and the catch-all are deleted together (Phase 4).
//
// Do NOT add features here. New work goes in src/features/*.
// See docs/11-nextjs-migration.md §2.
// ─────────────────────────────────────────────────────────────────────

// Top-level surface decided entirely by URL pathname (no `#` anywhere):
//   "/"                                → landing page
//   "/dev" | "/superadmin" | "/admin"
//     | "/owner" | "/moe"              → privileged-role sign-in portal
//   anything else (e.g. "/dashboard",
//     "/planner", "/lesson-plans/…")   → studio
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

export default function LegacyRoot() {
  return (
    <LanguageProvider>
      <Root />
    </LanguageProvider>
  );
}
