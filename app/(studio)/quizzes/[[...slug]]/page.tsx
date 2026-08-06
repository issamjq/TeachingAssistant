import type { Metadata } from "next";
import QuizzesRoute from "@/features/quizzes/components/QuizzesRoute";

export const metadata: Metadata = { title: "Quizzes — Murchid" };

// Optional catch-all so /quizzes, /quizzes/new and /quizzes/edit/:id all
// resolve here; the feature component picks which view renders.
export default async function QuizzesPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <QuizzesRoute slug={slug} />;
}
