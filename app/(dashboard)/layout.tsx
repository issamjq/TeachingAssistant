import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RequireOnboardedTeacher } from "@/features/auth/require-onboarded-teacher";
import { ClassesRefreshProvider } from "@/features/classes/classes-refresh-context";
import { StudioProvider } from "@/features/studio-legacy/studio-context";
import { StudioPanel } from "@/features/studio-legacy/StudioPanel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireOnboardedTeacher>
      <ClassesRefreshProvider>
        <StudioProvider>
          <DashboardShell>{children}</DashboardShell>
          <StudioPanel />
        </StudioProvider>
      </ClassesRefreshProvider>
    </RequireOnboardedTeacher>
  );
}
