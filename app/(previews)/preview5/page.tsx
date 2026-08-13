import type { Metadata } from "next";
import Slate from "@/features/studio-previews/variants/slate/Slate";

// Studio design 5 of 10 — "Slate". Listed at /preview.
//
// Renders the two fixed sessions in
// src/features/studio-previews/fixture.ts inside the shared studio
// chrome. Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Slate (design 5)",
  robots: { index: false, follow: false },
};

export default function Preview5Page() {
  return <Slate />;
}
