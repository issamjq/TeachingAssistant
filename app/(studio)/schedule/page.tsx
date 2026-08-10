import type { Metadata } from "next";
import ScheduleView from "@/features/schedule/ScheduleView";

export const metadata: Metadata = { title: "Schedule — Murchid" };

export default function SchedulePage() {
  return <ScheduleView />;
}
