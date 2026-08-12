import type { Metadata } from "next";
import { TeachingSkillsRoute } from "@/features/teaching-skills";

export const metadata: Metadata = { title: "Teaching skills — Murchid" };

export default function TeachingSkillsPage() {
  return <TeachingSkillsRoute />;
}
