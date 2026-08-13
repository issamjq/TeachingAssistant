import type { Metadata } from "next";
import Atelier from "@/features/studio-previews/variants/atelier/Atelier";

// Studio design 1 of 10 — "Atelier". Listed at /preview.
//
// Renders the two fixed sessions in
// src/features/studio-previews/fixture.ts inside the shared studio
// chrome. Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Atelier (design 1)",
  robots: { index: false, follow: false },
};

export default function Preview1Page() {
  return <Atelier />;
}
