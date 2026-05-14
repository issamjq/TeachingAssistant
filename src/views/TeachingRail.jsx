// TeachingRail — Outlook-style mini-calendar + upcoming-days list that
// rides on the right edge of the Teaching surfaces (Lesson Plans,
// Quizzes, Homework, Presentations, Activities). Collapses to a thin
// strip so the user can reclaim space, and remembers its preferred
// state in localStorage.
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { api } from "./_shared";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const isoKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameYMD = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

function monthMatrix(anchor) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(y, m, 1 - offset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  return cells[35].getMonth() !== m ? cells.slice(0, 35) : cells;
}

const PREF_KEY = "mudir.teaching-rail.collapsed";

export default function TeachingRail() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(PREF_KEY) === "1"; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, collapsed ? "1" : "0"); }
    catch { /* ignore */ }
  }, [collapsed]);

  const today = useMemo(() => new Date(), []);
  const [anchor, setAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  // selectedDate drives where the upcoming-days list starts. Defaults
  // to today; clicking a day in the mini grid moves it.
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const grid = useMemo(() => monthMatrix(anchor), [anchor]);

  const onPickDay = (d) => {
    const picked = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    setSelectedDate(picked);
    if (d.getMonth() !== anchor.getMonth() || d.getFullYear() !== anchor.getFullYear()) {
      setAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const [events, setEvents] = useState([]);
  useEffect(() => {
    api("/api/schedule")
      .then((rows) => {
        setEvents(
          (rows || [])
            .filter((r) => r.status !== "done")
            .map((r) => ({
              id: r.id,
              date: typeof r.date === "string"
                ? r.date.slice(0, 10)
                : new Date(r.date).toISOString().slice(0, 10),
              title: r.title,
              time: r.start_time ? String(r.start_time).slice(0, 5) : null,
            }))
        );
      })
      .catch(() => setEvents([]));
  }, []);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  // Outlook-style chronological list — 7 days starting from whichever
  // day is currently selected (defaults to today). The entry whose
  // date matches today is always labelled and colored "Today".
  const upcomingDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate() + i
      );
      const isToday = sameYMD(d, today);
      const isTomorrow = sameYMD(
        d,
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      );
      return {
        date: d,
        iso: isoKey(d),
        isToday,
        label: isToday ? "Today" : isTomorrow ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "long" }),
        sub: d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
        events: (eventsByDate.get(isoKey(d)) || []).sort((a, b) =>
          (a.time || "").localeCompare(b.time || "")
        ),
      };
    });
  }, [today, selectedDate, eventsByDate]);

  // pt-14 keeps the rail's top controls below the page-level X close
  // button (absolute top-3 right-8 in App.jsx) so they don't visually
  // collide.
  if (collapsed) {
    return (
      <aside className="shrink-0 w-9 flex flex-col items-center pt-14 border-l border-line/60">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand calendar rail"
          title="Show calendar"
          className="planner-nav-btn h-8 w-8 rounded-lg border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink flex items-center justify-center"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="mt-3 inline-flex h-7 w-7 rounded-full bg-accent text-paper-cool items-center justify-center font-mono text-[11px]">
          {today.getDate()}
        </span>
        <CalendarDays size={14} className="text-muted mt-3" />
      </aside>
    );
  }

  return (
    <aside className="shrink-0 w-[270px] flex flex-col gap-4 pt-14 pl-6 border-l border-line/60">
      {/* Header — month label + collapse */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1))
            }
            aria-label="Previous month"
            className="planner-nav-btn h-6 w-6 rounded-md border border-line bg-paper-cool hover:bg-paper-warm flex items-center justify-center"
          >
            <ChevronLeft size={12} />
          </button>
          <h3 className="font-serif text-[15px] font-medium text-ink leading-none">
            {MONTH_NAMES[anchor.getMonth()]}{" "}
            <span className="text-muted font-normal">{anchor.getFullYear()}</span>
          </h3>
          <button
            type="button"
            onClick={() =>
              setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1))
            }
            aria-label="Next month"
            className="planner-nav-btn h-6 w-6 rounded-md border border-line bg-paper-cool hover:bg-paper-warm flex items-center justify-center"
          >
            <ChevronRight size={12} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse calendar rail"
          title="Hide calendar"
          className="planner-nav-btn h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-paper-warm flex items-center justify-center"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Mini month grid */}
      <div>
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d, i) => (
            <div
              key={i}
              className="text-center font-mono text-[9.5px] uppercase tracking-wider text-muted py-1"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {grid.map((d, i) => {
            const inMonth = d.getMonth() === anchor.getMonth();
            const isToday = sameYMD(d, today);
            const isSelected = sameYMD(d, selectedDate);
            const hasEvents = (eventsByDate.get(isoKey(d)) || []).length > 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPickDay(d)}
                aria-label={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                aria-pressed={isSelected}
                className="aspect-square flex flex-col items-center justify-center rounded-md transition-colors hover:bg-paper-warm/50 focus:outline-none focus:ring-1 focus:ring-accent/40"
              >
                <span
                  className={`flex items-center justify-center h-6 w-6 rounded-full font-mono text-[11px] transition-colors ${
                    isToday
                      ? "bg-accent text-paper-cool font-medium"
                      : isSelected
                        ? "bg-accent/[0.14] text-ink font-medium ring-1 ring-accent/40"
                        : inMonth
                          ? "text-ink"
                          : "text-muted/45"
                  }`}
                >
                  {d.getDate()}
                </span>
                <span
                  className={`h-1 w-1 rounded-full mt-px ${
                    hasEvents && !isToday ? "bg-accent" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-line/40" />

      {/* Upcoming chronological list */}
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-3 pb-2">
        {upcomingDays.map((day) => (
          <div key={day.iso}>
            <p className={`text-[11.5px] mb-1.5 ${day.isToday ? "text-accent" : ""}`}>
              <span className={`font-medium ${day.isToday ? "text-accent" : "text-ink"}`}>
                {day.label}
              </span>
              <span className={day.isToday ? "text-accent" : "text-muted"}>
                {" "}· {day.sub}
              </span>
            </p>
            {day.events.length === 0 ? (
              <p className="text-[11.5px] text-muted/80 italic">
                No events scheduled
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {day.events.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-baseline gap-2 text-[12px] leading-tight"
                  >
                    {e.time && (
                      <span className="font-mono text-[10.5px] text-muted shrink-0 tabular-nums">
                        {e.time}
                      </span>
                    )}
                    <span className="text-ink truncate">{e.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
