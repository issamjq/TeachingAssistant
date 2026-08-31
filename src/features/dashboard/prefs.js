"use client";

// =====================================================================
// Dashboard preferences — what shows, how big, and how the charts draw
//
// Modelled on how a phone's quick-panel edit works: enter edit mode and
// the page itself becomes the editor. Every tile carries its own hide
// control, hidden tiles wait in a tray to be added back, and each tile
// can be resized — the grid reflows around whatever is chosen. No
// separate settings page, no checkbox list divorced from the thing it
// controls.
//
// Persisted per device in localStorage. A layout is a viewing habit,
// not account data — the phone and the classroom PC can reasonably
// differ, and a wrong guess costs one tap to fix.
// =====================================================================

const KEY = "murchid.dashboard.prefs";

/**
 * Every widget the dashboard can show.
 *
 *   locked   cannot be hidden — a dashboard with no hero is a blank
 *            page with an edit button
 *   sizes    the widths this widget can be set to; grid columns out of
 *            twelve. Absent = fixed.
 *   size     the default width
 *   default  visible without the teacher doing anything
 */
export const WIDGETS = [
  { key: "hero",     label: "Greeting & what's next", locked: true },
  { key: "runway",   label: "Plan & credits",         default: true },
  // Half the row. Three short numbers need less width than a chart of
  // eight weeks does, and the width they give up is width the chart can
  // actually use — its bars were islands in a quarter-page tile.
  { key: "rhythm",   label: "Work per week",          default: true,  sizes: [3, 4, 6], size: 6 },
  { key: "stats",    label: "Big numbers",            default: true,  sizes: [6, 8, 12], size: 6 },
  // The charts carry the calendar's ladder now. A bar chart of eight
  // weeks stretched across the full page was scale without information
  // — the same eight numbers, further apart — so the full-width rung is
  // gone, every rung slid down, and the new bottom rung is a different
  // DRAWING rather than a squeezed one: five weeks, shorter bars, one
  // label. Which drawing appears is decided by the tile's measured
  // width, not by the span, so it is the same judgement at 1024 as at
  // 1728. See CHART_COMPACT_MAX in DashboardView.
  // The calendar's own ladder, one notch below everything else. A full
  // month grid at half the page was more room than a month needs, so the
  // old L is gone and the rungs slid down — and the new bottom rung is a
  // different VIEW, not a squeezed grid: seven columns crammed into a
  // quarter-width tile is unreadable, so it becomes the week strip.
  // Two different tiles behind one control.
  //
  // SMALL pins it beside the day card, dense, filling the third that
  // card leaves — a companion to today rather than a widget.
  //
  // MEDIUM and LARGE hand it back to the flow as an ordinary tile: its
  // own square cells, its own row, dragged and reordered like the rest,
  // and the day card takes the whole top row again. A month someone has
  // deliberately made bigger is a month they intend to read, and reading
  // it is what the roomier drawing is for.
  { key: "calendar", label: "Calendar",               default: true,  sizes: [4, 5, 6], size: 4 },
  // Directly under the counts, in the column the chart does not use.
  // A teacher's first sight of the product should include somewhere to
  // type, and this is the one place on the page with room for it that
  // nothing else wanted.
  { key: "ask",      label: "Ask AI Studio",          default: true,  sizes: [3, 4, 6], size: 6 },
  { key: "tasks",    label: "Needs you",              default: true,  sizes: [4, 6, 12], size: 6 },
  { key: "week",     label: "This week's lessons",    default: false, sizes: [4, 6, 12], size: 6 },
  { key: "kinds",    label: "Library by kind",        default: false, sizes: [3, 4, 6], size: 4 },
];

/** The chart styles a widget can switch between, from its edit chrome. */
export const CHART_MODELS = {
  rhythm: [
    { id: "pills", label: "Pills" },
    { id: "line",  label: "Line" },
  ],
  kinds: [
    { id: "bars",  label: "Bars" },
    { id: "donut", label: "Donut" },
  ],
};

/** The widgets that live in the flow grid, in their default order. */
/**
 * The widgets that flow. `hero` and `runway` are the top card.
 *
 * The calendar is in this list even though its SMALL rung pins it beside
 * the day card: at medium and large it comes back into the flow and is
 * dragged and ordered like anything else, so it needs a position waiting
 * for it. A key that is only sometimes in the order is worse than one
 * that is always in it and sometimes ignored.
 */
export const FLOW_KEYS = WIDGETS
  .filter((w) => !["hero", "runway"].includes(w.key))
  .map((w) => w.key);

const DEFAULTS = {
  visible: WIDGETS.filter((w) => w.locked || w.default).map((w) => w.key),
  sizes: Object.fromEntries(WIDGETS.filter((w) => w.sizes).map((w) => [w.key, w.size])),
  // A line, not pills: eight weeks is a trend, and a trend is a shape the
  // eye follows rather than eight separate heights it has to compare.
  charts: { rhythm: "line", kinds: "bars" },
  order: [...FLOW_KEYS],
  seen: WIDGETS.map((w) => w.key),
};

export function defaultPrefs() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPrefs();
    const p = JSON.parse(raw);
    const sizes = { ...DEFAULTS.sizes };
    for (const [k, v] of Object.entries(p.sizes || {})) {
      const w = WIDGETS.find((x) => x.key === k);
      // A saved size a widget no longer offers falls back to its default
      // rather than producing an unstyleable span.
      if (w?.sizes?.includes(v)) sizes[k] = v;
    }
    /**
     * A widget added since the save is NEW, not hidden.
     *
     * `order` already appended unknown keys "so an old layout never
     * hides a new feature" — but `visible` did not, so a default-on
     * widget shipped after a teacher had once pressed Edit was invisible
     * to her forever, and to everyone who had. `seen` records which keys
     * existed when the layout was saved: anything defaulting to on that
     * she has never been offered gets switched on once. A widget she
     * actually turned off is in `seen`, so it stays off.
     */
    const seen = Array.isArray(p.seen) ? p.seen : (Array.isArray(p.visible) ? p.visible : []);
    const unseenDefaults = WIDGETS
      .filter((w) => w.default && !seen.includes(w.key))
      .map((w) => w.key);

    return {
      visible: [
        ...new Set([
          ...WIDGETS.filter((w) => w.locked).map((w) => w.key),
          ...(Array.isArray(p.visible) ? p.visible : DEFAULTS.visible),
          ...unseenDefaults,
        ]),
      ].filter((k) => WIDGETS.some((w) => w.key === k)),
      sizes,
      charts: { ...DEFAULTS.charts, ...(p.charts || {}) },
      // The saved order, cleaned: keys that no longer exist drop out,
      // widgets added since the save append at the end — so an old
      // layout never hides a new feature.
      order: [
        ...(Array.isArray(p.order) ? p.order.filter((k) => FLOW_KEYS.includes(k)) : []),
        ...FLOW_KEYS.filter((k) => !Array.isArray(p.order) || !p.order.includes(k)),
      ],
    };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs) {
  try {
    // Stamp every key that exists NOW, so the next release can tell a
    // widget she chose to hide from one she has never been shown.
    const seen = WIDGETS.map((w) => w.key);
    localStorage.setItem(KEY, JSON.stringify({ ...prefs, seen }));
  } catch {
    /* private browsing — the layout just resets next visit */
  }
}
