import type { Metadata } from "next";
import SuperAdminRoles from "@/views/SuperAdminRoles";

// Role-gated surface. Reading the matrix is sa_gate('admin.roles'); every
// write is sa_require() — a real super admin, no delegation — because the
// capability that grants capabilities is the one nobody should be able to
// grant themselves.
export const metadata: Metadata = {
  title: "Roles — Murchid",
  robots: { index: false, follow: false },
};

export default function SuperadminRolesPage() {
  return <SuperAdminRoles />;
}
