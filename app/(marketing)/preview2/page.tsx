import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 2 of 7 — "Card fan". Listed at /preview.
//
// Slot 2 is the design this replaced — the original card fan, now
// shipping nowhere, kept here so the incumbent is one click from every
// alternative.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eight indexed pages of identical content is duplication, not eight
// landing pages.
export const metadata: Metadata = {
  title: "Murchid — Card fan (variant 2)",
  robots: { index: false, follow: false },
};

export default function Preview2Page() {
  return <PreviewLandingRoute variant="legacy" />;
}
