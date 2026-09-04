import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { ClassTabs } from "@/components/layout/class-tabs";
import { getClass, classLabel } from "@/features/classes/mock-data";

// A `classId` is one subject taught to one division, in one grade, in one
// batch — a single row, not four nested params. Tabs below (lessons, notes,
// exams, quizzes, results, attendance, students, settings) are sibling
// route segments under this layout.
export default async function ClassLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const cls = getClass(classId);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 px-6 pt-5 md:px-8">
        <div>
          <Link
            href="/classes"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            My classes
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">
            {classLabel(cls)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Batch {cls.batch} · {cls.studentCount} students
          </p>
        </div>
      </div>
      <ClassTabs classId={classId} />
      <div className="p-6 md:p-8">{children}</div>
    </div>
  );
}
