import type { Metadata } from "next";
import PreviewLandingRoute from "@/features/landing/components/PreviewLandingRoute";

// Design preview of the landing page's opening act — the constellation cut.
//
// Lives inside the (marketing) group so it inherits the same language
// provider, router bridge and accessibility widget the real landing gets;
// a preview rendered under a different shell tells you nothing about how
// the real page behaves.
//
// noindex: it is the same marketing copy as "/", and two indexed pages
// with identical content is a duplicate, not a second landing page.
export const metadata: Metadata = {
  title: "Murchid — Landing preview",
  robots: { index: false, follow: false },
};

export default function LandingPreviewPage() {
  return <PreviewLandingRoute />;
}
