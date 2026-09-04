"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Lessons" },
  { segment: "notes", label: "Notes & text" },
  { segment: "exams", label: "Exams" },
  { segment: "quizzes", label: "Quizzes" },
  { segment: "results", label: "Results" },
  { segment: "attendance", label: "Attendance" },
  { segment: "students", label: "Students" },
  { segment: "settings", label: "Settings" },
] as const;

export function ClassTabs({ classId }: { classId: string }) {
  const pathname = usePathname();
  const base = `/classes/${classId}`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-6 md:px-8">
      {TABS.map(({ segment, label }) => {
        const href = segment ? `${base}/${segment}` : base;
        const active = pathname === href;
        return (
          <Link
            key={label}
            href={href}
            className={cn(
              "whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              active && "border-primary text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
