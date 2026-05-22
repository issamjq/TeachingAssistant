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
  MoreHorizontal, BarChart3, FileText, Layout,
  X, CheckCircle2, Clock, TrendingUp,
} from "lucide-react";
import { navigate } from "../lib/route";
import { useT, useI18n } from "../lib/i18n";
import { api } from "./_shared";
import SchedulePopup from "./_schedule-popup";
import PlannerTour, { hasSeenPlannerTour } from "./onboarding/PlannerTour";

// Categories the calendar can show. Each maps to one of the existing
// teaching surfaces, with a Murchid-palette color so the day cells stay
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


const isoKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const sameYMD = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function Planner() {
  const t = useT();
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar" : "en-US";
  // First-run tour: opens once on the first Planner visit per device.
  // Mount with the seen-flag inverted so it fires on initial render
  // (after auth + plan pick), and immediately persists once dismissed.
  const [tourOpen, setTourOpen] = useState(() => !hasSeenPlannerTour());
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
  // Midnight today — past calendar cells (before this) are visually
  // receded the way Google/Outlook do, but stay clickable so teachers
  // can still backfill past entries.
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

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
  // Pull from every teaching surface that carries a date so the
  // monthly grid mirrors the right-rail's "what's on" view. Schedule
  // entries stay clickable (open in SchedulePopup for edit/delete);
  // other kinds show as read-only chips for now.
  const reloadEvents = useCallback(() => {
    // DATE columns come back from pg as a JS Date at LOCAL midnight.
    // toISOString() would convert to UTC and roll the day back one in
    // UTC+ timezones (e.g. UAE), so May 15 showed as May 14. Format
    // from local Y-M-D parts instead. Plain strings keep their date.
    const isoOnly = (v) => {
      if (typeof v === "string") return v.slice(0, 10);
      const d = new Date(v);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    Promise.allSettled([
      api("/api/schedule"),
      api("/api/quizzes"),
      api("/api/homework"),
      api("/api/presentations"),
      api("/api/activities"),
    ]).then((results) => {
      const get = (i) => (results[i].status === "fulfilled" ? results[i].value || [] : []);
      const schedule = get(0)
        .filter((r) => r.status !== "done")
        .map((r) => ({
          id: `schedule-${r.id}`,
          raw: r,
          date: isoOnly(r.date),
          kind: "schedule",
          title: r.title,
          time: r.start_time ? String(r.start_time).slice(0, 5) : undefined,
        }));
      const quizzes = get(1)
        .filter((q) => q.scheduled_for)
        .map((q) => ({
          id: `quiz-${q.id}`,
          date: isoOnly(q.scheduled_for),
          kind: "quizzes",
          title: q.title,
        }));
      const homework = get(2)
        .filter((h) => h.due_date)
        .map((h) => ({
          id: `homework-${h.id}`,
          date: isoOnly(h.due_date),
          kind: "homework",
          title: h.title,
        }));
      const presentations = get(3)
        .filter((p) => p.scheduled_for)
        .map((p) => ({
          id: `presentation-${p.id}`,
          date: isoOnly(p.scheduled_for),
          kind: "presentations",
          title: p.title,
        }));
      const activities = get(4)
        .filter((a) => a.scheduled_for)
        .map((a) => ({
          id: `activity-${a.id}`,
          date: isoOnly(a.scheduled_for),
          kind: "activities",
          title: a.title,
        }));
      setEvents([...schedule, ...quizzes, ...homework, ...presentations, ...activities]);
    });
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
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(anchor);
  const monthLabel = `${monthName} ${anchor.getFullYear()}`;
  // Monday-first weekday headers, localized (2024-01-01 is a Monday).
  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 1 + i))
    ),
    [locale]
  );

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
      <div className="mb-2 flex items-baseline gap-3 flex-wrap">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold text-ink leading-none tracking-tight">
          <span key={monthLabel} className="studio-tick">
            {monthName}
          </span>{" "}
          <em className="italic font-medium text-accent">{anchor.getFullYear()}</em>
        </h1>
        <p className="font-serif italic text-[12px] text-muted leading-none">
          {t("planner.subtitle")}
        </p>
      </div>

      {/* 2-row grid:
            Row 1: top blocks (Pulse on the left, ThisMonth on the right).
            Row 2: calendar (left, flex-1 to fill) + Upcoming +
                   QuickActions stack (right, also flex-1).
          The filter chips + month-nav now live INSIDE the calendar
          card itself (planner-cal-toolbar) so the calendar reads as
          a single self-contained surface. */}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] grid-rows-[auto_1fr] gap-x-6 gap-y-3 items-stretch flex-1 min-h-0">
        {/* Row 1: Studio AI hero (left) + AI Insights (right), heights
            match via items-stretch. */}
        <div className="min-w-0">
          <PulseCard events={events} monthDate={anchor} todayStart={todayStart} />
        </div>
        <div className="min-w-0">
          <ThisMonthOverviewCard events={events} monthDate={anchor} todayStart={todayStart} />
        </div>

        {/* Row 2: Calendar (left, fills remaining height) + Upcoming +
            QuickActions stack (right, also fills). */}
        <div className="min-w-0 min-h-0 flex flex-col">

      {/* The grid. paper-cool surface, rounded-2xl, soft shadow. The
          calendar's own toolbar lives at the top (filter chips + nav),
          the weekday header sits below it, then the day cells. */}
      <div className="planner-grid planner-card-frame rounded-2xl bg-paper-cool overflow-hidden flex-1 flex flex-col min-h-0">

        {/* ── Calendar toolbar — filter chips on the left, month nav
            (◀ Today ▶) and Schedule on the right. Chips scroll
            horizontally on narrow widths with a soft fade-out edge. */}
        <div className="planner-cal-toolbar">
          <div className="planner-cal-filters">
            <button
              type="button"
              onClick={toggleAll}
              aria-pressed={allOn}
              className={`planner-cal-chip ${allOn ? "is-all-on" : ""}`}
            >
              <span className="planner-cal-chip-tile">▦</span>
              {t("planner.all")}
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
                  aria-pressed={on}
                  className={`planner-cal-chip ${on ? `${s.chipBg} ${s.chipText} is-on` : ""}`}
                >
                  <Icon size={12} strokeWidth={1.75} />
                  {t(`nav.${c.key}`)}
                </button>
              );
            })}
          </div>
          <div className="planner-cal-nav">
            <button
              type="button"
              onClick={goPrev}
              aria-label={t("planner.prevMonth")}
              className="planner-cal-icon-btn"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="planner-cal-today"
            >
              {t("planner.today")}
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={t("planner.nextMonth")}
              className="planner-cal-icon-btn"
            >
              <ChevronRight size={15} />
            </button>
            <span className="planner-cal-divider" aria-hidden="true" />
            <button
              type="button"
              onClick={() => { setEditingEntry(null); setShowSchedule(true); }}
              className="planner-cal-schedule"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>{t("planner.schedule")}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-line bg-[#fffdf6] flex-shrink-0">
          {weekdayLabels.map((d, i) => (
            <div
              key={i}
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
            const isPast = !isToday && d < todayStart;
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
                  inMonth
                    ? isPast
                      ? "bg-paper-cool/50"
                      : "bg-paper-cool"
                    : "bg-paper-warm/40 text-muted/60"
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
                          ? isPast
                            ? "text-muted/70"
                            : "text-ink-soft"
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
                <div className={`flex-1 flex flex-col gap-1 min-h-0 ${isPast ? "opacity-60" : ""}`}>
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

      <PlannerTour open={tourOpen} onClose={() => setTourOpen(false)} />
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
function dayHeaderParts(iso, locale) {
  const d = new Date(`${iso}T00:00:00`);
  return {
    weekday: d.toLocaleDateString(locale, { weekday: "long" }),
    full: d.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" }),
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
  const t = useT();
  const { lang } = useI18n();
  const { weekday, full } = dayHeaderParts(date, lang === "ar" ? "ar" : "en-US");
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
          className="absolute top-4 right-4 z-10 h-9 w-9 rounded-lg text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition"
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        <div className="px-7 pt-6 pb-5 border-b border-line pr-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {t("planner.thisDay")}
          </p>
          <h2 className="font-serif text-2xl font-medium text-ink leading-tight">
            {weekday}, <em className="italic font-medium text-accent">{full}</em>
          </h2>
        </div>

        <div className="px-6 py-5 max-h-[55vh] overflow-auto">
          {dayEvents.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">{t("planner.noEntries")}</p>
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
                      {e.time || t("planner.allDay")}
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

        <div className="px-6 py-4 border-t border-line bg-paper/60 flex justify-end">
          <button
            type="button"
            onClick={onNew}
            className="planner-nav-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-paper-cool text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(200,71,43,0.6)] hover:bg-accent/90 hover:-translate-y-px transition-all"
          >
            <Plus size={15} strokeWidth={2.5} />
            {t("planner.newEntry")}
          </button>
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
// ───────────────────────────────────────────────────────────────────────
// PulseCard — the new planner hero. Narrates the month in one
// sentence, surfaces three stats (planned / done / ahead), shows a
// per-week sparkline, then offers the four Studio shortcuts as
// chips below. Replaces the old "Studio AI" hero.
// ───────────────────────────────────────────────────────────────────────
function PulseCard({ events, monthDate, todayStart }) {
  const t = useT();
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
  const monthEvents = events.filter((e) => (e.date || "").slice(0, 7) === monthKey);
  const planned = monthEvents.length;
  const done = monthEvents.filter(
    (e) => new Date(`${e.date}T00:00:00`) < todayStart
  ).length;
  const ahead = Math.max(0, planned - done);

  // One-line narrative — the only piece of editorial voice we keep.
  // The right-rail "This Month Overview" already carries the numeric
  // breakdown, and the workload strip above already shows distribution,
  // so the pulse stays minimal: kicker + sentence + 4 launcher chips.
  let headline;
  if (planned === 0) {
    headline = (
      <>Your month is <em>open</em>. Pick a topic — the studio drafts the rest.</>
    );
  } else if (ahead === 0) {
    headline = (
      <>
        <em>{planned}</em> {planned === 1 ? "item" : "items"} this month — <b>all in the rear-view</b>.
      </>
    );
  } else {
    const dayCounts = {};
    for (const e of monthEvents) {
      const d = new Date(`${e.date}T00:00:00`);
      const wd = d.toLocaleDateString(undefined, { weekday: "long" });
      dayCounts[wd] = (dayCounts[wd] || 0) + 1;
    }
    const heaviest = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    headline = (
      <>
        <em>{ahead}</em> {ahead === 1 ? "thing" : "things"} ahead.
        {heaviest ? <> Heaviest: <b>{heaviest}</b>.</> : null}
      </>
    );
  }

  const chips = [
    { key: "lesson",       icon: BookOpen,      tone: "accent", studioKind: "lesson_plan" },
    { key: "quiz",         icon: GraduationCap, tone: "sage",   studioKind: "quiz" },
    { key: "homework",     icon: ClipboardList, tone: "gold",   studioKind: "homework" },
    { key: "presentation", icon: Layout,        tone: "soft",   studioKind: "presentation" },
  ];

  return (
    <section className="planner-pulse" aria-label="Month pulse">
      <div className="planner-pulse-text">
        <span className="planner-pulse-kicker">
          <Sparkles size={10} strokeWidth={2.25} /> {t("planner.studioAI")}
        </span>
        <h2 className="planner-pulse-h">{headline}</h2>
      </div>
      <div className="planner-pulse-chips">
        {chips.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => navigate(["studio", c.studioKind])}
              className="planner-pulse-chip"
              title={`${t(`hero.${c.key}.verb`)} ${t(`hero.${c.key}.noun`)}`}
            >
              <span className={`planner-pulse-chip-icon t-${c.tone}`}>
                <Icon size={13} strokeWidth={2} />
              </span>
              <span className="planner-pulse-chip-meta">
                <span className="planner-pulse-chip-verb">{t(`hero.${c.key}.verb`)}</span>
                <span className="planner-pulse-chip-noun">{t(`hero.${c.key}.noun`)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// AI Insights — big "On track" headline in sage green, soft chart
// glow below, 3-stat row underneath.
// ───────────────────────────────────────────────────────────────────────
function ThisMonthOverviewCard({ events = [], monthDate, todayStart }) {
  const t = useT();
  const { lang } = useI18n();
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
  const monthEvents = events.filter((e) => (e.date || "").slice(0, 7) === monthKey);
  const planned = monthEvents.length;
  // "Completed" = already happened this month (date is before today).
  const completed = monthEvents.filter(
    (e) => new Date(`${e.date}T00:00:00`) < todayStart
  ).length;
  const todo = Math.max(0, planned - completed);
  const pct = planned ? Math.round((completed / planned) * 100) : 0;
  const monthLabel = monthDate
    .toLocaleDateString(lang === "ar" ? "ar" : "en-US", { month: "short", year: "numeric" })
    .toUpperCase();
  const stats = [
    { n: planned,   k: t("planner.planned"),   dot: "bg-ink"     },
    { n: completed, k: t("planner.completed"), dot: "bg-sage"    },
    { n: todo,      k: t("planner.todo"),      dot: "bg-accent"  },
  ];
  return (
    <div className="rounded-xl border border-[#e6dccb] bg-[#fffdf6] px-3 py-2 shadow-[var(--shadow-1)] flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap mr-auto">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
          {monthLabel}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sage">
          <TrendingUp size={11} strokeWidth={2.25} /> {pct}%
        </span>
      </span>
      <div className="flex items-center gap-3 flex-wrap">
        {stats.map((s, i) => (
          <React.Fragment key={s.k}>
            {i > 0 && <span className="h-4 w-px bg-line/60 shrink-0" />}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              <span className="font-serif text-base font-medium text-ink leading-none">{s.n}</span>
              <span className="text-[10.5px] text-muted leading-none">{s.k}</span>
            </span>
          </React.Fragment>
        ))}
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
  const t = useT();
  const { lang } = useI18n();
  const loc = lang === "ar" ? "ar" : "en-US";
  const fmt = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return {
      month: d.toLocaleDateString(loc, { month: "short" }).toUpperCase(),
      day: d.toLocaleDateString(loc, { day: "numeric" }),
    };
  };
  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="font-serif text-[15px] font-medium text-ink">{t("planner.upcoming")}</h3>
        <button className="text-xs text-accent hover:text-ink transition">
          {t("planner.viewAll")}
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
                <p className="text-[10.5px] text-muted mt-0.5">{e.time || t("planner.allDay")}</p>
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
  const t = useT();
  const actions = [
    { key: "lesson",       label: t("planner.qa.lesson"),       icon: BookOpen,       tone: "accent",      route: ["lesson-plans", "templates"] },
    { key: "quiz",         label: t("planner.qa.quiz"),         icon: ClipboardList,  tone: "accent-soft", route: ["quizzes"] },
    { key: "homework",     label: t("planner.qa.homework"),     icon: GraduationCap,  tone: "sage",        route: ["homework"] },
    { key: "presentation", label: t("planner.qa.presentation"), icon: Presentation,   tone: "gold",        route: ["presentations"] },
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
        {t("planner.quickActions")}
      </h3>
      <div className="flex flex-col gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => navigate(a.route)}
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
