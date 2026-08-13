import type { Metadata } from "next";
import Bento from "@/features/studio-previews/variants/bento/Bento";

// Studio design 5 of 7 — "Bento". Listed at /preview.
//
// Renders the fixed session in src/features/studio-previews/fixture.ts.
// Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Bento (design 5)",
  robots: { index: false, follow: false },
};

export default function Preview5Page() {
  return <Bento />;
}
