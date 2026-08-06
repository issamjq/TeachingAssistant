import type { Metadata } from "next";
import HomeworkRoute from "@/features/homework/components/HomeworkRoute";

export const metadata: Metadata = { title: "Homework — Murchid" };

export default async function HomeworkPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <HomeworkRoute slug={slug} />;
}
