// =====================================================================
// Shared layout for the six-card contents index.
//
// Two sections draw this row: HeroAtelier resolves its title sequence
// into it, and ToolWalkthrough opens on it before collapsing the cards
// into a deck. The two are stacked 100vh sticky pins, so the handoff
// only reads as continuous if the last frame of one is pixel-identical
// to the first frame of the other. That is only reliable if both derive
// the positions from the same function — hence this module rather than
// the same arithmetic written twice.
//
// All coordinates are relative to the CENTRE of a 100vh pin, which is
// what both callers position against.
// =====================================================================

/** Natural card size. Everything here scales that box; it never reflows. */
export const CARD_W = 230;
export const CARD_H = 345;

const ROW_SCALE = 0.84; // card scale at the full design width
const ROW_PITCH = 210; // gap between card centres at the full width
const ROW_Y = 132; // row centre, just below the pin centre

const PORTRAIT_MAX = 560;
const G_COLS = 3;

export interface CardPos {
  x: number;
  y: number;
  s: number;
}

export interface IndexLayout {
  /** Settled position of card `i`. */
  pos: (i: number) => CardPos;
  /** Scale of a settled card. */
  scale: number;
  /** Type scale for the 01–06 labels, so they track the cards. */
  tocK: number;
  /** Uniform fit factor for standalone blocks (title, wordmark). */
  wordK: number;
  /** y of the bottom edge of the last row — anchor for anything below. */
  rowBottomY: number;
  /** y a bottom-anchored heading should sit at, above the first row. */
  headBottomY: number;
  isPortrait: boolean;
}

/**
 * @param n     number of cards (6)
 * @param vw    viewport width
 * @param dir   1 for LTR, -1 for RTL
 * @param isRTL affects only the wordK fit factor (مرشد is narrower)
 */
export function indexLayout(n: number, vw: number, dir: number, isRTL = false): IndexLayout {
  const mid = (n - 1) / 2;
  const rowW = ROW_PITCH * (n - 1) + CARD_W * ROW_SCALE;
  const k = Math.min(1, (vw - 48) / rowW);
  const pitch = ROW_PITCH * k;
  const rowScale = ROW_SCALE * k;
  const wordK = Math.min(1, (vw - 32) / (isRTL ? 440 : 720));

  // Phone portrait cannot fit six legible cards across, so the settled
  // arrangement reflows to 3×2 with roughly double-size cards.
  const isPortrait = vw < PORTRAIT_MAX;
  const gScale = Math.min(0.56, (vw - 40) / (G_COLS * CARD_W + (G_COLS - 1) * 16));
  const gColPitch = CARD_W * gScale + 16;
  const gRowPitch = CARD_H * gScale + 92; // card height + a roomy label band
  // Rows are derived, not assumed. This used to hard-code two rows, which
  // was right for six cards and silently wrong the moment there were eight.
  const gRows = Math.ceil(n / G_COLS);
  const gRow0Y = 150 - (gRowPitch * (gRows - 1)) / 2; // rows centred about y≈150

  const pos = (i: number): CardPos => {
    if (isPortrait) {
      const col = i % G_COLS;
      const row = Math.floor(i / G_COLS);
      return {
        x: (col - (G_COLS - 1) / 2) * gColPitch * dir,
        y: gRow0Y + row * gRowPitch,
        s: gScale,
      };
    }
    return { x: (i - mid) * pitch * dir, y: ROW_Y, s: rowScale };
  };

  const scale = isPortrait ? gScale : rowScale;
  const topY = isPortrait ? gRow0Y : ROW_Y;
  const bottomY = isPortrait ? gRow0Y + gRowPitch * (gRows - 1) : ROW_Y;

  return {
    pos,
    scale,
    // On portrait the labels read larger than the raw card scale, capped so
    // "PRESENTATIONS" still fits a card's width.
    tocK: isPortrait ? Math.min(0.85, gScale * 1.6) : k,
    wordK,
    rowBottomY: bottomY + (CARD_H * scale) / 2,
    headBottomY: topY - (CARD_H * scale) / 2 - (isPortrait ? 96 : 118),
    isPortrait,
  };
}

/**
 * Deck position of card `i` — the stacked formation the walkthrough uses.
 * `d` is the card's signed distance from the front of the deck.
 *
 * Shared for the same reason as the row: the walkthrough collapses the row
 * INTO this, so the end of that collapse must equal the deck's resting
 * state exactly or the first slot visibly snaps.
 */
export function deckPos(d: number, dir: number): CardPos & { rot: number; opacity: number } {
  const back = d >= 0;
  const m = Math.abs(d);
  return {
    x: (back ? 13 * d : -18 * m) * dir,
    y: back ? 16 * d : -62 * m,
    rot: (back ? 4.5 * d : -7 * m) * dir,
    s: back ? 1 - 0.055 * d : 1 - 0.06 * m,
    opacity: back ? Math.max(0, 1 - d * 0.26) : Math.max(0, 1 - m * 1.5),
  };
}

/**
 * Where the deck sits horizontally, relative to the pin centre.
 *
 * Mirrors the walkthrough's `deck | wire | detail` grid: a 1120px stage,
 * centred, whose first column is 300px wide. Computed rather than measured
 * so the hero can animate toward it without reading the other section's DOM.
 */
export function deckCenterX(vw: number, dir: number, narrow: boolean): number {
  if (narrow) return 0; // stacked layout — deck is centred
  const stage = Math.min(1120, vw - 128);
  return (-stage / 2 + 150) * dir;
}
