import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 9 of 10 — "Signal". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eleven indexed pages of identical content is duplication, not
// eleven landing pages.
export const metadata: Metadata = {
  title: "Murchid — Signal (variant 9)",
  robots: { index: false, follow: false },
};

export default function Preview9Page() {
  return <PreviewLandingRoute variant="signal" />;
}
