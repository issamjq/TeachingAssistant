"use client";

import Landing from "@/views/Landing";
import { navigate } from "@/lib/route";

// The marketing landing page at "/".
//
// onOpenStudio is the single entry action behind every primary CTA. Landing
// only calls it once a visitor is signed in; otherwise it routes them into
// its own sign-up funnel, which is internal React state rather than a URL.
//
// Landing.jsx is still one 7,266-line view backed by 2,674 lines of global
// CSS in src/landing.css. Breaking it into sections with co-located CSS
// Modules is its own step — the route peel does not depend on it.
export default function LandingRoute() {
  return <Landing onOpenStudio={() => navigate(["planner"])} />;
}
