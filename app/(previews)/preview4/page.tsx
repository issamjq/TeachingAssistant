import type { Metadata } from "next";
import Console from "@/features/studio-previews/variants/console/Console";

// Studio design 4 of 7 — "Console". Listed at /preview.
//
// Renders the fixed session in src/features/studio-previews/fixture.ts.
// Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Console (design 4)",
  robots: { index: false, follow: false },
};

export default function Preview4Page() {
  return <Console />;
}
