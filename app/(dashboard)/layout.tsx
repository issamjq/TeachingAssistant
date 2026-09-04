import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RequireOnboardedTeacher } from "@/features/auth/require-onboarded-teacher";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireOnboardedTeacher>
      <DashboardShell>{children}</DashboardShell>
    </RequireOnboardedTeacher>
  );
}
