import type { Metadata } from "next";
import Gallery from "@/features/studio-previews/Gallery";

// The chooser for the ten studio designs, served at /preview1../preview10.
//
// It used to live at /preview. That address now carries the subject-first
// studio preview, which is a proposal about the product's information
// architecture rather than a comparison of screen designs — a different
// question, and the one being asked right now. The ten cuts and this
// chooser are unchanged; only the address moved.
//
// noindex: these are internal design comparisons carrying a fixed
// fictional session, and none of them is a page a visitor should land on
// from a search result.
export const metadata: Metadata = {
  title: "Murchid — Studio, ten designs",
  robots: { index: false, follow: false },
};

export default function StudioDesignsPage() {
  return <Gallery />;
}
