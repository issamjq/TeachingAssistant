import type { Metadata } from "next";

// Portals are shareable direct links that are deliberately absent from the
// marketing nav. Now that they're real route segments they'd be crawlable and
// could surface in search results, which the old SPA catch-all never exposed.
// noindex keeps them unlisted — this is discoverability hygiene, not a
// security control (the real gate is the role check server-side).
export function portalMetadata(title: string): Metadata {
  return {
    title: `${title} — Murchid`,
    robots: { index: false, follow: false },
  };
}
