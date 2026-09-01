"use client";

// The honest answer to "did my class get this?", on the work itself.
//
// A quiz or homework row in ai_studio is only the teacher's half; the
// class's half is a schedule entry carrying it (db/tune.sql §48). The
// builders let a teacher fill in a grade, a subject, even a "scheduled
// date" — all stored on her row, none of it delivery — so a quiz could
// say "Saved" and be invisible to every student. This banner reads the
// timetable and says which of the two states the work is really in,
// with the one action that changes it.

import { useEffect, useState } from "react";
import { CalendarPlus, CircleAlert, Users } from "lucide-react";
import { api } from "@/shared/lib/apiClient";
import { navigate } from "@/lib/route";
import { PREFILL_KEY } from "@/shared/lib/assistantPrefill";
import { classLabel, matchRoster, type Audience } from "@/shared/lib/classMatch";
import { useRoster } from "./useRoster";

interface ScheduleEntry extends Audience {
  id: string;
  draft_id: string | null;
  title: string;
  date: string;
  start_time: string | null;
  status: string | null;
}

function readableDate(date: string, start: string | null): string {
  const day = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return start ? `${day}, ${String(start).slice(0, 5)}` : day;
}

export function DeliveryStatus({
  draftId,
  title,
  audience,
  /** Bump to re-read the timetable after a save. */
  refreshKey = 0,
  className = "",
}: {
  draftId: string | null | undefined;
  title?: string;
  audience: Audience;
  refreshKey?: number;
  /** Margin belongs to the caller — the banner may not render at all. */
  className?: string;
}) {
  const { roster, ready } = useRoster();
  const [entries, setEntries] = useState<ScheduleEntry[] | null>(null);

  useEffect(() => {
    // Unsaved work has no delivery state; the render guard below keeps a
    // stale list from showing if the id were ever cleared.
    if (!draftId) return;
    let live = true;
    api<ScheduleEntry[]>("/api/schedule")
      .then((rows) => {
        if (!live) return;
        setEntries(
          (Array.isArray(rows) ? rows : []).filter(
            (e) => String(e.draft_id) === String(draftId) && e.status !== "cancelled",
          ),
        );
      })
      .catch(() => {
        if (live) setEntries(null);
      });
    return () => {
      live = false;
    };
  }, [draftId, refreshKey]);

  // Unsaved work has no delivery state yet, and an unread timetable has
  // nothing honest to say.
  if (!draftId || entries === null || !ready) return null;

  const placeOnTimetable = () => {
    try {
      sessionStorage.setItem(
        PREFILL_KEY,
        JSON.stringify({
          action: "add_schedule_entry",
          at: Date.now(),
          draft_id: String(draftId),
          title: title || "",
          subject: String(audience.subject ?? ""),
          grade: String(audience.grade ?? ""),
          section: String(audience.section ?? ""),
        }),
      );
    } catch {
      /* the planner still opens; the teacher links the work by hand */
    }
    navigate(["planner"]);
  };

  if (!entries.length) {
    return (
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-paper px-3.5 py-2.5 ${className}`}>
        <p className="text-[12.5px] text-warn flex items-center gap-1.5 min-w-0">
          <CircleAlert size={14} className="flex-none" aria-hidden />
          Not on the timetable — students can&rsquo;t see this yet. Work reaches your
          class only through a timetable slot.
        </p>
        <button
          type="button"
          onClick={placeOnTimetable}
          className="murchid-pressable murchid-focus inline-flex items-center gap-1.5 rounded-full border border-accent/50 px-3 py-1 text-[12px] text-accent hover:bg-accent hover:text-on-accent transition-colors"
        >
          <CalendarPlus size={12} aria-hidden /> Put it on the timetable
        </button>
      </div>
    );
  }

  // The nearest upcoming slot, or the most recent one when all have passed.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = entries
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const shown = upcoming[0] ?? entries.sort((a, b) => b.date.localeCompare(a.date))[0]!;
  const matched = matchRoster(shown, roster);

  return (
    <div className={`rounded-lg border border-line bg-paper px-3.5 py-2.5 ${className}`}>
      <p
        className={`text-[12.5px] flex items-center gap-1.5 ${
          matched.length ? "text-ok" : "text-warn"
        }`}
      >
        <Users size={14} className="flex-none" aria-hidden />
        {matched.length ? (
          <>
            On the timetable for {readableDate(shown.date, shown.start_time)} — reaches{" "}
            {matched.length} student{matched.length === 1 ? "" : "s"}
            {classLabel(shown) ? ` (${classLabel(shown)})` : ""}.
          </>
        ) : (
          <>
            On the timetable for {readableDate(shown.date, shown.start_time)}, but its
            grade and subject{classLabel(shown) ? ` (${classLabel(shown)})` : ""} match
            nobody on your roster — check the spelling against My students.
          </>
        )}
      </p>
    </div>
  );
}
