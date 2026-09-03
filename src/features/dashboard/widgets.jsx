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
import React, { useMemo, useState } from "react";
import {
  ArrowUp, ArrowRight, Sparkles,
  FileText, GraduationCap, ClipboardList, Layers, Puzzle,
} from "lucide-react";
import { useI18n, useT } from "@/shared/i18n";
import s from "./Dashboard.module.css";
import { today } from "@/lib/localDate";

// Weekday initials for the UI language — 2024-01-01 is a Monday, so
// index 0 is Monday everywhere the grids expect it to be.
const dowNarrow = (locale) =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "narrow" }));

/** A week's Monday, as "12 Jul". Shared so the two rhythm charts
 *  cannot drift on how a week is spelled. */
const weekLabel = (iso, locale) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

/* ── pill bar chart ───────────────────────────────────────────────── */

/**
 * Work created per week, as rounded pills — with empty weeks drawn as
 * dashed ghosts rather than omitted. The ghost is the point: a missing
 * bar reads as a rendering gap, a dashed one reads as "this week
 * existed and held nothing".
 */
export function PillBars({ data = [], compact = false }) {
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar" : undefined;
  // Compact is a different drawing, not a scaled one: eight columns in a
  // 210px tile give 22px each, where the date labels collide and the
  // pills become tally marks. Five weeks, shorter bars, and only the
  // current week labelled keeps every element at a size it can be read
  // at — the chart answers "is it going up" either way.
  if (compact) data = data.slice(-5);
  const max = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((a, d) => a + d.n, 0);

  if (!total) {
    return (
      <p className="text-sm text-muted py-8 text-center">
        Nothing made yet — this fills in as you work.
      </p>
    );
  }

  const label = (iso) => weekLabel(iso, locale);

  return (
    <>
      <div
        className={s.pillRow}
        data-compact={compact || undefined}
        role="img"
        aria-label={`Work created per week over the last ${data.length} weeks, ${total} items in total.`}
      >
        {data.map((d, i) => {
          const now = i === data.length - 1;
          return (
            <div key={d.week} className={s.pillCol}>
              {d.n === 0 ? (
                <div className={s.pillGhost} data-compact={compact || undefined} aria-hidden="true" />
              ) : (
                <div
                  className={s.pill}
                  data-now={now}
                  // Pixels, not per cent. A percentage height needs every
                  // ancestor to have a definite height, and the edit-mode
                  // wrapper broke that chain — the bars silently rendered
                  // at zero. A pixel height cannot be orphaned. The floor
                  // keeps one item visibly a pill, not a dot.
                  style={{ height: `${Math.max(compact ? 14 : 20, (d.n / max) * (compact ? 76 : 118))}px` }}
                  aria-hidden="true"
                />
              )}
              <span className={s.pillLabel} data-now={now} data-quiet={compact && !now ? "" : undefined}>
                {now ? "now" : label(d.week)}
              </span>
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
  const { t, lang } = useI18n();
  const locale = lang === "ar" ? "ar" : undefined;
  const todayIso = today();
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
                <span className={s.dateChipMon}>{d.toLocaleDateString(locale, { month: "short" })}</span>
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block text-[13.5px] text-ink leading-snug truncate">
                  {e.title || t("dash.week.lesson")}
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
/**
 * @param {boolean} [props.dense] Short rows instead of square cells.
 *
 * A square day is the right shape when the calendar has a tile to
 * itself: six rows of them at a third of the page come to well over
 * three hundred pixels. Pinned beside the day card it has that card's
 * height and no more, so the cells give up their squareness — the one
 * dimension a month grid does not actually need — rather than the month
 * giving up two of its weeks.
 */
export function MiniCalendar({ entries = [], onPick, dense = false }) {
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar" : undefined;
  // `new Date()` in a render body is impure: two renders can disagree, so
  // React Compiler will not preserve the memoization of anything derived
  // from it — and y/m below are this month grid's memo dependencies.
  // Captured once per mount, which is also what the widget means: the grid
  // should not shift under a teacher because a re-render happened to land
  // the other side of midnight.
  const [today] = useState(() => new Date());
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

  // One expression instead of three loops that grew an array in place.
  //
  // Date already rolls day numbers over month boundaries — day 0 is the last
  // day of the previous month, day `days + 1` the first of the next — so the
  // leading and trailing padding need no special cases: a single 1-based day
  // number walked from `1 - lead` produces the whole grid. Anything outside
  // 1..days belongs to a neighbouring month.
  //
  // The previous version grew an array in place across three loops, reading
  // its own length as the loop bound. That was not what blocked compilation
  // — the impure `new Date()` above was — but one expression is easier to
  // check than three loops, and this one is verified equivalent to the old
  // output for every month from 2020 to 2032.
  const cells = useMemo(() => {
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;   // Sunday-based → Monday-first
    const days = new Date(y, m + 1, 0).getDate();
    const total = Math.ceil((lead + days) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const dayNo = i - lead + 1;
      return { d: new Date(y, m, dayNo), outside: dayNo < 1 || dayNo > days };
    });
  }, [y, m]);

  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayIso = iso(today);

  return (
    <div>
      <div className={s.calGrid} data-dense={dense} aria-hidden="true">
        {dowNarrow(locale).map((d, i) => <div key={i} className={s.calHead}>{d}</div>)}
      </div>
      <div className={s.calGrid} data-dense={dense} role="grid" aria-label={new Date(y, m, 1).toLocaleDateString(locale, { month: "long", year: "numeric" })}>
        {cells.map(({ d, outside }, i) => {
          const key = iso(d);
          const n = byDate.get(key) || 0;
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={s.calDay}
              data-dense={dense}
              data-outside={outside}
              data-today={key === todayIso}
              data-has={n > 0}
              onClick={() => onPick?.(key)}
              aria-label={`${d.toLocaleDateString(locale, { day: "numeric", month: "long" })}${n ? `, ${n}` : ""}`}
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

/* ── the week strip: the calendar at its smallest ─────────────────── */

/**
 * The current week as one row, for a quarter-width tile.
 *
 * Not a shrunken month. Seven columns of a month grid in ~250px give
 * about 30px per cell across six rows — visible, unreadable, and the
 * dates stop being scannable, which is the only thing a calendar this
 * size is for. A single week keeps each day big enough to read and
 * answers the question a narrow tile is actually asked: what is on,
 * between now and the weekend.
 *
 * It also carries a count the month grid never shows, because at this
 * size a summary line is cheaper than making the reader tally dots.
 */
export function WeekStrip({ entries = [], onPick }) {
  const { t, lang } = useI18n();
  const locale = lang === "ar" ? "ar" : undefined;
  const today = new Date();
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayIso = iso(today);

  const byDate = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (!e?.date) continue;
      map.set(e.date, (map.get(e.date) || 0) + 1);
    }
    return map;
  }, [entries]);

  // Monday-first, like the month grid and like a teaching week.
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const total = days.reduce((n, d) => n + (byDate.get(iso(d)) || 0), 0);

  return (
    <div>
      <div className={s.strip} role="grid" aria-label="This week">
        {days.map((d, i) => {
          const key = iso(d);
          const n = byDate.get(key) || 0;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              className={s.stripCol}
              data-today={key === todayIso}
              data-has={n > 0}
              onClick={() => onPick?.(key)}
              aria-label={`${d.toLocaleDateString(locale, { day: "numeric", month: "long" })}${n ? `, ${n}` : ""}`}
            >
              <span className={s.stripDow} aria-hidden="true">{dowNarrow(locale)[i]}</span>
              <span className={s.stripNum}>{d.getDate()}</span>
              <span className={s.stripDot} data-on={n > 0} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className="text-[11.5px] text-muted mt-3 text-center">
        {total === 0
          ? t("dash.week.none")
          : total === 1 ? t("dash.week.count1") : t("dash.week.count", { n: String(total) })}
      </p>
    </div>
  );
}

/* ── library breakdown ────────────────────────────────────────────── */

/** Horizontal bars, sorted descending — the ranking is the point. */
export function TypeBreakdown({ data = [], onPick, compact = false }) {
  const t = useT();
  const rows = [...data].sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((a, r) => a + r.n, 0);

  if (!total) {
    return <p className="text-sm text-muted py-4">{t("dash.kinds.empty")}</p>;
  }

  return (
    <ul className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {rows.map((r) => (
        <li key={r.key}>
          <button type="button" onClick={() => onPick?.(r.key)} className="w-full text-start group cursor-pointer">
            <div className={`flex items-baseline justify-between gap-2 ${compact ? "mb-1" : "mb-1.5"}`}>
              <span className={`${compact ? "text-[12px]" : "text-[13px]"} text-ink group-hover:text-accent transition-colors truncate`}>{r.label}</span>
              <span className={`${compact ? "text-[12px]" : "text-[13px]"} tabular-nums text-ink-soft shrink-0`}>{r.n}</span>
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
  const t = useT();
  if (!tasks.length) {
    return (
      <div className="py-5 text-center">
        <p className="text-sm text-ink">{t("dash.tasks.empty1")}</p>
        <p className="text-xs text-muted mt-1">{t("dash.tasks.empty2")}</p>
      </div>
    );
  }
  // Two jobs wearing one coat. "Teach forces at 09:00" is a clock
  // saying be somewhere; "Finish this draft" is work waiting whenever
  // there's a gap. Flat, the only thing separating them was the colour
  // of a 6px dot, so the list read as seven equal chores and a teacher
  // had to parse every row to find the ones with a time on them.
  // buildTasks already labels each row with a `kind` — this just stops
  // throwing that away.
  const groups = [
    { id: "today", label: t("dash.tasks.group.today"), items: tasks.filter((x) => x.kind === "lesson") },
    { id: "open", label: t("dash.tasks.group.open"), items: tasks.filter((x) => x.kind !== "lesson") },
  ].filter((g) => g.items.length);

  const row = (item) => (
    <li key={item.id}>
      <button type="button" className={s.task} onClick={() => onOpen?.(item.section)}>
        <span className={s.taskPip} data-urgent={!!item.urgent} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] text-ink leading-snug">{item.title}</span>
          <span className="block text-[11.5px] text-muted mt-0.5">{item.meta}</span>
        </span>
      </button>
    </li>
  );

  // One kind on its own needs no heading — a lone group label is a
  // header for a list of one thing, which is just noise.
  if (groups.length < 2) {
    return <ul className="space-y-1">{tasks.map(row)}</ul>;
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.id}>
          <p className={`${s.taskGroup} mb-1.5`}>
            {g.label} <span className={s.taskGroupCount}>{g.items.length}</span>
          </p>
          <ul className="space-y-1">{g.items.map(row)}</ul>
        </div>
      ))}
    </div>
  );
}

/* ── the khatim watermark ─────────────────────────────────────────── */

/** The landing's eight-point star, for the loud card's corner. */
/* ── ask the studio, from the dashboard ───────────────────────────── */

/**
 * A composer on the dashboard, one screen before the studio.
 *
 * The dashboard is where a teacher lands, and until now the only way in
 * was a button that took her to an empty box on another page. Two steps,
 * and the first told her nothing about what the thing does. A box she
 * can type into says it in the only way that lands: by being typeable.
 *
 * It deliberately does NOT generate here. Generation belongs in the
 * studio — that is where the thread lives, where documents render, where
 * the skills picker is, and where she can carry the conversation on.
 * Half a studio inside a dashboard tile would be a worse studio and a
 * worse dashboard. This takes the sentence and hands it over.
 *
 * Drawn as its own tinted surface rather than another white card,
 * because it is the one tile that asks for something rather than
 * reporting something, and a page of identical cards gives a teacher no
 * clue which one is the door.
 */
const ASK_KINDS = [
  { kind: "lesson_plan",  k: "lesson",   Icon: FileText },
  { kind: "quiz",         k: "quiz",     Icon: GraduationCap },
  { kind: "homework",     k: "homework", Icon: ClipboardList },
  { kind: "presentation", k: "deck",     Icon: Layers },
  { kind: "activity",     k: "activity", Icon: Puzzle },
];

export function AskStudio({ onGo, onOpen, greeting, name, showGreeting = true }) {
  const t = useT();
  const [text, setText] = useState("");
  const [kind, setKind] = useState(null);
  const ready = text.trim().length > 0;

  const go = () => {
    if (!ready) return;
    onGo?.(text.trim(), kind);
  };

  return (
    /* Greeting, box and chips are ONE block, centred in whatever height
       the row happens to be. Pinned to the top and bottom instead, a
       tile as tall as the calendar beside it left a third of a card of
       nothing in the middle, which reads as unfinished rather than airy. */
    <div className="flex h-full flex-col justify-center">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={s.askEyebrow}>{t("dash.ask.eyebrow")}</p>
          {/* Two lines, the second carrying the weight — the greeting is
              the manners and the question is the invitation. When the
              hero is already greeting her by name (it does that on a day
              with nothing scheduled) the first line is dropped rather
              than said twice on one screen. */}
          {showGreeting && (
            <p className={s.askHello}>{greeting}{name ? `, ${name}` : ""}</p>
          )}
          <p className={s.askAsk}>{t("dash.ask.question")}</p>
        </div>
        <button type="button" onClick={() => onOpen?.()} className={s.askOpen} aria-label="Open AI Studio">
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Enter sends. A dashboard tile is not where anyone writes three
          paragraphs, and shift+enter still gives a second line — the same
          contract as the studio's own composer. */}
      <div className={s.askBox} data-ready={ready}>
        <Sparkles size={16} className={s.askBoxIcon} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); }
          }}
          rows={1}
          className={s.askInput}
          placeholder={t("dash.ask.placeholder")}
          aria-label="Describe what you want to make"
        />
        <button
          type="button"
          onClick={go}
          disabled={!ready}
          className={s.askSend}
          aria-label="Open this in AI Studio"
        >
          <ArrowUp size={15} />
        </button>
      </div>

      {/* One line that scrolls, rather than a block that wraps to three
          rows and pushes the composer up. The overflow is the design: it
          says there is more here without spending height saying so. */}
      <div className={s.askChips}>
        {ASK_KINDS.map(({ kind: kd, k, Icon }) => (
          <button
            key={kd}
            type="button"
            /* Tapping the chosen one again clears it — otherwise the only
               way back to "let the studio decide" is a page reload. */
            onClick={() => setKind((prev) => (prev === kd ? null : kd))}
            className={s.askChip}
            data-on={kind === kd}
          >
            <Icon size={13} className="flex-shrink-0" />
            {t(`dash.kind.${k}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

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
export function LineTrend({ data = [], compact = false }) {
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar" : undefined;
  if (compact) data = data.slice(-5);
  const total = data.reduce((a, d) => a + d.n, 0);
  if (!total) {
    return (
      <p className="text-sm text-muted py-8 text-center">
        Nothing made yet — this fills in as you work.
      </p>
    );
  }

  /**
   * Drawn the way a price chart is drawn.
   *
   * Three things carry that reading and none of them is decoration.
   * The line is MITRED, not rounded: rounded joins smooth a series into
   * a suggestion, and a week that doubled should look like a corner.
   * The fill fades to nothing rather than sitting as a block, so the
   * shape reads as the line's shadow rather than a second object. And
   * the last value gets a dashed rule carried across the whole width
   * and out past the final point — where the run stands now, and the
   * fact that it has not finished.
   *
   * The data therefore stops short of the right edge. That gap is the
   * point: it is the part of the week that has not happened yet.
   */
  const w = 320, h = compact ? 74 : 110, pad = 8;
  const RUN = 0.88;                          // where the drawn data ends
  const max = Math.max(1, ...data.map((d) => d.n));
  const span = (w - pad * 2) * RUN;
  const pts = data.map((d, i) => [
    pad + (i / Math.max(1, data.length - 1)) * span,
    h - pad - (d.n / max) * (h - pad * 2),
  ]);
  const [lastX, lastY] = pts[pts.length - 1];
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${lastX.toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  const latest = data[data.length - 1]?.n ?? 0;

  return (
    <>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none"
           role="img" aria-label={`Work created per week, ${total} items over ${data.length} weeks. Latest week ${latest}.`}>
        <defs>
          <linearGradient id="ltFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--p-accent)" stopOpacity="0.30" />
            <stop offset="70%" stopColor="var(--p-accent)" stopOpacity="0.07" />
            <stop offset="100%" stopColor="var(--p-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Where it stands, held across the whole width so the last week
            can be read against every week before it. */}
        <line
          x1={pad} y1={lastY} x2={w - pad} y2={lastY}
          stroke="var(--p-accent)" strokeOpacity="0.45"
          strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke"
        />

        <path d={area} fill="url(#ltFill)" />
        {/* non-scaling-stroke because the viewBox is stretched to the
            tile's width: without it the line thickens as the card grows
            and the chart stops looking drawn and starts looking zoomed. */}
        <path d={line} fill="none" stroke="var(--p-accent)" strokeWidth="1.75"
              strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />

        {/* Sits on the rule it defines, with a ring of the card behind it
            so the dashes do not run through it. */}
        <circle cx={lastX} cy={lastY} r="4.5" fill="var(--p-surface)" />
        <circle cx={lastX} cy={lastY} r="3" fill="var(--p-accent)" />
      </svg>
      {/* The weeks, back under the line.
          The pills carried their own labels in the column beneath each
          bar; a path has no columns, so the dates are placed against the
          same x the points were drawn at — including the 88% run, so
          "now" lands under the dot and not under the dashed tail. */}
      <div className={s.trendAxis} aria-hidden="true">
        {data.map((d, i) => {
          const at = (pad + (i / Math.max(1, data.length - 1)) * span) / w * 100;
          const now = i === data.length - 1;
          if (compact && !now) return null;
          return (
            <span
              key={d.week}
              className={s.pillLabel}
              data-now={now}
              style={{ left: `${at}%` }}
            >
              {now ? "now" : weekLabel(d.week, locale)}
            </span>
          );
        })}
      </div>
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
export function KindDonut({ data = [], onPick, compact = false }) {
  const rows = [...data].filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  const total = rows.reduce((a, r) => a + r.n, 0);
  if (!total) {
    return <p className="text-sm text-muted py-4">Your library is empty. Anything you make lands here.</p>;
  }

  // A 132px ring beside a 130px legend needs 290px to sit on one line.
  // Under that the flex wraps and the ring dominates a tile it should
  // be summarising, so the compact drawing shrinks the ring instead.
  const size = compact ? 92 : 132, stroke = compact ? 12 : 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Each arc starts where the previous one ended, so the offsets need a
  // running total. It is accumulated in a plain loop rather than inside the
  // map callback: React Compiler rejects reassigning a variable captured by
  // a closure, because it cannot prove the writes stay inside this render.
  // A local loop that never escapes is fine, and the drawing is identical.
  const fracs = rows.map((row) => row.n / total);
  const offsets = [];
  let run = 0;
  for (const frac of fracs) {
    offsets.push(-run * c);
    run += frac;
  }
  const segs = rows.map((row, i) => ({
    ...row,
    tone: DONUT_TONES[i % DONUT_TONES.length],
    dash: fracs[i] * c,
    off: offsets[i],
  }));

  return (
    <div className={`flex items-center flex-wrap ${compact ? "gap-3" : "gap-5"}`}>
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
            <span className={`block font-serif ${compact ? "text-[19px]" : "text-[26px]"} text-ink`}>{total}</span>
            <span className="block text-[9px] font-mono uppercase tracking-widest text-muted mt-1">items</span>
          </span>
        </div>
      </div>
      <ul className={`space-y-1.5 flex-1 ${compact ? "min-w-[112px]" : "min-w-[130px]"}`}>
        {segs.map((sg) => (
          <li key={sg.key}>
            <button type="button" onClick={() => onPick?.(sg.key)}
                    className="flex items-center gap-2.5 w-full text-start group cursor-pointer">
              <span aria-hidden="true"
                    style={{ width: 9, height: 9, borderRadius: 3, background: sg.tone, flexShrink: 0 }} />
              <span className="text-[12.5px] text-ink group-hover:text-accent transition-colors flex-1 min-w-0 truncate">
                {sg.label}
              </span>
              <span className="text-[12.5px] tabular-nums text-ink-soft shrink-0">{sg.n}</span>
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
