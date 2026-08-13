import type { Metadata } from "next";
import Aurora from "@/features/studio-previews/variants/aurora/Aurora";

// Studio design 3 of 7 — "Aurora". Listed at /preview.
//
// Renders the fixed session in src/features/studio-previews/fixture.ts.
// Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Aurora (design 3)",
  robots: { index: false, follow: false },
};

export default function Preview3Page() {
  return <Aurora />;
}
