import type { Metadata } from "next";
import LandingPage from "@/features/landing/components/LandingPage";

// Live preview of the landing redesign while it is being built chapter by
// chapter. The real landing at "/" stays whole until every chapter is
// rebuilt, then this route is deleted and LandingPage moves to it.
//
// noindex — an unfinished duplicate of the home page is the last thing that
// should end up in search results.
export const metadata: Metadata = {
  title: "Landing preview — Murchid",
  robots: { index: false, follow: false },
};

export default function LandingPreviewPage() {
  return <LandingPage />;
}
