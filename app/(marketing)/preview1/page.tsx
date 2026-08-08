import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 1 of 7 — "Atelier". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eight indexed pages of identical content is duplication, not eight
// landing pages.
export const metadata: Metadata = {
  title: "Murchid — Atelier (variant 1)",
  robots: { index: false, follow: false },
};

export default function Preview1Page() {
  return <PreviewLandingRoute variant="atelier" />;
}
