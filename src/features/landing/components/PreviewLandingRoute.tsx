"use client";

import Landing from "@/views/Landing";
import { navigate } from "@/lib/route";

// The landing page with the constellation cut of the opening act.
//
// Same page, same funnel, same everything below the fold — only the hero
// differs, so what is under review here is exactly the redesign and not
// a parallel copy of the marketing site that will drift out of step with
// the real one. When the cut is signed off, "/" switches its heroVariant
// and this route and its page.tsx go away.
export default function PreviewLandingRoute() {
  return <Landing onOpenStudio={() => navigate(["planner"])} heroVariant="constellation" />;
}
