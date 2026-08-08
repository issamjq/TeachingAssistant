import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 10 of 10 — "Mihrab". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eleven indexed pages of identical content is duplication, not
// eleven landing pages.
export const metadata: Metadata = {
  title: "Murchid — Mihrab (variant 10)",
  robots: { index: false, follow: false },
};

export default function Preview10Page() {
  return <PreviewLandingRoute variant="mihrab" />;
}
