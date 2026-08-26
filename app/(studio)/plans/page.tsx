import type { Metadata } from "next";
import Plans from "@/views/Plans";

// Reached from the low-balance banner and from Account → Upgrade plan.
export const metadata: Metadata = {
  title: "Plans — Murchid",
  robots: { index: false, follow: false },
};

export default function PlansPage() {
  return <Plans />;
}
