import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 3 of 7 — "Bureau". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eight indexed pages of identical content is duplication, not eight
// landing pages.
export const metadata: Metadata = {
  title: "Murchid — Bureau (variant 3)",
  robots: { index: false, follow: false },
};

export default function Preview3Page() {
  return <PreviewLandingRoute variant="bureau" />;
}
