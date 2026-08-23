import type { Metadata } from "next";
import StudentWork from "@/views/StudentWork";

// One piece of work. student_work() answers null for any entry that does
// not reach this student, so an id typed into the bar shows nothing.
export const metadata: Metadata = {
  title: "My work — Murchid",
  robots: { index: false, follow: false },
};

export default async function StudentWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentWork entryId={id} />;
}
