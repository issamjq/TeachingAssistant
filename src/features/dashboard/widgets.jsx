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

/* ── the line model of the rhythm chart ───────────────────────────── */

/**
 * The same eight weeks as a line — the alternative model the customize
 * panel offers. A line answers "which way is this heading" faster than
 * pills; the pills answer "which week held what". Both are honest, so
 * the teacher picks.
 */
export function LineTrend({ data = [] }) {
  const total = data.reduce((a, d) => a + d.n, 0);
  if (!total) {
    return (
      <p className="text-sm text-muted py-8 text-center">
        Nothing made yet — this fills in as you work.
      </p>
    );
  }
  const w = 320, h = 110, pad = 8;
  const max = Math.max(1, ...data.map((d) => d.n));
  const pts = data.map((d, i) => [
    pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2),
    h - pad - (d.n / max) * (h - pad * 2),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;

  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none"
           role="img" aria-label={`Work created per week, ${total} items over ${data.length} weeks.`}>
        <defs>
          <linearGradient id="ltFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--p-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--p-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#ltFill)" />
        <path d={line} fill="none" stroke="var(--p-accent)" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="var(--p-accent)" />
      </svg>
      <table className="sr-only">
        <caption>Work created per week</caption>
        <tbody>{data.map((d) => <tr key={d.week}><th scope="row">{d.week}</th><td>{d.n}</td></tr>)}</tbody>
      </table>
    </>
  );
}

/* ── the donut model of the library breakdown ─────────────────────── */

const DONUT_TONES = [
  "var(--p-accent)", "var(--p-ambient-lift)", "var(--p-ok)",
  "var(--p-warn)", "var(--p-ambient-deep)",
];

/** The library as proportions rather than ranks. */
export function KindDonut({ data = [], onPick }) {
  const rows = [...data].filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  const total = rows.reduce((a, r) => a + r.n, 0);
  if (!total) {
    return <p className="text-sm text-muted py-4">Your library is empty. Anything you make lands here.</p>;
  }

  const size = 132, stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const segs = rows.map((row, i) => {
    const frac = row.n / total;
    const seg = { ...row, tone: DONUT_TONES[i % DONUT_TONES.length], dash: frac * c, off: -acc * c };
    acc += frac;
    return seg;
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          {segs.map((sg) => (
            <circle key={sg.key} cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={sg.tone} strokeWidth={stroke}
                    strokeDasharray={`${Math.max(0, sg.dash - 2)} ${c - sg.dash + 2}`}
                    strokeDashoffset={sg.off}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          ))}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <span className="text-center leading-none">
            <span className="block font-serif text-[26px] text-ink">{total}</span>
            <span className="block text-[9px] font-mono uppercase tracking-widest text-muted mt-1">items</span>
          </span>
        </div>
      </div>
      <ul className="space-y-1.5 min-w-[130px] flex-1">
        {segs.map((sg) => (
          <li key={sg.key}>
            <button type="button" onClick={() => onPick?.(sg.key)}
                    className="flex items-center gap-2.5 w-full text-start group cursor-pointer">
              <span aria-hidden="true"
                    style={{ width: 9, height: 9, borderRadius: 3, background: sg.tone, flexShrink: 0 }} />
              <span className="text-[12.5px] text-ink group-hover:text-accent transition-colors flex-1">
                {sg.label}
              </span>
              <span className="text-[12.5px] tabular-nums text-ink-soft">{sg.n}</span>
            </button>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>Library by kind</caption>
        <tbody>{rows.map((x) => <tr key={x.key}><th scope="row">{x.label}</th><td>{x.n}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
