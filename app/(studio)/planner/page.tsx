import type { Metadata } from "next";
import PlannerView from "@/features/planner/PlannerView";

export const metadata: Metadata = { title: "Planner — Murchid" };

export default function PlannerPage() {
  return <PlannerView />;
}
