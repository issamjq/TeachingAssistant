import type { Metadata } from "next";
import StudentAttendance from "@/views/StudentAttendance";

export const metadata: Metadata = {
  title: "My attendance — Murchid",
  robots: { index: false, follow: false },
};

export default function StudentAttendancePage() {
  return <StudentAttendance />;
}
