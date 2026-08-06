"use client";

import { navigate } from "@/lib/route";
import editorial from "../styles/editorial.module.css";
import Opening from "../sections/Opening";
import Contents from "../sections/Contents";

// The redesigned landing page.
//
// Set as a printed issue rather than a marketing stack: a masthead, numbered
// chapters, hairline rules doing the dividing, and Arabic carried as a second
// voice rather than an ornament.
//
// Built section by section. Chapters not yet rebuilt still come from the
// previous landing (see LandingRoute), so the page stays whole while the
// redesign lands — the same strangler approach the route migration used.

export default function LandingPage() {
  // Every primary action leads to the same place. Landing's own funnel
  // handles the signed-out case; signed-in teachers go straight to work.
  const enter = () => navigate(["planner"]);

  return (
    <div className={editorial.root}>
      <Opening onEnter={enter} />
      <Contents onEnter={enter} />
    </div>
  );
}
