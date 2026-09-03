import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalSheet } from "@/features/marketing";

const DOCS = ["privacy", "terms"] as const;
type Doc = (typeof DOCS)[number];

export function generateStaticParams() {
  return DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const title = doc === "terms" ? "Terms" : "Privacy";
  return { title: `${title} — Murchid`, robots: { index: false } };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ doc: string }>;
}) {
  const { doc } = await params;
  if (!DOCS.includes(doc as Doc)) notFound();
  return <LegalSheet doc={doc as Doc} />;
}
