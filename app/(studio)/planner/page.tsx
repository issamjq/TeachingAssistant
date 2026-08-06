import type { Metadata } from "next";
import Planner from "@/views/Planner";

export const metadata: Metadata = { title: "Planner — Murchid" };

export default function PlannerPage() {
  return <Planner />;
}
