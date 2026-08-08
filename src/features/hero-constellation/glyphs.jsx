"use client";

// =====================================================================
// Hero constellation — glyph set
//
// One line glyph per module, for the tiles that orbit the studio stage
// in the opening frame. These are the SAME eight things the contents
// index and the walkthrough show, so the keys here are HERO_CARDS keys
// verbatim — a glyph missing from this map is a module that would
// vanish mid-morph.
//
// (This file also held a drawn studio scene. It was replaced by
// StudioStage, which builds the centre out of real product UI: an
// illustrated figure among live product surfaces read as clip art next
// to them, and illustration appears nowhere else in Murchid.)
//
// Everything is stroke-on-transparent at 24×24 so a tile can size the
// glyph purely with width/height, and colour it with `currentColor`.
// =====================================================================

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** One 24×24 line glyph per module key. */
export const GLYPHS = {
  // AI Studio — the wand that makes the material
  studio: (
    <g {...S}>
      <path d="M4 20 L14.5 9.5" />
      <path d="M12.5 7.5 L16.5 11.5" />
      <path d="M17.5 3 L18.4 5.6 L21 6.5 L18.4 7.4 L17.5 10 L16.6 7.4 L14 6.5 L16.6 5.6 Z" />
      <path d="M7 3.5 L7.5 5 L9 5.5 L7.5 6 L7 7.5 L6.5 6 L5 5.5 L6.5 5 Z" />
    </g>
  ),
  // Goal Planner — a term laid out as a grid
  planner: (
    <g {...S}>
      <rect x="3.25" y="4.75" width="17.5" height="15.5" rx="2.5" />
      <path d="M3.25 9.5 H20.75" />
      <path d="M7.5 3 V6.5 M16.5 3 V6.5" />
      <path d="M7 13 h3 M14 13 h3 M7 16.75 h3 M14 16.75 h3" />
    </g>
  ),
  // Teaching Profile — it sounds like you
  profile: (
    <g {...S}>
      <path d="M15.5 20.5 v-2.6 a5 5 0 0 1 1.6-3.5 A7 7 0 1 0 5.6 8.2" />
      <path d="M4 12.5 L6.5 12.5" />
      <path d="M9 10.5 c1.6 0 1.6 2.4 3.2 2.4" />
      <path d="M8.5 16.5 h4" />
    </g>
  ),
  // Subjects & Students — every class, held
  roster: (
    <g {...S}>
      <circle cx="9" cy="8.5" r="3.25" />
      <path d="M3.5 19.5 a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6 a3 3 0 0 1 0 5.6" />
      <path d="M17.25 14.5 a5.5 5.5 0 0 1 3.25 5" />
    </g>
  ),
  // Proctored Papers — sat under observation
  proctor: (
    <g {...S}>
      <rect x="2.75" y="6.5" width="18.5" height="12.5" rx="2.5" />
      <circle cx="12" cy="12.75" r="3.25" />
      <circle cx="12" cy="12.75" r="0.9" fill="currentColor" stroke="none" />
      <path d="M8.75 6.5 L10.25 4 h3.5 L15.25 6.5" />
    </g>
  ),
  // Dashboard — a record that teaches back
  insights: (
    <g {...S}>
      <path d="M3.75 20.25 H20.5" />
      <rect x="5.5" y="12" width="3.25" height="6" rx="1" />
      <rect x="10.5" y="8" width="3.25" height="10" rx="1" />
      <rect x="15.5" y="4.25" width="3.25" height="13.75" rx="1" />
    </g>
  ),
  // Scheduling — timed, spaced, balanced
  schedule: (
    <g {...S}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7 V12.25 L15.5 14.25" />
      <path d="M12 1.75 v1.75 M12 20.5 v1.75 M1.75 12 h1.75 M20.5 12 h1.75" />
    </g>
  ),
  // Assistant — knows the platform
  assistant: (
    <g {...S}>
      <path d="M20.5 12.75 a8 8 0 0 1-8 8 H4.5 a1 1 0 0 1-.9-1.45 l1.15-2.3 A8 8 0 1 1 20.5 12.75 Z" />
      <path d="M9.9 9.9 a2.35 2.35 0 1 1 3 2.25 v1.1" />
      <circle cx="12.9" cy="16.1" r="0.85" fill="currentColor" stroke="none" />
    </g>
  ),
};

/** A single glyph, sized by its parent. */
export function Glyph({ kind, size = 30 }) {
  const g = GLYPHS[kind];
  if (!g) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {g}
    </svg>
  );
}
