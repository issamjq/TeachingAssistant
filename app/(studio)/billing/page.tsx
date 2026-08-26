import type { Metadata } from "next";
import Billing from "@/views/Billing";

// Her own account only — my_billing() reads the caller's faculty id from
// the session, and `payments` has a select-only owner policy with no
// write policy at all, so this segment carries no authorisation of its own.
export const metadata: Metadata = {
  title: "Billing — Murchid",
  robots: { index: false, follow: false },
};

export default function BillingPage() {
  return <Billing />;
}
