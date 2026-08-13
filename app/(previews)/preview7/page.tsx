import type { Metadata } from "next";
import Focus from "@/features/studio-previews/variants/focus/Focus";

// Studio design 7 of 10 — "Focus". Listed at /preview.
//
// Renders the two fixed sessions in
// src/features/studio-previews/fixture.ts inside the shared studio
// chrome. Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Focus (design 7)",
  robots: { index: false, follow: false },
};

export default function Preview7Page() {
  return <Focus />;
}
