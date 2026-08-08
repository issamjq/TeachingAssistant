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
    lockScale: b.lockScale,
    lockShiftY: b.lockShiftY,
    lockX: b.isPortrait ? 0 : lockX,
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

// ── 10 · MIHRAB ──────────────────────────────────────────────────────
// A tall pointed arch with مرشد set inside it, and the eight modules
// standing in niches down its two sides.
//
// The one variant that draws on where this product actually is. The arch
// is struck geometrically rather than illustrated — two arcs meeting at
// a point — so it stays architecture and never becomes decoration.
export function mihrab(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { scale: 0.6, shift: -0.09 });
  if (b.isPortrait) return done(b, vw, vh, phone(b, vw, vh, dir, { centreH: 210 }));

  const s = tileScale(vh, false) * 0.82;
  const size = TILE * s;
  const topY = b.lockBottom + 20;
  const availH = vh / 2 - 34 - topY;
  const archH = Math.min(340, availH);
  const archW = Math.min(archH * 0.62, vw * 0.22);
  const cy = topY + archH / 2;

  // Four niches a side, running down the arch's flanks in reading order:
  // 01 top-left, 02 top-right, then down. Their distance from the centre
  // follows the arch's own half-width at that height — narrow at the
  // point, wide at the foot — so the two columns bow with the arch
  // instead of standing square beside it. The first attempt derived both
  // the row and the side from one expression and produced neither.
  // A row must clear its own caption AND the tile below it. Derived from
  // the arch's height alone it came out at 83px against a 73px tile, so
  // every caption sat on the next niche down; the caption is the reason
  // this variant is legible at all, so it sets the floor and the arch
  // gives way. Then the whole column is clamped into the pin, because a
  // block sized from the arch can still start too low to finish inside
  // it.
  const rowPitch = size + 46;
  const row0 = Math.min(
    cy - (rowPitch * 3) / 2,
    vh / 2 - 30 - rowPitch * 3 - size / 2 - 16
  );

  return done(b, vw, vh, {
    tile: (i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const rank = Math.floor(i / 2); // 0..3, top to bottom
      const halfW = (archW / 2) * (0.42 + 0.58 * (rank / 3));
      return {
        x: (halfW + size / 2 + 30) * side * dir,
        y: row0 + rank * rowPitch,
        s,
      };
    },
    tileSize: size,
    filaments: false,
    centre: { x: 0, y: cy, w: archW, h: archH, k: archH / 340, kind: "mihrab" },
    lastY: row0 + 3 * rowPitch + size / 2 + 30,
  });
}
