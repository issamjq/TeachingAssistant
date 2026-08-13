import type { Metadata } from "next";
import Ribbon from "@/features/studio-previews/variants/ribbon/Ribbon";

// Studio design 8 of 10 — "Ribbon". Listed at /preview.
//
// Renders the two fixed sessions in
// src/features/studio-previews/fixture.ts inside the shared studio
// chrome. Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Ribbon (design 8)",
  robots: { index: false, follow: false },
};

export default function Preview8Page() {
  return <Ribbon />;
}
