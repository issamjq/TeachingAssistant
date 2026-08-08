import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 1 of 10 — "Atelier". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eleven indexed pages of identical content is duplication, not
// eleven landing pages.
export const metadata: Metadata = {
  title: "Murchid — Atelier (variant 1)",
  robots: { index: false, follow: false },
};

export default function Preview1Page() {
  return <PreviewLandingRoute variant="atelier" />;
}
