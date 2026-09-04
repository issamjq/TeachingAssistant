"use client";

import Link from "next/link";
import { FileWarning } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ReferenceRequiredNotice({ classId }: { classId: string }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-dashed border-warning/40 bg-warning/5 p-4">
      <FileWarning className="size-5 shrink-0 text-warning" />
      <div className="flex-1">
        <p className="text-sm font-medium">Add a syllabus or reference first</p>
        <p className="text-xs text-muted-foreground">
          Upload a document or choose from the shared deck in Notes & text —
          without one, a draft has nothing to be grounded in.
        </p>
      </div>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link href={`/classes/${classId}/notes`}>Go to Notes</Link>
      </Button>
    </div>
  );
}
