import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Stage-one variant 4 of 7 — "Ribbon". Listed at /preview.
//
// noindex: every preview route carries the same marketing copy as "/",
// and eight indexed pages of identical content is duplication, not eight
// landing pages.
export const metadata: Metadata = {
  title: "Murchid — Ribbon (variant 4)",
  robots: { index: false, follow: false },
};

export default function Preview4Page() {
  return <PreviewLandingRoute variant="ribbon" />;
}
