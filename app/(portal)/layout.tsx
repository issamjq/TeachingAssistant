import { LanguageProvider } from "@/shared/i18n";
import { RouterBridge } from "@/lib/route";
import AccessibilityWidget from "@/views/AccessibilityWidget";

// Route group for the privileged-role sign-in surfaces:
//   /dev · /superadmin · /admin · /owner · /moe
//
// A route group `(portal)` adds no path segment — /dev stays /dev. It exists
// so these five routes share one layout and are visibly one thing in the tree.
//
// This layout is a SERVER component: it only mounts the two client providers
// the portals need. That keeps the segment itself server-rendered, which is
// what makes the pages below cheap and statically analysable.
//
// Peeled from the catch-all in Phase 3. Because App Router specificity beats
// the optional catch-all, creating these files is all it took — nothing had
// to be removed from app/[[...slug]].
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      {/* Parks the router instance for navigate()/replace() — the portals
          call replace(["dashboard"]) on a successful sign-in. */}
      <RouterBridge />
      {children}
      {/* Was mounted globally by legacy/LegacyRoot. Peeled routes render
          outside that tree, so each route group mounts it itself — otherwise
          the accessibility toolbar silently disappears from the peeled
          surface, which is what happened on the first pass here. */}
      <AccessibilityWidget />
    </LanguageProvider>
  );
}
