"use client";

import Landing from "@/views/Landing";
import { navigate } from "@/lib/route";

// The landing page with one stage-one variant swapped into the hero.
//
// Same page, same funnel, same everything below the opening screen — only
// stage one differs, so what is under review is exactly the design and
// not a parallel copy of the marketing site that will drift out of step
// with the real one. When a variant is chosen, "/" takes its id and every
// preview route goes away.
export default function PreviewLandingRoute({ variant }: { variant: string }) {
  return (
    <Landing
      onOpenStudio={(where?: string) => navigate([where ?? "planner"])}
      heroVariant={variant}
    />
  );
}
