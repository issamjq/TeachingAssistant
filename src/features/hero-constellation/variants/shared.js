// =====================================================================
// Stage-one variants — shared layout kit
//
// Ten treatments of the landing's opening frame all hand off to the SAME
// two acts after it: the contents index, then the walkthrough deck. So a
// variant only has to answer three questions —
//
//   1. where do the eight sources rest before the morph?
//   2. what sits at the centre, if anything?
//   3. how big is the lockup, and where?
//
// Everything else — the morph, the index, the deck — is shared. What
// lives here is the arithmetic every variant needs to answer question 3
// and to lay out a phone, so ten files do not each re-derive it (and
// drift, which is how the first cut ended up reserving twice the lockup
// depth it needed on portrait).
//
// All coordinates are relative to the CENTRE of the 100vh pin, matching
// indexLayout — a source's start and its card's end live in one space,
// so the morph between them is a plain lerp.
// =====================================================================

import { CARD_W } from "../../hero-artifacts/indexLayout";

// Three tiers, not two. The first cut had one break at 560 and treated
// everything above it as a desktop scaled down, which put tablet-width
// windows through compositions authored for 1440 — captions overlapping
// their neighbours, centre pieces crowding the masthead. A tablet needs
// the variant's identity at a size it can actually hold, and a phone
// needs a different arrangement entirely.
export const PORTRAIT_MAX = 620;
const TABLET_MAX = 1080;

/** "phone" | "tablet" | "desktop" for a viewport width. */
export function tierOf(vw) {
  if (vw < PORTRAIT_MAX) return "phone";
  if (vw < TABLET_MAX) return "tablet";
  return "desktop";
}

/** Design size of a glyph tile at rest, in px. */
export const TILE = 78;

// Unscaled height of the masthead block — wordmark, meaning, tagline,
// CTA row, trust line — measured off the rendered page, not guessed.
//
// Two values because the wordmark is trimmed for stage one (see
// .lockCompact) and trimmed again under 620px, so the block is genuinely
// shorter on a phone. One number for both had the phone layouts
// reserving 40px of empty band under a masthead that had already ended.
const LOCK_H = 415;
const LOCK_H_PHONE = 380;
// A short phone — 740px and under, which is most of them once the browser
// chrome is counted — trims the wordmark again (see the paired media
// query in HeroConstellation.module.css). Without it the eight modules do
// not fit at ANY tile size: the band is 232px and needs 294.
const LOCK_H_PHONE_SHORT = 330;
const SHORT_PHONE_VH = 800;

/**
 * Lockup geometry and the viewport class every variant starts from.
 *
 * The subtlety worth knowing: the lockup is scaled by BOTH `scale` and
 * indexLayout's `wordK`, and the scale is applied about the element's
 * CENTRE (the default transform-origin), so its bottom edge moves by
 * half the shrinkage rather than all of it. `top + H * s` under-reads it
 * badly at small scales — which on a phone opened a dead band between
 * the lockup and everything below it.
 */
export function base(vw, vh, wordK, opts = {}) {
  const tier = tierOf(vw);
  const isPortrait = tier === "phone";

  // The masthead is NEVER scaled down by a variant. It renders at exactly
  // the size it does at "/" — wordK and nothing else.
  //
  // Every variant used to shrink it to buy room for its composition, from
  // 0.8 down to 0.58, and on the arch variants it was scaled to fit inside
  // the arch. That made the wordmark, the value line, both buttons and the
  // trust line smaller on the preview than on the real page — and the
  // buttons are the point of the screen. The composition gives way to the
  // masthead now, not the other way round: variants lay out in the band
  // BELOW it, which is why the tiers below exist.
  const scale = 1;
  const shiftY = Math.round(
    vh * (isPortrait
      ? opts.portraitShift ?? -0.05
      : tier === "tablet"
      ? (opts.shift ?? -0.045) - 0.02
      : opts.shift ?? -0.045)
  );
  const lockS = scale * wordK;

  // Lifting the masthead buys band for the composition below it, but on a
  // narrow window it must not rise into the editorial masthead bar. The
  // bar sits at clamp(80px, 11vh, 124px); the +46 is because Fraunces
  // with line-height 1 paints its ascenders ABOVE the line box, so
  // clearing the bar by the box alone still put the "M" through it.
  //
  // Only under 1200px. Wider than that the wordmark is centred well clear
  // of the bar's text, which sits at the inline start — clamping there
  // cost 40px of band to avoid a collision that cannot happen.
  const barBottom = Math.min(124, Math.max(80, vh * 0.11)) + 46;
  const rawTop = -vh / 2 + vh * 0.15 + shiftY;
  const top = vw < 1200 ? Math.max(-vh / 2 + barBottom, rawTop) : rawTop;
  const H = isPortrait
    ? (vh < SHORT_PHONE_VH ? LOCK_H_PHONE_SHORT : LOCK_H_PHONE)
    : LOCK_H;
  return {
    tier,
    isPortrait,
    wordK,
    lockScale: scale,
    // The EFFECTIVE shift, derived back out of the clamped top. Returning
    // the raw shift meant the clamp moved the layout's idea of where the
    // masthead was without moving the masthead itself.
    lockShiftY: top - (-vh / 2 + vh * 0.15),
    lockTop: top,
    lockBottom: top + (H * (1 + lockS)) / 2,
  };
}

/** Tiles give up size on a short window, and again on a narrow one. */
export function tileScale(vh, tier) {
  const byHeight = Math.min(1, Math.max(0.74, (vh - 520) / 380));
  // Smaller than before at both small tiers: a full-size masthead leaves
  // a tablet under 200px of band and a phone about 350px, and the tile
  // has to share that with a two-line caption.
  // Short phones give up tile size as well as masthead: both together are
  // what makes eight captioned modules fit under a full-size CTA.
  if (tier === "phone") return vh < SHORT_PHONE_VH ? 0.48 : 0.56;
  // A flat value, not a fraction of byHeight: multiplied out at 768 that
  // gave 0.40, i.e. a 31px tile, which is a bullet rather than an icon.
  if (tier === "tablet") return 0.6;
  return byHeight;
}

/**
 * A source starts life the size of the thing it is replacing, so the
 * cross-fade lands on matching silhouettes instead of a card popping out
 * of a much smaller square.
 */
export function cardStart(sourceW) {
  return (sourceW * 1.06) / CARD_W;
}

/**
 * The phone frame every variant composes inside.
 *
 * Two columns of four, and that is not a design choice — it is the only
 * arrangement a 390px screen has room for once each module carries its
 * name and what it does. A caption needs about 150px to set two lines
 * without hyphenating, so three columns is out; and eight rows of one
 * column is 560px of band on a screen that has about 350.
 *
 * What varies between variants is everything else: how far each row is
 * pushed out (`bow`), whether the tiles carry a rotation, and what is
 * drawn behind them. That is enough for a phone to read as the same
 * design as its desktop — an arch behind two columns hugging its jambs
 * is recognisably Mihrab, and a wave threaded through the eight is
 * recognisably Ribbon.
 *
 * @param bow per-row outward offset, indexed 0-3, in px
 */
export function phoneGrid(vw, vh, dir, topY, s, { bow = null, rot = null } = {}) {
  const size = TILE * s;
  const cols = 2;
  const colPitch = Math.min(vw / cols - 10, 192);
  const rows = 4;
  const bottom = vh / 2 - 70; // clear of the floating accessibility widget

  // Does a two-line caption fit? Four rows of tile-plus-name-plus-
  // description need about 366px, and a 740px-tall phone has 258 once a
  // full-size masthead has had its share. Forced in anyway, the grid was
  // lifted by the overflow guard straight into the CTA buttons — captions
  // sitting on "Try the studio" is worse than captions without their
  // second line, so on a short phone the description goes.
  const withDesc = 3 * (size + 46) + size + 52 <= bottom - topY;
  const capH = withDesc ? 52 : 28;
  const rowPitch = size + (withDesc ? 46 : 30);

  const top = Math.min(topY + size / 2, bottom - (rows - 1) * rowPitch - size / 2 - capH);

  // The caption box is bounded by how close the two columns ever come,
  // not by the column pitch. A row pulled inward by `bow` brings its two
  // captions together, and at a fixed width they overlapped in the middle
  // — on three of the seven, at every phone size.
  const minHalf = Math.min(...Array.from({ length: rows }, (_, r) => colPitch / 2 + (bow ? bow[r] : 0)));
  const labelW = Math.max(96, Math.min(colPitch - 16, minHalf * 2 - 14));

  const tile = (i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const side = col === 0 ? -1 : 1;
    return {
      x: (colPitch / 2 + (bow ? bow[row] : 0)) * side * dir,
      y: top + row * rowPitch,
      s,
      rot: rot ? rot[i] * dir : 0,
    };
  };
  return {
    tile,
    size,
    colPitch,
    rowPitch,
    top,
    showDesc: withDesc,
    /** Centre of the eight-tile block, for anything drawn behind it. */
    midY: top + (rowPitch * (rows - 1)) / 2,
    height: rowPitch * (rows - 1) + size,
    labelW,
    lastY: top + (rows - 1) * rowPitch + size / 2 + capH - 18,
  };
}

/**
 * Where the cue line goes, and whether there is room for it at all.
 *
 * Squeezed onto the tiles it reads as a collision, so on a short laptop
 * window or a small phone it is DROPPED instead: the line is a nicety,
 * the eight modules are the content.
 */
export function cue(vh, lastY, floorY = -Infinity) {
  const wanted = Math.max(lastY + 34, floorY);
  return { cueY: Math.min(wanted, vh / 2 - 24), showCue: wanted <= vh / 2 - 24 };
}

/** Clamp a centre block so it can never leave the pin. */
export function fit(topY, vh, designW, designH, maxW, minK = 0.42) {
  const kByW = maxW / designW;
  const kByH = (vh / 2 - 34 - topY) / designH;
  const k = Math.max(minK, Math.min(1, kByW, kByH));
  return { k, w: designW * k, h: designH * k, y: topY + (designH * k) / 2 };
}

/**
 * The tablet arrangement: one row of eight, captioned, under the
 * masthead.
 *
 * A tablet at 1024x768 has about 190px between a full-size masthead and
 * the bottom of the pin. That is one row of tile-plus-caption and no
 * more — two rows do not fit at any tile size worth reading, and the
 * desktop compositions all assume two. One row of eight at 1024 gives
 * each module a 120px column, which a 48px tile and a wrapped caption
 * sit inside comfortably.
 */
export function rowOf8(vw, vh, dir, topY, s) {
  const size = TILE * s;
  const pitch = Math.min((vw - 32) / 8, 150);
  // A caption in a 120px column wraps its name to two lines and adds a
  // description under that — about 54px, not the 34 a one-line caption
  // needs. Budgeted at 34, the cue line landed on top of them.
  const capH = 54;
  const y = Math.min(topY + size / 2, vh / 2 - 54 - size / 2 - capH);
  return {
    tile: (i) => ({ x: (i - 3.5) * pitch * dir, y, s }),
    labelW: pitch - 8,
    lastY: y + size / 2 + capH,
  };
}
