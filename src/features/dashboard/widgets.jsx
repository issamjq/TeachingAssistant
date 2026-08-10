"use client";

// =====================================================================
// Dashboard widgets — calendar, pill chart, ring, schedule, tasks
//
// All hand-drawn SVG and CSS rather than a charting library. The whole
// app runs on ten runtime dependencies, and the shapes needed here — a
// row of pill bars, a donut, a month grid — are about forty lines each.
// Chart.js would be the largest dependency in the project, shipped so a
// bar can have a tooltip.
//
// Every visual carries an accessible twin: charts have sr-only tables,
// calendar days speak their counts, and nothing relies on colour alone.
// =====================================================================
import React, { useMemo } from "react";
import s from "./Dashboard.module.css";

const MONTHS = ["January","February","March","April","May","June","July",
                "August","September","October","November","December"];
const MON_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

/* ── pill bar chart ───────────────────────────────────────────────── */

/**
 * Work created per week, as rounded pills — with empty weeks drawn as
 * dashed ghosts rather than omitted. The ghost is the point: a missing
 * bar reads as a rendering gap, a dashed one reads as "this week
 * existed and held nothing".
 */
export function PillBars({ data = [] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((a, d) => a + d.n, 0);

  if (!total) {
    return (
      <p className="text-sm text-muted py-8 text-center">
        Nothing made yet — this fills in as you work.
      </p>
    );
  }

  const label = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return `${d.getDate()} ${MON_SHORT[d.getMonth()]}`;
  };

  return (
    <>
      <div
        className={s.pillRow}
        role="img"
        aria-label={`Work created per week over the last ${data.length} weeks, ${total} items in total.`}
      >
        {data.map((d, i) => {
          const now = i === data.length - 1;
          return (
            <div key={d.week} className={s.pillCol}>
              {d.n === 0 ? (
                <div className={s.pillGhost} aria-hidden="true" />
              ) : (
                <div
                  className={s.pill}
                  data-now={now}
                  // Floor of 14% so one item is still visibly a pill,
                  // not a dot lost at the baseline.
                  style={{ height: `${Math.max(14, (d.n / max) * 100)}%` }}
                  aria-hidden="true"
                />
              )}
              <span className={s.pillLabel} data-now={now}>{now ? "now" : label(d.week)}</span>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>Work created per week</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.week}><th scope="row">{d.week}</th><td>{d.n}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/* ── ring ─────────────────────────────────────────────────────────── */

/** A donut for "x of y", drawn for the dark card. */
export function Ring({ value = 0, max = 1, size = 92, children }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, max ? value / max : 0));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className={s.ringTrack} cx={size / 2} cy={size / 2} r={r}
                fill="none" strokeWidth={stroke} />
        <circle
          className={s.ringFill}
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

/* ── week schedule ────────────────────────────────────────────────── */

/**
 * The next lessons as a dated list — each row led by a date chip, the
 * way EDUPRO sets its upcoming assignments. Big serif day numeral so
 * the date is scannable before the title is read.
 */
export function WeekSchedule({ entries = [], onOpen }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const rows = useMemo(
    () =>
      [...entries]
        .filter((e) => e?.date)
        .sort((a, b) =>
          a.date === b.date
            ? (a.start_time || "").localeCompare(b.start_time || "")
            : a.date.localeCompare(b.date))
        .slice(0, 5),
    [entries]
  );

  if (!rows.length) {
    return (
      <p className="text-sm text-muted py-4">
        Nothing on the timetable yet — plan a lesson and it lands here.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {rows.map((e, i) => {
        const d = new Date(e.date + "T00:00:00");
        return (
          <li key={`${e.date}-${i}`}>
            <button type="button" onClick={() => onOpen?.()} className={`${s.task} !py-2`}>
              <span className={s.dateChip} data-today={e.date === todayIso} aria-hidden="true">
                <span className={s.dateChipDay}>{d.getDate()}</span>
                <span className={s.dateChipMon}>{MON_SHORT[d.getMonth()]}</span>
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block text-[13.5px] text-ink leading-snug truncate">
                  {e.title || "Lesson"}
                </span>
                <span className="block text-[11.5px] text-muted mt-0.5 truncate">
                  {[e.start_time ? e.start_time.slice(0, 5) : null, e.subject]
                    .filter(Boolean).join(" · ") || "—"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ── calendar ─────────────────────────────────────────────────────── */

/**
 * A month grid with the teacher's lessons marked. Monday-first, because
 * a teaching week is. Days outside the month stay rendered so the grid
 * keeps its shape between months.
 */
export function MiniCalendar({ entries = [], onPick }) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  const byDate = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (!e?.date) continue;
      map.set(e.date, (map.get(e.date) || 0) + 1);
    }
    return map;
  }, [entries]);

  const cells = useMemo(() => {
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;      // shift Sunday-based to Monday-first
    const out = [];
    for (let i = 0; i < lead; i++) out.push({ d: new Date(y, m, -(lead - 1 - i)), outside: true });
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 1; i <= days; i++) out.push({ d: new Date(y, m, i), outside: false });
    while (out.length % 7) out.push({ d: new Date(y, m + 1, out.length - lead - days + 1), outside: true });
    return out;
  }, [y, m]);

  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayIso = iso(today);

  return (
    <div>
      <div className={s.calGrid} aria-hidden="true">
        {DOW.map((d, i) => <div key={i} className={s.calHead}>{d}</div>)}
      </div>
      <div className={s.calGrid} role="grid" aria-label={`${MONTHS[m]} ${y}`}>
        {cells.map(({ d, outside }, i) => {
          const key = iso(d);
          const n = byDate.get(key) || 0;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={s.calDay}
              data-outside={outside}
              data-today={key === todayIso}
              data-has={n > 0}
              onClick={() => onPick?.(key)}
              aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]}${n ? `, ${n} lesson${n > 1 ? "s" : ""}` : ", nothing scheduled"}`}
            >
              {d.getDate()}
              {n > 0 && <span className={s.calDot} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── library breakdown ────────────────────────────────────────────── */

/** Horizontal bars, sorted descending — the ranking is the point. */
export function TypeBreakdown({ data = [], onPick }) {
  const rows = [...data].sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((a, r) => a + r.n, 0);

  if (!total) {
    return <p className="text-sm text-muted py-4">Your library is empty. Anything you make lands here.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <button type="button" onClick={() => onPick?.(r.key)} className="w-full text-start group cursor-pointer">
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-[13px] text-ink group-hover:text-accent transition-colors">{r.label}</span>
              <span className="text-[13px] tabular-nums text-ink-soft">{r.n}</span>
            </div>
            <div className={s.barTrack}>
              <div className={s.barFill} style={{ width: `${(r.n / max) * 100}%` }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ── tasks ────────────────────────────────────────────────────────── */

/**
 * What needs attention — derived from work already in an unfinished
 * state, never typed in. A manual list is one more thing to maintain,
 * and an empty one is a reproach; this one empties itself as the work
 * gets done.
 */
export function TaskList({ tasks = [], onOpen }) {
  if (!tasks.length) {
    return (
      <div className="py-5 text-center">
        <p className="text-sm text-ink">Nothing needs you right now.</p>
        <p className="text-xs text-muted mt-1">Unfinished drafts and today's lessons show up here.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {tasks.map((t) => (
        <li key={t.id}>
          <button type="button" className={s.task} onClick={() => onOpen?.(t.section)}>
            <span className={s.taskPip} data-urgent={!!t.urgent} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] text-ink leading-snug">{t.title}</span>
              <span className="block text-[11.5px] text-muted mt-0.5">{t.meta}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ── the khatim watermark ─────────────────────────────────────────── */

/** The landing's eight-point star, for the loud card's corner. */
export function KhatimMark({ className }) {
  // Two overlapping squares, one rotated 45° — the classic construction.
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" fill="none">
      <rect x="18" y="18" width="64" height="64" stroke="currentColor" strokeWidth="1.4" />
      <rect x="18" y="18" width="64" height="64" stroke="currentColor" strokeWidth="1.4"
            transform="rotate(45 50 50)" />
      <circle cx="50" cy="50" r="13" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
