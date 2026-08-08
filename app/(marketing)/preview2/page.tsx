import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 2 of 10 — "Cover". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eleven indexed pages of identical content is duplication, not
// eleven landing pages.
export const metadata: Metadata = {
  title: "Murchid — Cover (variant 2)",
  robots: { index: false, follow: false },
};

export default function Preview2Page() {
  return <PreviewLandingRoute variant="cover" />;
}
