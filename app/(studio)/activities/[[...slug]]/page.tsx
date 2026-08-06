import type { Metadata } from "next";
import ActivitiesRoute from "@/features/activities/components/ActivitiesRoute";

export const metadata: Metadata = { title: "Activities — Murchid" };

export default async function ActivitiesPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <ActivitiesRoute slug={slug} />;
}
