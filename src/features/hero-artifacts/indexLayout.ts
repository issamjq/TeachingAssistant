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
export function indexLayout(
  n: number, vw: number, vh: number, dir: number, isRTL = false
): IndexLayout {
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

  // ── landscape arrangements ───────────────────────────────────────
  // Four across, two down.
  //
  // Eight in a single row was a wall of small identical rectangles: pitch
  // limited them to 0.70 scale across the full viewport width, which read
  // as a spec sheet rather than a contents page. A staggered variant was
  // worse still — offsetting alternate rows put each label against its
  // neighbour's card, so it read as misaligned rather than hand-placed.
  // The grid takes half the width and lands the cards LARGER, at 0.72.
  const G2_COLS = 4;
  const G2_ROWS = Math.ceil(n / G2_COLS);
  // Height is the binding constraint, so the label band is compact: the
  // number sits inline with the name rather than stacked above it, which
  // buys ~26px a row and takes the cards from 0.63 to ~0.74 — bigger than
  // the single row managed, in half the width.
  const G2_LABEL = 46; // gap between a card's top and the label above it
  const G2_LABEL_H = 48; // the label's own two lines
  const G2_GAP_X = 40;
  const G2_GAP_Y = 34; // row 2's labels sat 14px off row 1's cards at 16
  // Both derived from the viewport, not fixed pixels. A hard 625/-215 was
  // tuned on a 900pt window and pushed the second row 60px past the bottom
  // of a 700pt one — the pin clips, so the last four cards were simply cut.
  const g2TopAbs = Math.max(196, vh * 0.26); // clears nav + heading
  const g2BotGap = Math.max(48, vh * 0.07);
  const G2_AVAIL = vh - g2TopAbs - g2BotGap;
  const G2_TOP = g2TopAbs - vh / 2; // block top, relative to the pin centre
  const g2ByW = (vw - 96 - (G2_COLS - 1) * G2_GAP_X) / (G2_COLS * CARD_W);
  // Solved from the block height rather than a per-row budget:
  //   rows·CARD_H·s + (rows−1)(LABEL+GAP_Y) + LABEL_H ≤ AVAIL
  const g2ByH =
    (G2_AVAIL - (G2_ROWS - 1) * (G2_LABEL + G2_GAP_Y) - G2_LABEL_H) / (G2_ROWS * CARD_H);
  const g2Scale = Math.max(0.4, Math.min(0.78, g2ByW, g2ByH));
  const g2ColPitch = CARD_W * g2Scale + G2_GAP_X;
  const g2RowPitch = CARD_H * g2Scale + G2_LABEL + G2_GAP_Y;
  // Anchored to the top of the available band, not centred on an arbitrary
  // y — centring pushed the second row past the bottom of the pin as the
  // cards grew.
  const g2Row0Y = G2_TOP + G2_LABEL_H + (CARD_H * g2Scale) / 2;
  const grid2 = (i: number): CardPos => ({
    x: ((i % G2_COLS) - (G2_COLS - 1) / 2) * g2ColPitch * dir,
    y: g2Row0Y + Math.floor(i / G2_COLS) * g2RowPitch,
    s: g2Scale,
  });

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
    return grid2(i);
  };

  const scale = isPortrait ? gScale : g2Scale;
  const topY = isPortrait ? gRow0Y : g2Row0Y;
  const bottomY = isPortrait
    ? gRow0Y + gRowPitch * (gRows - 1)
    : g2Row0Y + g2RowPitch * (G2_ROWS - 1);

  return {
    pos,
    scale,
    // On portrait the labels read larger than the raw card scale, capped so
    // "PRESENTATIONS" still fits a card's width.
    tocK: isPortrait ? Math.min(0.85, gScale * 1.6) : Math.min(1, g2Scale * 1.25),
    wordK,
    rowBottomY: bottomY + (CARD_H * scale) / 2,
    // The grid sits higher than a single row did, so its heading needs a
    // tighter gap or it collides with the nav.
    headBottomY:
      topY - (CARD_H * scale) / 2 - (isPortrait ? 96 : 88),
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
