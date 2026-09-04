import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RequireOnboardedTeacher } from "@/features/auth/require-onboarded-teacher";
import { ClassesRefreshProvider } from "@/features/classes/classes-refresh-context";
import { StudioProvider } from "@/features/studio-legacy/studio-context";
import { StudioPanel } from "@/features/studio-legacy/StudioPanel";
import { AnalyticsTracker } from "@/features/analytics/analytics-tracker";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-app h-svh bg-primary p-3 text-foreground md:p-4">
      <AnalyticsTracker />
      <RequireOnboardedTeacher>
        <ClassesRefreshProvider>
          <StudioProvider>
            <DashboardShell>{children}</DashboardShell>
            <StudioPanel />
          </StudioProvider>
        </ClassesRefreshProvider>
      </RequireOnboardedTeacher>
    </div>
  );
}
