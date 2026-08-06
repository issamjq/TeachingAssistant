import type { Metadata } from "next";
import Schedule from "@/views/Schedule";

export const metadata: Metadata = { title: "Schedule — Murchid" };

export default function SchedulePage() {
  return <Schedule />;
}
