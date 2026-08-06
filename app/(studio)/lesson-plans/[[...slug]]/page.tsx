import type { Metadata } from "next";
import LessonPlansRoute from "@/features/lesson-plans/components/LessonPlansRoute";

export const metadata: Metadata = { title: "Lesson Plans — Murchid" };

export default async function LessonPlansPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <LessonPlansRoute slug={slug} />;
}
