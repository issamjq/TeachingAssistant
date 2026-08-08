import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 7 of 10 — "Orbit". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eleven indexed pages of identical content is duplication, not
// eleven landing pages.
export const metadata: Metadata = {
  title: "Murchid — Orbit (variant 7)",
  robots: { index: false, follow: false },
};

export default function Preview7Page() {
  return <PreviewLandingRoute variant="orbit" />;
}
