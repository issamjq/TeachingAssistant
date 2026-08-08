import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 2 of 7 — "Aperture". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eight indexed pages of identical content is duplication, not eight
// landing pages.
export const metadata: Metadata = {
  title: "Murchid — Aperture (variant 2)",
  robots: { index: false, follow: false },
};

export default function Preview2Page() {
  return <PreviewLandingRoute variant="aperture" />;
}
