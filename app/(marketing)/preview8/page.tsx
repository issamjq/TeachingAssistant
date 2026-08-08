import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 8 of 12 — "Shingle". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and thirteen indexed pages of identical content is duplication, not
// thirteen landing pages.
export const metadata: Metadata = {
  title: "Murchid — Shingle (variant 8)",
  robots: { index: false, follow: false },
};

export default function Preview8Page() {
  return <PreviewLandingRoute variant="shingle" />;
}
