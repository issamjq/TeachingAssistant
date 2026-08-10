"use client";

// =====================================================================
// Dashboard preferences — which widgets show, and how the charts draw
//
// Edited FROM the dashboard, not from Settings. The decision "do I want
// the calendar here" is made while looking at the calendar; sending the
// teacher to another page to make it means they never will.
//
// Persisted per device in localStorage. A layout is a viewing habit, not
// account data — the phone and the classroom PC can reasonably differ,
// and a wrong guess costs one tap to fix.
// =====================================================================

const KEY = "murchid.dashboard.prefs";

/**
 * Every widget the dashboard can show. `locked` cannot be hidden — a
 * dashboard with no hero is a blank page with a customize button.
 *
 * Defaults follow the instruction: the five or six that matter, and the
 * rest opt-in. "This week" starts hidden because the calendar already
 * marks those days; "By kind" because the Library stat carries the
 * total. Both are one tap away.
 */
export const WIDGETS = [
  { key: "hero",     label: "Greeting & what's next",   locked: true },
  { key: "runway",   label: "Plan & credits",           default: true },
  { key: "stats",    label: "Big numbers",              default: true },
  { key: "rhythm",   label: "Work per week",            default: true },
  { key: "calendar", label: "Calendar",                 default: true },
  { key: "tasks",    label: "Needs you",                default: true },
  { key: "week",     label: "This week's lessons",      default: false },
  { key: "kinds",    label: "Library by kind",          default: false },
];

/** The chart styles a widget can switch between. */
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

const DEFAULTS = {
  visible: WIDGETS.filter((w) => w.locked || w.default).map((w) => w.key),
  charts: { rhythm: "pills", kinds: "bars" },
};

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw);
    return {
      // Locked widgets are re-added on load, so a stale saved list from
      // before a widget became locked cannot hide it.
      visible: [
        ...new Set([
          ...WIDGETS.filter((w) => w.locked).map((w) => w.key),
          ...(Array.isArray(p.visible) ? p.visible : DEFAULTS.visible),
        ]),
      ].filter((k) => WIDGETS.some((w) => w.key === k)),
      charts: { ...DEFAULTS.charts, ...(p.charts || {}) },
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* private browsing — the layout just resets next visit */
  }
}
