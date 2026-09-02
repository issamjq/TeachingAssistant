"use client";

// This week.
//
// The product grew a screen per noun — lessons, quizzes, homework,
// decks, activities, templates, material, goals, calendar, timetable,
// students, reports — and a teacher's actual question is never "what is
// in my quizzes". It is "what am I teaching next, and is it ready?"
//
// Everything the last few phases built only pays off when it is answered
// in one place: the curriculum gave her a unit, the plan gave the unit
// dates, the dates became lessons, and the lessons need material. This
// is where that chain becomes a Tuesday.
//
// Deliberately NOT the dashboard. That is a configurable overview with
// widgets she can rearrange; this has one job and no settings.

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Sparkles, CheckCircle2, CircleDashed, ClipboardCheck, ArrowRight,
} from "lucide-react";
import { api } from "@/views/_shared";
import BrandLoader from "@/components/BrandLoader";
import { navigate } from "@/lib/route";
import { PREFILL_KEY } from "@/shared/lib/assistantPrefill";
import { isoDay } from "@/lib/localDate";

interface Lesson {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  section: string | null;
  date: string;
  start_time: string | null;
  status: string | null;
  draft_id: string | null;
  has_draft: boolean;
}

interface Week {
  from: string;
  to: string;
  lessons: Lesson[];
  to_mark: number;
}

const DAY_LABEL = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "short",
  });

const audienceOf = (l: Lesson) =>
  [l.grade, l.section, l.subject].filter(Boolean).join(" · ");

/**
 * Send an unmade lesson to the studio with what we already know.
 *
 * The slot has a title, a class and a date — that is a brief. Making her
 * retype it into an empty composer is the thing this screen exists to
 * stop.
 */
function draft(l: Lesson) {
  const brief = [
    l.title,
    audienceOf(l) ? `For ${audienceOf(l)}.` : "",
    `It is taught on ${l.date}.`,
  ].filter(Boolean).join("\n\n");
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify({
      action: "create_work", prompt: brief, kind: "lesson_plan", at: Date.now(),
    }));
  } catch { /* she can retype it; a crash she cannot undo */ }
  navigate(["studio"]);
}

export default function WeekView() {
  const [week, setWeek] = useState<Week | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = isoDay(new Date());

  useEffect(() => {
    let live = true;
    api<Week>("/api/week")
      .then((r) => { if (live) setWeek(r); })
      .catch((e: any) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, Lesson[]>();
    for (const l of week?.lessons || []) {
      const k = String(l.date).slice(0, 10);
      const list = m.get(k);
      if (list) list.push(l); else m.set(k, [l]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [week]);

  const unmade = (week?.lessons || []).filter((l) => !l.has_draft).length;

  if (error) {
    return (
      <div className="rounded-lg border border-line p-4">
        <p className="text-sm text-accent">{error}</p>
      </div>
    );
  }
  if (!week) return <BrandLoader />;

  return (
    <div>
      <header className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1.5">
          This week
        </p>
        <h1 className="font-serif text-2xl leading-tight">
          {week.lessons.length
            ? <>{week.lessons.length} lesson{week.lessons.length === 1 ? "" : "s"}, <em className="text-accent">{unmade || "none"}</em> {unmade === 1 ? "still to make" : "still to make"}</>
            : <>Nothing timetabled <em className="text-accent">yet</em></>}
        </h1>
        {!!week.to_mark && (
          <button
            type="button"
            onClick={() => navigate(["reports"])}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] text-ink hover:underline"
          >
            <ClipboardCheck size={14} className="text-warn" aria-hidden />
            {week.to_mark} paper{week.to_mark === 1 ? "" : "s"} waiting to be marked
            <ArrowRight size={13} aria-hidden />
          </button>
        )}
      </header>

      {!week.lessons.length ? (
        <div className="rounded-xl border border-line p-6 max-w-[52ch]">
          <p className="font-serif text-lg mb-1.5">Your week is empty.</p>
          <p className="text-[13.5px] text-muted leading-relaxed mb-4">
            Plan a unit and Murchid can lay the whole term out for you — every
            lesson on the day you teach it. Or put a single lesson on the
            calendar yourself.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(["goals"])}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-ink text-paper text-sm font-medium"
            >
              <CalendarDays size={15} aria-hidden /> Plan a unit
            </button>
            <button
              type="button"
              onClick={() => navigate(["planner"])}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-line text-sm"
            >
              Open the calendar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {byDay.map(([date, lessons]) => (
            <section key={date}>
              <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted mb-2">
                {DAY_LABEL(date)}
                {date === today && <span className="text-accent"> · today</span>}
              </h2>
              <ul className="space-y-1.5">
                {lessons.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-start gap-3 rounded-lg border border-line px-3.5 py-3"
                  >
                    <span className="flex-none font-mono text-[11px] text-muted pt-0.5 w-[3.2rem] tabular-nums">
                      {l.start_time ? String(l.start_time).slice(0, 5) : "—"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] text-ink">{l.title}</span>
                      {audienceOf(l) && (
                        <span className="block text-[12px] text-muted mt-0.5">{audienceOf(l)}</span>
                      )}
                    </span>
                    <span className="flex-none pt-0.5">
                      {l.has_draft ? (
                        <button
                          type="button"
                          onClick={() => navigate(["lesson-plans", "edit", l.draft_id as string])}
                          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ok hover:underline"
                        >
                          <CheckCircle2 size={12} aria-hidden /> Ready
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => draft(l)}
                          className="inline-flex items-center gap-1.5 text-[12px] text-accent hover:underline"
                          title="Open the studio with this lesson's brief already written"
                        >
                          <Sparkles size={12} aria-hidden /> Make it
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!!week.lessons.length && !!unmade && (
        <p className="mt-6 flex items-center gap-2 text-[12.5px] text-muted">
          <CircleDashed size={13} aria-hidden />
          {unmade} of this week&apos;s lessons {unmade === 1 ? "has" : "have"} nothing
          behind {unmade === 1 ? "it" : "them"} yet.
        </p>
      )}
    </div>
  );
}
