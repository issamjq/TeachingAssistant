import type { Metadata } from "next";
import WeekView from "@/features/week/WeekView";

export const metadata: Metadata = { title: "This week — Murchid" };

export default function WeekPage() {
  return <WeekView />;
}
