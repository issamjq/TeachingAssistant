import type { Metadata } from "next";
import SuperAdminFriction from "@/views/SuperAdminFriction";

// Role-gated surface. sa_friction and sa_stuck_users are gated on
// sa_gate('admin.friction') — a capability of its own rather than a
// slice of admin.analytics, because these two reads carry names.
export const metadata: Metadata = {
  title: "Friction — Murchid",
  robots: { index: false, follow: false },
};

export default function SuperadminFrictionPage() {
  return <SuperAdminFriction />;
}
