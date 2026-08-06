import { LanguageProvider } from "@/shared/i18n";
import { RouterBridge } from "@/lib/route";
import AccessibilityWidget from "@/views/AccessibilityWidget";
import StudioShell from "@/features/studio-shell/StudioShell";

// Route group for the authenticated teacher workspace. `(studio)` adds no
// path segment — /quizzes stays /quizzes.
//
// The shell (sidebar, drawer, top bar, teaching rail) lives here so it
// mounts ONCE and survives navigation between sections: moving from
// /quizzes to /homework re-renders only the page, not the sidebar. In the
// pre-migration App.jsx the shell and the section dispatcher were the same
// component, so everything re-rendered together.
//
// This layout is a server component; StudioShell owns the client boundary.
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <RouterBridge />
      <StudioShell>{children}</StudioShell>
      {/* Mounted per route group — peeled routes render outside the legacy
          tree that used to provide it globally. */}
      <AccessibilityWidget />
    </LanguageProvider>
  );
}
