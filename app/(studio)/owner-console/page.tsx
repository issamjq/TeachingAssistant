import type { Metadata } from "next";
import OwnerDashboard from "@/views/OwnerDashboard";

// Role-gated surface. StudioShell already bounces any section that isn't in
// SECTIONS_BY_ROLE for the signed-in role, and every API this view calls is
// re-checked server-side by requireRole() — so this segment carries no
// authorisation logic of its own.
export const metadata: Metadata = {
  title: "Owner console — Murchid",
  robots: { index: false, follow: false },
};

export default function OwnerConsolePage() {
  return <OwnerDashboard />;
}
