import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 3 of 12 — "Aperture". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and thirteen indexed pages of identical content is duplication, not
// thirteen landing pages.
export const metadata: Metadata = {
  title: "Murchid — Aperture (variant 3)",
  robots: { index: false, follow: false },
};

export default function Preview3Page() {
  return <PreviewLandingRoute variant="aperture" />;
}
