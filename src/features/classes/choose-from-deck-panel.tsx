"use client";

import { useEffect, useState } from "react";
import { LibraryBig, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SYLLABUS_TYPES } from "@/features/onboarding/uae-institutions";
import {
  listSharedMaterials,
  attachExistingMaterial,
  type SharedMaterialRow,
} from "@/lib/data/library";

export function ChooseFromDeckPanel({
  ownerId,
  classId,
  onAttached,
}: {
  ownerId: string;
  classId: string;
  onAttached: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [syllabus, setSyllabus] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [results, setResults] = useState<SharedMaterialRow[] | null>(null);
  const [attaching, setAttaching] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    listSharedMaterials({
      syllabus: syllabus || undefined,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
      subject: subject || undefined,
    }).then(setResults);
  }, [open, syllabus, gradeLevel, subject]);

  async function attach(materialId: string) {
    setAttaching(materialId);
    try {
      await attachExistingMaterial(ownerId, classId, materialId);
      onAttached();
      setOpen(false);
    } finally {
      setAttaching(null);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <LibraryBig /> Choose from deck
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Choose from the shared deck</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Any syllabus</option>
            {SYLLABUS_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Input
            type="number"
            placeholder="Grade"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className="h-8 w-20 text-xs"
          />
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-8 w-32 text-xs"
          />
        </div>
        {results === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : results.length === 0 ? (
          <EmptyState
            icon={LibraryBig}
            title="No shared materials match"
            description="Ask a super admin to add documents to the shared library, or try different filters."
          />
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {results.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[r.syllabus, r.grade_level ? `Grade ${r.grade_level}` : null, r.subject]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={attaching === r.id}
                  onClick={() => attach(r.id)}
                >
                  {attaching === r.id ? "Adding…" : "Add"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
