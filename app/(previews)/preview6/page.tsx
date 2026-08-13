import type { Metadata } from "next";
import Desk from "@/features/studio-previews/variants/desk/Desk";

// Studio design 6 of 10 — "Desk". Listed at /preview.
//
// Renders the two fixed sessions in
// src/features/studio-previews/fixture.ts inside the shared studio
// chrome. Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Desk (design 6)",
  robots: { index: false, follow: false },
};

export default function Preview6Page() {
  return <Desk />;
}
