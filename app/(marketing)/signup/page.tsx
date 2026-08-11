import type { Metadata } from "next";
import FunnelRoute from "@/features/marketing/FunnelRoute";

export const metadata: Metadata = {
  title: "Start seven days free — Murchid",
  description:
    "Create a Murchid account. Seven days of full access, no card required.",
};

export default function SignUpPage() {
  return <FunnelRoute mode="signup" />;
}
