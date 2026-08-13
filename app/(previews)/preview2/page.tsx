import type { Metadata } from "next";
import Canvas from "@/features/studio-previews/variants/canvas/Canvas";

// Studio design 2 of 7 — "Canvas". Listed at /preview.
//
// Renders the fixed session in src/features/studio-previews/fixture.ts.
// Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Canvas (design 2)",
  robots: { index: false, follow: false },
};

export default function Preview2Page() {
  return <Canvas />;
}
