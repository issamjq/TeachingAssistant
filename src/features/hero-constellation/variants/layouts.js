// =====================================================================
// Stage-one variants — the ten layouts
//
// Each function answers the same question: where do the eight sources
// rest before the morph, and what sits at the centre while they do. They
// all return the same shape, because HeroStageOne draws them all with
// one code path — the variants differ in composition, not in machinery.
//
// Returned shape:
//   tile(i)        -> {x, y, s, rot?}  source i's resting transform
//   tileSize       rendered px of one source at rest
//   sourceW        width used to size a card at the start of its morph
//   showLabels     whether sources carry a caption at rest
//   lockScale/-ShiftY/-Align   how the masthead sits
//   centre         {x,y,w,h,k,compact} for the centre block, or null
//   cueY/showCue   the caption line under the composition
//   cardStartScale scale a card begins its morph at
//
// Every coordinate is relative to the CENTRE of the 100vh pin.
// =====================================================================

import { base, cardStart, cue, fit, portraitGrid, TILE, tileScale } from "./shared";
import { NICHES } from "./arch";

/** Design size of the studio window (StudioStage). */
const STAGE_W = 520;
const STAGE_H = 300;

/** Assemble the common tail of a layout result. */
function done(b, vw, vh, opts) {
  const {
    tile, tileSize, sourceW = tileSize, centre = null,
    lastY, cueFloor = -Infinity,
    // Captioned everywhere, phones included. Portrait used to opt out on
    // the grounds that the contents list names the modules a beat later,
    // which was a loss dressed up as a trade: the opening screen is where
    // a visitor decides whether to keep scrolling, and eight unlabelled
    // glyphs give them nothing to decide on.
    showLabels = true,
    lockX = 0, filaments = true, labelAbove = null, pulseAt = null,
    pulseDur = 7, labelW = null,
  } = opts;
  return {
    tile,
    tileSize,
    sourceW,
    showLabels,
    // Where a caption sits relative to its source. Only Signal needs the
    // choice: its sources straddle a luminous rule, and a caption hung
    // below an above-the-line tile lands ON the rule and is unreadable.
    labelAbove,
    // Where source i sits along the centre's travelling light, 0-1, or
    // null if the variant has none. Drives the per-source glow so a module
    // lights at the moment the light reaches it.
    pulseAt,
    // Seconds for one full pass of the variant's light. Each composition
    // gets its own: a wave read left to right wants a different tempo
    // from light falling down an arch.
    pulseDur,
    // A tablet's bands sit closer together than a desktop's, so the
    // default caption box overlaps its neighbour there.
    labelW: labelW ?? (b.tier === "tablet" ? 134 : null),
    // Filaments are struck from the centre to each source. Variants whose
    // centre IS the connector — the ring, the rule, the arch — switch
    // them off; drawing both gave two competing sets of lines.
    filaments,
    // The architectural variants place the masthead INSIDE their arch, so
    // they set these absolutely rather than as a nudge off the default.
    lockScale: opts.lockScale ?? b.lockScale,
    lockShiftY: opts.lockShiftY ?? b.lockShiftY,
    lockX: b.isPortrait ? 0 : lockX,
    labelPlace: opts.labelPlace ?? "below",
    // Whether a caption also carries what the module DOES. On by default:
    // naming eight features without saying what any of them are is the
    // failure the whole opening frame exists to avoid.
    showDesc: opts.showDesc ?? true,
    centre,
    ...cue(vh, lastY, cueFloor),
    cardStartScale: cardStart(sourceW),
    isPortrait: b.isPortrait,
  };
}

/**
 * The phone form nearly every variant falls back to: the centre block
 * (cropped) above, four tiles across and two down below it. A phone has
 * no room for ten different compositions and would not benefit from
 * them — what varies between variants is a desktop composition.
 */
function phone(b, vw, vh, dir) {
  const s = tileScale(vh, "phone");
  const g = portraitGrid(vw, vh, dir, b.lockBottom + 34, s);
  return {
    tile: g.tile,
    tileSize: TILE * s,
    labelW: g.labelW,
    lastY: g.lastY,
    // No centre on a phone — see portraitGrid. Eight named modules beat a
    // 150px crop of a studio window.
    centre: null,
    pulseAt: (i) => i / 8,
    pulseDur: 7.4,
  };
}

// ── 1 · ATELIER ──────────────────────────────────────────────────────
// The studio window, with the eight modules flanking it.
//
// Within a band the four tiles are pushed OUTWARD (-1, -0.62, +0.62, +1
// of the spread) rather than spaced evenly. Evenly spaced, the two inner
// tiles of each band sat in the middle of the frame — which is where the
// window lives. Biased out, the eight frame the window instead of
// covering it, and they still arrive at an evenly-spaced grid because
// the morph interpolates to indexLayout's positions, not to their own.
export function atelier(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK);
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir));

  const s = tileScale(vh, b.tier);
  const size = TILE * s;
  const U = [-1, -0.62, 0.62, 1];
  const spread = Math.min(vw * (b.tier === "tablet" ? 0.36 : 0.4), 500);
  const inner = Math.abs(U[1]) * spread;

  const c = fit(b.lockBottom + 34, vh, STAGE_W, STAGE_H, (inner - size / 2 - 34) * 2);
  const bandA = c.y - c.h * 0.26;
  const bandB = c.y + c.h * 0.26;

  return done(b, vw, vh, {
    tile: (i) => ({ x: U[i % 4] * spread * dir, y: i < 4 ? bandA : bandB, s }),
    tileSize: size,
    // Light leaves the studio window and reaches the modules outward-in
    // reverse: the pair nearest the window first, the far pair last, so
    // it reads as being EMITTED rather than as a list ticking through.
    pulseAt: (i) => [0.62, 0.3, 0.3, 0.62][i % 4] + (i < 4 ? 0 : 0.06),
    pulseDur: 6.4,
    centre: { x: 0, ...c, compact: false },
    lastY: bandB + size / 2 + 30,
    cueFloor: c.y + c.h / 2 + 14,
  });
}

// ── 2 · APERTURE ─────────────────────────────────────────────────────
// A wide arc of light — a stage aperture — with the eight modules
// standing on it. The arc is struck from a centre far above the pin, so
// what you see is a shallow, almost architectural curve rather than a
// circle, and the tiles read as placed on a horizon.
export function aperture(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.76 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir));

  const s = tileScale(vh, b.tier);
  const size = TILE * s;
  const spread = Math.min(vw * (b.tier === "tablet" ? 0.37 : 0.42), 560);
  const topY = b.lockBottom + 40;
  const depth = Math.min(126, vh / 2 - 46 - topY - size / 2);

  // Two arcs, four on each, the lower one wider — a shallow amphitheatre.
  const arc = (i) => {
    const row = Math.floor(i / 4);
    const u = ((i % 4) - 1.5) / 1.5;
    const w = spread * (row === 0 ? 0.72 : 1);
    const rise = (1 - u * u) * (row === 0 ? 26 : 40);
    return { x: u * w * dir, y: topY + size / 2 + row * depth - rise, s };
  };

  return done(b, vw, vh, {
    tile: arc,
    tileSize: size,
    // Across the arc, near row first — the way a stage light sweeps.
    pulseAt: (i) => (i % 4) / 4 * 0.44 + (i < 4 ? 0.04 : 0.5),
    pulseDur: 7.6,
    filaments: false,
    centre: { x: 0, y: topY + depth * 0.6, w: spread * 2.1, h: depth * 2.4, k: 1, kind: "aperture" },
    lastY: topY + size / 2 + depth + size / 2 + 30,
  });
}

// ── 3 · BUREAU ───────────────────────────────────────────────────────
// The desk, seen from slightly above. The studio window lies back in
// perspective and the eight modules sit around it as objects that have
// been put down rather than arranged — each one carries a small, fixed
// rotation. The rotations are hand-set and deliberately irregular; a
// formula produced a pattern, and a pattern reads as a grid that has
// been knocked askew rather than as a desk.
const BUREAU_ROT = [-6, 4, -3, 7, 5, -7, 3, -4];
const BUREAU_DY = [-14, 10, -8, 12, 8, -12, 14, -6];
export function bureau(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.74 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir));

  const s = tileScale(vh, b.tier) * 0.94;
  const size = TILE * s;
  const U = [-1, -0.63, 0.63, 1];
  const spread = Math.min(vw * (b.tier === "tablet" ? 0.37 : 0.41), 520);
  const inner = Math.abs(U[1]) * spread;

  const c = fit(b.lockBottom + 40, vh, STAGE_W, STAGE_H, (inner - size / 2 - 30) * 2);
  const bandA = c.y - c.h * 0.28;
  const bandB = c.y + c.h * 0.28;

  return done(b, vw, vh, {
    tile: (i) => ({
      x: U[i % 4] * spread * dir,
      y: (i < 4 ? bandA : bandB) + BUREAU_DY[i],
      s,
      rot: BUREAU_ROT[i] * dir,
    }),
    tileSize: size,
    // A lamp swept across a desk: strictly left to right by position, so
    // the two rows light together where they line up rather than in
    // reading order, which is what makes it read as a sweep.
    pulseAt: (i) => 0.06 + ((i % 4) / 3) * 0.82,
    pulseDur: 8,
    centre: { x: 0, ...c, compact: false, kind: "bureau" },
    lastY: bandB + 14 + size / 2 + 30,
    cueFloor: c.y + c.h / 2 + 18,
  });
}

// ── 4 · RIBBON ───────────────────────────────────────────────────────
// One flowing ribbon of light across the frame with the eight modules
// riding it, rising and falling with the wave.
//
// This replaced a pure-typography contents poster, which was elegant and
// inert — eight names in Fraunces, no glyphs, nothing moving, and no way
// to tell a quiz from a timetable. The ribbon is the motif the rest of
// the landing already runs on, and putting the modules ON it says they
// are one continuous thing rather than eight separate products.
//
// The wave is a single sine, sampled at the same normalised positions
// here and in the drawn path, so the modules sit ON the ribbon rather
// than near it.
export function ribbon(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.7, shift: -0.06 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir));

  const s = tileScale(vh, b.tier) * 0.92;
  const size = TILE * s;
  const W = Math.min(vw * (b.tier === "tablet" ? 0.84 : 0.88), 1240);
  const top = b.lockBottom + 34;
  // Amplitude is bounded by what is left of the pin once a two-line
  // caption is allowed for under the LOWEST point of the wave.
  const amp = Math.min(76, (vh / 2 - 46 - top - size - 44) / 2);
  const cy = top + size / 2 + amp;

  const wave = (u) => Math.sin(u * Math.PI * 2);

  // Where each module sits along the ribbon BY ARC LENGTH, not by x.
  //
  // The travelling light moves at constant speed along the line, and the
  // line is longer than the box is wide — steeply on the rising and
  // falling flanks, barely at the crests. Timing the glows off x instead
  // would run them a few percent early at the crests and late on the
  // flanks, which on a 7s cycle is exactly the kind of near-miss that
  // reads as "the animation is slightly broken" rather than as an
  // animation at all.
  const SAMPLES = 400;
  const cum = [0];
  for (let k = 1; k <= SAMPLES; k++) {
    const u0 = (k - 1) / SAMPLES;
    const u1 = k / SAMPLES;
    const dx = (W * (u1 - u0)) ** 2;
    const dy = (amp * (wave(u1) - wave(u0))) ** 2;
    cum.push(cum[k - 1] + Math.sqrt(dx + dy));
  }
  const total = cum[SAMPLES];
  const arcAt = (u) => cum[Math.round(u * SAMPLES)] / total;

  return done(b, vw, vh, {
    tile: (i) => ({
      x: (i / (n - 1) - 0.5) * W * dir,
      y: cy - wave(i / (n - 1)) * amp,
      s,
    }),
    tileSize: size,
    filaments: false,
    pulseAt: (i) => arcAt(i / (n - 1)),
    centre: { x: 0, y: cy, w: W, h: amp * 2.24, k: 1, kind: "ribbon" },
    // The lowest point of the wave PLUS its two-line caption. Measured to
    // the tile alone, the cue line ran straight through the caption of
    // whichever module sat at the trough.
    lastY: cy + amp + size * 0.72 + 30,
  });
}

// ── 5 · SIGNAL ───────────────────────────────────────────────────────
// One luminous line across the frame with the eight modules standing on
// it, alternating above and below like stops on a route. The line is the
// through-thread the rest of the landing already uses; here it carries
// the whole composition.
export function signal(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.78 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir));

  const s = tileScale(vh, b.tier) * 0.92;
  const size = TILE * s;
  const spread = Math.min(vw * (b.tier === "tablet" ? 0.38 : 0.43), 580);
  const topY = b.lockBottom + 44;
  const lift = Math.min(58, (vh / 2 - 40 - topY - size) / 2);
  const lineY = topY + size / 2 + lift;

  return done(b, vw, vh, {
    tile: (i) => ({
      x: ((i - (n - 1) / 2) / ((n - 1) / 2)) * spread * dir,
      y: lineY + (i % 2 === 0 ? -lift : lift),
      s,
    }),
    tileSize: size,
    // Stepping along the line in order, matching the highlight that
    // travels it — see .sigPulse, which shares this duration.
    pulseAt: (i) => i / (n - 1),
    pulseDur: 7,
    // Above-the-line sources caption ABOVE themselves; hung below, the
    // caption lands on the luminous rule and cannot be read at all.
    labelAbove: (i) => i % 2 === 0,
    filaments: false,
    centre: { x: 0, y: lineY, w: spread * 2.2, h: 2, k: 1, kind: "signal" },
    lastY: lineY + lift + size / 2 + 30,
  });
}

// ── shared: an arch the masthead stands inside ───────────────────────
// Mihrab, Colonnade and Khatim all frame the lockup with architecture,
// so they size it the same way: the arch takes the height it can get,
// and the masthead is scaled to sit INSIDE it rather than the arch being
// grown to fit whatever size the masthead happened to be.
function archFrame(b, vw, vh, { widthRatio = 0.78, lockFill = 0.74, topGap = 0.3 } = {}) {
  // Below the masthead bar, not merely below the nav: at 0.13 the apex
  // came up through "FOR TEACHERS, KG–G12".
  const top = -vh / 2 + Math.max(132, vh * 0.16);
  const h = Math.min(vh * 0.74, vh / 2 - 26 - top);
  const w = Math.min(h * widthRatio, vw * 0.46);
  // Scaled to a fraction of the arch's width, so the masthead is always
  // comfortably inside the jambs whatever the window does. The 720 is the
  // Latin wordmark's design width; wordK is divided out because the hero
  // multiplies the two back together.
  const lockScale = Math.max(0.28, Math.min(0.92, (w * lockFill) / 720 / b.wordK));
  return {
    top,
    h,
    w,
    cy: top + h / 2,
    lockScale,
    // Absolute, not a nudge: the masthead's own CSS top is subtracted out
    // so the block lands at a chosen height INSIDE the arch.
    lockShiftY: top + h * topGap - (-vh / 2 + vh * 0.15),
  };
}

// ── 6 · MIHRAB ──────────────────────────────────────────────────────
// A monumental pointed arch with the whole masthead standing inside it —
// wordmark, tagline, buttons, trust line, all centred — and the eight
// modules set into its outline, four to a side.
//
// The modules sit just OUTSIDE the line rather than on it. Inside, they
// collided with the wordmark at every width that made the wordmark large
// enough to be the wordmark; outside, the interior belongs entirely to
// the masthead and the arch reads as carrying the modules rather than
// containing them. Their captions hang outward for the same reason.
export function mihrab(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.68, shift: -0.075 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir));

  const s = tileScale(vh, b.tier) * 0.86;
  const size = TILE * s;
  const A = archFrame(b, vw, vh, { widthRatio: 0.8, lockFill: 0.76, topGap: 0.28 });

  return done(b, vw, vh, {
    tile: (i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const nq = NICHES[Math.floor(i / 2)];
      return {
        x: ((nq.hf * A.w) / 2 + size / 2 + 16) * side * dir,
        y: A.top + nq.f * A.h,
        s,
      };
    },
    tileSize: size,
    // Light falls from the apex down both jambs at once, so the two
    // niches of a rank light together. Architecture is symmetrical; a
    // light running down one side and then the other would fight it.
    pulseAt: (i) => 0.08 + Math.floor(i / 2) * 0.26,
    pulseDur: 7.2,
    labelPlace: "outside",
    filaments: false,
    lockScale: A.lockScale,
    lockShiftY: A.lockShiftY,
    centre: { x: 0, y: A.cy, w: A.w, h: A.h, k: 1, kind: "mihrab" },
    lastY: A.top + NICHES[3].f * A.h + size / 2,
  });
}

// ── 7 · KHATIM ──────────────────────────────────────────────────────
// The arch again, and inside it an eight-pointed star — the khatim — with
// one module standing at each of its eight points.
//
// The count is the whole argument: there are eight modules and the star
// has eight points, so the arrangement is not a layout imposed on the
// content but the content's own number made into a shape. It also solves
// what Mihrab works around — the modules have somewhere to be that is
// neither on top of the masthead nor exiled to the margins.
export function khatim(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.68, shift: -0.06 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir));

  // Both were too small to read at a glance: the masthead filled 60% of
  // the arch and the tiles were at 0.84, which on a faint star over a
  // mid-tone drench left the whole frame looking like a watermark.
  const s = tileScale(vh, b.tier);
  const size = TILE * s;
  const A = archFrame(b, vw, vh, { widthRatio: 0.96, lockFill: 0.74, topGap: 0.3 });

  // A khatim is two squares at 45°, so its eight points fall every 45°.
  // Rotated by 22.5° none of them lands on the vertical axis — which is
  // where the masthead is. Unrotated, two points sat directly on the
  // wordmark and on the buttons.
  //
  // The radii are then sized so even the nearest points clear the
  // masthead: the vertical pair must clear its top and bottom, the
  // horizontal pair its width. Both are derived rather than picked,
  // because the masthead is itself sized from the arch.
  const OFF = Math.SQRT1_2 * 0.5412; // sin(22.5°) / sin(45°) → 0.383
  const lockHalfH = A.h * 0.31;
  const lockHalfW = (A.w * 0.74) / 2;
  const ry = Math.min(
    A.h * 0.47,
    Math.max((lockHalfH + size / 2 + 22) / Math.cos((22.5 * Math.PI) / 180), A.h * 0.34)
  );
  const rx = Math.min(
    vw * 0.34,
    Math.max((lockHalfW + size / 2 + 24) / Math.cos((22.5 * Math.PI) / 180), A.w * 0.62)
  );
  const cy = A.top + A.h * 0.5;

  // Reading order runs down the star by rows — top pair, upper pair,
  // lower pair, bottom pair — so the eight travel paths to the contents
  // grid stay parallel instead of crossing.
  const ANG = [-112.5, -67.5, -157.5, -22.5, 157.5, 22.5, 112.5, 67.5];

  return done(b, vw, vh, {
    tile: (i) => {
      const a = (ANG[i] * Math.PI) / 180;
      return { x: Math.cos(a) * rx * dir, y: cy + Math.sin(a) * ry, s };
    },
    tileSize: size,
    // Round the star, clockwise from its top-left point — the order the
    // rosette's own construction implies, and the order its rotating
    // trace passes them in.
    pulseAt: (i) => [0, 0.875, 0.125, 0.75, 0.25, 0.625, 0.375, 0.5][i],
    pulseDur: 8.4,
    labelPlace: "outside",
    filaments: false,
    lockScale: A.lockScale,
    lockShiftY: A.lockShiftY,
    centre: {
      x: 0, y: cy, w: rx * 2, h: ry * 2, k: 1, kind: "khatim",
      archH: A.h, archW: A.w, archTop: A.top,
    },
    lastY: cy + ry + size / 2,
  });
}
