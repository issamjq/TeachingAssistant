import type { Metadata } from "next";
import SuperAdminRevenue from "@/views/SuperAdminRevenue";

// Role-gated surface. Every sa_revenue_* RPC is re-gated by
// sa_gate('admin.dashboard') in the database, so this segment carries no
// authorisation logic of its own.
export const metadata: Metadata = {
  title: "Revenue — Murchid",
  robots: { index: false, follow: false },
};

export default function SuperadminRevenuePage() {
  return <SuperAdminRevenue />;
}
