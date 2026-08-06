import LegacyAppMount from "./LegacyAppMount";

// ─────────────────────────────────────────────────────────────────────
// MIGRATION SCAFFOLDING — temporary. See docs/11-nextjs-migration.md §2.
//
// Optional catch-all: matches "/" and every path with no more specific
// segment in app/. It hands off to the pre-migration SPA, which does its
// own pathname routing internally (src/lib/route.js).
//
// App Router specificity means a real route always wins over this. So
// peeling a route in Phase 3 is purely additive — create
// app/(studio)/quizzes/page.tsx and /quizzes stops reaching here. Nothing
// needs to be removed from this file, and no route list is maintained
// anywhere. When the last route is peeled, delete this directory.
// ─────────────────────────────────────────────────────────────────────

// The legacy tree is client-only (see LegacyAppMount), so there is nothing
// to prerender and no set of paths to enumerate at build time.
export const dynamic = "force-static";

export default function CatchAllPage() {
  return <LegacyAppMount />;
}
