import type { Metadata } from "next";
import { FunnelRoute } from "@/features/marketing";
import { readBillingMode } from "@/features/marketing/billingMode";

// Metadata is generated rather than static: the title and description are
// the offer, and the offer moves with the billing switch (db/tune.sql
// §89). A search result promising "seven days free" during a free period
// undersells it; promising "free" while plans are on sale oversells it,
// which is the worse of the two.
export async function generateMetadata(): Promise<Metadata> {
  const { billingOn } = await readBillingMode();
  return billingOn
    ? {
        title: "Start seven days free — Murchid",
        description:
          "Create a Murchid account. Seven days of full access, no card required.",
      }
    : {
        title: "Start free — Murchid",
        description:
          "Create a Murchid account. Murchid is free while we are in public testing — the whole studio, no card required.",
      };
}

export default function SignUpPage() {
  return <FunnelRoute mode="signup" />;
}
