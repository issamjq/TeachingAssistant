import type { Metadata } from "next";
import Atelier from "@/features/studio-previews/variants/atelier/Atelier";

// Studio design 1 of 7 — "Atelier". Listed at /preview.
//
// Renders the fixed session in src/features/studio-previews/fixture.ts.
// Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Atelier (design 1)",
  robots: { index: false, follow: false },
};

export default function Preview1Page() {
  return <Atelier />;
}
