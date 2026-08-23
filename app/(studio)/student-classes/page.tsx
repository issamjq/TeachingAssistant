import type { Metadata } from "next";
import StudentClasses from "@/views/StudentClasses";

export const metadata: Metadata = {
  title: "My classes — Murchid",
  robots: { index: false, follow: false },
};

export default function StudentClassesPage() {
  return <StudentClasses />;
}
