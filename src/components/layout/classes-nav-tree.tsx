"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { listHierarchy, type BatchRow } from "@/lib/data/classes";
import { useClassesRefresh } from "@/features/classes/classes-refresh-context";

const CONTENT_TABS = [
  { segment: "", label: "Lessons" },
  { segment: "presentations", label: "Presentations" },
  { segment: "activities", label: "Activities" },
  { segment: "homework", label: "Homework" },
  { segment: "notes", label: "Notes & text" },
  { segment: "exams", label: "Exams" },
  { segment: "quizzes", label: "Quizzes" },
] as const;

function currentAcademicStartYear(): number {
  const now = new Date();
  // UAE school year runs roughly Aug/Sep -> Jun, so anything from July
  // onward belongs to the year that just started.
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

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
    <div className="relative ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
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
          <div key={batch.id} className="relative">
            <span
              className={cn(
                "absolute -left-[15px] top-2 size-2 rounded-full border-2 border-sidebar",
                isCurrent ? "bg-primary" : "bg-sidebar-border",
              )}
            />
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
              className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {isOpen ? (
                <ChevronDown className="size-3 shrink-0" />
              ) : (
                <ChevronRight className="size-3 shrink-0" />
              )}
              <span className="truncate">{batch.label}</span>
              {isCurrent ? (
                <span className="ml-auto shrink-0 text-[10px] font-normal text-primary">
                  Current
                </span>
              ) : null}
            </button>

            {isOpen ? (
              <div className="relative ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border pb-1 pl-3">
                {items.length === 0 ? (
                  <p className="py-1 text-[11px] text-sidebar-foreground/40">
                    No classes yet
                  </p>
                ) : (
                  items.map((c) => {
                    const href = `/classes/${c.id}`;
                    const active = pathname?.startsWith(href);
                    return (
                      <div key={c.id} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[13px] top-1/2 size-1.5 -translate-y-1/2 rounded-full",
                            active ? "bg-primary" : "bg-sidebar-border",
                          )}
                        />
                        <Link
                          href={href}
                          className={cn(
                            "block truncate rounded-md px-1.5 py-1 text-[11px]",
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          {c.label}
                        </Link>
                        {active ? (
                          <div className="relative ml-2 mt-0.5 space-y-0.5 border-l border-sidebar-border pb-1 pl-3">
                            {CONTENT_TABS.map((tab) => {
                              const tabHref = tab.segment ? `${href}/${tab.segment}` : href;
                              const tabActive = pathname === tabHref;
                              return (
                                <div key={tab.label} className="relative">
                                  <span
                                    className={cn(
                                      "absolute -left-[13px] top-1/2 size-1 -translate-y-1/2 rounded-full",
                                      tabActive ? "bg-primary" : "bg-sidebar-border",
                                    )}
                                  />
                                  <Link
                                    href={tabHref}
                                    className={cn(
                                      "block truncate rounded-md px-1.5 py-0.5 text-[11px]",
                                      tabActive
                                        ? "text-primary font-medium"
                                        : "text-sidebar-foreground/50 hover:text-sidebar-accent-foreground",
                                    )}
                                  >
                                    {tab.label}
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
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
