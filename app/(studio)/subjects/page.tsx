import type { Metadata } from "next";
import SubjectsView from "@/features/subjects/SubjectsView";

export const metadata: Metadata = { title: "Subjects and divisions — Murchid" };

export default function SubjectsPage() {
  return <SubjectsView />;
}
