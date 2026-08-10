"use client";

import DashboardView from "../DashboardView";
import { navigate } from "@/lib/route";
import { navTargetFor } from "@/config/nav";

// Dashboard tiles jump to other sections; routing them goes through the same
// navTargetFor map the sidebar uses, so a tile and its nav item always land
// on the same place (e.g. lesson-plans → /lesson-plans/templates).
export default function DashboardRoute() {
  return <DashboardView onJump={(key?: string) => key && navigate(navTargetFor(key))} />;
}
