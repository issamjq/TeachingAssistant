import type { Metadata } from "next";
import Focus from "@/features/studio-previews/variants/focus/Focus";

// Studio design 7 of 7 — "Focus". Listed at /preview.
//
// Renders the fixed session in src/features/studio-previews/fixture.ts.
// Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Focus (design 7)",
  robots: { index: false, follow: false },
};

export default function Preview7Page() {
  return <Focus />;
}
