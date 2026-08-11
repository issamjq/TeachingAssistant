import type { Metadata } from "next";
import FunnelRoute from "@/features/marketing/FunnelRoute";

export const metadata: Metadata = { title: "Sign in — Murchid" };

export default function SignInPage() {
  return <FunnelRoute mode="signin" />;
}
