import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 11 of 12 — "Colonnade". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and thirteen indexed pages of identical content is duplication, not
// thirteen landing pages.
export const metadata: Metadata = {
  title: "Murchid — Colonnade (variant 11)",
  robots: { index: false, follow: false },
};

export default function Preview11Page() {
  return <PreviewLandingRoute variant="colonnade" />;
}
