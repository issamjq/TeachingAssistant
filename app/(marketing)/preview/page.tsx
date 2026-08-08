import type { Metadata } from "next";
import PreviewGallery from "@/features/landing/components/PreviewGallery";

// The chooser for the ten stage-one variants, served at /preview1../preview10.
export const metadata: Metadata = {
  title: "Murchid — Landing stage one, ten variants",
  robots: { index: false, follow: false },
};

export default function PreviewIndexPage() {
  return <PreviewGallery />;
}
