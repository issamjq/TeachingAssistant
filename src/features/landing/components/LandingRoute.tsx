"use client";

import { Suspense } from "react";
import EntryGate from "./EntryGate";

// The marketing landing page at "/".
//
// onOpenStudio is the single entry action behind every primary CTA. Landing
// only calls it once a visitor is signed in; otherwise it routes them into
// its own sign-up funnel, which is internal React state rather than a URL.
//
// The opening act is the "atelier" cut: the studio window with the eight
// modules flanking it, each named and captioned with what it does. It
// replaced a fan of eight cards dealt at a scale where none of them could
// be read.
//
// The stage-one variants that used to be browsable at /preview1../preview7
// are gone; those routes now hold seven designs for the STUDIO screen
// instead (src/features/studio-previews/). The variant definitions
// themselves still live in src/features/hero-constellation/variants.ts,
// which is what LandingHome picks the shipping cut from.
//
// Landing.jsx is still one 7,266-line view backed by 2,674 lines of global
// CSS in src/landing.css. Breaking it into sections with co-located CSS
// Modules is its own step — the route peel does not depend on it.
// Where a teacher lands depends on how they got in:
//   sign-UP  → /studio     the AI Studio, which is the one screen that is
//                          useful with no data behind it
//   sign-IN  → /dashboard  a summary of work they have actually done
//   anything else → /planner, which is what the landing's own
//                          "Open the planner" button says it does
// A signed-in teacher is sent to their dashboard before anything paints;
// see EntryGate. Reaching the marketing page on purpose is `/?home=1`,
// which is where the studio's logo points.
export default function LandingRoute({
  billingOn = true,
  freeGrant = 800,
}: {
  billingOn?: boolean;
  freeGrant?: number;
}) {
  // useSearchParams needs a Suspense boundary to keep this route
  // statically renderable — without one Next opts the whole page into
  // dynamic rendering, and "/" is the one page that must stay static.
  return (
    <Suspense fallback={null}>
      <EntryGate billingOn={billingOn} freeGrant={freeGrant} />
    </Suspense>
  );
}
