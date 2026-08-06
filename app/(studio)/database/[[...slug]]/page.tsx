import type { Metadata } from "next";
import DatabaseRoute from "@/features/students/components/DatabaseRoute";

export const metadata: Metadata = { title: "My students — Murchid" };

export default async function DatabasePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <DatabaseRoute slug={slug} />;
}
