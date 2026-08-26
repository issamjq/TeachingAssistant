import type { Metadata } from "next";
import LandingRoute from "@/features/landing/components/LandingRoute";
import { readBillingMode } from "@/features/marketing/billingMode";

// The one genuinely public, SEO-relevant page in the app. Under Vite it was
// an empty shell hydrated on the client; as a real segment it gets proper
// metadata and can be statically rendered.
export const metadata: Metadata = {
  title: "Murchid — The lesson director",
  description:
    "AI lesson director for teachers, KG–G12. Plan, draft and reuse lessons, quizzes, homework, presentations and activities — in English and Arabic.",
  openGraph: {
    title: "Murchid — The lesson director",
    description:
      "AI lesson director for teachers, KG–G12. The teacher directs, Murchid drafts.",
    type: "website",
  },
};

// ISR, not per-request rendering. The billing switch is read on the
// server so the pricing section is correct in the HTML — no flash of
// three price cards during a free period, and crawlers index what is
// actually true. Sixty seconds is the most a marketing page should lag
// behind a flip, and the page stays cached rather than rendered for
// every visitor, which is what "/" being static was protecting.
export const revalidate = 60;

export default async function HomePage() {
  const mode = await readBillingMode();
  return <LandingRoute billingOn={mode.billingOn} freeGrant={mode.freeGrant} />;
}
