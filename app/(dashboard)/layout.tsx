import { DashboardShell } from "@/components/layout/dashboard-shell";

// Teacher app shell. Static "Teacher / pending approval" identity for now —
// becomes role-aware once auth (docs/00-concept.md) lands.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
