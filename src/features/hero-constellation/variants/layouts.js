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

import { base, cardStart, cue, fit, phoneGrid, rowOf8, TILE, tileScale } from "./shared";
import { NICHES } from "./arch";

/**
 * The least two stacked bands may be apart: a tile, its two-line caption,
 * and a gap. Derived from the centre piece's height, the separation shrank
 * with it — on a 720px-tall window the upper band's captions landed on the
 * lower band's tiles.
 */
const bandGap = (size) => size + 66;

/** Design size of the studio window (StudioStage). */
const STAGE_W = 520;
const STAGE_H = 300;

/**
 * Assemble the common tail of a layout result — and guarantee the whole
 * composition fits the pin.
 *
 * Everything in stage one has to be visible inside one 100dvh screen: a
 * variant whose last row of captions falls past the bottom edge is not a
 * slightly cropped design, it is eight modules of which a visitor can
 * read six. Each layout sizes itself against the viewport it was given,
 * but the arithmetic is per-variant and the failure mode is silent —
 * 1280x720, a very ordinary laptop, overflowed on four of the seven.
 *
 * So the fit is enforced here rather than trusted there: measure where
 * the composition actually ends, captions included, and if it runs past
 * the pin lift the whole thing — tiles and centre together — by the
 * overflow. One check, in one place, that no future variant can forget.
 */
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
    pulseDur = 7, labelW = null, capH: capHOpt = null,
  } = opts;
  const showDesc = opts.showDesc ?? true;
  const labelPlace = opts.labelPlace ?? "below";

  // How far below a tile its caption reaches. Captions hung "outside" sit
  // beside the tile and add nothing below it.
  // A name can wrap to two lines and a description under it to two more.
  // 52 under-counted both, so the overflow guard lifted by slightly less
  // than the composition actually needed.
  const capH =
    labelPlace === "below" && showLabels ? capHOpt ?? (showDesc ? 58 : 30) : 0;
  let bottom = -Infinity;
  for (let i = 0; i < 8; i++) bottom = Math.max(bottom, tile(i).y + tileSize / 2 + capH);
  if (centre) bottom = Math.max(bottom, centre.y + centre.h / 2);

  const lift = Math.max(0, bottom - (vh / 2 - 16));
  const fitTile = lift ? (i) => { const t = tile(i); return { ...t, y: t.y - lift }; } : tile;
  const fitCentre = lift && centre ? { ...centre, y: centre.y - lift } : centre;

  return {
    tile: fitTile,
    tileSize,
    sourceW,
    showLabels,
    labelAbove,
    pulseAt,
    pulseDur,
    labelW: labelW ?? (b.tier === "tablet" ? 134 : null),
    filaments,
    lockScale: opts.lockScale ?? b.lockScale,
    lockShiftY: opts.lockShiftY ?? b.lockShiftY,
    lockX: b.isPortrait ? 0 : lockX,
    labelPlace,
    showDesc,
    reserveName: !b.isPortrait,
    centre: fitCentre,
    ...cue(vh, lastY - lift, cueFloor - lift),
    cardStartScale: cardStart(sourceW),
    isPortrait: b.isPortrait,
  };
}

/**
 * The tablet arrangement, shared by all seven.
 *
 * A tablet has one row of band under a full-size masthead and no more, so
 * there is nothing left to compose WITH — the row is the whole layout.
 * Phones are different: two columns of four leave room for a shape behind
 * them, which is why each variant builds its own (see the `phone` branch
 * in each layout below) rather than sharing this.
 */
function tabletRow(b, vw, vh, dir, { wave = null, rot = null, centre = null, pulseDur = 7.2 } = {}) {
  const g = rowOf8(vw, vh, dir, b.lockBottom + 10, tileScale(vh, "tablet") * 1.5);
  const size = g.size;
  // A wave that rises above the base row would push its highest tile into
  // the trust line above it, so the whole row drops by the wave's deepest
  // upward excursion first.
  const lift = wave ? Math.min(0, ...Array.from({ length: 8 }, (_, i) => wave(i))) : 0;
  const tile = (i) => {
    const t = g.tile(i);
    return { ...t, y: t.y + (wave ? wave(i) : 0) - lift, rot: rot ? rot[i] * dir : 0 };
  };
  const pts = Array.from({ length: 8 }, (_, i) => { const t = tile(i); return [t.x, t.y]; });
  return {
    tile,
    tileSize: size,
    labelW: g.labelW,
    capH: g.capH,
    lastY: g.lastY - lift + (wave ? 12 : 0),
    // A tablet used to get no centre at all, which meant no travelling
    // light — the modules glowed in sequence with nothing visibly
    // carrying the beat, so it read as eight things blinking rather than
    // as one light passing through them. Each variant hands its own shape
    // down to this size now.
    centre: centre ? centre(g, size, pts) : null,
    pulseAt: (i) => i / 8,
    pulseDur,
  };
}

/**
 * Is there room below the masthead for a two-band composition at all?
 *
 * A 1280x720 laptop leaves about 160px under a full-size masthead, and
 * the desktop compositions all want two rows of tile-plus-caption plus
 * something drawn between them. Forced in, the overflow guard lifted the
 * whole thing into the CTA buttons — which is the failure it exists to
 * prevent, arriving by a different route.
 *
 * So a short desktop takes the tablet's single captioned row instead. It
 * is a real fallback, chosen deliberately, rather than a composition
 * squeezed until something collides.
 */
function hasBand(b, vh) {
  return vh / 2 - 40 - (b.lockBottom + 26) >= 230;
}

/** Start a phone frame: the shared two-by-four, with a per-variant shape. */
function phoneBase(b, vw, vh, dir, opts) {
  const s = tileScale(vh, "phone");
  const g = phoneGrid(vw, vh, dir, b.lockBottom + 26, s, opts);
  return { g, s, size: TILE * s };
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
  if (b.tier === "tablet" || !hasBand(b, vh))
    return done(b, vw, vh, tabletRow(b, vw, vh, dir, {
    centre: (g, size) => ({ x: 0, y: g.tile(0).y - size / 2 - 24, w: g.labelW * 8, h: 2, k: 1, kind: "source" }),
    pulseDur: 6.4,
    }));
  if (b.isPortrait) {
    // The studio window will not fit above two columns of four on a phone
    // — 150px of window plus 366px of grid against 350px of band — so the
    // studio is present as what it DOES instead: filaments radiating from
    // a point just above the eight, and a pool of light there.
    const { g, s, size } = phoneBase(b, vw, vh, dir);
    return done(b, vw, vh, {
      tile: g.tile, tileSize: size, labelW: g.labelW, lastY: g.lastY, showDesc: g.showDesc,
      pulseAt: (i) => [0.34, 0.34, 0.12, 0.12, 0.58, 0.58, 0.8, 0.8][i],
      pulseDur: 6.4,
      centre: { x: 0, y: g.top - 26, w: g.colPitch * 2, h: 2, k: 1, kind: "source" },
    });
  }

  const s = tileScale(vh, b.tier);
  const size = TILE * s;
  const U = [-1, -0.62, 0.62, 1];
  const spread = Math.min(vw * (b.tier === "tablet" ? 0.36 : 0.4), 500);
  const inner = Math.abs(U[1]) * spread;

  const c = fit(b.lockBottom + 34, vh, STAGE_W, STAGE_H, (inner - size / 2 - 34) * 2);
  const sep = Math.max(c.h * 0.52, bandGap(size));
  const bandA = c.y - sep / 2;
  const bandB = c.y + sep / 2;

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
  const b = base(vw, vh, wordK);
  if (b.tier === "tablet" || !hasBand(b, vh))
    return done(b, vw, vh, tabletRow(b, vw, vh, dir, {
    rot: BUREAU_ROT,
    wave: (i) => (i % 2 === 0 ? -7 : 7),
    centre: (g, size) => ({ x: 0, y: g.tile(0).y, w: Math.min(vw * 0.94, 1200), h: size + 90, k: 1, kind: "sweep" }),
    pulseDur: 8,
    }));
  if (b.isPortrait) {
    // The desk, from above: the same eight, each set down at its own
    // angle. Rotation is the whole character of this variant and it costs
    // nothing on a phone, where a tilted studio window would not fit.
    const { g, s, size } = phoneBase(b, vw, vh, dir, {
      bow: [6, -8, 8, -6], rot: BUREAU_ROT,
    });
    return done(b, vw, vh, {
      tile: g.tile, tileSize: size, labelW: g.labelW, lastY: g.lastY, showDesc: g.showDesc,
      pulseAt: (i) => 0.06 + Math.floor(i / 2) * 0.24 + (i % 2) * 0.08,
      pulseDur: 8,
    });
  }

  const s = tileScale(vh, b.tier) * 0.94;
  const size = TILE * s;
  const U = [-1, -0.63, 0.63, 1];
  const spread = Math.min(vw * (b.tier === "tablet" ? 0.37 : 0.41), 520);
  const inner = Math.abs(U[1]) * spread;

  const c = fit(b.lockBottom + 40, vh, STAGE_W, STAGE_H, (inner - size / 2 - 30) * 2);
  const sep = Math.max(c.h * 0.56, bandGap(size));
  const bandA = c.y - sep / 2;
  const bandB = c.y + sep / 2;

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
  const b = base(vw, vh, wordK, { shift: -0.06 });
  if (b.tier === "tablet" || !hasBand(b, vh))
    return done(b, vw, vh, tabletRow(b, vw, vh, dir, {
    wave: (i) => -Math.round(Math.sin((i / 7) * Math.PI * 2) * 30),
    centre: (g, size, pts) => ({ x: 0, y: 0, w: vw, h: vh, k: 1, kind: "ribbonThread", points: pts }),
    pulseDur: 7,
    }));
  if (b.isPortrait) {
    // The wave, threaded down the screen: the ribbon is drawn THROUGH the
    // eight in reading order, left to right and back, so it still ties
    // them into one continuous thing. The path is handed to the centre as
    // points rather than re-derived there — the same reason the desktop
    // wave is sampled once.
    const { g, s, size } = phoneBase(b, vw, vh, dir, { bow: [-10, 6, 6, -10] });
    const pts = Array.from({ length: 8 }, (_, i) => {
      const t = g.tile(i);
      return [t.x, t.y];
    });
    return done(b, vw, vh, {
      tile: g.tile, tileSize: size, labelW: g.labelW, lastY: g.lastY, showDesc: g.showDesc,
      pulseAt: (i) => i / 7,
      pulseDur: 7,
      centre: { x: 0, y: 0, w: vw, h: vh, k: 1, kind: "ribbonThread", points: pts },
    });
  }

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
  const b = base(vw, vh, wordK);
  if (b.tier === "tablet" || !hasBand(b, vh))
    return done(b, vw, vh, tabletRow(b, vw, vh, dir, {
    wave: (i) => (i % 2 === 0 ? -20 : 20),
    centre: (g, size) => ({ x: 0, y: g.tile(0).y, w: Math.min(vw * 0.9, 1160), h: 2, k: 1, kind: "signal" }),
    pulseDur: 7,
    }));
  if (b.isPortrait) {
    // The line, run vertically down the gutter between the two columns,
    // with the eight stepping either side of it exactly as they step
    // either side of it on a desktop.
    const { g, s, size } = phoneBase(b, vw, vh, dir, { bow: [-6, -6, -6, -6] });
    return done(b, vw, vh, {
      tile: g.tile, tileSize: size, labelW: g.labelW, lastY: g.lastY, showDesc: g.showDesc,
      pulseAt: (i) => i / 7,
      pulseDur: 7,
      centre: { x: 0, y: g.midY, w: 2, h: g.height + 56, k: 1, kind: "signalV" },
    });
  }

  const s = tileScale(vh, b.tier) * 0.92;
  const size = TILE * s;
  const spread = Math.min(vw * (b.tier === "tablet" ? 0.38 : 0.43), 580);
  // Half this variant's modules caption ABOVE themselves, so the band has
  // to start a caption's height below the masthead, not flush against it
  // — "Proctored Papers" was landing on the trust line.
  const CAP = 58;
  const topY = b.lockBottom + 26 + CAP;
  // Half the vertical gap between an above-line module and a below-line
  // one. It has to clear a whole caption, not just the tile: at a flat 58
  // the caption hanging under an upper module reached the tile below it.
  const lift = Math.max(size / 2 + 26, Math.min(72, (vh / 2 - 36 - topY - size) / 2));
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
    // …and end one below it, for the same reason at the other edge: the
    // lower row's captions were reaching the cue line.
    lastY: lineY + lift + size / 2 + CAP,
  });
}

// ── 6 · MIHRAB ───────────────────────────────────────────────────────
// A monumental pointed arch rising around the masthead, with the eight
// modules set into its jambs, four to a side.
//
// They were on the arch's CURVE, following it up to the point. That
// worked while the masthead was scaled down to fit inside; at its real
// size the wordmark is 720px wide and the upper niches — where the arch
// narrows — landed on top of it. The jambs are the part of an arch that
// is vertical and full width, which is exactly where there is room
// beside a masthead, so that is where they go. Their captions hang
// outward for the same reason: the interior belongs to the masthead.
export function mihrab(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { shift: -0.045 });
  if (b.tier === "tablet" || !hasBand(b, vh))
    return done(b, vw, vh, tabletRow(b, vw, vh, dir, {
    centre: (g, size) => ({ x: 0, y: g.tile(0).y - 12, w: Math.min(vw * 0.6, 620), h: size + 190, k: 1, kind: "mihrab" }),
    pulseDur: 7.2,
    }));
  if (b.isPortrait) {
    // The arch behind, with the two columns hugging its jambs — the same
    // relationship the desktop composition has, at the only width a phone
    // can give it.
    const { g, s, size } = phoneBase(b, vw, vh, dir);
    const w = g.colPitch * 2 - size - 8;
    return done(b, vw, vh, {
      tile: g.tile, tileSize: size, labelW: g.labelW, lastY: g.lastY, showDesc: g.showDesc,
      pulseAt: (i) => 0.08 + Math.floor(i / 2) * 0.26,
      pulseDur: 7.2,
      centre: { x: 0, y: g.midY - 10, w, h: g.height + 96, k: 1, kind: "mihrab" },
    });
  }

  const s = tileScale(vh, b.tier) * 0.92;
  const size = TILE * s;

  // The arch is built AROUND the masthead rather than the masthead being
  // fitted into the arch.
  // The apex clears the masthead bar, and the foot goes all the way down
  // rather than stopping just under the masthead — cut short at
  // lockBottom + 72 the arch ended mid-screen with a third of the frame
  // empty beneath it, which reads as a crop rather than as a building.
  const top = -vh / 2 + Math.max(126, vh * 0.145);
  const bottom = vh / 2 - 42;
  const h = bottom - top;
  const lockW = 760 * wordK;
  const w = Math.min(vw * 0.62, Math.max(h * 0.72, lockW * 1.1));

  const colX = w / 2 + size / 2 + 18;
  const f0 = 0.3;
  const step = 0.19;

  return done(b, vw, vh, {
    tile: (i) => ({
      x: colX * (i % 2 === 0 ? -1 : 1) * dir,
      y: top + (f0 + Math.floor(i / 2) * step) * h,
      s,
    }),
    tileSize: size,
    // Light falls from the apex down both jambs at once, so the two
    // niches of a rank light together. Architecture is symmetrical; a
    // light running down one side and then the other would fight it.
    pulseAt: (i) => 0.08 + Math.floor(i / 2) * 0.26,
    pulseDur: 7.2,
    labelPlace: "outside",
    filaments: false,
    centre: { x: 0, y: top + h / 2, w, h, k: 1, kind: "mihrab" },
    lastY: top + (f0 + 3 * step) * h + size / 2,
  });
}

// ── 7 · KHATIM ───────────────────────────────────────────────────────
// The eight-pointed star — the khatim — with one module standing at each
// of its eight points.
//
// The star used to sit inside an arch with the masthead in its middle.
// It cannot: eight points spaced around a masthead 450px tall need about
// 700px of height, and a 900px window has 300 left once the masthead has
// had its own. So the rosette moved into the band below, where it has
// the width it needs and the modules still stand exactly on its points.
//
// The count is the argument either way: eight modules, eight points, so
// the arrangement is the content's own number made into a shape.
export function khatim(n, vw, vh, dir, wordK) {
  const b = base(vw, vh, wordK, { shift: -0.05 });
  if (b.tier === "tablet" || !hasBand(b, vh))
    return done(b, vw, vh, tabletRow(b, vw, vh, dir, {
    wave: (i) => -Math.round((1 - Math.abs((i - 3.5) / 3.5)) * 18),
    centre: (g, size) => ({ x: 0, y: g.tile(0).y - 6, w: Math.min(vw * 0.72, 780), h: size + 150, k: 1, kind: "khatim" }),
    pulseDur: 8.4,
    }));
  if (b.isPortrait) {
    // The rosette behind, with the rows bowed to its silhouette — widest
    // where the star is widest. Eight points on a 390px screen cannot
    // each carry a caption, so the star holds the eight rather than
    // standing them on its points.
    const { g, s, size } = phoneBase(b, vw, vh, dir, { bow: [-16, 12, 12, -16] });
    return done(b, vw, vh, {
      tile: g.tile, tileSize: size, labelW: g.labelW, lastY: g.lastY, showDesc: g.showDesc,
      pulseAt: (i) => [0, 0.875, 0.125, 0.75, 0.25, 0.625, 0.375, 0.5][i],
      pulseDur: 8.4,
      centre: { x: 0, y: g.midY, w: g.colPitch * 2 + size, h: g.height + 40, k: 1, kind: "khatim" },
    });
  }

  const s = tileScale(vh, b.tier) * 0.88;
  const size = TILE * s;

  const top = b.lockBottom + 20;
  const bottom = vh / 2 - 34;
  const ry = Math.max(84, Math.min(132, (bottom - top - size) / 2));
  const cy = top + size / 2 + ry;
  const rx = Math.min(vw * 0.34, 500);

  // Two squares at 45° to each other, both offset by 22.5° so no point
  // lands on the vertical axis. Reading order runs down the star by rows,
  // so the eight travel paths to the contents grid stay parallel.
  const ANG = [-112.5, -67.5, -157.5, -22.5, 157.5, 22.5, 112.5, 67.5];

  return done(b, vw, vh, {
    tile: (i) => {
      const a = (ANG[i] * Math.PI) / 180;
      return { x: Math.cos(a) * rx * dir, y: cy + Math.sin(a) * ry, s };
    },
    tileSize: size,
    // Round the star, clockwise from its top-left point — the order its
    // rotating trace passes them in.
    pulseAt: (i) => [0, 0.875, 0.125, 0.75, 0.25, 0.625, 0.375, 0.5][i],
    pulseDur: 8.4,
    labelPlace: "outside",
    filaments: false,
    centre: { x: 0, y: cy, w: rx * 2, h: ry * 2, k: 1, kind: "khatim" },
    lastY: cy + ry + size / 2,
  });
}
