import type { Metadata } from "next";
import Gallery from "@/features/studio-previews/Gallery";

// The chooser for the seven studio designs, served at /preview1../preview7.
//
// noindex: these are internal design comparisons carrying a fixed
// fictional session, and none of them is a page a visitor should land on
// from a search result.
export const metadata: Metadata = {
  title: "Murchid — Studio, seven designs",
  robots: { index: false, follow: false },
};

export default function PreviewIndexPage() {
  return <Gallery />;
}
