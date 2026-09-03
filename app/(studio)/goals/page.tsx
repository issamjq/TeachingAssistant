import type { Metadata } from "next";
import { Suspense } from "react";
import GoalsView from "@/features/goals/GoalsView";

export const metadata: Metadata = { title: "Goal planner — Murchid" };

export default function GoalsPage() {
  // GoalsView reads ?curriculum=1 (class-settings' "Curriculum" link) via
  // useSearchParams, which Next can only statically prerender inside a
  // Suspense boundary — without one the build fails outright rather than
  // just warning.
  return (
    <Suspense fallback={null}>
      <GoalsView />
    </Suspense>
  );
}
