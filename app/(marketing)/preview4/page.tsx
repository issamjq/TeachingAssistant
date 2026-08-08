import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 4 of 12 — "Bureau". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and thirteen indexed pages of identical content is duplication, not
// thirteen landing pages.
export const metadata: Metadata = {
  title: "Murchid — Bureau (variant 4)",
  robots: { index: false, follow: false },
};

export default function Preview4Page() {
  return <PreviewLandingRoute variant="bureau" />;
}
