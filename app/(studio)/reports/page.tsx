import type { Metadata } from "next";
import Reports from "@/views/Reports";

export const metadata: Metadata = { title: "Reports — Murchid" };

export default function ReportsPage() {
  return <Reports />;
}
