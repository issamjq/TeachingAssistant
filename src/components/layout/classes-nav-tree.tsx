"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { listHierarchy, type BatchRow } from "@/lib/data/classes";
import { useClassesRefresh } from "@/features/classes/classes-refresh-context";

function currentAcademicStartYear(): number {
  const now = new Date();
  // UAE school year runs roughly Aug/Sep -> Jun, so anything from July
  // onward belongs to the year that just started.
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

// Batch -> Class only. The third level this used to carry (Lessons,
// Presentations, ... Quizzes) duplicated ClassTabs, which already renders
// every tab — 11 of them, not just these 7 — at the top of the class page
// itself once you're on it. The sidebar's job stops at "which class";
// "which view of this class" belongs to the page you're already on.
export function ClassesNavTree() {
  const pathname = usePathname();
  const { version } = useClassesRefresh();
  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    listHierarchy().then((data) => {
      if (cancelled) return;
      setBatches(data);
      setExpanded((prev) => {
        if (prev.size > 0) return prev;
        const currentYear = currentAcademicStartYear();
        const current = data.find((b) => b.start_year === currentYear) ?? data[0];
        return current ? new Set([current.id]) : prev;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (!batches || batches.length === 0) return null;

  const currentYear = currentAcademicStartYear();
  const sorted = batches.slice().sort((a, b) => b.start_year - a.start_year);

  return (
    <div className="mt-1 ml-1 space-y-0.5">
      {sorted.map((batch) => {
        const isOpen = expanded.has(batch.id);
        const isCurrent = batch.start_year === currentYear;
        const items = batch.grades
          .slice()
          .sort((a, b) => a.level - b.level)
          .flatMap((g) =>
            g.divisions.flatMap((d) =>
              d.classes.map((c) => ({
                id: c.id,
                label: `Grade ${g.level} · ${d.label} · ${c.subject}`,
              })),
            ),
          );

        return (
          <div key={batch.id}>
            <button
              type="button"
              onClick={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(batch.id)) next.delete(batch.id);
                  else next.add(batch.id);
                  return next;
                })
              }
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {isOpen ? (
                <ChevronDown className="size-3.5 shrink-0" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{batch.label}</span>
              {isCurrent ? (
                <span className="ml-auto shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Current
                </span>
              ) : null}
            </button>

            {isOpen ? (
              <div className="mt-0.5 space-y-0.5 pb-1 pl-6">
                {items.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-sidebar-foreground/40">
                    No classes yet
                  </p>
                ) : (
                  items.map((c) => {
                    const href = `/classes/${c.id}`;
                    const active = pathname?.startsWith(href);
                    return (
                      <Link
                        key={c.id}
                        href={href}
                        className={cn(
                          "block truncate rounded-md px-2 py-1.5 text-xs",
                          active
                            ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        {c.label}
                      </Link>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
