"use client";

// =====================================================================
// The Scheduler — a month you can read the shape of
//
// The old screen was three stacked surfaces that had drifted out of the
// design system: a cream hero with a PNG texture and its own quick
// actions, a month grid whose chips were sage and gold, and a right
// column of three separate cards whose seams were the loudest thing on
// the page. It also asked twice — once in the hero, once in the rail —
// for the same four "make something" actions.
//
// What it did not have was any sense of LOAD. A month grid tells you
// what is on the 14th; it does not tell you that the second week is
// brutal and the third is empty, which is the thing a teacher opens a
// month view to find out. So the ribbon above the grid draws one bar per
// day, stacked by kind: the shape of the month, before a word is read.
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
import {
  KINDS, KIND_BY_KEY, tintOf, isoKey, sameYMD,
  monthGrid, daysOfMonth, monthStats, ribbonCeiling,
} from "./month";
import s from "./Planner.module.css";

/** The four things worth making, and where each one lives. */
const MAKE = [
  { kind: "lesson-plans",  verb: "Draft",  noun: "a lesson plan", to: ["lesson-plans"] },
  { kind: "quizzes",       verb: "Build",  noun: "a quiz",        to: ["quizzes"] },
  { kind: "homework",      verb: "Set",    noun: "homework",      to: ["homework"] },
  { kind: "presentations", verb: "Make",   noun: "a deck",        to: ["presentations"] },
];

export default function PlannerView() {
  const t = useT();
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar" : "en-US";

  const [anchor, setAnchor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
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
  const monthDays = useMemo(() => daysOfMonth(anchor, eventsByDate), [anchor, eventsByDate]);
  const stats = useMemo(() => monthStats(monthDays, todayIso), [monthDays, todayIso]);
  const ceiling = useMemo(() => ribbonCeiling(monthDays), [monthDays]);

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
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(anchor);

  const goPrev = () => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1));
  const goNext = () => setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1));
  const goToday = () => setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));

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

  const toggleKind = (key) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  const allOn = visible.size === KINDS.length;

  return (
    <div className="relative max-w-[1440px] mx-auto flex flex-col lg:h-full lg:min-h-0">
      {/* ── header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Scheduler
          </p>
          <h1 className="font-serif text-4xl font-medium text-ink leading-none">
            {monthName} <em className="italic font-light text-accent">{anchor.getFullYear()}</em>
          </h1>
          <p className="text-muted mt-2 text-[14.5px]">{t("planner.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button" onClick={goPrev} aria-label="Previous month"
            className="h-9 w-9 rounded-lg border border-line hover:border-accent hover:bg-paper-warm grid place-items-center cursor-pointer transition"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button" onClick={goToday}
            className="h-9 px-3 rounded-lg border border-line hover:border-accent hover:bg-paper-warm font-mono text-[10.5px] uppercase tracking-wider cursor-pointer transition"
          >
            Today
          </button>
          <button
            type="button" onClick={goNext} aria-label="Next month"
            className="h-9 w-9 rounded-lg border border-line hover:border-accent hover:bg-paper-warm grid place-items-center cursor-pointer transition"
          >
            <ChevronRight size={15} />
          </button>
          <Button className="ms-1" onClick={() => openNewForDay(todayIso)}>
            <Plus size={15} className="mr-2" /> New entry
          </Button>
        </div>
      </div>

      {/* ── the shape of the month ──────────────────────────────── */}
      <div className="rounded-2xl border border-line bg-surface/85 px-4 pt-3.5 pb-3 mb-4">
        <div className="flex items-baseline justify-between gap-3 mb-2.5">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted">
            How the month falls
          </p>
          <p className="text-[11.5px] text-muted">
            {stats.total
              ? <>Heaviest: <span className="text-ink">
                  {stats.busiest?.date.toLocaleDateString(locale, { weekday: "long", day: "numeric" })}
                </span> · {stats.busiest?.events.length} items</>
              : "Nothing scheduled yet"}
          </p>
        </div>

        <div className={s.ribbon}>
          {monthDays.map(({ date, key, events: evs }) => (
            <button
              key={key}
              type="button"
              className={s.ribbonDay}
              data-today={sameYMD(date, today)}
              data-past={date < todayStart}
              onClick={() => setDayListDate(key)}
              title={`${date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })} — ${evs.length} item${evs.length === 1 ? "" : "s"}`}
              aria-label={`${date.getDate()}: ${evs.length} items`}
            >
              {evs.slice(0, 6).map((e, i) => (
                <span
                  key={e.id || i}
                  className={s.ribbonSeg}
                  style={{ "--seg": tintOf(e.kind), height: `${Math.max(3, (100 / ceiling) * 0.82)}%` }}
                />
              ))}
            </button>
          ))}
        </div>
        <div className={s.ribbonScale}>
          <span>1</span>
          <span>{Math.ceil(monthDays.length / 2)}</span>
          <span>{monthDays.length}</span>
        </div>
      </div>

      {/* ── filters ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className={s.filters}>
          <button
            type="button"
            className={s.chip}
            data-on={allOn}
            onClick={() => setVisible(allOn ? new Set() : new Set(KINDS.map((k) => k.key)))}
            style={{ "--tint": "var(--p-ink)" }}
          >
            <span className={s.chipDot} />
            {t("planner.all")}
            <span className={s.chipCount}>{events.length}</span>
          </button>
          {/* Only kinds something can actually be. Lesson plans carry no
              date yet, so a chip for them would sit at zero forever,
              toggling nothing — a control that cannot do anything is
              worse than an absent one. It appears by itself the day
              drafts start arriving with dates on them. */}
          {KINDS.filter((k) => counts.get(k.key)).map((k) => (
            <button
              key={k.key}
              type="button"
              className={s.chip}
              data-on={visible.has(k.key)}
              onClick={() => toggleKind(k.key)}
              style={{ "--tint": k.tint }}
              aria-pressed={visible.has(k.key)}
            >
              <span className={s.chipDot} />
              {k.label}
              <span className={s.chipCount}>{counts.get(k.key) || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── calendar + rail ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 lg:flex-1 lg:min-h-0">
        <div className={s.grid}>
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
        </div>

        {/* ── one rail, three sections ───────────────────────────── */}
        <aside className={s.rail}>
          <div className={s.railSection}>
            <p className={s.railTitle}>This month</p>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-[30px] leading-none text-ink">{stats.total}</span>
              <span className="text-[12px] text-muted">
                {stats.total === 1 ? "thing planned" : "things planned"}
              </span>
            </div>
            <div className={`${s.meter} mt-3`}>
              <span className={s.meterFill} style={{ width: `${stats.percent}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2 font-mono text-[10px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck2 size={11} className="text-accent" /> {stats.done} done
              </span>
              <span>{stats.ahead} still ahead</span>
            </div>
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
                  <ArrowRight size={13} className="text-muted flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </aside>
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
