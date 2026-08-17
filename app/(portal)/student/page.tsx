import type { Metadata } from "next";
import StudentSignIn from "@/features/portal/components/StudentSignIn";

// The student sign-in surface. Unlike the staff portals it does not
// provision a teacher — it claims a roster row by email — so it renders its
// own component rather than the shared PortalSignIn.
export const metadata: Metadata = {
  title: "Student sign-in — Murchid",
  robots: { index: false, follow: false },
};

export default function StudentPortalPage() {
  return <StudentSignIn />;
}
