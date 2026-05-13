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
  GraduationCap, ClipboardList, Presentation, Sparkles,
} from "lucide-react";

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

  return (
    <div className="planner-view max-w-6xl mx-auto pb-12">
      {/* Header — month/year, prev/next chevrons, Today button. */}
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Planner
          </p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium text-ink leading-tight">
            <span key={monthLabel} className="studio-tick">
              {MONTH_LABELS[anchor.getMonth()]}
            </span>{" "}
            <em className="italic font-light text-accent">{anchor.getFullYear()}</em>
          </h1>
          <p className="font-serif italic text-sm text-muted mt-1.5 max-w-xl leading-relaxed">
            Lesson plans, schedule, quizzes, homework, presentations, and activities — all on one grid.
          </p>
        </div>
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous month"
            className="h-9 w-9 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm flex items-center justify-center transition-all duration-150 hover:-translate-y-px"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3.5 py-1.5 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm font-serif italic text-sm text-ink transition-all duration-150 hover:-translate-y-px"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next month"
            className="h-9 w-9 rounded-lg border border-line bg-paper-cool hover:border-ink hover:bg-paper-warm flex items-center justify-center transition-all duration-150 hover:-translate-y-px"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Category filter row — pill chips, one per teaching surface.
          Click toggles visibility. Active chips show full color; off
          ones go monochrome. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <span className="font-serif italic text-sm text-muted mr-1.5">Showing</span>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const on = visible.has(c.key);
          const s = COLOR_STYLES[c.color];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleCategory(c.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] transition-all duration-200 ${
                on
                  ? `${s.chipBg} ${s.chipText} border-transparent`
                  : "bg-paper-cool/60 text-muted border-line hover:border-ink/40"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${on ? s.dot : "bg-muted/50"}`} />
              <Icon size={11} strokeWidth={1.75} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* The grid. paper-cool surface, rounded-2xl, soft shadow. Day
          headers in mono-uppercase, body cells in a 7-column grid. */}
      <div className="planner-grid rounded-2xl border border-line bg-paper-cool overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b border-line bg-paper-warm/30">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted px-3 py-2.5 text-center"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((d, i) => {
            const inMonth = d.getMonth() === anchor.getMonth();
            const isToday = sameYMD(d, today);
            const dayEvents = eventsByDate.get(isoKey(d)) || [];
            const shown = dayEvents.slice(0, 3);
            const overflow = dayEvents.length - shown.length;
            return (
              <div
                key={i}
                className={`planner-cell border-b border-r border-line/70 px-2 pt-2 pb-1.5 min-h-[120px] flex flex-col gap-1.5 transition-colors duration-150 ${
                  inMonth ? "bg-paper-cool" : "bg-paper-warm/40 text-muted/60"
                } hover:bg-paper-warm/50 ${
                  isToday ? "planner-cell-today" : ""
                } ${(i + 1) % 7 === 0 ? "border-r-0" : ""} ${i >= 35 ? "border-b-0" : ""}`}
                style={{ animationDelay: `${(i % 14) * 18}ms` }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`font-mono text-[11px] leading-none ${
                      isToday
                        ? "h-5 w-5 rounded-full bg-accent text-paper-cool flex items-center justify-center font-medium"
                        : inMonth
                          ? "text-ink-soft"
                          : "text-muted/60"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="font-mono text-[9px] text-muted uppercase tracking-wider">
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Today panel — pulled out below the grid so it's always glanceable
          regardless of which month the teacher is browsing. */}
      <div className="mt-5 rounded-2xl border border-line bg-paper-cool p-5 md:p-6">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="font-serif italic text-lg text-ink">
            Today —{" "}
            <span className="not-italic font-medium">
              {today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {todaysEvents.length} item{todaysEvents.length === 1 ? "" : "s"}
          </span>
        </div>
        {todaysEvents.length === 0 ? (
          <p className="font-serif italic text-sm text-muted">
            Nothing scheduled. A clear day.
          </p>
        ) : (
          <ul className="space-y-2">
            {todaysEvents.map((e) => {
              const cat = CATEGORIES.find((c) => c.key === e.kind);
              const s = COLOR_STYLES[cat?.color || "ink"];
              const Icon = cat?.icon || BookOpen;
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-line bg-paper hover:border-ink/40 transition-colors duration-150"
                >
                  <span className={`h-7 w-7 rounded-md ${s.chipBg} ${s.chipText} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={13} strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-ink font-medium truncate">{e.title}</span>
                    <span className="block font-serif italic text-[11px] text-muted">{cat?.label}</span>
                  </span>
                  {e.time && (
                    <span className="font-mono text-[11px] text-ink-soft flex-shrink-0">
                      {e.time}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-5 text-center font-serif italic text-xs text-muted/80">
        Scaffolding · Mudir will pull real items from each teaching surface in a later build.
      </p>
    </div>
  );
}
