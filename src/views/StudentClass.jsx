"use client";

// =====================================================================
// One subject, as the student sees it
//
// A student holds one grade and several subjects, one per teacher, and
// each roster row IS a subject. This is that row opened up: everything
// their teacher has set, what they have done about each item, and
// nothing whatsoever about anybody else.
//
// The work is grouped by what the student has to DO, not by what it is.
// "To do" first, because that is the question they came to answer;
// "Upcoming" next, because it is the one they will ask second; and
// "Done" last, closed, as a record rather than a task list.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen, ClipboardList, PencilLine, Sparkles, Presentation as PresentIcon,
  Clock, CheckCircle2, Upload, ArrowRight,
} from "lucide-react";
import { api } from "./_shared";
import BrandLoader from "../components/BrandLoader";
import { navigate } from "@/lib/route";

/** What each kind of work is called, and what it looks like. */
const KIND = {
  lesson_plan:  { label: "Lesson",       icon: BookOpen,      verb: "Read" },
  presentation: { label: "Slides",       icon: PresentIcon,   verb: "View" },
  quiz:         { label: "Quiz",         icon: ClipboardList, verb: "Start" },
  homework:     { label: "Homework",     icon: PencilLine,    verb: "Hand in" },
  activity:     { label: "Activity",     icon: Sparkles,      verb: "Hand in" },
};

/** Work the student has to act on. A lesson is read, not returned. */
const NEEDS_RETURN = new Set(["quiz", "homework", "activity"]);

/**
 * The four things a subject actually contains.
 *
 * Lesson and slides share a tab because they are one lesson: the notes
 * are what was taught and the deck is what was shown. Splitting them
 * would make a child open two tabs to revise one hour.
 */
const TABS = [
  { key: "lesson",   label: "Lesson",   types: ["lesson_plan", "presentation"], icon: BookOpen },
  { key: "quiz",     label: "Quizzes",  types: ["quiz"],       icon: ClipboardList },
  { key: "homework", label: "Homework", types: ["homework"],   icon: PencilLine },
  { key: "activity", label: "Activities", types: ["activity"], icon: Sparkles },
];

function isDone(w) {
  if (w.type === "quiz") return Boolean(w.attempted_at);
  if (NEEDS_RETURN.has(w.type)) return Boolean(w.submitted);
  return false; // a lesson or a deck is never "done" — it is there to be read
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : null;

const fmtTime = (t) => (t ? String(t).slice(0, 5) : null);

export default function StudentClass({ studentRowId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api(`/api/student/class/${studentRowId}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [studentRowId]);

  const [tab, setTab] = useState("lesson");

  /** How many items sit under each tab — a tab with nothing in it says so. */
  const counts = useMemo(() => {
    const work = data?.work || [];
    const out = {};
    for (const t of TABS) out[t.key] = work.filter((w) => t.types.includes(w.type)).length;
    return out;
  }, [data]);

  const groups = useMemo(() => {
    const types = TABS.find((t) => t.key === tab)?.types || [];
    const work = (data?.work || []).filter((w) => types.includes(w.type));
    const todo = [];
    const upcoming = [];
    const done = [];
    for (const w of work) {
      if (isDone(w)) done.push(w);
      else if (w.is_upcoming) upcoming.push(w);
      else todo.push(w);
    }
    return { todo, upcoming, done, total: work.length };
  }, [data, tab]);

  if (error) {
    return (
      <div className="bg-paper border border-accent rounded-lg p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
      </div>
    );
  }
  if (!data) return <BrandLoader />;

  const empty = (data.work || []).length === 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" />
          {data.grade}{data.section ? ` · ${data.section}` : ""}
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          {data.subject || <em className="italic font-light text-accent">Your class</em>}
        </h2>
        {data.teacher && (
          <p className="text-muted mt-2">Taught by {data.teacher}</p>
        )}
      </div>

      {empty ? (
        <div className="border border-line rounded-xl p-12 text-center">
          <p className="text-ink mb-1">Nothing set yet.</p>
          <p className="text-sm text-muted">
            When {data.teacher || "your teacher"} sets work for {data.subject || "this class"},
            it appears here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 border-b border-line -mb-2 overflow-x-auto">
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition whitespace-nowrap ${
                    active
                      ? "border-accent text-ink"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                  {counts[key] > 0 && (
                    <span className="font-mono text-[10px] text-muted">{counts[key]}</span>
                  )}
                </button>
              );
            })}
          </div>

          {groups.total === 0 ? (
            <div className="border border-line rounded-xl p-12 text-center">
              <p className="text-sm text-muted">
                Nothing here yet for {TABS.find((t) => t.key === tab)?.label.toLowerCase()}.
              </p>
            </div>
          ) : (
            <>
              <Group title="To do" items={groups.todo} tone="accent" />
              <Group title="Coming up" items={groups.upcoming} tone="muted" />
              <Group title="Done" items={groups.done} tone="sage" done />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Group({ title, items, tone, done = false }) {
  if (!items.length) return null;
  return (
    <section>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
        <span className={`w-6 h-px ${tone === "accent" ? "bg-accent" : "bg-line"}`} />
        {title} <span className="text-ink-soft">{items.length}</span>
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((w) => (
          <WorkCard key={w.entry_id} w={w} done={done} />
        ))}
      </div>
    </section>
  );
}

function WorkCard({ w, done }) {
  const kind = KIND[w.type] || { label: w.type, icon: BookOpen, verb: "Open" };
  const Icon = kind.icon;
  const date = fmtDate(w.date);
  const time = fmtTime(w.start_time);

  return (
    <button
      type="button"
      onClick={() => navigate(["student-work", w.entry_id])}
      className={`text-start border rounded-xl p-4 transition hover:border-ink ${
        done ? "border-line bg-paper-warm/40" : "border-line bg-paper"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-accent flex-shrink-0"><Icon size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted mb-1">
            {kind.label}
          </p>
          <p className="text-ink font-medium leading-snug mb-2">{w.title}</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {/* Only says when it is scheduled, and only if it is. An
                undated item is work she has set but not placed in a week
                yet, and inventing a date for it would be a lie. */}
            {date ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} />
                {w.is_upcoming ? "Scheduled for " : ""}{date}{time ? ` · ${time}` : ""}
              </span>
            ) : (
              <span>No date set</span>
            )}

            {w.type === "quiz" && w.attempted_at && (
              <span className="inline-flex items-center gap-1 text-sage">
                <CheckCircle2 size={11} />
                {w.score != null && w.max_score
                  ? `${w.score}/${w.max_score}`
                  : "Submitted"}
              </span>
            )}
            {NEEDS_RETURN.has(w.type) && w.type !== "quiz" && w.submitted && (
              <span className="inline-flex items-center gap-1 text-sage">
                <CheckCircle2 size={11} /> Handed in
              </span>
            )}
            {NEEDS_RETURN.has(w.type) && !isDone(w) && (
              <span className="inline-flex items-center gap-1 text-clay">
                {w.type === "quiz" ? <ClipboardList size={11} /> : <Upload size={11} />}
                {w.type === "quiz" ? "Not attempted" : "Not handed in"}
              </span>
            )}
          </div>
        </div>
        <ArrowRight size={14} className="text-muted flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}
