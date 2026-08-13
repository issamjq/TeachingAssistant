import { LanguageProvider } from "@/shared/i18n";
import { RouterBridge } from "@/lib/route";
import AssistantMount from "@/features/assistant/AssistantMount";
import StudioShell from "@/features/studio-shell/StudioShell";
import { ContextPanelProvider } from "@/shared/shell/ContextPanel";

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
      {/* The second left column is a shell-level slot: the provider has to
          sit outside StudioShell so a section rendered as `children` can
          register content the shell renders beside the nav. */}
      <ContextPanelProvider>
        <StudioShell>{children}</StudioShell>
      </ContextPanelProvider>
      {/* The floating assistant. It carries the accessibility controls as
          one of its tabs, so this single mount covers both. */}
      <AssistantMount scope="studio" />
    </LanguageProvider>
  );
}
