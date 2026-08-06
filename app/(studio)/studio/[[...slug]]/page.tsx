import type { Metadata } from "next";
import StudioRoute from "@/features/studio-ai/components/StudioRoute";

export const metadata: Metadata = { title: "Studio — Murchid" };

export default async function StudioPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <StudioRoute slug={slug} />;
}
