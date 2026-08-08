import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 7 of 7 — "Khatim". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eight indexed pages of identical content is duplication, not eight
// landing pages.
export const metadata: Metadata = {
  title: "Murchid — Khatim (variant 7)",
  robots: { index: false, follow: false },
};

export default function Preview7Page() {
  return <PreviewLandingRoute variant="khatim" />;
}
