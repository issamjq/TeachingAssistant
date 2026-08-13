import type { Metadata } from "next";
import Prism from "@/features/studio-previews/variants/prism/Prism";

// Studio design 10 of 10 — "Prism". Listed at /preview.
//
// Renders the two fixed sessions in
// src/features/studio-previews/fixture.ts inside the shared studio
// chrome. Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Prism (design 10)",
  robots: { index: false, follow: false },
};

export default function Preview10Page() {
  return <Prism />;
}
