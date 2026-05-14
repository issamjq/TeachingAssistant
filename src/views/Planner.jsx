// Planner — the teacher's monthly calendar. Aggregates every teaching
// surface (lesson plans, schedule, quizzes, homework, presentations,
// activities) onto one grid. Designed as the "where am I this month"
// hub.
//
// Right now only /api/schedule is wired. The remaining domains
// (/api/quizzes, /api/homework, /api/drafts, etc.) will be merged into
// the same event shape later:
//   { id, date: YYYY-MM-DD, kind, title, time? }
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft, ChevronRight, Plus, BookOpen, CalendarDays,
  GraduationCap, ClipboardList, Presentation, Sparkles, ArrowRight,
  MoreHorizontal, MessageCircle, BarChart3, FileText, Layout,
  Users, X, CheckCircle2, Clock, TrendingUp,
} from "lucide-react";
import { navigate } from "../lib/route";
import { api } from "./_shared";
import SchedulePopup from "./_schedule-popup";

// Categories the calendar can show. Each maps to one of the existing
// teaching surfaces, with a Mudir-palette color so the day cells stay
// editorial instead of garish. Icon is shown in the filter row and on
// each event chip.
const CATEGORIES = [
  { key: "lesson-plans",  label: "Lesson Plans",  icon: BookOpen,       color: "ink"          },
  { key: "schedule",      label: "Schedule",      icon: CalendarDays,   color: "sage"         },
  { key: "quizzes",       label: "Quizzes",       icon: GraduationCap,  color: "accent"       },
  { key: "homework",      label: "Homework",      icon: ClipboardList,  color: "gold"         },
  { key: "presentations", label: "Presentations", icon: Presentation,   color: "accent-soft"  },
  { key: "activities",    label: "Activities",    icon: Sparkles,       color: "muted"        },
];

// Resolve a category color key to actual Tailwind classes for chip bg,
// border, and dot. Keeps the category palette in one table so it's easy
// to retune later.
const COLOR_STYLES = {
  "ink":         { dot: "bg-ink",         chipBg: "bg-ink/[0.06]",         chipText: "text-ink",     ring: "ring-ink/30" },
  "sage":        { dot: "bg-sage",        chipBg: "bg-sage/[0.10]",        chipText: "text-sage",    ring: "ring-sage/40" },
  "accent":      { dot: "bg-accent",      chipBg: "bg-accent/[0.08]",      chipText: "text-accent",  ring: "ring-accent/30" },
  "gold":        { dot: "bg-gold",        chipBg: "bg-gold/[0.10]",        chipText: "text-gold",    ring: "ring-gold/40" },
  "accent-soft": { dot: "bg-accent-soft", chipBg: "bg-accent-soft/[0.10]", chipText: "text-accent-soft", ring: "ring-accent-soft/40" },
  "muted":       { dot: "bg-muted",       chipBg: "bg-muted/[0.10]",       chipText: "text-muted",   ring: "ring-muted/40" },
};

// Calendar maths — return a 6×7 grid of Date objects for the month
// containing `anchor`, padded with leading days from the previous month
// and trailing days from the next so the grid is always rectangular.
function monthGrid(anchor, weekStart = 1 /* Mon */) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const firstOfMonth = new Date(y, m, 1);
  const offset = (firstOfMonth.getDay() - weekStart + 7) % 7;
  const start = new Date(y, m, 1 - offset);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  // Drop the 6th week when it's entirely next-month — keeps the grid
  // free of "padding days" that don't belong to the displayed month,
  // and lets the remaining 5 rows flex-fill the same vertical space
  // so each cell reads bigger.
  return days[35].getMonth() !== m ? days.slice(0, 35) : days;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const isoKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const sameYMD = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function Planner() {
  // The visible month (1st of the displayed month). Today by default.
  const [anchor, setAnchor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  // Filters — which category keys are visible. All-on by default.
  const [visible, setVisible] = useState(
    () => new Set(CATEGORIES.map((c) => c.key))
  );
  // Day-action flow: click a calendar cell → DayListPopup that lists
  // that day's entries with a "+ New entry" button in the header.
  // Clicking an entry opens SchedulePopup in edit mode; clicking
  // "New entry" opens it in create mode with the date pre-filled.
  const [showSchedule, setShowSchedule] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formDefaultDate, setFormDefaultDate] = useState(null);
  const [dayListDate, setDayListDate] = useState(null); // ISO date string
  const today = new Date();

  const openNewForDay = (iso) => {
    setFormDefaultDate(iso);
    setEditingEntry(null);
    setDayListDate(null);
    setShowSchedule(true);
  };
  const openEditEntry = (entry) => {
    setEditingEntry(entry);
    setDayListDate(null);
    setShowSchedule(true);
  };

  // Toggle a category on/off. Shift-click would isolate one in a fuller
  // build; the simple version below is fine for the scaffold.
  const toggleCategory = (key) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const goPrev = () =>
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1));
  const goNext = () =>
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1));
  const goToday = () =>
    setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));

  // Live events from /api/schedule (only the schedule domain is wired
  // so far). reloadEvents is exposed to the Schedule popup so a saved
  // entry shows up in the calendar immediately.
  // Teaching profile — used to scope the Grade + Section dropdowns in
  // the schedule form to what this teacher actually teaches.
  const [teacherGrades, setTeacherGrades] = useState([]);
  const [teacherSections, setTeacherSections] = useState([]);
  useEffect(() => {
    api("/api/me")
      .then((me) => {
        setTeacherGrades(Array.isArray(me?.grade_levels) ? me.grade_levels : []);
        setTeacherSections(Array.isArray(me?.sections) ? me.sections : []);
      })
      .catch(() => { /* silent; the popup just shows an empty list */ });
  }, []);

  const [events, setEvents] = useState([]);
  const reloadEvents = useCallback(() => {
    api("/api/schedule")
      .then((rows) => {
        const mapped = (rows || [])
          // "done" entries don't belong on the calendar — they're
          // counted in the Completed stat instead.
          .filter((r) => r.status !== "done")
          .map((r) => {
            const iso = typeof r.date === "string"
              ? r.date.slice(0, 10)
              : new Date(r.date).toISOString().slice(0, 10);
            return {
              id: `schedule-${r.id}`,
              raw: r,
              date: iso,
              kind: "schedule",
              title: r.title,
              time: r.start_time ? String(r.start_time).slice(0, 5) : undefined,
            };
          });
        setEvents(mapped);
      })
      .catch(() => setEvents([]));
  }, []);
  useEffect(() => { reloadEvents(); }, [reloadEvents]);

  // Bucket events by ISO date for O(1) lookup per cell.
  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      if (!visible.has(e.kind)) continue;
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events, visible]);

  const grid = useMemo(() => monthGrid(anchor), [anchor]);
  const monthLabel = `${MONTH_LABELS[anchor.getMonth()]} ${anchor.getFullYear()}`;

  // The "Today" panel — pulls today's events from the unfiltered list so
  // a teacher who hid e.g. Homework still sees today's homework here.
  const todaysEvents = useMemo(() => {
    const key = isoKey(today);
    return events.filter((e) => e.date === key);
  }, [events]);

  // "All" filter — true when every category is visible.
  const allOn = visible.size === CATEGORIES.length;
  const toggleAll = () => {
    if (allOn) setVisible(new Set());
    else setVisible(new Set(CATEGORIES.map((c) => c.key)));
  };

  return (
    <div className="planner-view relative max-w-[1400px] mx-auto pb-0 h-full flex flex-col">

      {/* ── Month hero — stacked headline + italic editorial caption.
          No eyebrow; the page header (sidebar nav) already says where
          you are. */}
      <div className="mb-3">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink leading-none tracking-tight">
          <span key={monthLabel} className="studio-tick">
            {MONTH_LABELS[anchor.getMonth()]}
          </span>{" "}
          <em className="italic font-medium text-accent">{anchor.getFullYear()}</em>
        </h1>
        <p className="font-serif italic text-[13px] text-muted leading-snug mt-1.5">
          Lesson plans, schedule, quizzes, homework, presentations, and activities — all on one grid.
        </p>
      </div>

      {/* 2-row grid:
            Row 1: top blocks (Studio AI hero on the left, AI Insights on
                   the right) — both stretch to the same height via
                   items-stretch + grid-rows-[auto_1fr].
            Row 2: calendar (left, flex-1 to fill) + Upcoming +
                   QuickActions stack (right, also flex-1).
          The filter chip row + small calendar header live ABOVE the
          grid so they don't break the column alignment. */}

      {/* ── Filter chip row — All + one per category. Sits above the
          grid so both columns inside the grid start at the same Y. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2 shrink-0">
        <button
          type="button"
          onClick={toggleAll}
          className={`planner-nav-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] font-medium ${
            allOn
              ? "bg-ink text-paper-cool border-ink shadow-sm"
              : "bg-paper-cool text-ink border-line hover:border-ink"
          }`}
        >
          <span className={`inline-flex h-3.5 w-3.5 rounded items-center justify-center text-[8px] ${
            allOn ? "bg-paper-cool/20" : "bg-ink/10"
          }`}>▦</span>
          All
        </button>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const on = visible.has(c.key);
          const s = COLOR_STYLES[c.color];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleCategory(c.key)}
              className={`planner-nav-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] ${
                on
                  ? `${s.chipBg} ${s.chipText} border-transparent`
                  : "bg-paper-cool text-muted border-line hover:border-ink/40"
              }`}
            >
              <Icon size={12} strokeWidth={1.75} />
              {c.label}
            </button>
          );
        })}
        <span className="flex-1" />
        {/* Calendar nav — Schedule + Today + prev/next inline on the same
            row so the grid below starts flush. Schedule opens a blurred
            modal over the Planner. */}
        <button
          type="button"
          onClick={() => { setEditingEntry(null); setShowSchedule(true); }}
          className="planner-nav-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/[0.10] hover:bg-accent/[0.18] hover:border-accent/50 text-accent text-[11.5px] font-semibold shadow-sm"
        >
          <Plus size={13} strokeWidth={2.5} />
          Schedule
        </button>
        <button
          type="button"
          onClick={goToday}
          className="planner-nav-btn px-2.5 py-1 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm font-serif italic text-xs text-ink"
        >
          Today
        </button>
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous month"
          className="planner-nav-btn h-7 w-7 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm flex items-center justify-center"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next month"
          className="planner-nav-btn h-7 w-7 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm flex items-center justify-center"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] grid-rows-[auto_1fr] gap-x-6 gap-y-3 items-stretch flex-1 min-h-0">
        {/* Row 1: Studio AI hero (left) + AI Insights (right), heights
            match via items-stretch. */}
        <div className="min-w-0">
          <StudioHeroCard />
        </div>
        <div className="min-w-0">
          <ThisMonthOverviewCard />
        </div>

        {/* Row 2: Calendar (left, fills remaining height) + Upcoming +
            QuickActions stack (right, also fills). */}
        <div className="min-w-0 min-h-0 flex flex-col">

      {/* The grid. paper-cool surface, rounded-2xl, soft shadow. Day
          headers in mono-uppercase, body cells in a 7-column grid. */}
      <div className="planner-grid planner-card-frame rounded-2xl bg-paper-cool overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="grid grid-cols-7 border-b border-line bg-[#fffdf6] flex-shrink-0">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted px-2 py-1.5 text-center"
            >
              {d}
            </div>
          ))}
        </div>
        <div
          className="grid grid-cols-7 flex-1 auto-rows-fr"
          style={{ gridTemplateRows: `repeat(${grid.length / 7}, 1fr)` }}
        >
          {grid.map((d, i) => {
            const inMonth = d.getMonth() === anchor.getMonth();
            const isToday = sameYMD(d, today);
            const dayEvents = eventsByDate.get(isoKey(d)) || [];
            const shown = dayEvents.slice(0, 2);
            const overflow = dayEvents.length - shown.length;
            const lastRowStart = grid.length - 7;
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => setDayListDate(isoKey(d))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDayListDate(isoKey(d));
                  }
                }}
                className={`planner-cell border-b border-r border-line/70 px-1.5 pt-1 pb-1 min-h-[60px] flex flex-col gap-0.5 cursor-pointer transition-colors duration-150 ${
                  inMonth ? "bg-paper-cool" : "bg-paper-warm/40 text-muted/60"
                } hover:bg-paper-warm/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-inset ${
                  isToday ? "planner-cell-today" : ""
                } ${(i + 1) % 7 === 0 ? "border-r-0" : ""} ${i >= lastRowStart ? "border-b-0" : ""}`}
                style={{ animationDelay: `${(i % 14) * 18}ms` }}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`font-mono text-[11px] leading-none ${
                      isToday
                        ? "h-6 w-6 rounded-full bg-accent text-paper-cool flex items-center justify-center font-medium text-[11.5px]"
                        : inMonth
                          ? "text-ink-soft"
                          : "text-muted/60"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="font-mono text-[10px] text-muted">
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-1 min-h-0">
                  {shown.map((e) => {
                    const cat = CATEGORIES.find((c) => c.key === e.kind);
                    const s = COLOR_STYLES[cat?.color || "ink"];
                    return (
                      <span
                        key={e.id}
                        title={`${cat?.label || e.kind} · ${e.title}${e.time ? ` · ${e.time}` : ""}`}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${s.chipBg} ${s.chipText} text-[10.5px] leading-tight pointer-events-none`}
                      >
                        <span className={`h-1 w-1 flex-shrink-0 rounded-full ${s.dot}`} />
                        <span className="truncate">{e.title}</span>
                      </span>
                    );
                  })}
                  {overflow > 0 && (
                    <span className="font-serif italic text-[10.5px] text-muted px-1.5">
                      +{overflow} more
                    </span>
                  )}
                </div>
                {isToday && (
                  <span className="planner-cell-today-spark" aria-hidden>
                    <Sparkles size={11} strokeWidth={2} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
        </div>

        {/* Row 2 right: Upcoming + Quick Actions stack, fills the same
            vertical space as the calendar to its left. Upcoming takes
            flex-1 so any extra height grows the list, and Quick Actions
            stays pinned to the bottom edge — keeping its bottom flush
            with the calendar's bottom. */}
        <div className="min-w-0 min-h-0 flex flex-col gap-3">
          <UpcomingCard
            events={events
              .filter((e) => e.date >= isoKey(today))
              .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
              .slice(0, 4)}
            className="flex-1 min-h-0"
          />
          <QuickActionsCard />
        </div>
      </div>

      {dayListDate && (
        <DayListPopup
          date={dayListDate}
          dayEvents={eventsByDate.get(dayListDate) || []}
          onClose={() => setDayListDate(null)}
          onSelect={openEditEntry}
          onNew={() => openNewForDay(dayListDate)}
        />
      )}

      {showSchedule && (
        <SchedulePopup
          initial={editingEntry}
          defaultDate={formDefaultDate}
          teacherGrades={teacherGrades}
          teacherSections={teacherSections}
          onClose={() => {
            setShowSchedule(false);
            setEditingEntry(null);
            setFormDefaultDate(null);
          }}
          onSaved={reloadEvents}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// DayListPopup — opens when the user clicks any calendar cell. Lists
// that day's entries (click one to edit) and has a "+ New entry"
// button in the header for creating a fresh entry pre-filled to that
// date. The intermediate two-card picker is gone — this is the single
// entry point for everything a teacher does on a day.
// ───────────────────────────────────────────────────────────────────────
function dayHeaderParts(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "long" }),
    full: d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
  };
}

function useModalChrome(onClose) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
}

function DayListPopup({ date, dayEvents, onClose, onSelect, onNew }) {
  useModalChrome(onClose);
  const { weekday, full } = dayHeaderParts(date);
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/45 backdrop-blur-lg backdrop-saturate-150 animate-[fadeIn_180ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative bg-paper-cool rounded-2xl border border-line shadow-[0_30px_80px_-20px_rgba(15,20,16,0.45)] w-full max-w-[640px] animate-[popIn_220ms_cubic-bezier(0.22,1,0.36,1)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 h-9 w-9 rounded-lg border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink flex items-center justify-center transition-all"
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        <div className="px-7 pt-6 pb-5 border-b border-line flex items-start justify-between gap-3 pr-14">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 inline-flex items-center gap-2.5">
              <span className="w-6 h-px bg-accent" /> This day
            </p>
            <h2 className="font-serif text-2xl font-medium text-ink leading-tight">
              {weekday}, <em className="italic font-medium text-accent">{full}</em>
            </h2>
          </div>
          <button
            type="button"
            onClick={onNew}
            className="planner-nav-btn shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/[0.10] hover:bg-accent/[0.18] hover:border-accent/50 text-accent text-[11.5px] font-semibold shadow-sm self-center"
          >
            <Plus size={13} strokeWidth={2.5} />
            New entry
          </button>
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-auto">
          {dayEvents.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">No entries yet on this day.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {dayEvents.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => e.raw && onSelect(e.raw)}
                  className="planner-nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-line bg-[#fdf8ee] hover:border-ink/30 text-left"
                >
                  <span className="h-2 w-2 rounded-full bg-sage flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink leading-tight truncate">{e.title}</p>
                    <p className="text-[11px] text-muted mt-0.5">
                      {e.time || "All day"}
                      {e.raw?.subject ? ` · ${e.raw.subject}` : ""}
                      {e.raw?.section ? ` · ${e.raw.section}` : ""}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-muted flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ───────────────────────────────────────────────────────────────────────
// Hero card — Studio AI prompt panel above the calendar. Headline +
// 6 quick-action chips. Each chip routes to /studio (the picker
// pre-selects the kind in a later wire-up).
// ───────────────────────────────────────────────────────────────────────
function StudioHeroCard() {
  // verb + noun two-line label, with a per-chip soft-tinted icon tile so
  // the row reads as six distinct tools instead of one repeated chip.
  const chips = [
    { key: "lesson",       icon: BookOpen,      verb: "Generate", noun: "Lesson Plan",     color: "accent" },
    { key: "quiz",         icon: GraduationCap, verb: "Create",   noun: "Quiz",            color: "sage" },
    { key: "presentation", icon: Layout,        verb: "Build",    noun: "Presentation",    color: "accent-soft" },
    { key: "weekly",       icon: CalendarDays,  verb: "Plan",     noun: "Weekly Schedule", color: "indigo" },
    { key: "insights",     icon: Users,         verb: "Analyze",  noun: "Students",        color: "moss" },
    { key: "ask",          icon: MessageCircle, verb: "Ask",      noun: "Anything",        color: "violet" },
  ];
  return (
    <div className="planner-hero rounded-2xl p-4 md:p-5 relative overflow-hidden h-full flex flex-col justify-center">
      <div className="relative z-10">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/[0.10] px-2.5 py-1 text-[11px] font-semibold text-accent mb-2.5">
          <Sparkles size={11} strokeWidth={2.25} /> Studio AI
        </p>
        <h2 className="font-serif text-2xl md:text-[1.55rem] text-ink leading-[1.1] font-semibold tracking-tight">
          What would you like to{" "}
          <span className="italic font-medium text-accent">create</span> today?
        </h2>
        <p className="text-[12.5px] text-muted mt-1.5 max-w-xl leading-snug">
          Your AI co-pilot that helps you plan, save time, and make every class amazing.
        </p>
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {chips.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => navigate(["studio"])}
              className="planner-hero-chip group"
            >
              <span className={`planner-hero-chip-icon planner-hero-chip-icon-${c.color}`}>
                <Icon size={13} strokeWidth={2} />
              </span>
              <span className="flex flex-col min-w-0 text-left leading-[1.1]">
                <span className="text-[10.5px] font-semibold text-ink whitespace-nowrap">{c.verb}</span>
                <span className="text-[9px] text-muted whitespace-nowrap">{c.noun}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// AI Insights — big "On track" headline in sage green, soft chart
// glow below, 3-stat row underneath.
// ───────────────────────────────────────────────────────────────────────
function ThisMonthOverviewCard() {
  const planned = 28;
  const completed = 12;
  const todo = 16;
  const pct = Math.round((completed / planned) * 100);
  const stats = [
    { n: planned,   k: "Planned",   icon: CalendarDays,  tint: "ink",    iconBg: "bg-ink/[0.08]",    iconText: "text-ink" },
    { n: completed, k: "Completed", icon: CheckCircle2,  tint: "sage",   iconBg: "bg-sage/[0.14]",   iconText: "text-sage" },
    { n: todo,      k: "To do",     icon: Clock,         tint: "accent", iconBg: "bg-accent/[0.12]", iconText: "text-accent" },
  ];
  return (
    <div className="h-full flex flex-col rounded-2xl border border-[#e6dccb] bg-[#fffdf6] p-4 shadow-[0_18px_44px_-22px_rgba(15,20,16,0.14)]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-serif text-[15px] font-medium text-ink leading-tight">
          This Month Overview
        </h3>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted mt-1 whitespace-nowrap">
          May 2026
        </span>
      </div>

      <div className="h-px bg-line/40 mb-3" />

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.k}>
              <span className={`inline-flex h-6 w-6 rounded-md items-center justify-center ${s.iconBg} ${s.iconText} mb-2`}>
                <Icon size={12} strokeWidth={2.25} />
              </span>
              <p className="font-serif text-2xl font-medium text-ink leading-none">{s.n}</p>
              <p className="text-[11px] text-muted mt-1.5">{s.k}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted">
            Progress
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sage">
            <TrendingUp size={11} strokeWidth={2.25} />
            {pct}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-line/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sage to-sage/70"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Upcoming — next 4 items from the same live events the calendar
// shows; until more domains are wired, that's whatever rows live in
// /api/schedule.
// ───────────────────────────────────────────────────────────────────────
function UpcomingCard({ events, className = "" }) {
  const fmt = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return {
      month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
      day: d.getDate(),
    };
  };
  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="font-serif text-[15px] font-medium text-ink">Upcoming</h3>
        <button className="text-xs text-accent hover:text-ink transition">
          View all
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        {events.map((e) => {
          const { month, day } = fmt(e.date);
          return (
            <div key={e.id} className="flex items-center gap-2.5">
              <div className="flex-shrink-0 rounded-lg bg-paper-warm/60 px-2 py-1 text-center min-w-[44px]">
                <div className="text-[9px] text-muted tracking-wider uppercase">{month}</div>
                <div className="text-sm font-medium font-serif text-ink leading-none mt-0.5">{day}</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-ink leading-tight truncate">{e.title}</p>
                <p className="text-[10.5px] text-muted mt-0.5">{e.time || "All day"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Quick Actions — four shortcut buttons that route to the studio with
// the kind pre-selected (deferred wiring — for now they go to /studio).
// ───────────────────────────────────────────────────────────────────────
function QuickActionsCard() {
  const actions = [
    { key: "lesson",       label: "New Lesson Plan",  icon: BookOpen,       tone: "accent"      },
    { key: "quiz",         label: "New Quiz",         icon: ClipboardList,  tone: "accent-soft" },
    { key: "homework",     label: "New Homework",     icon: GraduationCap,  tone: "sage"        },
    { key: "presentation", label: "New Presentation", icon: Presentation,   tone: "gold"        },
  ];
  const toneToBg = {
    accent:        "bg-[rgba(200,71,43,0.12)] text-accent",
    "accent-soft": "bg-[rgba(232,122,85,0.14)] text-accent",
    sage:          "bg-[rgba(107,127,90,0.14)] text-sage",
    gold:          "bg-[rgba(184,137,61,0.15)] text-gold",
  };
  return (
    <div>
      <h3 className="font-serif text-[15px] font-medium text-ink mb-2.5">
        Quick Actions
      </h3>
      <div className="flex flex-col gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => navigate(["studio"])}
              className="planner-nav-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-line/70 bg-paper-cool hover:border-ink/30"
            >
              <span className={`flex-shrink-0 inline-flex h-7 w-7 rounded-lg items-center justify-center ${toneToBg[a.tone]}`}>
                <Icon size={13} strokeWidth={2} />
              </span>
              <span className="flex-1 text-left text-[12.5px] font-medium text-ink">{a.label}</span>
              <Plus size={13} strokeWidth={2} className="text-muted flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
