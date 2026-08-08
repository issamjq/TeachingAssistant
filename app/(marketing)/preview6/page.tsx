import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 6 of 7 — "Mihrab". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eight indexed pages of identical content is duplication, not eight
// landing pages.
export const metadata: Metadata = {
  title: "Murchid — Mihrab (variant 6)",
  robots: { index: false, follow: false },
};

export default function Preview6Page() {
  return <PreviewLandingRoute variant="mihrab" />;
}
