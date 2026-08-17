import type { Metadata } from "next";
import StudentDashboard from "@/views/StudentDashboard";

// The student's own dashboard. StudioShell bounces any section not in
// SECTIONS_BY_ROLE for the signed-in role, and student_dashboard() is
// scoped by current_student_id() in the database — so this segment carries
// no authorisation logic of its own.
export const metadata: Metadata = {
  title: "My dashboard — Murchid",
  robots: { index: false, follow: false },
};

export default function StudentDashboardPage() {
  return <StudentDashboard />;
}
