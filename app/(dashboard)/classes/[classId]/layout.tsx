"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { ClassTabs } from "@/components/layout/class-tabs";
import { Button } from "@/components/ui/button";
import { getClassWithPath, type ClassWithPath } from "@/lib/data/classes";

// A `classId` is one subject taught to one division, in one grade, in one
// batch — a single row, not four nested params. Tabs below (lessons, notes,
// exams, quizzes, results, attendance, students, settings) are sibling
// route segments under this layout.
export default function ClassLayout({ children }: { children: React.ReactNode }) {
  const { classId } = useParams<{ classId: string }>();
  const [cls, setCls] = useState<ClassWithPath | null | undefined>(undefined);

  useEffect(() => {
    setCls(undefined);
    getClassWithPath(classId).then(setCls);
  }, [classId]);

  const backLink = (
    <Link
      href="/classes"
      className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" />
      My classes
    </Link>
  );

  if (cls === undefined) {
    return (
      <div className="px-6 pt-5 md:px-8">
        {backLink}
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (cls === null) {
    return (
      <div className="px-6 pt-5 md:px-8">
        {backLink}
        <h1 className="font-serif text-xl font-medium tracking-tight">Class not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This class doesn&apos;t exist, or isn&apos;t yours.
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/classes">Back to My Classes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="px-6 pt-5 md:px-8">
        {backLink}
        <h1 className="font-serif text-xl font-medium tracking-tight">
          Grade {cls.grade.level} · Div {cls.division.label} · {cls.subject}
        </h1>
        <p className="text-sm text-muted-foreground">Batch {cls.batch.label}</p>
      </div>
      <ClassTabs classId={classId} />
      <div className="p-6 md:p-8">{children}</div>
    </div>
  );
}
