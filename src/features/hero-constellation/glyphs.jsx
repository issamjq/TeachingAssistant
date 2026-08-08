"use client";

// =====================================================================
// Hero constellation — glyph set + studio plate
//
// The opening frame of the landing is a single scene rather than a pile
// of cards: a teal studio stage drawn as line art, with the eight
// modules floating over it as gold glyph tiles. Those tiles are the
// SAME eight things the contents index and the walkthrough show, so the
// keys here are HERO_CARDS keys verbatim — a glyph missing from this map
// is a module that would vanish mid-morph.
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

// ── The studio plate ─────────────────────────────────────────────────
// The "one image" the opening frame is built around: a teacher at a lit
// studio surface, an AI screen behind her, a perspective floor running
// off into the drench. Drawn rather than photographed so it inherits the
// Murchid palette exactly (gold line on teal) and costs no image bytes,
// and so the glyph tiles can float over it at any size without a
// resolution mismatch.
//
// Purely decorative — aria-hidden, no text, no interaction.
export function StudioPlate({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 900 340"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="hxFloor" x1="450" y1="150" x2="450" y2="340" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.88 0.075 192)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="oklch(0.88 0.075 192)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hxScreen" x1="450" y1="40" x2="450" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.72 0.10 195)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="oklch(0.30 0.07 205)" stopOpacity="0.30" />
        </linearGradient>
        <radialGradient id="hxHalo" cx="450" cy="150" r="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.88 0.075 192)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="oklch(0.88 0.075 192)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Stage halo — the light the whole scene sits in */}
      <ellipse cx="450" cy="176" rx="330" ry="150" fill="url(#hxHalo)" />

      {/* Perspective floor. Lines converge behind the figure, which is
          what gives the plate its depth without any 3D. */}
      <g stroke="oklch(0.88 0.075 192)" strokeOpacity="0.26" strokeWidth="1">
        <path d="M450 196 L60 340 M450 196 L215 340 M450 196 L370 340 M450 196 L530 340 M450 196 L685 340 M450 196 L840 340" />
        <path d="M250 250 H650" strokeOpacity="0.18" />
        <path d="M170 300 H730" strokeOpacity="0.12" />
      </g>
      <path d="M120 340 L450 196 L780 340 Z" fill="url(#hxFloor)" />

      {/* The AI screen behind the desk — a node graph, the machine half */}
      <g>
        <rect x="546" y="52" width="252" height="150" rx="10" fill="url(#hxScreen)" stroke="oklch(0.88 0.075 192)" strokeOpacity="0.5" />
        <g stroke="oklch(0.88 0.075 192)" strokeOpacity="0.55" strokeWidth="1" fill="none">
          <path d="M596 152 L640 108 L700 130 L748 88" />
          <path d="M640 108 L648 168 M700 130 L744 158" />
        </g>
        <g fill="oklch(0.88 0.075 192)" fillOpacity="0.85">
          <circle cx="596" cy="152" r="3.5" />
          <circle cx="640" cy="108" r="3.5" />
          <circle cx="700" cy="130" r="3.5" />
          <circle cx="748" cy="88" r="3.5" />
          <circle cx="648" cy="168" r="3" />
          <circle cx="744" cy="158" r="3" />
        </g>
        <path d="M660 202 v18 M614 226 h92" stroke="oklch(0.88 0.075 192)" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* The teacher — the human half, and deliberately the tallest
          element on the plate. Line art, no face: she reads as any
          teacher rather than one stock person. */}
      <g stroke="oklch(0.92 0.08 190)" strokeOpacity="0.9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="392" cy="76" r="21" />
        <path d="M371 72 a21 21 0 0 1 42 0 a30 30 0 0 0-42 0 Z" fill="oklch(0.92 0.08 190)" fillOpacity="0.28" stroke="none" />
        <path d="M392 97 v18" />
        <path d="M356 196 c0-46 12-78 36-81 c24 3 36 35 36 81" fill="oklch(0.92 0.08 190)" fillOpacity="0.1" />
        {/* the raised, pointing arm — she is directing the studio */}
        <path d="M424 126 L468 104 L498 92" />
        <path d="M498 92 l9-4" />
        <path d="M360 128 L344 168 L352 186" />
        <path d="M366 196 v34 M418 196 v34" />
      </g>

      {/* Desk + the lesson surface she is working on */}
      <g>
        <rect x="196" y="196" width="300" height="9" rx="4.5" fill="oklch(0.88 0.075 192)" fillOpacity="0.4" />
        <path d="M216 205 v46 M476 205 v46" stroke="oklch(0.88 0.075 192)" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="232" y="160" width="112" height="36" rx="5" fill="oklch(0.96 0.02 200)" fillOpacity="0.14" stroke="oklch(0.88 0.075 192)" strokeOpacity="0.45" transform="rotate(-6 288 178)" />
        <g stroke="oklch(0.88 0.075 192)" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" transform="rotate(-6 288 178)">
          <path d="M246 172 h58 M246 182 h78" />
        </g>
      </g>

      {/* Light ribbon — the thread that runs through the whole landing,
          here tying the desk to the screen. */}
      <path
        d="M150 268 C 300 232, 340 300, 470 252 C 590 208, 640 262, 800 214"
        stroke="oklch(0.94 0.07 190)"
        strokeOpacity="0.34"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
