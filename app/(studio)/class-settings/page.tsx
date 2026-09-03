import type { Metadata } from "next";
import ClassSettingsView from "@/features/class-settings/ClassSettingsView";

export const metadata: Metadata = { title: "Class settings — Murchid" };

export default function ClassSettingsPage() {
  return <ClassSettingsView />;
}
