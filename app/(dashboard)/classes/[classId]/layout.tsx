"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { ClassTabs } from "@/components/layout/class-tabs";
import { getClassWithPath, type ClassWithPath } from "@/lib/data/classes";

// A `classId` is one subject taught to one division, in one grade, in one
// batch — a single row, not four nested params. Tabs below (lessons, notes,
// exams, quizzes, results, attendance, students, settings) are sibling
// route segments under this layout.
export default function ClassLayout({ children }: { children: React.ReactNode }) {
  const { classId } = useParams<{ classId: string }>();
  const [cls, setCls] = useState<ClassWithPath | null | undefined>(undefined);

  useEffect(() => {
    getClassWithPath(classId).then(setCls);
  }, [classId]);

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
          {cls === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : cls === null ? (
            <p className="text-sm text-destructive">Class not found.</p>
          ) : (
            <>
              <h1 className="text-lg font-semibold tracking-tight">
                Grade {cls.grade.level} · Div {cls.division.label} · {cls.subject}
              </h1>
              <p className="text-sm text-muted-foreground">Batch {cls.batch.label}</p>
            </>
          )}
        </div>
      </div>
      <ClassTabs classId={classId} />
      <div className="p-6 md:p-8">{children}</div>
    </div>
  );
}
