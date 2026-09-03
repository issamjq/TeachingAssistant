import type { Metadata } from "next";
import { CurriculumView } from "@/features/curriculum";

export const metadata: Metadata = { title: "Curriculum — Murchid" };

export default function CurriculumPage() {
  return <CurriculumView />;
}
