import type { Metadata } from "next";
import SuperAdminUsage from "@/views/SuperAdminUsage";

// Role-gated surface. StudioShell bounces any section not in
// SECTIONS_BY_ROLE for the signed-in role, and every sa_ai_* RPC is
// re-gated by sa_gate('admin.dashboard') in the database — so this
// segment carries no authorisation logic of its own.
export const metadata: Metadata = {
  title: "AI usage — Murchid",
  robots: { index: false, follow: false },
};

export default function SuperadminUsagePage() {
  return <SuperAdminUsage />;
}
