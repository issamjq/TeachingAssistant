import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 12 of 12 — "Khatim". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and thirteen indexed pages of identical content is duplication, not
// thirteen landing pages.
export const metadata: Metadata = {
  title: "Murchid — Khatim (variant 12)",
  robots: { index: false, follow: false },
};

export default function Preview12Page() {
  return <PreviewLandingRoute variant="khatim" />;
}
