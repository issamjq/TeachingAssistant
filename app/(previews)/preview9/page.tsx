import type { Metadata } from "next";
import Terrace from "@/features/studio-previews/variants/terrace/Terrace";

// Studio design 9 of 10 — "Terrace". Listed at /preview.
//
// Renders the two fixed sessions in
// src/features/studio-previews/fixture.ts inside the shared studio
// chrome. Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Terrace (design 9)",
  robots: { index: false, follow: false },
};

export default function Preview9Page() {
  return <Terrace />;
}
