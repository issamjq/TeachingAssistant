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
  { key: "stats",    label: "Big numbers",            default: true,  sizes: [6, 12], size: 12 },
  // The charts carry the calendar's ladder now. A bar chart of eight
  // weeks stretched across the full page was scale without information
  // — the same eight numbers, further apart — so the full-width rung is
  // gone, every rung slid down, and the new bottom rung is a different
  // DRAWING rather than a squeezed one: five weeks, shorter bars, one
  // label. Which drawing appears is decided by the tile's measured
  // width, not by the span, so it is the same judgement at 1024 as at
  // 1728. See CHART_COMPACT_MAX in DashboardView.
  { key: "rhythm",   label: "Work per week",          default: true,  sizes: [3, 4, 6], size: 4 },
  // The calendar's own ladder, one notch below everything else. A full
  // month grid at half the page was more room than a month needs, so the
  // old L is gone and the rungs slid down — and the new bottom rung is a
  // different VIEW, not a squeezed grid: seven columns crammed into a
  // quarter-width tile is unreadable, so it becomes the week strip.
  { key: "calendar", label: "Calendar",               default: true,  sizes: [3, 4, 6], size: 4 },
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
export const FLOW_KEYS = WIDGETS
  .filter((w) => !["hero", "runway"].includes(w.key))
  .map((w) => w.key);

const DEFAULTS = {
  visible: WIDGETS.filter((w) => w.locked || w.default).map((w) => w.key),
  sizes: Object.fromEntries(WIDGETS.filter((w) => w.sizes).map((w) => [w.key, w.size])),
  charts: { rhythm: "pills", kinds: "bars" },
  order: [...FLOW_KEYS],
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
    return {
      visible: [
        ...new Set([
          ...WIDGETS.filter((w) => w.locked).map((w) => w.key),
          ...(Array.isArray(p.visible) ? p.visible : DEFAULTS.visible),
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
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* private browsing — the layout just resets next visit */
  }
}
