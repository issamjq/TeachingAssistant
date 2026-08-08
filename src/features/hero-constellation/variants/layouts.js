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
import { NICHES, SPRING } from "./arch";

/** Design size of the studio window (StudioStage). */
const STAGE_W = 520;
const STAGE_H = 300;
/** …and of its portrait crop. */
const STAGE_H_C = 150;

/** Assemble the common tail of a layout result. */
function done(b, vw, vh, opts) {
  const {
    tile, tileSize, sourceW = tileSize, centre = null,
    lastY, cueFloor = -Infinity, showLabels = !b.isPortrait,
    lockX = 0, filaments = true, labelAbove = null,
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
function phone(b, vw, vh, dir, { centreH = STAGE_H_C, hasCentre = true } = {}) {
  const s = tileScale(vh, true);
  const k = hasCentre ? Math.min(0.82, (vw - 36) / STAGE_W) : 0;
  const h = centreH * k;
  const y = b.lockBottom + 26 + h / 2;
  const g = portraitGrid(vw, vh, dir, hasCentre ? y + h / 2 + 34 : b.lockBottom + 40, s);
  return {
    tile: g.tile,
    tileSize: TILE * s,
    lastY: g.lastY,
    centre: hasCentre ? { x: 0, y, w: STAGE_W * k, h, k, compact: true } : null,
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

  const s = tileScale(vh, false);
  const size = TILE * s;
  const U = [-1, -0.62, 0.62, 1];
  const spread = Math.min(vw * 0.4, 500);
  const inner = Math.abs(U[1]) * spread;

  const c = fit(b.lockBottom + 34, vh, STAGE_W, STAGE_H, (inner - size / 2 - 34) * 2);
  const bandA = c.y - c.h * 0.26;
  const bandB = c.y + c.h * 0.26;

  return done(b, vw, vh, {
    tile: (i) => ({ x: U[i % 4] * spread * dir, y: i < 4 ? bandA : bandB, s }),
    tileSize: size,
    centre: { x: 0, ...c, compact: false },
    lastY: bandB + size / 2 + 30,
    cueFloor: c.y + c.h / 2 + 14,
  });
}

// ── 2 · COVER ────────────────────────────────────────────────────────
// A magazine cover. One tall specimen card holds the left field; the
// eight modules run down the right as a numbered editorial index, set in
// type rather than boxed in tiles. The most print-like of the ten — and
// the one that says "considered publication" fastest, because a reader
// recognises a contents column before they read a word of it.
export function cover(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.66, shift: -0.085 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir));

  const rowW = Math.min(320, vw * 0.28);
  const c = fit(b.lockBottom + 20, vh, 300, 400, Math.min(300, vw * 0.23));
  // The contents column is centred on the plate rather than hung from
  // the lockup, so the two read as one spread instead of as two blocks
  // that happen to share a screen.
  const rowH = Math.min(36, (c.h - 8) / n);
  const top = c.y - ((n - 1) * rowH) / 2;
  return done(b, vw, vh, {
    tile: (i) => ({ x: vw * 0.17 * dir, y: top + i * rowH, s: 1 }),
    tileSize: rowH,
    sourceW: rowW,
    showLabels: false, // the row IS the label
    filaments: false,
    centre: { x: -vw * 0.19 * dir, ...c, compact: false, kind: "specimen" },
    lastY: Math.max(top + (n - 1) * rowH + rowH / 2, c.y + c.h / 2),
  });
}

// ── 3 · APERTURE ─────────────────────────────────────────────────────
// A wide arc of light — a stage aperture — with the eight modules
// standing on it. The arc is struck from a centre far above the pin, so
// what you see is a shallow, almost architectural curve rather than a
// circle, and the tiles read as placed on a horizon.
export function aperture(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.76 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir, { hasCentre: false }));

  const s = tileScale(vh, false);
  const size = TILE * s;
  const spread = Math.min(vw * 0.42, 560);
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
    filaments: false,
    centre: { x: 0, y: topY + depth * 0.6, w: spread * 2.1, h: depth * 2.4, k: 1, kind: "aperture" },
    lastY: topY + size / 2 + depth + size / 2 + 30,
  });
}

// ── 4 · BUREAU ───────────────────────────────────────────────────────
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

  const s = tileScale(vh, false) * 0.94;
  const size = TILE * s;
  const U = [-1, -0.63, 0.63, 1];
  const spread = Math.min(vw * 0.41, 520);
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
    centre: { x: 0, ...c, compact: false, kind: "bureau" },
    lastY: bandB + 14 + size / 2 + 30,
    cueFloor: c.y + c.h / 2 + 18,
  });
}

// ── 5 · SPREAD ───────────────────────────────────────────────────────
// A magazine spread: masthead hard to the inline start, the studio
// window on the far side, and the eight modules in a 2×4 rail down the
// gutter between them. The only variant that breaks the centred lockup,
// and the one that most resembles a real editorial page.
export function spread(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.62, shift: 0.015 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir));

  const s = tileScale(vh, false) * 0.86;
  const size = TILE * s;
  // Three columns of content across the page: masthead, module rail,
  // studio. Each is placed from the viewport rather than from its
  // neighbour, so none of them can drift into another as the window
  // changes — which is exactly how the first attempt put the rail on top
  // of the wordmark.
  const lockX = -vw * 0.26 * dir;
  const railX = vw * 0.02 * dir;
  const stageX = vw * 0.3 * dir;

  const colPitch = size + 62;
  // Rows need room for a caption UNDER each tile, not merely for the
  // tile: at size+26 the caption of one row sat on the tile of the next.
  const rowPitch = size + 46;
  const top = -((n / 2 - 1) * rowPitch) / 2;

  const c = fit(-vh / 2 + vh * 0.26, vh, STAGE_W, STAGE_H, Math.min(vw * 0.32, 440));
  return done(b, vw, vh, {
    tile: (i) => ({
      x: railX + ((i % 2) - 0.5) * colPitch * dir,
      y: top + Math.floor(i / 2) * rowPitch,
      s,
    }),
    tileSize: size,
    lockX,
    filaments: false,
    centre: { x: stageX, y: -14, w: c.w, h: c.h, k: c.k, compact: false },
    lastY: top + 3 * rowPitch + size / 2 + 30,
  });
}

// ── 6 · INDEX ────────────────────────────────────────────────────────
// No centre object at all. The eight modules ARE the composition, set
// large in Fraunces as a contents poster in two columns.
//
// The most restrained of the ten and, on a page whose whole identity is
// editorial typography, arguably the most on-brand: nothing to render
// badly, nothing to date, and it reads at a glance from across a room.
export function index(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.66, shift: -0.1, portraitScale: 0.78 });

  const cols = b.isPortrait ? 1 : 2;
  const rows = n / cols;
  const rowH = Math.min(b.isPortrait ? 46 : 62, (vh / 2 - 40 - (b.lockBottom + 30)) / rows);
  const colPitch = Math.min(vw * 0.42, 520);
  const top = b.lockBottom + 34 + rowH / 2;

  return done(b, vw, vh, {
    tile: (i) => ({
      x: cols === 1 ? 0 : ((i % cols) - 0.5) * colPitch * dir,
      y: top + Math.floor(i / cols) * rowH,
      s: 1,
    }),
    tileSize: rowH,
    sourceW: colPitch * 0.8,
    showLabels: false, // the row IS the label
    filaments: false,
    centre: null,
    lastY: top + (rows - 1) * rowH + rowH / 2,
  });
}

// ── 7 · ORBIT ────────────────────────────────────────────────────────
// The wordmark as the thing everything else turns around: two faint
// rings, and the eight modules standing on the outer one.
//
// The ellipse is deliberately shallow and pushed BELOW the lockup rather
// than centred on it — a true ring around the masthead put tiles on top
// of the wordmark at the twelve o'clock positions, and no amount of
// tuning fixes a ring whose centre is occupied.
export function orbit(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.72 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir, { hasCentre: false }));

  const s = tileScale(vh, false);
  const size = TILE * s;
  const rx = Math.min(vw * 0.4, 520);
  const topY = b.lockBottom + 30;
  const ry = Math.min(132, (vh / 2 - 40 - topY - size) / 2);
  const cy = topY + size / 2 + ry;

  // Angles start at the inline start and run round the lower half, so
  // reading order and travel order agree.
  const ang = (i) => Math.PI + (i / (n - 1)) * Math.PI;
  return done(b, vw, vh, {
    tile: (i) => ({
      x: Math.cos(ang(i)) * rx * dir,
      y: cy + Math.sin(ang(i)) * ry,
      s,
    }),
    tileSize: size,
    filaments: false,
    centre: { x: 0, y: cy, w: rx * 2, h: ry * 2, k: 1, kind: "orbit" },
    lastY: cy + ry + size / 2 + 30,
  });
}

// ── 8 · SHINGLE ──────────────────────────────────────────────────────
// The eight sources are the CARDS themselves, overlapped like shingles
// so each shows its own title strip and the one at the front shows its
// whole face.
//
// This is what the original fan wanted to be. The fan failed because it
// stacked eight cards at a scale where none of them could be read; a
// shingle at a steep enough offset gives every card a legible strip, and
// no cross-fade is needed at all — the morph is pure position and scale.
export function shingle(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.66, shift: -0.075 });
  const CARD_H_D = 345;
  const topY0 = b.lockBottom + (b.isPortrait ? 26 : 30);
  // Sized to the band it actually has rather than to a fixed cap, so the
  // cards are as large as the window allows instead of leaving a third of
  // the screen empty under them.
  const s = b.isPortrait ? 0.34 : Math.max(0.4, Math.min(0.8, (vh / 2 - 26 - topY0) / CARD_H_D));
  const size = CARD_H_D * s;
  // Overlap is the point — a shingle, not a row. Half a card's width of
  // step leaves each one a title strip and nothing more.
  const step = b.isPortrait
    ? Math.min(38, (vw - 80) / (n - 1))
    : Math.min(230 * s * 0.62, (vw * 0.8) / (n - 1));
  const y = Math.min(topY0 + size / 2, vh / 2 - 26 - size / 2);

  return done(b, vw, vh, {
    tile: (i) => ({ x: (i - (n - 1) / 2) * step * dir, y, s }),
    tileSize: size,
    sourceW: 230 * s,
    showLabels: false, // each card carries its own title
    centre: null,
    lastY: y + size / 2,
  });
}

// ── 9 · SIGNAL ───────────────────────────────────────────────────────
// One luminous line across the frame with the eight modules standing on
// it, alternating above and below like stops on a route. The line is the
// through-thread the rest of the landing already uses; here it carries
// the whole composition.
export function signal(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.78 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir, { hasCentre: false }));

  const s = tileScale(vh, false) * 0.92;
  const size = TILE * s;
  const spread = Math.min(vw * 0.43, 580);
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

// ── 10 · MIHRAB ──────────────────────────────────────────────────────
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
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir, { centreH: 210 }));

  const s = tileScale(vh, false) * 0.86;
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
    labelPlace: "outside",
    filaments: false,
    lockScale: A.lockScale,
    lockShiftY: A.lockShiftY,
    centre: { x: 0, y: A.cy, w: A.w, h: A.h, k: 1, kind: "mihrab" },
    lastY: A.top + NICHES[3].f * A.h + size / 2,
  });
}

// ── 11 · COLONNADE ───────────────────────────────────────────────────
// An arcade: eight slender arches in a row, one per module, with the
// masthead standing above them.
//
// The idea Mihrab is reaching for, taken literally — if there are eight
// modules, build eight arches. Each module gets its own architecture
// instead of being an icon stuck to the side of someone else's, and the
// row reads as a facade, which is a shape that says "institution"
// faster than any amount of copy.
export function colonnade(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.7, shift: -0.055 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir, { hasCentre: false }));

  const bayW = Math.min((vw * 0.82) / n, 150);
  const top = Math.max(b.lockBottom + 30, -vh / 2 + vh * 0.44);
  // Slender: an arcade of squat bays reads as a row of tombstones. Two to
  // one, and taking whatever height is left rather than a fixed cap,
  // which was leaving a fifth of the screen empty underneath.
  const bayH = Math.min(bayW * 2, vh / 2 - 40 - top);
  const cy = top + bayH / 2;
  // The glyph sits under the springing, where the bay is full width —
  // higher up it is inside the curve and clips. Its CAPTION then has to
  // clear the base line too, which is what sets the fraction here.
  const glyphY = top + bayH * (SPRING + (1 - SPRING) * 0.3);

  return done(b, vw, vh, {
    tile: (i) => ({
      x: (i - (n - 1) / 2) * bayW * dir,
      y: glyphY,
      s: Math.min(1, (bayW * 0.52) / TILE),
    }),
    tileSize: Math.min(TILE, bayW * 0.52),
    filaments: false,
    centre: { x: 0, y: cy, w: bayW * n, h: bayH, k: 1, kind: "colonnade", bays: n },
    lastY: top + bayH,
  });
}

// ── 12 · KHATIM ──────────────────────────────────────────────────────
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
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir, { hasCentre: false }));

  const s = tileScale(vh, false) * 0.84;
  const size = TILE * s;
  const A = archFrame(b, vw, vh, { widthRatio: 0.92, lockFill: 0.6, topGap: 0.3 });

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
  const lockHalfH = A.h * 0.3;
  const lockHalfW = (A.w * 0.6) / 2;
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
