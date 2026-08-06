import { LanguageProvider } from "@/shared/i18n";
import { RouterBridge } from "@/lib/route";
import AccessibilityWidget from "@/views/AccessibilityWidget";

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
      {/* Mounted per route group — peeled routes render outside the legacy
          tree that used to provide it globally. */}
      <AccessibilityWidget />
    </LanguageProvider>
  );
}
