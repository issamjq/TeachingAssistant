import type { Metadata } from "next";
import MaterialsView from "@/features/materials/MaterialsView";

export const metadata: Metadata = { title: "My material — Murchid" };

export default function MaterialsPage() {
  return <MaterialsView />;
}
