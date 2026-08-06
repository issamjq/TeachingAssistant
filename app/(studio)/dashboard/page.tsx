import type { Metadata } from "next";
import DashboardRoute from "@/features/dashboard/components/DashboardRoute";

export const metadata: Metadata = { title: "Dashboard — Murchid" };

export default function DashboardPage() {
  return <DashboardRoute />;
}
