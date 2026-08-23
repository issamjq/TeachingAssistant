import type { Metadata } from "next";
import CreditUsage from "@/views/CreditUsage";

// Her own spending only — my_ai_usage() reads the caller's faculty id
// from the session rather than a parameter, so there is no id here to
// tamper with and no authorisation for this segment to carry.
export const metadata: Metadata = {
  title: "Credits used — Murchid",
  robots: { index: false, follow: false },
};

export default function CreditUsagePage() {
  return <CreditUsage />;
}
