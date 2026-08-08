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

/** Below this width the pin is laid out as a phone, not a scaled desktop. */
export const PORTRAIT_MAX = 560;

/** Design size of a glyph tile at rest, in px. */
export const TILE = 78;

// Unscaled design height of the lockup block — wordmark, meaning,
// tagline, CTA row, trust line. Measured from the rendered page rather
// than guessed, and deliberately a touch generous.
const LOCK_H = 450;

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
  const isPortrait = vw < PORTRAIT_MAX;
  const scale = isPortrait
    ? opts.portraitScale ?? 0.92
    : opts.scale ?? 0.8;
  const shiftY = Math.round(vh * (isPortrait ? opts.portraitShift ?? -0.045 : opts.shift ?? -0.045));
  const lockS = scale * wordK;
  const top = -vh / 2 + vh * 0.15 + shiftY;
  return {
    isPortrait,
    // Carried through so a variant that sizes the masthead against
    // something of its own (the arch variants) can divide it back out —
    // the hero multiplies lockScale and wordK together.
    wordK,
    lockScale: scale,
    lockShiftY: shiftY,
    lockTop: top,
    lockBottom: top + (LOCK_H * (1 + lockS)) / 2,
  };
}

/** Tiles give up a little size on a short window so everything still fits. */
export function tileScale(vh, isPortrait) {
  return isPortrait ? 0.7 : Math.min(1, Math.max(0.78, (vh - 520) / 380));
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
 * The phone arrangement every variant falls back to: four across, two
 * down, below whatever the centre is, and no captions.
 *
 * Two columns of four with a caption under each was the obvious answer
 * and it did not survive contact with a phone — eight rows of
 * tile-plus-caption need about 390px of the 844 available, which forced
 * the lockup down to a third of its size, and even then each caption ran
 * into the tile below it. Nothing is lost by dropping the captions:
 * portrait already names all eight, in full, in the contents LIST a beat
 * later (.atl-mlist).
 */
export function portraitGrid(vw, vh, dir, topY, s) {
  const size = TILE * s;
  const cols = 4;
  const colPitch = Math.min((vw - 40) / cols, 96);
  const rowPitch = size + 21;
  const top = Math.min(topY + size / 2, vh / 2 - 34 - size / 2 - rowPitch);
  return {
    tile: (i) => ({
      x: ((i % cols) - (cols - 1) / 2) * colPitch * dir,
      y: top + Math.floor(i / cols) * rowPitch,
      s,
    }),
    lastY: top + rowPitch + size / 2,
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
