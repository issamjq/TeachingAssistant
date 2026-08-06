import type { Metadata } from "next";
import PresentationsRoute from "@/features/presentations/components/PresentationsRoute";

export const metadata: Metadata = { title: "Presentations — Murchid" };

export default async function PresentationsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <PresentationsRoute slug={slug} />;
}
