import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 10 of 12 — "Mihrab". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and thirteen indexed pages of identical content is duplication, not
// thirteen landing pages.
export const metadata: Metadata = {
  title: "Murchid — Mihrab (variant 10)",
  robots: { index: false, follow: false },
};

export default function Preview10Page() {
  return <PreviewLandingRoute variant="mihrab" />;
}
