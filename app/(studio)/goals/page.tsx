import type { Metadata } from "next";
import GoalsView from "@/features/goals/GoalsView";

export const metadata: Metadata = { title: "Goal planner — Murchid" };

export default function GoalsPage() {
  return <GoalsView />;
}
