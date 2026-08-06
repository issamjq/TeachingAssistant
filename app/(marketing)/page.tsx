import type { Metadata } from "next";
import LandingRoute from "@/features/landing/components/LandingRoute";

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

export default function HomePage() {
  return <LandingRoute />;
}
