import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RequireOnboardedTeacher } from "@/features/auth/require-onboarded-teacher";
import { ClassesRefreshProvider } from "@/features/classes/classes-refresh-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireOnboardedTeacher>
      <ClassesRefreshProvider>
        <DashboardShell>{children}</DashboardShell>
      </ClassesRefreshProvider>
    </RequireOnboardedTeacher>
  );
}
