"use client";

// =====================================================================
// The teacher's dashboard — a bento that edits itself in place
//
// Edit mode works the way a phone's quick-panel edit does: press Edit
// and the PAGE becomes the editor. Every tile carries its own hide
// control, a size control sits on its bottom edge, hidden tiles wait in
// a tray to be added back, and the grid reflows live around every
// change. Done pins it; Reset puts the defaults back. No second page,
// no checkbox list divorced from the thing it controls.
//
// The layout is one flowing 12-column grid rather than hand-built rows,
// because resizing only means anything if the neighbours rearrange
// themselves around the new size.
//
// Every number on this page is real.
// =====================================================================
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, Sparkles, CalendarDays, FileText, HelpCircle, Users,
  SlidersHorizontal, Plus, RotateCcw, X, GripVertical,
} from "lucide-react";
import { api } from "@/views/_shared";
import {
  MiniCalendar, PillBars, LineTrend, Ring, WeekSchedule,
  TypeBreakdown, KindDonut, TaskList, KhatimMark,
} from "./widgets";
import { WIDGETS, CHART_MODELS, loadPrefs, savePrefs, defaultPrefs } from "./prefs";
import s from "./Dashboard.module.css";

const fmtTime = (t) => (t ? t.slice(0, 5) : "—");
const hm = (t) => { if (!t) return null; const [h, m] = t.split(":"); return Number(h) * 60 + Number(m); };

const QUICK = [
  { icon: Sparkles,   title: "Open AI Studio", hint: "Describe it; edit what comes back", section: "studio" },
  { icon: FileText,   title: "Draft a lesson", hint: "Objectives, activity, assessment",  section: "lesson-plans" },
  { icon: HelpCircle, title: "Build a quiz",   hint: "MCQ, short answer, essay",          section: "quizzes" },
  { icon: Users,      title: "Add students",   hint: "Register, attendance, marks",       section: "database" },
];

// Tailwind needs the class names written out — a template string span
// would be purged from the build.
const SPAN = { 4: "lg:col-span-4", 6: "lg:col-span-6", 12: "lg:col-span-12" };
const SIZE_LABEL = { 4: "S", 6: "M", 12: "L" };

function nowLesson(lessons) {
  if (!lessons?.length) return { mode: "clear" };
  const now = new Date();
  const m = now.getHours() * 60 + now.getMinutes();
  let next = null, delta = Infinity;
  for (const l of lessons) {
    const a = hm(l.start_time);
    if (a == null) continue;
    const b = hm(l.end_time) ?? a + 55;
    if (m >= a && m < b) return { mode: "live", lesson: l, left: b - m };
    if (a > m && a - m < delta) { next = l; delta = a - m; }
  }
  return next ? { mode: "next", lesson: next, until: delta } : { mode: "clear" };
}

function Head({ eyebrow, title, action, onAction }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        {eyebrow && <p className={`${s.eyebrow} mb-1`}>{eyebrow}</p>}
        <h2 className={s.title}>{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="text-[12px] text-muted hover:text-accent transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap mt-0.5"
        >
          {action} <ArrowRight size={12} className="rtl:rotate-180" />
        </button>
      )}
    </div>
  );
}

const Bar = ({ w = "w-24", h = "h-4" }) => (
  <div className={`animate-pulse rounded bg-line/50 ${w} ${h}`} aria-hidden="true" />
);

/**
 * The editing chrome around one tile: dashed outline, a hide control on
 * the top corner, size and chart-model controls docked on the bottom
 * edge. The tile's own content goes inert underneath, so hiding a stat
 * card cannot also navigate to My students.
 */
function EditFrame({ widget, prefs, onChange, drag, children }) {
  const meta = WIDGETS.find((w) => w.key === widget);
  const hide = () =>
    onChange({ ...prefs, visible: prefs.visible.filter((k) => k !== widget) });
  const resize = (span) =>
    onChange({ ...prefs, sizes: { ...prefs.sizes, [widget]: span } });
  const model = (id) =>
    onChange({ ...prefs, charts: { ...prefs.charts, [widget]: id } });

  return (
    <div className={s.editFrame} data-drag={drag?.active === widget}>
      {children}
      {drag && (
        <div className={s.tileControls} style={{ insetInlineEnd: "auto", insetInlineStart: -6 }}>
          <button
            type="button"
            className={s.dragBtn}
            aria-label={`Move ${meta.label}. Drag, or press the arrow keys.`}
            title="Drag to move — or use the arrow keys"
            onPointerDown={drag.start(widget)}
            onKeyDown={(e) => {
              // Arrows move one slot. Left/Up go earlier, Right/Down
              // later; RTL flips the horizontal pair so "towards the
              // start" is always towards the start.
              const rtl = document.documentElement.dir === "rtl";
              const back = e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft");
              const fwd = e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight");
              if (!back && !fwd) return;
              e.preventDefault();
              drag.nudge(widget, back ? -1 : 1);
            }}
          >
            <span><GripVertical size={15} strokeWidth={2.2} /></span>
          </button>
        </div>
      )}
      <div className={s.tileControls}>
        {!meta.locked && (
          <button type="button" className={s.tileBtn} onClick={hide} aria-label={`Hide ${meta.label}`}>
            <span><X size={15} strokeWidth={2.4} /></span>
          </button>
        )}
      </div>
      <div className={s.tileDock}>
        {CHART_MODELS[widget] ? (
          <span className={s.sizeSeg} role="radiogroup" aria-label={`${meta.label} chart style`}>
            {CHART_MODELS[widget].map((m) => (
              <button
                key={m.id} type="button" role="radio"
                aria-checked={prefs.charts[widget] === m.id}
                data-on={prefs.charts[widget] === m.id}
                className={s.sizeBtn}
                onClick={() => model(m.id)}
              >
                {m.label}
              </button>
            ))}
          </span>
        ) : <span />}
        {meta.sizes && (
          <span className={s.sizeSeg} role="radiogroup" aria-label={`${meta.label} size`}>
            {meta.sizes.map((sp) => (
              <button
                key={sp} type="button" role="radio"
                aria-checked={prefs.sizes[widget] === sp}
                data-on={prefs.sizes[widget] === sp}
                className={s.sizeBtn}
                onClick={() => resize(sp)}
                aria-label={`${meta.label} size ${SIZE_LABEL[sp]}`}
              >
                {SIZE_LABEL[sp]}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DashboardView({ onJump }) {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  // Defaults first, real prefs after mount — localStorage does not exist
  // during server rendering, and a hydration mismatch is worse than one
  // frame of the default layout.
  const [prefs, setPrefs] = useState(defaultPrefs);

  useEffect(() => { setPrefs(loadPrefs()); }, []);

  const changePrefs = (next) => { setPrefs(next); savePrefs(next); };
  const show = (key) => prefs.visible.includes(key);
  const hidden = WIDGETS.filter((w) => !w.locked && !show(w.key));

  // ── reordering ──────────────────────────────────────────────────────
  // The order is edited as the VISIBLE sequence; hidden widgets trail at
  // the end. Editing the full list instead would make an arrow press
  // sometimes swap with an invisible neighbour — a move that looks like
  // nothing happened.
  const visibleOrder = prefs.order.filter((k) => show(k));
  const commitOrder = (vis) =>
    changePrefs({ ...prefs, order: [...vis, ...prefs.order.filter((k) => !vis.includes(k))] });

  const nudge = (key, dir) => {
    const v = [...visibleOrder];
    const i = v.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= v.length) return;
    [v[i], v[j]] = [v[j], v[i]];
    commitOrder(v);
  };

  /**
   * Take the slot the pointer is over — on the far side of it.
   *
   * Direction matters. Inserting before the target regardless made
   * every downward drag bounce: moving calendar toward the end crossed
   * rhythm first, was inserted BEFORE rhythm, and ended up one slot
   * earlier instead of later. Dragging down puts you after what you
   * cross; dragging up puts you before it — which is how physical
   * reordering feels everywhere else.
   */
  const placeAt = (key, targetKey) => {
    if (key === targetKey) return;
    const iFrom = visibleOrder.indexOf(key);
    const iTo = visibleOrder.indexOf(targetKey);
    if (iFrom < 0 || iTo < 0) return;
    const v = visibleOrder.filter((k) => k !== key);
    const j = v.indexOf(targetKey);
    v.splice(iFrom < iTo ? j + 1 : j, 0, key);
    commitOrder(v);
  };

  const [dragKey, setDragKey] = useState(null);
  // Refs, because the drag listeners live on WINDOW for the whole edit
  // session — pointer capture on the grip died silently after the first
  // re-render, and window listeners reading refs cannot go stale.
  const dragKeyRef = useRef(null);
  const placeAtRef = useRef(placeAt);
  placeAtRef.current = placeAt;
  const lastPointRef = useRef({ x: 0, y: 0 });

  // The floating clone: what actually follows the cursor. Its position
  // is written straight to the DOM on each move — routing 60 moves a
  // second through setState would re-render the whole dashboard per
  // frame, which is its own kind of shiver.
  const cloneRef = useRef(null);
  const dragRect = useRef(null);       // size of the grabbed tile
  const grabOffset = useRef({ x: 0, y: 0 });

  const placeClone = () => {
    const el = cloneRef.current;
    if (!el) return;
    const { x, y } = lastPointRef.current;
    el.style.transform =
      `translate3d(${x - grabOffset.current.x}px, ${y - grabOffset.current.y}px, 0)`;
  };
  useLayoutEffect(placeClone, [dragKey]);

  // Swap hysteresis. Reordering two tiles of different sizes can drop
  // the pointer back onto the tile it just displaced, which swaps back,
  // which drops it again — the oscillation that read as shivering. Two
  // rules kill it: a short cooldown after any reorder, and a longer
  // block on re-swapping the SAME pair.
  const swapGuard = useRef({ t: 0, pair: "" });

  // FLIP: displaced tiles slide to their new slot instead of
  // teleporting. Measure where every tile was, and after the reorder
  // render, play each one from its old position to its new one.
  const tileNodes = useRef(new Map());
  const prevRects = useRef(new Map());
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useLayoutEffect(() => {
    if (!editing) { prevRects.current.clear(); return; }
    const pane = document.querySelector(".murchid-content-pane");
    const scroll = pane ? pane.scrollTop : 0;
    const next = new Map();
    for (const [key, el] of tileNodes.current) {
      if (!el || !el.isConnected) continue;
      // Clear any in-flight animation before measuring, or a reorder
      // during a slide measures the transformed position and compounds.
      el.style.transition = "";
      el.style.transform = "";
      const r = el.getBoundingClientRect();
      // Scroll-corrected: the pane auto-scrolls during a drag, and raw
      // viewport rects would read that as every tile having moved.
      next.set(key, { left: r.left, top: r.top + scroll });
      const prev = prevRects.current.get(key);
      if (prev && !reduced.current && key !== dragKeyRef.current) {
        const dx = prev.left - r.left;
        const dy = prev.top - (r.top + scroll);
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          void el.offsetWidth;               // commit the start position
          el.style.transition = "transform 240ms cubic-bezier(0.2, 0, 0, 1)";
          el.style.transform = "";
          el.addEventListener("transitionend", function done() {
            el.style.transition = "";
            el.removeEventListener("transitionend", done);
          });
        }
      }
    }
    prevRects.current = next;
  });

  useEffect(() => {
    if (!editing) return undefined;

    const hitTest = (x, y) => {
      const key = dragKeyRef.current;
      if (!key) return;
      const now = performance.now();
      // Swap hysteresis: a short cooldown after any reorder, and a
      // longer block on the SAME pair swapping straight back — the
      // different-size oscillation that read as shivering.
      if (now - swapGuard.current.t < 140) return;
      const el = document.elementFromPoint(x, y);
      const target = el?.closest?.("[data-widget-key]")?.getAttribute("data-widget-key");
      if (!target || target === key) return;
      const pair = [key, target].sort().join("|");
      if (pair === swapGuard.current.pair && now - swapGuard.current.t < 420) return;
      placeAtRef.current(key, target);
      swapGuard.current = { t: now, pair };
    };

    const move = (e) => {
      lastPointRef.current = { x: e.clientX, y: e.clientY };
      placeClone();
      hitTest(e.clientX, e.clientY);
    };
    const up = () => {
      if (!dragKeyRef.current) return;
      dragKeyRef.current = null;
      dragRect.current = null;
      setDragKey(null);
    };

    // Edge auto-scroll: the dashboard is taller than the window, and a
    // drag towards a tile below the fold otherwise sails off the
    // viewport into nothing. Holding near either edge scrolls the pane
    // while hit-testing continues, so a stationary pointer carries the
    // tile a long way — exactly how a phone's edit mode does it.
    const pane = document.querySelector(".murchid-content-pane");
    let raf = 0;
    const tick = () => {
      const key = dragKeyRef.current;
      if (key && pane) {
        const r = pane.getBoundingClientRect();
        const { x, y } = lastPointRef.current;
        const ZONE = 96, SPEED = 16;
        let dy = 0;
        if (y > r.bottom - ZONE) dy = Math.min(SPEED, ((y - (r.bottom - ZONE)) / ZONE) * SPEED);
        else if (y < r.top + ZONE) dy = -Math.min(SPEED, (((r.top + ZONE) - y) / ZONE) * SPEED);
        if (dy) {
          pane.scrollTop += dy;
          hitTest(x, y);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [editing]);

  const drag = {
    active: dragKey,
    start: (key) => (e) => {
      e.preventDefault();
      const node = tileNodes.current.get(key);
      const r = node?.getBoundingClientRect();
      if (r) {
        dragRect.current = { width: r.width, height: r.height };
        grabOffset.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      }
      lastPointRef.current = { x: e.clientX, y: e.clientY };
      dragKeyRef.current = key;
      setDragKey(key);
    },
    nudge,
  };

  useEffect(() => {
    let live = true;
    api("/api/me").then((r) => live && setMe(r)).catch(() => {});
    api("/api/dashboard")
      .then((r) => live && setData(r))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  const today = data?.today_lessons || [];
  const counts = data?.counts || {};
  const plan = data?.plan || null;
  const calendar = data?.calendar || [];
  const status = useMemo(() => nowLesson(today), [today]);
  const isNew = !loading && !error && (counts.total ?? 0) === 0 && today.length === 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  let headline, sub;
  if (status.mode === "live") {
    headline = <>Right now — <em className="italic">{status.lesson.title || "your class"}</em></>;
    sub = `${status.left} min left · ${status.lesson.section || status.lesson.grade || "your group"}`;
  } else if (status.mode === "next") {
    headline = <>Next up — <em className="italic">{status.lesson.title || "your next class"}</em></>;
    sub = status.until < 60
      ? `in ${status.until} min · ${fmtTime(status.lesson.start_time)}`
      : `at ${fmtTime(status.lesson.start_time)}`;
  } else {
    headline = <>{greeting}, <em className="italic">{me?.first_name || "there"}</em></>;
    sub = today.length ? "Nothing more on the schedule today." : "A clear day. Make something with it.";
  }

  const stats = [
    { label: "Students",  value: counts.students ?? 0, unit: "in your roster",  section: "database" },
    { label: "Library",   value: counts.total ?? 0,    unit: "things you made", section: "lesson-plans" },
    { label: "Scheduled", value: calendar.length,      unit: "next 14 days",    section: "schedule" },
  ];

  const kindsPick = (k) => onJump?.({
    lesson_plan: "lesson-plans", quiz: "quizzes", homework: "homework",
    presentation: "presentations", activity: "activities",
  }[k]);

  /** One tile's content, by key. The edit frame wraps whatever this returns. */
  const renderWidget = (key) => {
    switch (key) {
      case "stats":
        return (
          <div className={`grid gap-4 ${prefs.sizes.stats === 12 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3 lg:grid-cols-3"}`}>
            {stats.map((k) => (
              <button
                key={k.label} type="button" onClick={() => onJump?.(k.section)}
                className={`${s.glass} ${s.tap} p-5`}
              >
                <p className={s.eyebrow}>{k.label}</p>
                {loading ? <Bar w="w-16" h="h-10" /> : (
                  <p className={`${s.figure} text-ink mt-2`}>{k.value}</p>
                )}
                <p className="text-[12px] text-muted mt-1.5">{k.unit}</p>
              </button>
            ))}
          </div>
        );
      case "rhythm":
        return (
          <section className={`${s.glass} p-5 md:p-6 h-full flex flex-col`}>
            <Head eyebrow="Last eight weeks" title={<>Your <em>rhythm</em></>} />
            <div className="flex-1 min-h-[150px] flex flex-col justify-end">
              {loading ? <Bar w="w-full" h="h-28" />
                : prefs.charts.rhythm === "line"
                  ? <LineTrend data={data?.activity || []} />
                  : <PillBars data={data?.activity || []} />}
            </div>
          </section>
        );
      case "calendar":
        return (
          <section className={`${s.glass} p-5 h-full`}>
            <Head
              eyebrow={new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              title="Calendar" action="Schedule" onAction={() => onJump?.("schedule")}
            />
            {loading
              ? <div className="grid grid-cols-7 gap-1.5">{Array.from({ length: 28 }, (_, i) => <Bar key={i} w="w-full" h="h-8" />)}</div>
              : <MiniCalendar entries={calendar} onPick={() => onJump?.("schedule")} />}
          </section>
        );
      case "tasks":
        return (
          <section className={`${s.glass} p-5 h-full`}>
            <Head eyebrow="To do" title="Needs you" />
            {loading
              ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Bar key={i} w="w-full" h="h-11" />)}</div>
              : <TaskList tasks={data?.tasks || []} onOpen={(sec) => onJump?.(sec)} />}
          </section>
        );
      case "week":
        return (
          <section className={`${s.glass} p-5 h-full`}>
            <Head eyebrow="Coming up" title="This week" action="Plan" onAction={() => onJump?.("planner")} />
            {loading
              ? <div className="space-y-2">{[0, 1, 2].map((i) => <Bar key={i} w="w-full" h="h-12" />)}</div>
              : <WeekSchedule entries={calendar} onOpen={() => onJump?.("schedule")} />}
          </section>
        );
      case "kinds":
        return (
          <section className={`${s.glass} p-5 h-full`}>
            <Head eyebrow="Library" title="By kind" action="All" onAction={() => onJump?.("lesson-plans")} />
            {loading
              ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Bar key={i} w="w-full" h="h-7" />)}</div>
              : prefs.charts.kinds === "donut"
                ? <KindDonut data={data?.by_type || []} onPick={kindsPick} />
                : <TypeBreakdown data={data?.by_type || []} onPick={kindsPick} />}
          </section>
        );
      default:
        return null;
    }
  };

  const flowWidgets = visibleOrder
    .map((k) => WIDGETS.find((w) => w.key === k))
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {/* ── the edit bar, or the way in ─────────────────────────────── */}
      {editing ? (
        <div className={s.editBar}>
          <p className="font-serif text-[16px] font-semibold text-ink flex-1">
            Edit dashboard
            <span className="font-sans text-[12px] font-normal text-muted ms-3 hidden sm:inline">
              Drag the grip to move a tile; hide, resize, or switch a chart — it rearranges as you go.
            </span>
          </p>
          <button
            type="button"
            onClick={() => changePrefs(defaultPrefs())}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] text-ink-soft hover:bg-paper-warm hover:text-ink transition-colors cursor-pointer"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-accent text-on-accent text-[13px] font-medium hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className={s.eyebrow}>{dateLine}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-line bg-surface/70 text-[12.5px] text-ink-soft hover:border-accent hover:text-ink transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={13} /> Edit
          </button>
        </div>
      )}

      {/* ── the tray of hidden tiles ────────────────────────────────── */}
      {editing && hidden.length > 0 && (
        <div className={s.tray}>
          <p className={`${s.eyebrow} mb-2.5`}>Hidden — tap to add back</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((w) => (
              <button
                key={w.key}
                type="button"
                className={s.trayChip}
                onClick={() => changePrefs({ ...prefs, visible: [...prefs.visible, w.key] })}
              >
                <Plus size={14} className="text-accent" /> {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── row 1 · the loud card and its counterweight ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className={`${s.loud} p-6 md:p-8 ${show("runway") ? "lg:col-span-8" : "lg:col-span-12"} flex flex-col justify-between min-h-[220px]`}>
          <KhatimMark className={s.loudMark} />
          <div className="relative">
            {/* The date lives in the page header now; twice on one screen
                was once too many. The eyebrow names the card instead. */}
            <p className={s.loudEyebrow}>Today</p>
            <h1 className="font-serif text-[30px] md:text-[40px] leading-[1.05] font-medium mt-2.5 max-w-xl">
              {headline}
            </h1>
            <p className={`${s.loudSub} text-sm mt-2`}>{sub}</p>
          </div>
          <div className="relative flex flex-wrap gap-2.5 mt-6">
            <button type="button" className={s.btnOnLoud} onClick={() => onJump?.("studio")}>
              <Sparkles size={15} /> Open AI Studio
            </button>
            <button type="button" className={s.btnGhostOnLoud} onClick={() => onJump?.("planner")}>
              <CalendarDays size={15} /> Plan the week
            </button>
          </div>
        </section>

        {show("runway") && (
          (() => {
            const runwayCard = (
              <section className={`${s.ink} p-6 h-full flex flex-col justify-between min-h-[220px]`}>
                {plan ? (
                  <>
                    <p className={s.inkEyebrow}>
                      {plan.status === "trialing" ? "Free trial" : `${plan.plan} plan`}
                    </p>
                    <div className="flex items-end justify-between gap-4 mt-3">
                      <div>
                        <p className={s.figure}>{plan.days_left ?? "∞"}</p>
                        <p className={`${s.inkMuted} text-[12.5px] mt-1.5`}>
                          {plan.days_left === 1 ? "day left" : "days left"}
                          {plan.status === "trialing" ? " — then choose a plan" : ""}
                        </p>
                      </div>
                      {plan.credits != null && (
                        <Ring value={plan.credits} max={plan.allowance || 1} size={92}>
                          <span className="text-center leading-none">
                            <span className="block font-serif text-[19px]">{plan.credits}</span>
                            <span className={`${s.inkMuted} block text-[8.5px] font-mono uppercase tracking-widest mt-1`}>
                              credits
                            </span>
                          </span>
                        </Ring>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onJump?.("account")}
                      className="mt-5 self-start text-[12.5px] underline underline-offset-4 decoration-1 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      Manage plan
                    </button>
                  </>
                ) : (
                  <>
                    <p className={s.inkEyebrow}>Your library</p>
                    <p className={`${s.figure} mt-3`}>{counts.total ?? 0}</p>
                    <p className={`${s.inkMuted} text-[12.5px] mt-1.5`}>things made so far</p>
                  </>
                )}
              </section>
            );
            return (
              <div className="lg:col-span-4">
                {editing
                  ? <EditFrame widget="runway" prefs={prefs} onChange={changePrefs}>{runwayCard}</EditFrame>
                  : runwayCard}
              </div>
            );
          })()
        )}
      </div>

      {plan && plan.days_left != null && plan.days_left <= 3 && !editing && (
        <div className={`${s.glass} px-4 py-3 flex items-center gap-3 flex-wrap`}>
          <p className="text-sm text-ink flex-1 min-w-[220px]">
            {plan.days_left === 0
              ? <>Your {plan.status === "trialing" ? "trial" : "plan"} has ended. Everything you have made stays readable.</>
              : <>Your {plan.status === "trialing" ? "trial" : "plan"} ends in <b>{plan.days_left} {plan.days_left === 1 ? "day" : "days"}</b>.</>}
          </p>
          <button
            type="button"
            onClick={() => onJump?.("account")}
            className="h-9 px-4 rounded-full bg-accent text-on-accent text-[13px] font-medium hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Choose a plan
          </button>
        </div>
      )}

      {error && (
        <div className={`${s.glass} p-4`}>
          <p className={s.eyebrow}>Could not load the dashboard</p>
          <p className="text-sm text-ink-soft mt-1">{error}</p>
        </div>
      )}

      {isNew && !editing && (
        <section className={`${s.glassRaised} p-5 md:p-6`}>
          <p className={s.eyebrow}>First steps</p>
          <h2 className="font-serif text-2xl md:text-[28px] font-medium text-ink leading-tight mt-1.5">
            Nothing here yet — <em className="italic text-accent">that is the right place to start.</em>
          </h2>
          <p className="text-sm text-ink-soft mt-2 max-w-xl">
            Draft one lesson and the rest of this page fills itself in.
          </p>
          <div className="grid sm:grid-cols-2 gap-2.5 mt-4">
            {QUICK.map((a) => (
              <button
                key={a.section}
                type="button"
                onClick={() => onJump?.(a.section)}
                className={`${s.glass} ${s.tap} px-4 py-3 flex items-center gap-3`}
              >
                <a.icon size={17} className="text-accent flex-shrink-0" />
                <span className="min-w-0 text-start">
                  <span className="block text-sm text-ink">{a.title}</span>
                  <span className="block text-xs text-muted mt-0.5">{a.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* The clone that rides the cursor. Inert, so the pointer drags
          through it to hit-test the real tiles underneath. */}
      {dragKey && dragRect.current && createPortal(
        <div
          ref={cloneRef}
          className={s.dragClone}
          style={{ width: dragRect.current.width, height: dragRect.current.height }}
          aria-hidden="true"
        >
          {renderWidget(dragKey)}
        </div>,
        document.body
      )}

      {/* ── the flow grid: everything else, at the teacher's sizes ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {flowWidgets.map((w) => {
          const span = w.sizes ? prefs.sizes[w.key] ?? w.size : 12;
          const tile = renderWidget(w.key);
          return (
            <div
              key={w.key}
              className={SPAN[span] || "lg:col-span-12"}
              data-widget-key={w.key}
              ref={(el) => { if (el) tileNodes.current.set(w.key, el); else tileNodes.current.delete(w.key); }}
            >
              {editing
                ? <EditFrame widget={w.key} prefs={prefs} onChange={changePrefs} drag={drag}>{tile}</EditFrame>
                : tile}
            </div>
          );
        })}
      </div>
    </div>
  );
}
