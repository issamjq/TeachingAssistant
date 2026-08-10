"use client";

// =====================================================================
// Dashboard widgets — calendar, charts, tasks
//
// The charts are hand-drawn SVG rather than Chart.js or Recharts. Not
// stubbornness: the whole app runs on ten runtime dependencies, and the
// three shapes needed here — a trend line, a set of bars, a ring — are
// about forty lines each. A charting library would be the largest
// dependency in the project, shipped so a sparkline can have a tooltip.
//
// If real analytics arrive later — zoom, brushing, multiple series —
// that is the moment to add one. Not before.
// =====================================================================
import React, { useMemo } from "react";
import s from "./Dashboard.module.css";

const MONTHS = ["January","February","March","April","May","June","July",
                "August","September","October","November","December"];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

/* ── calendar ─────────────────────────────────────────────────────── */

/**
 * A month grid with the teacher's lessons marked.
 *
 * Monday-first, because a teaching week is. Days outside the month are
 * still rendered so the grid keeps its shape rather than reflowing
 * between months.
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
    // getDay() is Sunday-based; shift so Monday is column 0.
    const lead = (first.getDay() + 6) % 7;
    const out = [];
    for (let i = 0; i < lead; i++) {
      const d = new Date(y, m, -(lead - 1 - i));
      out.push({ d, outside: true });
    }
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 1; i <= days; i++) out.push({ d: new Date(y, m, i), outside: false });
    while (out.length % 7) {
      out.push({ d: new Date(y, m + 1, out.length - lead - days + 1), outside: true });
    }
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
              // Screen readers get the count in words; the dot is for eyes.
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

/* ── trend ────────────────────────────────────────────────────────── */

/**
 * Work created per week. A line chart, because the question is "is this
 * going up" and a line answers it faster than anything else.
 *
 * pathLength="1" normalises the dash animation so the draw-on takes the
 * same time whatever the shape.
 */
export function TrendChart({ data = [], height = 96 }) {
  const w = 320;
  const pad = 6;
  const max = Math.max(1, ...data.map((d) => d.n));

  const pts = data.map((d, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
    const yv = height - pad - (d.n / max) * (height - pad * 2);
    return [x, yv];
  });

  const line = pts.map(([x, yv], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${yv.toFixed(1)}`).join(" ");
  const area = pts.length
    ? `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height - pad} L${pts[0][0].toFixed(1)} ${height - pad} Z`
    : "";

  const total = data.reduce((a, d) => a + d.n, 0);
  if (!total) {
    return (
      <p className="text-sm text-muted py-6 text-center">
        Nothing made yet — this fills in as you work.
      </p>
    );
  }

  return (
    <>
      <svg
        className={s.spark}
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Work created per week for the last ${data.length} weeks, ${total} items in total.`}
      >
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--p-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--p-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill="url(#trendFill)" />}
        <path className={s.sparkLine} d={line} pathLength="1" />
        {pts.map(([x, yv], i) => (
          <circle key={i} cx={x} cy={yv} r={i === pts.length - 1 ? 3.5 : 0}
                  fill="var(--p-accent)" />
        ))}
      </svg>
      {/* The accessible alternative to the picture. */}
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

/* ── breakdown ────────────────────────────────────────────────────── */

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
          <button
            type="button"
            onClick={() => onPick?.(r.key)}
            className="w-full text-start group cursor-pointer"
          >
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-[13px] text-ink group-hover:text-accent transition-colors">
                {r.label}
              </span>
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
 * What needs attention.
 *
 * Derived from work that is already unfinished rather than typed in by
 * hand. A manual list is one more thing to maintain, and an empty one is
 * a reproach — this one is right without tending and empties itself as
 * the work gets done.
 */
export function TaskList({ tasks = [], onOpen }) {
  if (!tasks.length) {
    return (
      <div className="py-5 text-center">
        <p className="text-sm text-ink">Nothing needs you right now.</p>
        <p className="text-xs text-muted mt-1">
          Unfinished drafts and today's lessons show up here.
        </p>
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
