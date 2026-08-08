import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 5 of 10 — "Spread". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eleven indexed pages of identical content is duplication, not
// eleven landing pages.
export const metadata: Metadata = {
  title: "Murchid — Spread (variant 5)",
  robots: { index: false, follow: false },
};

export default function Preview5Page() {
  return <PreviewLandingRoute variant="spread" />;
}
