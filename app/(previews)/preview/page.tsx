import type { Metadata } from "next";
import SubjectPreview from "@/features/subject-preview/SubjectPreview";

// The subject-first studio, previewed on the signed-in account's real
// data before any of it is peeled onto a real route.
//
// The proposal: everything a teacher makes — lesson plans, study notes,
// homework, activities, quizzes, presentations — is filed under the
// SUBJECT it was made for, on both the teacher's side and the student's,
// instead of living in seven kind-shaped libraries that each hold every
// class at once.
//
// Read-only. It calls the same api() paths the studio does, and only
// ever with GET.
//
// The ten studio screen designs that used to be listed here moved to
// /preview/studios; /preview1../preview10 are unchanged.
export const metadata: Metadata = {
  title: "Murchid — Subject-first studio (preview)",
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  return <SubjectPreview />;
}
