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
  const tier = tierOf(vw);
  const isPortrait = tier === "phone";
  const desk = opts.scale ?? 0.8;
  const scale = isPortrait
    ? opts.portraitScale ?? 0.86
    // A tablet runs the desktop composition, but the masthead gives up a
    // good deal more of it. At 1024x768 the vertical budget below the
    // masthead is about 300px for two bands of modules and their
    // captions, and at 0.92 the second band's captions ran off the
    // bottom of the pin.
    : tier === "tablet"
    ? desk * 0.82
    : desk;
  const shiftY = Math.round(
    vh * (isPortrait
      ? opts.portraitShift ?? -0.05
      : tier === "tablet"
      ? (opts.shift ?? -0.045) - 0.03
      : opts.shift ?? -0.045)
  );
  const lockS = scale * wordK;
  const top = -vh / 2 + vh * 0.15 + shiftY;
  return {
    tier,
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

/** Tiles give up size on a short window, and again on a narrow one. */
export function tileScale(vh, tier) {
  const byHeight = Math.min(1, Math.max(0.74, (vh - 520) / 380));
  if (tier === "phone") return 0.72;
  if (tier === "tablet") return byHeight * 0.8;
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
 * The phone arrangement every variant falls back to: two columns of
 * four, each module captioned with its name AND what it does.
 *
 * The previous version was four across, two down, with no captions at
 * all — the argument being that portrait names them again in the
 * contents list a beat later. That was wrong. The opening screen is
 * where a visitor decides whether to keep scrolling, and eight unlabelled
 * glyphs give them nothing to decide on; deferring the names to a beat
 * they may never reach is not a trade, it is a loss.
 *
 * So the captions stay and the CENTRE goes instead. On a phone the centre
 * piece was a 150px-tall crop that could carry one line of legible type;
 * eight named modules are worth more than that.
 */
export function portraitGrid(vw, vh, dir, topY, s) {
  const size = TILE * s;
  const cols = 2;
  const colPitch = Math.min(vw / cols - 12, 190);
  // Room for the tile plus a name that may wrap to two lines plus a
  // description — measured against "Subjects & Students", which is the
  // longest of the eight and the one that wraps first.
  const rowPitch = size + 54;
  const rows = 4;
  // 78px of bottom margin, not 26: the accessibility widget floats in the
  // bottom corner of every page, and the last row's caption was running
  // underneath it.
  const top = Math.min(
    topY + size / 2,
    vh / 2 - 78 - (rows - 1) * rowPitch - size / 2 - 34
  );
  return {
    tile: (i) => ({
      x: ((i % cols) - (cols - 1) / 2) * colPitch * dir,
      y: top + Math.floor(i / cols) * rowPitch,
      s,
    }),
    labelW: colPitch - 14,
    lastY: top + (rows - 1) * rowPitch + size / 2 + 34,
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
