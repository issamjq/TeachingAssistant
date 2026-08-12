import type { Metadata } from "next";
import { StudentBoardRoute } from "@/features/bulletin-board";

// The student's side of the bulletin board, reached over the share
// link a teacher copies from the studio. Deliberately OUTSIDE the
// (studio) and (portal) groups: there is no session here and no shell —
// the token in the path is the entire story.

export const metadata: Metadata = { title: "Class board — Murchid" };

export default async function BoardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <StudentBoardRoute token={token} />;
}
