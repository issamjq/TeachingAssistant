import type { Metadata } from "next";
import Nova from "@/features/studio-previews/variants/nova/Nova";

// Studio design 4 of 10 — "Nova". Listed at /preview.
//
// Renders the two fixed sessions in
// src/features/studio-previews/fixture.ts inside the shared studio
// chrome. Nothing here fetches, generates or saves.
export const metadata: Metadata = {
  title: "Murchid Studio — Nova (design 4)",
  robots: { index: false, follow: false },
};

export default function Preview4Page() {
  return <Nova />;
}
