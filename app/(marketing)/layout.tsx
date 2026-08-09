import { LanguageProvider } from "@/shared/i18n";
import { RouterBridge } from "@/lib/route";
import AssistantMount from "@/features/assistant/AssistantMount";

// Route group for the public marketing surface. `(marketing)` adds no path
// segment — the page inside it is "/".
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <RouterBridge />
      {children}
      {/* The floating assistant. It carries the accessibility controls as
          one of its tabs, so this single mount covers both. */}
      <AssistantMount scope="landing" />
    </LanguageProvider>
  );
}
