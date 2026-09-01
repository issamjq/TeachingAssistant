import type { Metadata } from "next";
import SuperAdminCosts from "@/views/SuperAdminCosts";

// Role-gated surface. StudioShell bounces any section not in
// SECTIONS_BY_ROLE for the signed-in role, and every /api/superadmin/*
// path is re-checked by is_super_admin() in the database — so this segment
// carries no authorisation logic of its own.
export const metadata: Metadata = {
  title: "Pricing — Murchid",
  robots: { index: false, follow: false },
};

export default function SuperadminCostsPage() {
  return <SuperAdminCosts />;
}
