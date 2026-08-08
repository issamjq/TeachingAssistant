"use client";

import Landing from "@/views/Landing";
import { navigate } from "@/lib/route";

// The marketing landing page at "/".
//
// onOpenStudio is the single entry action behind every primary CTA. Landing
// only calls it once a visitor is signed in; otherwise it routes them into
// its own sign-up funnel, which is internal React state rather than a URL.
//
// The opening act is the "atelier" cut: the studio window with the eight
// modules flanking it, each named and captioned with what it does. It
// replaced a fan of eight cards dealt at a scale where none of them could
// be read — the fan is still reachable at /preview2 for comparison, and
// the alternatives at /preview1 and /preview3../preview7.
//
// Landing.jsx is still one 7,266-line view backed by 2,674 lines of global
// CSS in src/landing.css. Breaking it into sections with co-located CSS
// Modules is its own step — the route peel does not depend on it.
export default function LandingRoute() {
  return <Landing onOpenStudio={() => navigate(["planner"])} heroVariant="atelier" />;
}
