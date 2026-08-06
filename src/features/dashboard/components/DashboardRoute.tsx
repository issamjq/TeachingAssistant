"use client";

import Dashboard from "@/views/Dashboard";
import { navigate } from "@/lib/route";
import { navTargetFor } from "@/config/nav";

// Dashboard tiles jump to other sections; routing them goes through the same
// navTargetFor map the sidebar uses, so a tile and its nav item always land
// on the same place (e.g. lesson-plans → /lesson-plans/templates).
export default function DashboardRoute() {
  return <Dashboard onJump={(key: string) => navigate(navTargetFor(key))} />;
}
