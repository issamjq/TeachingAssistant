// Planner — the teacher's monthly calendar. Aggregates every teaching
// surface (lesson plans, schedule, quizzes, homework, presentations,
// activities) onto one grid. Designed as the "where am I this month"
// hub.
//
// IMPORTANT: this view is wired to placeholder data only right now. The
// real API integration (pulling actual scheduled rows from /api/quizzes,
// /api/homework, /api/schedule, /api/drafts, etc.) is intentionally
// deferred — the user wants the scaffolding in place first.
//
// When we hook it up later, replace `PLACEHOLDER_EVENTS` with a
// `useEffect` that fans out into each domain's GET endpoint and merges
// the results into the same shape:
//   { id, date: YYYY-MM-DD, kind, title, time? }
import React, { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Plus, BookOpen, CalendarDays,
  GraduationCap, ClipboardList, Presentation, Sparkles, ArrowRight,
  MoreHorizontal, MessageCircle, BarChart3, FileText, Layout,
} from "lucide-react";
import { navigate } from "../lib/route";

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

// Build a synthetic month of events so the empty calendar isn't a sea
// of blank cells. Anchored to the current month so it always feels
// "this month". Wire-up swaps this for real API data.
function buildPlaceholderEvents(anchor) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const at = (d, kind, title, time) => ({
    id: `${kind}-${d}-${title}`,
    date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    kind,
    title,
    time,
  });
  // Spread a believable teacher's month across the grid so every chip
  // type shows up at least twice.
  return [
    at(2,  "schedule",      "Period 1 · Algebra",        "08:00"),
    at(2,  "lesson-plans",  "Linear equations · intro"),
    at(3,  "quizzes",       "Diagnostic · Section A",     "10:30"),
    at(5,  "homework",      "Word problems · Lesson 3"),
    at(7,  "presentations", "Cell biology slides"),
    at(8,  "schedule",      "Period 3 · Geometry",        "11:15"),
    at(10, "lesson-plans",  "Quadratics worked examples"),
    at(10, "activities",    "Pair-and-share warm-up"),
    at(12, "quizzes",       "Mid-term review · 7B",       "09:00"),
    at(14, "homework",      "Reading · Ch. 4"),
    at(14, "presentations", "Photosynthesis"),
    at(15, "lesson-plans",  "Statistics: mean & median"),
    at(16, "activities",    "Outdoor measurement task"),
    at(17, "schedule",      "Period 5 · Algebra",         "13:45"),
    at(18, "quizzes",       "Pop quiz · Lesson 5",        "10:00"),
    at(20, "homework",      "Practice set · Geometry"),
    at(21, "lesson-plans",  "Linear equations · review"),
    at(22, "schedule",      "Period 2 · Geometry",        "09:15"),
    at(24, "activities",    "Group challenge: bridges"),
    at(25, "quizzes",       "Unit test · 8A",             "11:30"),
    at(27, "homework",      "Word problems · Lesson 6"),
    at(28, "presentations", "Linear systems"),
    at(29, "lesson-plans",  "Geometry: angles"),
  ];
}

// Calendar maths — return a 6×7 grid of Date objects for the month
// containing `anchor`, padded with leading days from the previous month
// and trailing days from the next so the grid is always rectangular.
function monthGrid(anchor, weekStart = 1 /* Mon */) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const firstOfMonth = new Date(y, m, 1);
  const offset = (firstOfMonth.getDay() - weekStart + 7) % 7;
  const start = new Date(y, m, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
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
  const today = new Date();

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

  // Bucket events by ISO date for O(1) lookup per cell.
  const events = useMemo(() => buildPlaceholderEvents(anchor), [anchor]);
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
    <div className="planner-view max-w-[1400px] mx-auto pb-2 h-full flex flex-col">

      {/* ── Month hero — eyebrow + tight headline + one-line caption.
          The orb is gone; we save the room for the calendar grid. */}
      <div className="mb-2">
        <p className="font-sans text-[10px] uppercase tracking-[0.30em] text-accent-soft mb-1">
          Planner
        </p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-serif text-2xl md:text-3xl font-medium text-ink leading-none">
            <span key={monthLabel} className="studio-tick">
              {MONTH_LABELS[anchor.getMonth()]}
            </span>{" "}
            <em className="italic font-light text-accent">{anchor.getFullYear()}</em>
          </h1>
          <p className="text-[12.5px] text-muted leading-snug">
            Lesson plans, schedules, quizzes and activities — all in one workspace.
          </p>
        </div>
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
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] font-medium transition-all duration-200 ${
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] transition-all duration-200 ${
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
        {/* Calendar nav — Today + prev/next inline on the same row so
            the grid below starts flush. */}
        <button
          type="button"
          onClick={goToday}
          aria-label="Jump to today"
          className="h-7 w-7 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm flex items-center justify-center transition-all duration-150"
        >
          <CalendarDays size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={goToday}
          className="px-2.5 py-1 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm font-serif italic text-xs text-ink transition-all duration-150"
        >
          Today
        </button>
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous month"
          className="h-7 w-7 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm flex items-center justify-center transition-all duration-150"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next month"
          className="h-7 w-7 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm flex items-center justify-center transition-all duration-150"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] grid-rows-[auto_1fr] gap-x-3 gap-y-3 items-stretch flex-1 min-h-0">
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
      <div className="planner-grid rounded-2xl border border-line bg-paper-cool overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        <div className="grid grid-cols-7 border-b border-line bg-paper-warm/30 flex-shrink-0">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted px-2 py-1.5 text-center"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 grid-rows-6 flex-1 auto-rows-fr">
          {grid.map((d, i) => {
            const inMonth = d.getMonth() === anchor.getMonth();
            const isToday = sameYMD(d, today);
            const dayEvents = eventsByDate.get(isoKey(d)) || [];
            const shown = dayEvents.slice(0, 2);
            const overflow = dayEvents.length - shown.length;
            return (
              <div
                key={i}
                className={`planner-cell border-b border-r border-line/70 px-1.5 pt-1 pb-1 min-h-[60px] flex flex-col gap-0.5 transition-colors duration-150 ${
                  inMonth ? "bg-paper-cool" : "bg-paper-warm/40 text-muted/60"
                } hover:bg-paper-warm/50 ${
                  isToday ? "planner-cell-today" : ""
                } ${(i + 1) % 7 === 0 ? "border-r-0" : ""} ${i >= 35 ? "border-b-0" : ""}`}
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
                        className={`group inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${s.chipBg} ${s.chipText} text-[10.5px] leading-tight cursor-pointer hover:translate-x-px transition-transform duration-150`}
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
            vertical space as the calendar to its left. */}
        <div className="min-w-0 min-h-0 flex flex-col gap-3">
          <UpcomingCard events={events.slice(0, 3)} />
          <QuickActionsCard />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Hero card — Studio AI prompt panel above the calendar. Headline +
// 6 quick-action chips. Each chip routes to /studio (the picker
// pre-selects the kind in a later wire-up).
// ───────────────────────────────────────────────────────────────────────
function StudioHeroCard() {
  const chips = [
    { key: "lesson",       icon: BookOpen,      label: "Lesson Plan" },
    { key: "quiz",         icon: GraduationCap, label: "Quiz" },
    { key: "presentation", icon: Layout,        label: "Presentation" },
    { key: "weekly",       icon: CalendarDays,  label: "Weekly Plan" },
    { key: "insights",     icon: BarChart3,     label: "Student Insights" },
    { key: "ask",          icon: MessageCircle, label: "Ask Studio" },
  ];
  return (
    <div className="planner-hero rounded-2xl p-3 md:p-4 mb-2 relative overflow-hidden">
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2 lg:gap-5 items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/[0.10] px-2 py-0.5 text-[10.5px] font-medium text-accent mb-1.5">
            <Sparkles size={10} strokeWidth={2} /> Studio AI
          </p>
          <h2 className="font-serif text-lg md:text-xl text-ink leading-[1.15] font-medium">
            What would you like to{" "}
            <em className="italic font-light text-accent">create</em> today?
          </h2>
          <p className="text-[12px] text-muted mt-0.5 max-w-md leading-snug">
            Your AI teaching co-pilot — plan faster, generate content, save hours.
          </p>
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5 lg:flex-shrink-0">
          {chips.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => navigate(["studio"])}
                className="planner-hero-chip group"
              >
                <span className="planner-hero-chip-icon">
                  <Icon size={12} strokeWidth={1.75} />
                </span>
                <span className="text-[10.5px] font-medium text-ink leading-tight text-center">
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// AI Insights — big "On track" headline in sage green, soft chart
// glow below, 3-stat row underneath.
// ───────────────────────────────────────────────────────────────────────
function ThisMonthOverviewCard() {
  return (
    <div className="rounded-2xl border border-line bg-paper-cool p-3.5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-[15px] font-medium text-ink">AI Insights</h3>
        <span className="rounded-lg bg-accent/[0.10] p-1.5">
          <Sparkles size={12} strokeWidth={2} className="text-accent" />
        </span>
      </div>
      <p className="text-[12px] text-muted">Your teaching rhythm is</p>
      <h4 className="font-serif text-xl font-medium text-sage leading-tight mt-0.5">
        On track
      </h4>
      <div className="mt-3 relative h-14 rounded-xl bg-gradient-to-b from-accent/[0.08] to-transparent overflow-hidden">
        <svg viewBox="0 0 320 84" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="monthChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 60 C30 56 50 48 80 50 C110 52 130 32 160 30 C190 28 210 20 240 18 C270 16 290 24 320 22 L320 84 L0 84 Z"
            fill="url(#monthChartFill)"
          />
          <path
            d="M0 60 C30 56 50 48 80 50 C110 52 130 32 160 30 C190 28 210 20 240 18 C270 16 290 24 320 22"
            stroke="var(--color-accent)" strokeWidth="2" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[
          { n: 28, k: "Planned" },
          { n: 12, k: "Completed" },
          { n: 16, k: "To do" },
        ].map((s) => (
          <div key={s.k}>
            <p className="font-serif text-lg font-medium text-ink leading-none">{s.n}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Upcoming — next 4 items pulled from the same placeholder data the
// calendar uses, so the rail and grid stay in sync until the real API
// lands.
// ───────────────────────────────────────────────────────────────────────
function UpcomingCard({ events }) {
  const fmt = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return {
      month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
      day: d.getDate(),
    };
  };
  return (
    <div className="rounded-2xl border border-line bg-paper-cool p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="font-serif text-[15px] font-medium text-ink">Upcoming</h3>
        <button className="text-xs text-accent hover:text-ink transition">
          View all
        </button>
      </div>
      <div className="space-y-1.5">
        {events.map((e) => {
          const { month, day } = fmt(e.date);
          return (
            <div
              key={e.id}
              className="flex items-center gap-2.5 rounded-xl border border-line p-2"
            >
              <div className="flex-shrink-0 rounded-lg bg-paper-warm/60 px-2 py-1 text-center min-w-[40px]">
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
    { key: "lesson",       label: "New Lesson Plan" },
    { key: "quiz",         label: "New Quiz" },
    { key: "homework",     label: "New Homework" },
    { key: "presentation", label: "New Presentation" },
  ];
  return (
    <div className="rounded-2xl border border-line bg-paper-cool p-3.5">
      <h3 className="font-serif text-[15px] font-medium text-ink mb-2.5">
        Quick Actions
      </h3>
      <div className="space-y-1.5">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => navigate(["studio"])}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-line bg-paper hover:shadow-md transition-shadow duration-150"
          >
            <span className="text-[12.5px] font-medium text-ink">{a.label}</span>
            <span className="rounded-lg bg-accent/[0.10] p-1">
              <Plus size={12} strokeWidth={2} className="text-accent" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
