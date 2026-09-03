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
import { useI18n, useT } from "@/shared/i18n";
import {
  MiniCalendar, WeekStrip, PillBars, LineTrend, Ring, WeekSchedule, AskStudio,
  TypeBreakdown, KindDonut, TaskList, KhatimMark,
} from "./widgets";
import { WIDGETS, CHART_MODELS, loadPrefs, savePrefs, defaultPrefs } from "./prefs";
import { PREFILL_KEY } from "@/shared/lib/assistantPrefill";
import s from "./Dashboard.module.css";

const fmtTime = (t) => (t ? t.slice(0, 5) : "—");
const hm = (t) => { if (!t) return null; const [h, m] = t.split(":"); return Number(h) * 60 + Number(m); };

// Titles and hints live in the dictionary (dash.quick.*) — this holds
// only the icon and the destination.
const QUICK = [
  { icon: Sparkles,   k: "studio",   section: "studio" },
  { icon: FileText,   k: "lesson",   section: "lesson-plans" },
  { icon: HelpCircle, k: "quiz",     section: "quizzes" },
  { icon: Users,      k: "students", section: "database" },
];

// Tailwind needs the class names written out — a template string span
// would be purged from the build.
// A quarter- or third-width tile only exists once the page is wide
// enough to divide into one. The studio rail eats a quarter of a 1024px
// screen, where lg:col-span-3 measured 161px — narrower than the header
// controls inside it, which spilled 20px out of the card. Both narrow
// rungs therefore fall back to half a row below xl.
/**
 * The calendar's small rung is a different tile, not a smaller one.
 *
 * At SMALL it is pinned beside the day card, filling the third that card
 * leaves and drawn dense to fit its height. At medium and large it goes
 * back into the flow with its own square cells, where it can be dragged
 * and reordered — and the day card takes the whole row back, because a
 * card with a third of empty space beside it is worse than a wide one.
 */
const CAL_PINNED_SPAN = 4;

const SPAN = {
  3: "lg:col-span-6 xl:col-span-3",
  4: "lg:col-span-6 xl:col-span-4",
  5: "lg:col-span-6 xl:col-span-5",
  6: "lg:col-span-6",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
};
// Below this the month grid gives seven columns of under 30px: a grid
// you can see but not read. Measured on the tile, so it is the same
// judgement at every viewport and every span.
const CALENDAR_MONTH_MIN = 270;
// Below this a chart stops being drawn small and starts being drawn
// differently — fewer weeks, shorter bars, one label. Set so the S rung
// of the chart ladder actually reaches it: a span of 3 measures ~305px
// on a 1600 screen and ~224px on a 1280 one, and eight columns of 30px
// put the 8.5px date labels into each other.
const CHART_COMPACT_MAX = 340;

// Labelled by POSITION in a widget's own ladder, not by column count.
// A shared span→label map broke as soon as one widget had a different
// ladder: the calendar's 6 is its largest while the rhythm's 6 is its
// middle, and one map cannot call the same number both L and M.
const SIZE_LABELS = ["S", "M", "L"];

function nowLesson(lessons, now) {
  // No clock yet means the server pass: say nothing about "right now"
  // rather than saying the server's version of it.
  if (!now || !lessons?.length) return { mode: "clear" };
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

function Head({ eyebrow, title, action, onAction, meta }) {
  return (
    // Wraps rather than spills: a header action pushed past the card
    // edge is the one break a narrow tile produces reliably, and it
    // reads as the card being torn rather than the label being long.
    <div className="flex items-start justify-between gap-x-3 gap-y-1 mb-4 flex-wrap">
      <div className="min-w-0">
        {eyebrow && <p className={`${s.eyebrow} mb-1`}>{eyebrow}</p>}
        <h2 className={s.title}>{title}</h2>
      </div>
      {/* A chart's own value, sitting where a header action would. A
          drawing without a number is a shape: the reader can see that a
          week rose without being told what it rose to. Charts pass this;
          tiles that already ARE their number do not. */}
      {meta && <div className="shrink-0 text-right">{meta}</div>}
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

/**
 * One tile in the flow grid, measuring itself.
 *
 * Which drawing a widget uses is a question about PIXELS, not about
 * grid columns: a span of 4 is 384px on a 1440 screen and 220px on a
 * 1024 one, and only one of those fits a month grid. So the tile
 * reports its own width and the widget chooses from that. This also
 * decides `self-start` — a tile that fell back to its compact drawing
 * is short, and stretching it to a tall neighbour leaves dead space
 * that reads as something failing to load.
 */
function FlowTile({ widget, span, className, editing, prefs, onChange, drag, render, onNode }) {
  const el = useRef(null);
  const [width, setWidth] = useState(null);

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const tile = render(widget.key, width);
  // A tile showing its compact drawing is SHORT — a week strip is ~120px
  // and five stubby bars are less. Stretched to a tall neighbour like
  // "Needs you", the remaining 300px of card is dead space that reads as
  // something failing to load, so these opt out of the row's height.
  // The calendar is always its own height: a month is however many rows
  // it is, and stretching it to match a seven-item task list pads the
  // card with 300px of nothing. The charts only opt out when compact,
  // because at full size their bars are meant to sit on the row's
  // shared baseline.
  const short =
    widget.key === "calendar" ||
    (width != null &&
      (widget.key === "rhythm" || widget.key === "kinds") &&
      width < CHART_COMPACT_MAX);

  /**
   * The chart carries two rows on its own.
   *
   * The counts card takes only the height three numbers need, which
   * left a band of nothing beneath it — and the card below could not
   * reach up into it, because a grid row is a row. Spanning the chart
   * across both rows instead puts the counts and the composer in one
   * column, stacked, with no seam between them: the short card is
   * followed immediately by the tall one rather than by a gap.
   *
   * The composer takes two rows for the opposite reason: it is not
   * reporting anything, so it has nothing that runs out. Given one row
   * it ended level with the counts and left a band of nothing beside
   * the to-do; given both, the two columns finish together and the one
   * card asking the teacher to do something is the largest on the page.
   *
   * Only at full width: at a third or a quarter these are ordinary
   * tiles and the row they are in is the row they belong in.
   */
  const tall = ["rhythm", "ask"].includes(widget.key) && span === 6 && !short;

  return (
    <div
      className={`${className} ${short ? "self-start" : ""} ${tall ? "lg:row-span-2" : ""}`}
      data-widget-key={widget.key}
      ref={(node) => {
        el.current = node;
        onNode(widget.key, node);
      }}
    >
      {editing
        ? <EditFrame widget={widget.key} prefs={prefs} onChange={onChange} drag={drag}>{tile}</EditFrame>
        : tile}
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
  const t = useT();
  const meta = WIDGETS.find((w) => w.key === widget);
  const name = t(`dash.wid.${widget}`);
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
            aria-label={`Move ${name}. Drag, or press the arrow keys.`}
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
          <button type="button" className={s.tileBtn} onClick={hide} aria-label={`Hide ${name}`}>
            <span><X size={15} strokeWidth={2.4} /></span>
          </button>
        )}
      </div>
      <div className={s.tileDock}>
        {CHART_MODELS[widget] ? (
          <span className={s.sizeSeg} role="radiogroup" aria-label={`${name} chart style`}>
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
          <span className={s.sizeSeg} role="radiogroup" aria-label={`${name} size`}>
            {meta.sizes.map((sp, i) => (
              <button
                key={sp} type="button" role="radio"
                aria-checked={prefs.sizes[widget] === sp}
                data-on={prefs.sizes[widget] === sp}
                className={s.sizeBtn}
                onClick={() => resize(sp)}
                aria-label={`${name} size ${SIZE_LABELS[i]}`}
              >
                {SIZE_LABELS[i]}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DashboardView({ onJump }) {
  // The audit counted two translation calls in ~1,090 lines — an Arabic
  // teacher signed in to an English page. Everything visible now goes
  // through the dictionary, and dates format in the UI language.
  const { t, lang } = useI18n();
  const locale = lang === "ar" ? "ar" : undefined;
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

  // Live credit ring: an AI generation spends credits on the backend and
  // announces the new balance (see lib/data/credits). Update the ring in
  // place rather than re-fetching the whole dashboard on every generation.
  useEffect(() => {
    let off = () => {};
    import("@/lib/data/credits").then(({ onCreditsChange }) => {
      off = onCreditsChange((balance) => {
        setData((d) => (d?.plan ? { ...d, plan: { ...d.plan, credits: balance } } : d));
      });
    });
    return () => off();
  }, []);

  const today = data?.today_lessons || [];
  const counts = data?.counts || {};
  const plan = data?.plan || null;
  /** Are plans on sale? See planSummary() in src/lib/data/entities.ts. */
  const planOn = plan?.billing_enabled !== false;
  const calendar = data?.calendar || [];
  // The clock is the client's, and only the client's. Rendered during
  // SSR these two lines take the SERVER's hour and timezone, which is a
  // different afternoon from the teacher's — React then reports a
  // hydration mismatch and throws away the tree it just built. `now` is
  // null until mount, so the first paint commits to no time at all
  // rather than to the wrong one.
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    // Cross midday, midnight or a lesson boundary with the tab open and
    // the greeting should follow rather than stay stuck on "morning".
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const status = useMemo(() => nowLesson(today, now), [today, now]);
  const isNew = !loading && !error && (counts.total ?? 0) === 0 && today.length === 0;

  const hour = now?.getHours() ?? null;
  const greeting =
    hour == null
      ? t("dash.greet.hello")
      : hour < 12
        ? t("dash.greet.morning")
        : hour < 17
          ? t("dash.greet.afternoon")
          : t("dash.greet.evening");
  const dateLine = now
    ? now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })
    : "";

  let headline, sub;
  if (status.mode === "live") {
    headline = <>{t("dash.hero.rightNow")}<em className="italic">{status.lesson.title || t("dash.hero.yourClass")}</em></>;
    sub = `${t("dash.hero.minLeft", { n: String(status.left) })} · ${status.lesson.section || status.lesson.grade || t("dash.hero.yourGroup")}`;
  } else if (status.mode === "next") {
    headline = <>{t("dash.hero.nextUp")}<em className="italic">{status.lesson.title || t("dash.hero.yourNextClass")}</em></>;
    sub = status.until < 60
      ? t("dash.hero.inMin", { n: String(status.until), time: fmtTime(status.lesson.start_time) })
      : t("dash.hero.at", { time: fmtTime(status.lesson.start_time) });
  } else {
    headline = <>{greeting}, <em className="italic">{me?.first_name || t("dash.hero.there")}</em></>;
    sub = today.length ? t("dash.hero.nothingMore") : t("dash.hero.clearDay");
  }

  const calPinned = show("calendar") && (prefs.sizes.calendar ?? CAL_PINNED_SPAN) === CAL_PINNED_SPAN;

  const stats = [
    { label: t("dash.stat.students"),  value: counts.students ?? 0, unit: t("dash.stat.studentsUnit"),  section: "database" },
    { label: t("dash.stat.library"),   value: counts.total ?? 0,    unit: t("dash.stat.libraryUnit"),   section: "lesson-plans" },
    { label: t("dash.stat.scheduled"), value: calendar.length,      unit: t("dash.stat.scheduledUnit"), section: "schedule" },
  ];

  /**
   * Carry the sentence to the studio and start it there.
   *
   * The same parking spot the assistant and the template library
   * already use — sessionStorage, one navigation long — so there is one
   * way into the studio's composer rather than three. `autostart` is
   * this caller's addition: the assistant hands over a SUGGESTION and
   * waits for the teacher to agree, but here she has written the words
   * herself and pressed send, so asking her to press it a second time on
   * the next screen would be asking her to confirm her own sentence.
   */
  const askStudio = (prompt, kind) => {
    try {
      sessionStorage.setItem(
        PREFILL_KEY,
        JSON.stringify({ action: "create_work", prompt, kind, autostart: true, at: Date.now() }),
      );
    } catch {
      /* private browsing: the studio opens empty, which is the old behaviour */
    }
    onJump?.("studio");
  };

  const kindsPick = (k) => onJump?.({
    lesson_plan: "lesson-plans", quiz: "quizzes", homework: "homework",
    presentation: "presentations", activity: "activities",
  }[k]);

  /** One tile's content, by key. The edit frame wraps whatever this returns. */
  const renderWidget = (key, width = null) => {
    // A null width is a tile that has not measured yet (first paint) or
    // the drag clone: assume roomy, so nothing flashes compact.
    const chartCompact = width != null && width < CHART_COMPACT_MAX;
    switch (key) {
      case "stats":
        return (
          /* Three counts of the same thing — how much of your work is in
             here — so they are three columns of one card rather than
             three cards. As separate tiles they claimed the weight of
             three ideas and read as a row of scoreboards; in one card
             the eye takes them in as a single line and the card above
             keeps its authority. */
          /* No h-full. Every other tile fills its row because a chart or a
             month grid genuinely wants the height; three numbers do not,
             and stretching them to match the chart beside it put ninety
             pixels of nothing above and below the only three words on
             the card. It takes the height it needs and the row carries
             on around it. */
          <section className={`${s.glass} grid grid-cols-1 sm:grid-cols-3 p-1.5`}>
            {stats.map((k) => (
              <button
                key={k.label} type="button" onClick={() => onJump?.(k.section)}
                /* Centred in its own third rather than ranged left across
                   the card: with no dividers between them, three
                   left-aligned columns read as one ragged list starting
                   in three places. Centred, each count sits over its own
                   share of the card and the three read as three. */
                className={`${s.statCell} ${s.tap} px-4 py-6 text-center`}
              >
                <p className={s.eyebrow}>{k.label}</p>
                {loading ? <Bar w="w-14" h="h-8" /> : (
                  <p className={`${s.statFigure} text-ink mt-1.5`}>{k.value}</p>
                )}
                <p className="text-[12px] text-muted mt-1">{k.unit}</p>
              </button>
            ))}
          </section>
        );
      case "rhythm": {
        // The window the drawing actually shows — compact keeps five
        // weeks, so the readout has to be counted over the same slice
        // or the number would describe a chart that isn't on screen.
        const act = data?.activity || [];
        const shown = chartCompact ? act.slice(-5) : act;
        const thisWeek = shown.length ? shown[shown.length - 1].n : 0;
        const spanTotal = shown.reduce((a, d) => a + d.n, 0);
        return (
          <section className={`${s.glass} p-5 md:p-6 h-full flex flex-col`}>
            <Head
              eyebrow={chartCompact ? t("dash.w.rhythm.eyebrow5") : t("dash.w.rhythm.eyebrow8")}
              title={<>{t("dash.w.rhythm.titlePlain")}<em>{t("dash.w.rhythm.titleEm")}</em></>}
              meta={!loading && spanTotal > 0 && (
                <>
                  <p className={`${s.statFigure} text-ink leading-none`}>{thisWeek}</p>
                  <p className="text-[12px] text-muted mt-1 whitespace-nowrap">
                    {t("dash.w.rhythm.thisWeek")}
                  </p>
                </>
              )}
            />
            <div className={`flex-1 flex flex-col justify-end ${chartCompact ? "min-h-[104px]" : "min-h-[150px]"}`}>
              {loading ? <Bar w="w-full" h={chartCompact ? "h-20" : "h-28"} />
                : prefs.charts.rhythm === "line"
                  ? <LineTrend data={act} compact={chartCompact} />
                  : <PillBars data={act} compact={chartCompact} />}
            </div>
            {!loading && spanTotal > 0 && (
              <p className="text-[12px] text-muted mt-3">
                {t("dash.w.rhythm.total").replace("{n}", String(spanTotal))
                  .replace("{w}", String(shown.length))}
              </p>
            )}
          </section>
        );
      }
      case "calendar": {
        // At its smallest the calendar shows the WEEK, not a shrunken
        // month. Seven columns in a quarter-width tile give ~30px cells,
        // which is a grid you can see but not read — and a calendar you
        // cannot read is decoration. The threshold is the tile's own
        // width, not its span: span 4 is 384px at 1440 and 220px at
        // 1024, and only the first can hold a month.
        const compact = width != null && width < CALENDAR_MONTH_MIN;
        return (
          <section className={`${s.glass} p-5 h-full`}>
            <Head
              eyebrow={compact
                ? t("dash.w.calendar.thisWeek")
                : new Date().toLocaleDateString(locale, { month: "long", year: "numeric" })}
              title={t("dash.w.calendar.title")} action={t("dash.w.calendar.action")} onAction={() => onJump?.("schedule")}
            />
            {loading
              ? <div className="grid grid-cols-7 gap-1.5">{Array.from({ length: compact ? 7 : 28 }, (_, i) => <Bar key={i} w="w-full" h="h-8" />)}</div>
              : compact
                ? <WeekStrip entries={calendar} onPick={() => onJump?.("schedule")} />
                : <MiniCalendar entries={calendar} onPick={() => onJump?.("schedule")} />}
          </section>
        );
      }
      case "ask":
        return (
          /* Its own tinted surface rather than .glass, and no <Head>: the
             widget carries its own greeting, which is the whole point of
             it — a card that speaks first. */
          /* Roomier padding than a reporting tile: this one is asking a
             question and then waiting, and a question set tight against
             its own edges reads as a label. */
          <section className={`${s.askCard} p-6 md:p-7 h-full min-h-[300px]`}>
            <AskStudio
              onGo={askStudio}
              onOpen={() => onJump?.("studio")}
              greeting={greeting}
              name={me?.first_name || ""}
              /* The hero greets by name on a day with nothing scheduled.
                 Two greetings on one screen is one too many, so this one
                 stands down and leads with the question instead. */
              showGreeting={status.mode === "live" || status.mode === "next"}
            />
          </section>
        );
      case "tasks":
        return (
          <section className={`${s.glass} p-5 h-full`}>
            <Head eyebrow={t("dash.w.tasks.eyebrow")} title={t("dash.w.tasks.title")} />
            {loading
              ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Bar key={i} w="w-full" h="h-11" />)}</div>
              : <TaskList tasks={data?.tasks || []} onOpen={(sec) => onJump?.(sec)} />}
          </section>
        );
      case "week":
        return (
          <section className={`${s.glass} p-5 h-full`}>
            <Head eyebrow={t("dash.w.week.eyebrow")} title={t("dash.w.week.title")} action={t("dash.w.week.action")} onAction={() => onJump?.("planner")} />
            {loading
              ? <div className="space-y-2">{[0, 1, 2].map((i) => <Bar key={i} w="w-full" h="h-12" />)}</div>
              : <WeekSchedule entries={calendar} onOpen={() => onJump?.("schedule")} />}
          </section>
        );
      case "kinds":
        return (
          <section className={`${s.glass} p-5 h-full`}>
            <Head eyebrow={t("dash.w.kinds.eyebrow")} title={t("dash.w.kinds.title")} action={t("dash.w.kinds.action")} onAction={() => onJump?.("lesson-plans")} />
            {loading
              ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Bar key={i} w="w-full" h="h-7" />)}</div>
              : prefs.charts.kinds === "donut"
                ? <KindDonut data={data?.by_type || []} onPick={kindsPick} compact={chartCompact} />
                : <TypeBreakdown data={data?.by_type || []} onPick={kindsPick} compact={chartCompact} />}
          </section>
        );
      default:
        return null;
    }
  };

  const flowWidgets = visibleOrder
    // Only while it is pinned. At medium and large it is an ordinary
    // tile again and belongs in the order like everything else.
    .filter((k) => !(k === "calendar" && calPinned))
    .map((k) => WIDGETS.find((w) => w.key === k))
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {/* ── the edit bar, or the way in ─────────────────────────────── */}
      {editing ? (
        <div className={s.editBar}>
          <p className="font-serif text-[16px] font-semibold text-ink flex-1">
            {t("dash.edit.title")}
            <span className="font-sans text-[12px] font-normal text-muted ms-3 hidden sm:inline">
              {t("dash.edit.hint")}
            </span>
          </p>
          <button
            type="button"
            onClick={() => changePrefs(defaultPrefs())}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] text-ink-soft hover:bg-paper-warm hover:text-ink transition-colors cursor-pointer"
          >
            <RotateCcw size={13} /> {t("dash.edit.reset")}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-accent text-on-accent text-[13px] font-medium hover:bg-accent-hover transition-colors cursor-pointer"
          >
            {t("dash.edit.done")}
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
            <SlidersHorizontal size={13} /> {t("dash.edit.button")}
          </button>
        </div>
      )}

      {/* ── the tray of hidden tiles ────────────────────────────────── */}
      {editing && hidden.length > 0 && (
        <div className={s.tray}>
          <p className={`${s.eyebrow} mb-2.5`}>{t("dash.edit.tray")}</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((w) => (
              <button
                key={w.key}
                type="button"
                className={s.trayChip}
                onClick={() => changePrefs({ ...prefs, visible: [...prefs.visible, w.key] })}
              >
                <Plus size={14} className="text-accent" /> {t(`dash.wid.${w.key}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── row 1 · one card, two halves ────────────────────────────
          What's happening now and what it costs were two cards sitting
          side by side saying two halves of the same sentence: here is
          your day, here is what you have left to spend on it. Merged,
          the answer is one object — the teal of the studio bleeding into
          the ink of the ledger, so the eye crosses from the lesson to
          the balance without crossing a border.

          The seam is a hairline, not a gap. Two ideas, one card: enough
          to keep them legible as two, not enough to make them separate
          things again.

          With the credits hidden the hero takes the row back on its own,
          as it always did — a lone card at a third of the page is a
          header, not a hero. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {show("runway") ? (
          <section className={`${s.duo} ${calPinned ? "lg:col-span-8" : "lg:col-span-12"} min-h-[220px] flex flex-col md:flex-row`}>
            <div className="relative flex-1 p-6 md:p-7 flex flex-col justify-center min-w-0">
              {/* No watermark here. On the old wide teal card it sat off
                  to the right as a quiet flourish; halved and merged, it
                  landed dead centre across the crossover and read as a
                  logo stamped on the seam. The gradient is the flourish
                  now. It stays on the full-width card below, where it
                  still has the room it was drawn for. */}
              <div className="relative">
              {/* The date lives in the page header now; twice on one screen
              was once too many. The eyebrow names the card instead. */}
              <p className={s.loudEyebrow}>{t("dash.today")}</p>
              <h1 className="font-serif text-[30px] md:text-[40px] leading-[1.05] font-medium mt-2.5 max-w-xl">
              {headline}
              </h1>
              <p className={`${s.loudSub} text-sm mt-2`}>{sub}</p>
              </div>
              <div className="relative flex flex-wrap gap-2.5 mt-6">
              <button type="button" className={s.btnOnLoud} onClick={() => onJump?.("studio")}>
              <Sparkles size={15} /> {t("dash.openStudio")}
              </button>
              <button type="button" className={s.btnGhostOnLoud} onClick={() => onJump?.("planner")}>
              <CalendarDays size={15} /> {t("dash.planWeek")}
              </button>
              </div>
            </div>

            {(() => {
              const runwayHalf = (
                <div className="relative flex-1 p-6 md:p-7 flex flex-col justify-center min-w-0">
                  {plan ? (
                  <>
                  {/* PUBLIC TEST PERIOD (db/tune.sql §89): there are no
                  plans, so this card must not call itself one. It was
                  the last surface still saying "TRIAL PLAN" to a
                  teacher on a free grant. */}
                  {/* Flush right, the way "Today" is flush left: each half
                      labels itself from its own outer edge, so the two
                      eyebrows bracket the card instead of both leaning
                      the same way. */}
                  <p className={`${s.inkEyebrow} text-right`}>
                  {!planOn
                  ? t("dash.plan.credits")
                  : plan.status === "trialing" ? t("dash.plan.trial") : t("dash.plan.named", { plan: plan.plan })}
                  </p>
                  {/* The ring is the thing worth looking at here, so it
                      takes the middle of its half instead of a corner,
                      and the countdown reads back from the right edge
                      towards it. */}
                  <div className="flex items-center gap-4 mt-3">
                    {plan.credits != null && (
                      <div className="flex-1 flex justify-center">
                        <Ring value={plan.credits} max={plan.allowance || 1} size={92}>
                          <span className="text-center leading-none">
                            <span className="block font-serif text-[19px]">{plan.credits}</span>
                            <span className={`${s.inkMuted} block text-[8.5px] font-mono uppercase tracking-widest mt-1`}>
                              {t("dash.plan.creditsWord")}
                            </span>
                          </span>
                        </Ring>
                      </div>
                    )}
                    <div className="text-right">
                      <p className={s.figure}>{plan.days_left ?? "∞"}</p>
                      <p className={`${s.inkMuted} text-[12.5px] mt-1.5`}>
                        {plan.days_left === 1 ? t("dash.plan.dayLeft") : t("dash.plan.daysLeft")}
                        {planOn && plan.status === "trialing" ? t("dash.plan.thenChoose") : ""}
                      </p>
                      {/* The date the number is counting to. A bare
                          countdown is unfalsifiable — this is what makes
                          it checkable against a bank statement. */}
                      {plan.ends_at && (
                        <p className={`${s.inkMuted} text-[11px] mt-1 opacity-75`}>
                          {plan.status === "trialing" ? t("dash.plan.ends") : t("dash.plan.renews")}
                          {new Date(plan.ends_at).toLocaleDateString(locale, {
                            day: "numeric", month: "long",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Nothing to manage while billing is off. Account is
                  still one click away in the sidebar menu. */}
                  {planOn && (
                  <button
                  type="button"
                  onClick={() => onJump?.("account")}
                  className="mt-5 self-start text-[12.5px] underline underline-offset-4 decoration-1 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                  {t("dash.plan.manage")}
                  </button>
                  )}
                  </>
                  ) : (
                  <>
                  <p className={s.inkEyebrow}>{t("dash.plan.libraryEyebrow")}</p>
                  <p className={`${s.figure} mt-3`}>{counts.total ?? 0}</p>
                  <p className={`${s.inkMuted} text-[12.5px] mt-1.5`}>{t("dash.plan.thingsMade")}</p>
                  </>
                  )}
                </div>
              );
              /* Still its own widget: it can be hidden and comes back
                 with its own frame in edit mode, even though it no
                 longer has its own card. */
              return editing
                ? <div className="flex-1 p-2"><EditFrame widget="runway" prefs={prefs} onChange={changePrefs}>{runwayHalf}</EditFrame></div>
                : runwayHalf;
            })()}
          </section>
        ) : (
          <section className={`${s.loud} p-6 md:p-8 lg:col-span-12 flex flex-col justify-between min-h-[220px]`}>
            <KhatimMark className={s.loudMark} />
            <div className="relative">
            {/* The date lives in the page header now; twice on one screen
            was once too many. The eyebrow names the card instead. */}
            <p className={s.loudEyebrow}>{t("dash.today")}</p>
            <h1 className="font-serif text-[30px] md:text-[40px] leading-[1.05] font-medium mt-2.5 max-w-xl">
            {headline}
            </h1>
            <p className={`${s.loudSub} text-sm mt-2`}>{sub}</p>
            </div>
            <div className="relative flex flex-wrap gap-2.5 mt-6">
            <button type="button" className={s.btnOnLoud} onClick={() => onJump?.("studio")}>
            <Sparkles size={15} /> {t("dash.openStudio")}
            </button>
            <button type="button" className={s.btnGhostOnLoud} onClick={() => onJump?.("planner")}>
            <CalendarDays size={15} /> {t("dash.planWeek")}
            </button>
            </div>
          </section>
        )}

        {/* The calendar, pinned to the third the merged card left free.
            It is still its own widget — it can be hidden, and it frames
            itself in edit mode — but it no longer moves in the flow
            order, because a fixed home and an order are two different
            promises and the second one it can no longer keep. */}
        {calPinned && (
          (() => {
            const monthCard = (
              /* Height comes from the day card beside it, not from the
                 month: p-4 and a one-line heading buy the six rows the
                 dense grid needs inside 220px. */
              <section className={`${s.glass} p-4 h-full flex flex-col`}>
                <div className={s.calBar}>
                  <p className={s.calBarMonth}>
                    {new Date().toLocaleDateString(locale, { month: "long", year: "numeric" })}
                  </p>
                  <button
                    type="button"
                    onClick={() => onJump?.("schedule")}
                    className="text-[12px] text-muted hover:text-accent transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    {t("dash.w.calendar.action")} <ArrowRight size={12} />
                  </button>
                </div>
                {loading
                  ? <div className="grid grid-cols-7 gap-0.5">{Array.from({ length: 35 }, (_, i) => <Bar key={i} w="w-full" h="h-5" />)}</div>
                  : <MiniCalendar entries={calendar} onPick={() => onJump?.("schedule")} dense />}
              </section>
            );
            return (
              <div className="lg:col-span-4">
                {editing
                  ? <EditFrame widget="calendar" prefs={prefs} onChange={changePrefs}>{monthCard}</EditFrame>
                  : monthCard}
              </div>
            );
          })()
        )}
      </div>

      {planOn && plan && plan.days_left != null && plan.days_left <= 3 && !editing && (
        <div className={`${s.glass} px-4 py-3 flex items-center gap-3 flex-wrap`}>
          <p className="text-sm text-ink flex-1 min-w-[220px]">
            {plan.days_left === 0
              ? t("dash.expiry.ended", { kind: t(plan.status === "trialing" ? "dash.word.trial" : "dash.word.plan") })
              : <>
                  {t("dash.expiry.endsIn", { kind: t(plan.status === "trialing" ? "dash.word.trial" : "dash.word.plan") })}
                  <b>
                    {plan.days_left === 1
                      ? t("dash.expiry.day", { n: "1" })
                      : t("dash.expiry.days", { n: String(plan.days_left) })}
                  </b>.
                </>}
          </p>
          <button
            type="button"
            onClick={() => onJump?.("account")}
            className="h-9 px-4 rounded-full bg-accent text-on-accent text-[13px] font-medium hover:bg-accent-hover transition-colors cursor-pointer"
          >
            {t("dash.choosePlan")}
          </button>
        </div>
      )}

      {error && (
        <div className={`${s.glass} p-4`}>
          <p className={s.eyebrow}>{t("dash.error")}</p>
          <p className="text-sm text-ink-soft mt-1">{error}</p>
        </div>
      )}

      {isNew && !editing && (
        <section className={`${s.glassRaised} p-5 md:p-6`}>
          <p className={s.eyebrow}>{t("dash.first.eyebrow")}</p>
          <h2 className="font-serif text-2xl md:text-[28px] font-medium text-ink leading-tight mt-1.5">
            {t("dash.first.titlePlain")}<em className="italic text-accent">{t("dash.first.titleEm")}</em>
          </h2>
          <p className="text-sm text-ink-soft mt-2 max-w-xl">
            {t("dash.first.sub")}
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
                  <span className="block text-sm text-ink">{t(`dash.quick.${a.k}`)}</span>
                  <span className="block text-xs text-muted mt-0.5">{t(`dash.quick.${a.k}Hint`)}</span>
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
          {renderWidget(dragKey, dragRect.current?.width ?? null)}
        </div>,
        document.body
      )}

      {/* ── the flow grid: everything else, at the teacher's sizes ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {flowWidgets.map((w) => (
          <FlowTile
            key={w.key}
            widget={w}
            span={w.sizes ? prefs.sizes[w.key] ?? w.size : 12}
            className={SPAN[w.sizes ? prefs.sizes[w.key] ?? w.size : 12] || "lg:col-span-12"}
            editing={editing}
            prefs={prefs}
            onChange={changePrefs}
            drag={drag}
            render={renderWidget}
            onNode={(k, node) => { if (node) tileNodes.current.set(k, node); else tileNodes.current.delete(k); }}
          />
        ))}
      </div>
    </div>
  );
}
