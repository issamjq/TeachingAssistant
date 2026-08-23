import type { Metadata } from "next";
import StudentClass from "@/views/StudentClass";

// One subject, as the student sees it. The id in the path is a roster
// row — student_class() refuses any row this login has not claimed, so
// the segment carries no authorisation of its own.
export const metadata: Metadata = {
  title: "My class — Murchid",
  robots: { index: false, follow: false },
};

export default async function StudentClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentClass studentRowId={id} />;
}
