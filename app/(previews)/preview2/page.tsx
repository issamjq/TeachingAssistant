import type { Metadata } from "next";
import Canvas from "@/features/studio-previews/variants/canvas/Canvas";

// Studio design 2 of 10 — "Canvas". Listed at /preview.
//
// Renders the two fixed sessions in
// src/features/studio-previews/fixture.ts inside the shared studio
// chrome. Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Canvas (design 2)",
  robots: { index: false, follow: false },
};

export default function Preview2Page() {
  return <Canvas />;
}
