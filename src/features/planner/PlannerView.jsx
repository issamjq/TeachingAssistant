"use client";

// =====================================================================
// The Scheduler — the calendar model everyone already knows
//
// Restructured on the convention Google Calendar taught the world,
// wearing Murchid's own materials: one toolbar (Today, arrows, the
// period, the view), one sidebar (create, the little month, which
// calendars are on, what is next), and one main surface that is a
// month grid, a week drawer or a day drawer depending on the view.
//
// The week and day views are the new capability, not just new paint:
// schedule entries have clock times, and a month cell cannot show that
// 09:00 and 09:30 collide — the time grid can, and does, the same way
// a calendar drawer does everywhere else. Clicking an empty slot
// creates an entry at that hour; clicking an entry edits it; a day's
// header falls into its day. Quizzes, homework, decks and activities
// carry dates but no clock, so they live on the all-day shelf.
// =====================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Plus, ArrowRight, CalendarCheck2,
} from "lucide-react";
import { navigate } from "@/lib/route";
import { useT, useI18n } from "@/lib/i18n";
import { api } from "@/views/_shared";
import { Button } from "@/components/ui/button";
import SchedulePopup from "@/views/_schedule-popup";
import PlannerTour, { hasSeenPlannerTour } from "@/views/onboarding/PlannerTour";
import { today as todayKey } from "@/lib/localDate";
import DayPeek from "./DayPeek";
import MiniMonth from "./MiniMonth";
import WeekGrid from "./WeekGrid";
import {
  KINDS, KIND_BY_KEY, tintOf, isoKey, sameYMD,
  monthGrid, daysOfMonth, monthStats, weekOf,
} from "./month";
import s from "./Planner.module.css";

/** The four things worth making, and where each one lives. */
const MAKE = [
  { kind: "lesson-plans",  verb: "Draft",  noun: "a lesson plan", to: ["lesson-plans"] },
  { kind: "quizzes",       verb: "Build",  noun: "a quiz",        to: ["quizzes"] },
  { kind: "homework",      verb: "Set",    noun: "homework",      to: ["homework"] },
  { kind: "presentations", verb: "Make",   noun: "a deck",        to: ["presentations"] },
];

const VIEWS = ["day", "week", "month"];
const VIEW_KEY = "murchid.planner.view";

export default function PlannerView() {
  const t = useT();
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar" : "en-US";

  // The anchor is a DAY now, not a month: week and day views need to
  // know which one, and the month views just read its month.
  const [anchor, setAnchor] = useState(() => new Date());
  // Server-rendered as month and corrected on mount — reading the saved
  // view during the first render is the localStorage-hydration trap this
  // repo has already paid for twice.
  const [view, setView] = useState("month");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (VIEWS.includes(saved)) setView(saved);
    } catch { /* default stands */ }
  }, []);
  const pickView = (v) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* a preference, not data */ }
  };

  const [visible, setVisible] = useState(() => new Set(KINDS.map((k) => k.key)));
  const [events, setEvents] = useState([]);
  const [teacherGrades, setTeacherGrades] = useState([]);
  const [teacherSections, setTeacherSections] = useState([]);

  const [showSchedule, setShowSchedule] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formDefaultDate, setFormDefaultDate] = useState(null);
  const [dayListDate, setDayListDate] = useState(null);
  // The assistant's "put X on Thursday" hand-off: open the entry form
  // seeded with what it knew. The teacher still confirms the save.
  const [prefillEntry, setPrefillEntry] = useState(null);
  useEffect(() => {
    import("@/shared/lib/assistantPrefill").then(({ takePrefill }) => {
      const pre = takePrefill("add_schedule_entry");
      if (!pre) return;
      const fields = {};
      for (const k of ["title", "subject", "grade", "section", "date", "start_time", "end_time", "notes"]) {
        if (typeof pre[k] === "string" && pre[k]) fields[k] = pre[k];
      }
      if (Object.keys(fields).length) {
        setPrefillEntry(fields);
        setShowSchedule(true);
      }
    });
  }, []);

  // See the note in the loader: the tour opens once, for a new account,
  // and never on mount.
  const [tourOpen, setTourOpen] = useState(false);
  const tourDecided = useRef(false);

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayIso = todayKey();

  useEffect(() => {
    api("/api/me")
      .then((me) => {
        setTeacherGrades(Array.isArray(me?.grade_levels) ? me.grade_levels : []);
        setTeacherSections(Array.isArray(me?.sections) ? me.sections : []);
      })
      .catch(() => { /* the form just shows an empty list */ });
  }, []);

  const isoOnly = (v) => {
    if (typeof v === "string") return v.slice(0, 10);
    const d = new Date(v);
    return isoKey(d);
  };

  const reloadEvents = useCallback(() => {
    Promise.allSettled([
      api("/api/schedule"),
      api("/api/quizzes"),
      api("/api/homework"),
      api("/api/presentations"),
      api("/api/activities"),
    ]).then((results) => {
      const get = (i) => (results[i].status === "fulfilled" ? results[i].value || [] : []);
      const all = [
        ...get(0).map((r) => ({
          id: `schedule-${r.id}`, raw: r, date: isoOnly(r.date), kind: "schedule",
          title: r.title, time: r.start_time ? String(r.start_time).slice(0, 5) : undefined,
        })),
        ...get(1).filter((q) => q.scheduled_for).map((q) => ({
          id: `quiz-${q.id}`, date: isoOnly(q.scheduled_for), kind: "quizzes", title: q.title,
        })),
        ...get(2).filter((h) => h.due_date).map((h) => ({
          id: `homework-${h.id}`, date: isoOnly(h.due_date), kind: "homework", title: h.title,
        })),
        ...get(3).filter((p) => p.scheduled_for).map((p) => ({
          id: `presentation-${p.id}`, date: isoOnly(p.scheduled_for), kind: "presentations", title: p.title,
        })),
        ...get(4).filter((a) => a.scheduled_for).map((a) => ({
          id: `activity-${a.id}`, date: isoOnly(a.scheduled_for), kind: "activities", title: a.title,
        })),
      ];
      setEvents(all);

      // Once, on the first load only. "New" is the account, not the
      // device: a calendar with anything in it belongs to someone who
      // has already started, whatever browser they are in.
      if (!tourDecided.current) {
        tourDecided.current = true;
        const answered = results.some((r) => r.status === "fulfilled");
        if (answered && all.length === 0 && !hasSeenPlannerTour()) setTourOpen(true);
      }
    });
  }, []);
  useEffect(() => { reloadEvents(); }, [reloadEvents]);

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
  const week = useMemo(() => weekOf(anchor), [anchor]);
  const monthDays = useMemo(() => daysOfMonth(anchor, eventsByDate), [anchor, eventsByDate]);
  const stats = useMemo(() => monthStats(monthDays, todayIso), [monthDays, todayIso]);

  const counts = useMemo(() => {
    const m = new Map();
    for (const e of events) m.set(e.kind, (m.get(e.kind) || 0) + 1);
    return m;
  }, [events]);

  const upcoming = useMemo(
    () => events
      .filter((e) => e.date >= todayIso)
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
      .slice(0, 5),
    [events, todayIso],
  );

  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 1 + i))),
    [locale],
  );

  // What the toolbar calls the period depends on the view: the month,
  // the week's span, or the day itself.
  const title = useMemo(() => {
    if (view === "day") {
      return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(anchor);
    }
    if (view === "week") {
      try {
        return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" })
          .formatRange(week[0], week[6]);
      } catch {
        return `${week[0].getDate()} – ${week[6].getDate()}`;
      }
    }
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(anchor);
  }, [view, anchor, week, locale]);

  // Prev/next move by whatever the view shows.
  const step = (dir) =>
    setAnchor((a) => {
      if (view === "month") return new Date(a.getFullYear(), a.getMonth() + dir, 1);
      const d = new Date(a);
      d.setDate(a.getDate() + dir * (view === "week" ? 7 : 1));
      return d;
    });
  const goToday = () => setAnchor(new Date());

  const openNewForDay = (iso, startTime = null) => {
    setFormDefaultDate(iso);
    setEditingEntry(null);
    setDayListDate(null);
    if (startTime) {
      const [h] = startTime.split(":").map(Number);
      setPrefillEntry({
        date: iso,
        start_time: startTime,
        end_time: `${String(Math.min(23, h + 1)).padStart(2, "0")}:00`,
      });
    }
    setShowSchedule(true);
  };
  const openEditEntry = (entry) => {
    // Only schedule entries are editable here; a quiz chip belongs to the
    // quizzes screen and the day peek offers the way there.
    if (entry.kind === "schedule" && entry.raw) {
      setEditingEntry(entry.raw);
      setDayListDate(null);
      setShowSchedule(true);
    } else {
      setDayListDate(entry.date);
    }
  };

  const toggleKind = (key) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  const allOn = visible.size === KINDS.length;

  const fallToDay = (d) => {
    setAnchor(new Date(d));
    pickView("day");
  };

  return (
    <div className="relative max-w-[1440px] mx-auto flex flex-col lg:h-full lg:min-h-0">
      {/* ── the toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button" onClick={goToday}
            className="h-9 px-3.5 rounded-lg border border-line hover:border-accent hover:bg-paper-warm font-mono text-[10.5px] uppercase tracking-wider cursor-pointer transition"
          >
            Today
          </button>
          <button
            type="button" onClick={() => step(-1)} aria-label={`Previous ${view}`}
            className="h-9 w-9 rounded-lg border border-line hover:border-accent hover:bg-paper-warm grid place-items-center cursor-pointer transition"
          >
            <ChevronLeft size={15} className="rtl:rotate-180" />
          </button>
          <button
            type="button" onClick={() => step(1)} aria-label={`Next ${view}`}
            className="h-9 w-9 rounded-lg border border-line hover:border-accent hover:bg-paper-warm grid place-items-center cursor-pointer transition"
          >
            <ChevronRight size={15} className="rtl:rotate-180" />
          </button>
        </div>

        <h1 className="font-serif text-[22px] md:text-[26px] font-medium text-ink leading-none min-w-0 truncate">
          {view === "month" ? (
            <>
              {new Intl.DateTimeFormat(locale, { month: "long" }).format(anchor)}{" "}
              <em className="italic font-light text-accent">{anchor.getFullYear()}</em>
            </>
          ) : title}
        </h1>

        <div className="ms-auto flex items-center gap-2">
          <div className={s.viewSeg} role="radiogroup" aria-label="Calendar view">
            {VIEWS.map((v) => (
              <button
                key={v} type="button" role="radio"
                aria-checked={view === v}
                data-on={view === v}
                className={s.viewBtn}
                onClick={() => pickView(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <Button onClick={() => openNewForDay(view === "month" ? todayIso : isoKey(anchor))}>
            <Plus size={15} className="mr-2" /> New entry
          </Button>
        </div>
      </div>

      {/* ── sidebar + main ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[248px_1fr] gap-4 lg:flex-1 lg:min-h-0">
        <aside className={`${s.sidebar} order-2 lg:order-1 hidden lg:flex`}>
          <div className={s.railSection}>
            <MiniMonth
              anchor={anchor}
              view={view}
              eventsByDate={eventsByDate}
              locale={locale}
              onPick={(d) => setAnchor(new Date(d))}
              onMonthStep={(dir) =>
                setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, Math.min(a.getDate(), 28)))}
            />
          </div>

          <div className={s.railSection}>
            <p className={s.railTitle}>Calendars</p>
            <button
              type="button"
              className={s.calRow}
              data-on={allOn}
              onClick={() => setVisible(allOn ? new Set() : new Set(KINDS.map((k) => k.key)))}
              style={{ "--tint": "var(--p-ink)" }}
            >
              <span className={s.calDotSm} />
              {t("planner.all")}
              <span className={s.calCount}>{events.length}</span>
            </button>
            {/* Only kinds something can actually be — a row that toggles
                nothing is worse than an absent one. */}
            {KINDS.filter((k) => counts.get(k.key)).map((k) => (
              <button
                key={k.key}
                type="button"
                className={s.calRow}
                data-on={visible.has(k.key)}
                onClick={() => toggleKind(k.key)}
                style={{ "--tint": k.tint }}
                aria-pressed={visible.has(k.key)}
              >
                <span className={s.calDotSm} />
                {k.label}
                <span className={s.calCount}>{counts.get(k.key) || 0}</span>
              </button>
            ))}
          </div>

          <div className={`${s.railSection} ${s.railGrow}`}>
            <p className={s.railTitle}>Up next</p>
            {upcoming.length === 0 ? (
              <p className="text-[12.5px] text-muted leading-relaxed">
                Nothing ahead. Click a day to put something in it.
              </p>
            ) : upcoming.map((e) => {
              const d = new Date(`${e.date}T00:00:00`);
              return (
                <button
                  key={e.id}
                  type="button"
                  className={s.upNext}
                  style={{ "--tint": tintOf(e.kind) }}
                  onClick={() => setDayListDate(e.date)}
                >
                  <span className={s.upNextDay}>
                    <span className={s.upNextDow}>{d.toLocaleDateString(locale, { month: "short" })}</span>
                    <span className={s.upNextNum}>{d.getDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] text-ink leading-tight truncate">{e.title}</span>
                    <span className="block text-[10.5px] text-muted mt-0.5">
                      {[KIND_BY_KEY[e.kind]?.label, e.time].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={s.railSection}>
            <p className={s.railTitle}>Make something</p>
            {MAKE.map((m) => {
              const Icon = KIND_BY_KEY[m.kind].icon;
              return (
                <button
                  key={m.kind}
                  type="button"
                  className={s.action}
                  style={{ "--tint": KIND_BY_KEY[m.kind].tint }}
                  onClick={() => navigate(m.to)}
                >
                  <span className={s.actionIcon}><Icon size={14} /></span>
                  <span className="flex-1">
                    <span className="text-ink font-medium">{m.verb}</span> {m.noun}
                  </span>
                  <ArrowRight size={13} className="text-muted flex-shrink-0 rtl:rotate-180" />
                </button>
              );
            })}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-line/60 font-mono text-[10px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck2 size={11} className="text-accent" /> {stats.done} done
              </span>
              <span>{stats.ahead} ahead this month</span>
            </div>
          </div>
        </aside>

        {/* ── the main surface ───────────────────────────────────── */}
        <div className={`${s.grid} order-1 lg:order-2`}>
          {view === "month" ? (
            <>
              <div className={s.dowRow}>
                {weekdayLabels.map((d, i) => <div key={i} className={s.dow}>{d}</div>)}
              </div>
              <div className={s.cells} style={{ gridTemplateRows: `repeat(${grid.length / 7}, minmax(0, 1fr))` }}>
                {grid.map((d, i) => {
                  const key = isoKey(d);
                  const inMonth = d.getMonth() === anchor.getMonth();
                  const isToday = sameYMD(d, today);
                  const dayEvents = eventsByDate.get(key) || [];
                  const shown = dayEvents.slice(0, 3);
                  const overflow = dayEvents.length - shown.length;
                  const dow = d.getDay();

                  return (
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      data-tour={i === 0 ? "planner-cell" : undefined}
                      className={s.cell}
                      data-today={isToday}
                      data-outside={!inMonth}
                      data-past={!isToday && d < todayStart}
                      data-weekend={inMonth && (dow === 0 || dow === 6)}
                      onClick={() => setDayListDate(key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDayListDate(key); }
                      }}
                      aria-label={`${d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}, ${dayEvents.length} items`}
                    >
                      <div className={s.cellHead}>
                        <span className={s.cellNum}>{d.getDate()}</span>
                        {dayEvents.length > 0 && <span className={s.cellCount}>{dayEvents.length}</span>}
                      </div>

                      <div className={s.cellChips}>
                        {shown.map((e) => (
                          <span
                            key={e.id}
                            className={s.cellChip}
                            style={{ "--tint": tintOf(e.kind) }}
                            title={`${KIND_BY_KEY[e.kind]?.label || e.kind} · ${e.title}${e.time ? ` · ${e.time}` : ""}`}
                          >
                            {e.time ? `${e.time} ` : ""}{e.title}
                          </span>
                        ))}
                        {overflow > 0 && <span className={s.cellMore}>+{overflow} more</span>}
                      </div>

                      <button
                        type="button"
                        className={s.cellAdd}
                        aria-label={`Add an entry on ${d.toLocaleDateString(locale, { day: "numeric", month: "long" })}`}
                        onClick={(ev) => { ev.stopPropagation(); openNewForDay(key); }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <WeekGrid
              days={view === "week" ? week : [anchor]}
              eventsByDate={eventsByDate}
              locale={locale}
              onSlotClick={(iso, time) => openNewForDay(iso, time)}
              onEventClick={openEditEntry}
              onAllDayClick={(iso) => setDayListDate(iso)}
              onDayClick={fallToDay}
            />
          )}
        </div>
      </div>

      {dayListDate && (
        <DayPeek
          date={dayListDate}
          dayEvents={eventsByDate.get(dayListDate) || []}
          locale={locale}
          onClose={() => setDayListDate(null)}
          onSelect={openEditEntry}
          onNew={() => openNewForDay(dayListDate)}
        />
      )}

      {showSchedule && (
        <SchedulePopup
          initial={editingEntry}
          defaultDate={formDefaultDate}
          prefill={prefillEntry}
          teacherGrades={teacherGrades}
          teacherSections={teacherSections}
          onClose={() => { setShowSchedule(false); setEditingEntry(null); setFormDefaultDate(null); setPrefillEntry(null); }}
          onSaved={reloadEvents}
        />
      )}

      <PlannerTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
