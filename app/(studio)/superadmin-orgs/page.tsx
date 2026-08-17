import type { Metadata } from "next";
import SuperAdminOrgs from "@/views/SuperAdminOrgs";

// Role-gated surface. StudioShell bounces any section not in
// SECTIONS_BY_ROLE for the signed-in role, and every /api/superadmin/*
// path is re-checked by is_super_admin() in the database.
export const metadata: Metadata = {
  title: "Organisations — Murchid",
  robots: { index: false, follow: false },
};

export default function SuperadminOrgsPage() {
  return <SuperAdminOrgs />;
}
