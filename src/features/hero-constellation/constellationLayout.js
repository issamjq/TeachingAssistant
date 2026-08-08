// =====================================================================
// Hero constellation — opening-frame layout
//
// Where the eight glyph tiles sit BEFORE they become cards, and where
// the studio plate sits behind them. Every coordinate is relative to the
// centre of the 100vh pin, which is the same frame indexLayout() uses —
// so a tile's start and its card's end are expressed in one space and
// the morph between them is a plain lerp.
//
// Why a layout module rather than inline arithmetic: the tiles, the
// connector filaments and the cards all have to agree on these numbers
// to the pixel. Two of the three drawing it themselves is how you get a
// filament pointing at nothing.
//
// The arrangement is two bowed bands of four, not a ring. The bands ARE
// the two rows of the 4×2 contents grid, bowed apart and pushed under
// the lockup — so the morph reads as the constellation straightening
// into the index, and tile i never has to cross tile j to get home. A
// ring looked better standing still and turned into a knot the moment
// it moved.
// =====================================================================

import { CARD_H, CARD_W } from "../hero-artifacts/indexLayout";

/** Design size of a glyph tile at rest, in px. */
export const TILE = 78;

const PORTRAIT_MAX = 560;

/**
 * @param n     number of modules (8)
 * @param vw    viewport width
 * @param vh    viewport height
 * @param dir   1 for LTR, -1 for RTL
 * @param wordK indexLayout's uniform fit factor — the lockup is scaled by
 *              BOTH this and lockScale, so the depth estimate below has to
 *              account for both or it reserves twice the room it needs
 * @returns {{
 *   tile:(i:number)=>{x:number,y:number,s:number},
 *   tileSize:number,
 *   lockScale:number,
 *   lockShiftY:number,
 *   plate:{x:number,y:number,w:number,h:number},
 *   cardStartScale:number,
 *   isPortrait:boolean,
 * }}
 */
export function constellationLayout(n, vw, vh, dir, wordK = 1) {
  const isPortrait = vw < PORTRAIT_MAX;

  // The opening frame has to hold the masthead lockup AND the scene, so
  // the lockup gives up some size here that it gets back nowhere else —
  // it is the one frame where the visual is the message and the wordmark
  // is the caption. Shrink and lift, then let lockOut carry it away.
  const lockScale = isPortrait ? 0.92 : 0.8;
  const lockShiftY = -Math.round(vh * 0.045);

  // Where the lockup's bottom edge lands.
  //
  // Two things make this less obvious than it looks. The lockup is scaled
  // by BOTH lockScale and wordK, and the scale is applied about the
  // element's CENTRE (the default transform-origin), so the bottom edge
  // moves by half the shrinkage rather than all of it — the naive
  // `top + H * s` under-reads it badly at small scales. Getting either
  // wrong is visible immediately: too shallow and the upper band sits on
  // the CTA buttons, too deep and a dead band opens between the lockup
  // and the scene.
  //
  // H is the block's unscaled design height — wordmark, meaning, tagline,
  // CTA row, trust line — measured from the rendered page rather than
  // guessed, and deliberately a touch generous.
  const LOCK_H = 450;
  const lockS = lockScale * wordK;
  const lockTop = -vh / 2 + vh * 0.15 + lockShiftY;
  const lockBottom = lockTop + (LOCK_H * (1 + lockS)) / 2;

  const half = TILE / 2;
  // Bands are bounded by the pin, never by a fixed offset: on a short
  // window a fixed step put the lower band's tiles through the bottom
  // edge, where the pin clips them.
  const bandA = Math.min(lockBottom + 40, vh / 2 - half - 176);
  const bandB = Math.min(bandA + 164, vh / 2 - half - 22);

  const spread = Math.min(vw * 0.4, 500);
  // The upper band DIPS in the middle rather than bowing up. Bowed up, its
  // two centre tiles rose into the CTA row — the one part of the frame
  // that must never be crowded — while its outer tiles wasted the clear
  // margin either side of the wordmark. Dipped, the band cradles the
  // lockup: outer tiles sit up beside the tagline, centre tiles hang below
  // the buttons. The lower band keeps a gentle dip so the two together
  // still read as a curve around the scene rather than as a table.
  const bowA = 54;
  const bowB = 20;

  const cols = 4;
  const band = (i) => {
    const row = Math.floor(i / cols); // 0 = upper band, 1 = lower band
    const u = ((i % cols) - (cols - 1) / 2) / ((cols - 1) / 2); // -1 → 1
    const bow = (row === 0 ? bowA : bowB) * (1 - u * u);
    return { x: u * spread * dir, y: (row === 0 ? bandA : bandB) + bow, s: 1 };
  };

  // Portrait: four across, two down, and NO captions.
  //
  // Two columns of four with a caption under each was the obvious
  // arrangement and it did not survive contact with a phone. Eight rows
  // of tile-plus-caption need about 390px of the 844 available, which
  // forced the lockup down to a third of its size — a hero whose brand
  // mark is smaller than its icons — and even then each caption ran into
  // the tile below it.
  //
  // A phone gets the tiles as a compact plate of eight instead. Nothing
  // is lost by dropping the captions here: portrait already names all
  // eight, in full, in the contents LIST a beat later (.atl-mlist), so
  // the caption was the one element paying for itself twice.
  const pCols = 4;
  const pTileS = 0.78;
  const pTileH = TILE * pTileS;
  const pColPitch = Math.min((vw - 40) / pCols, 96);
  // The two rows are CENTRED in the band between the lockup and the cue
  // rather than stacked from the top of it. Top-stacked, they left a
  // third of a phone screen empty below the composition, which reads as
  // the page having ended early.
  const pBandTop = lockBottom + 34;
  const pBandBottom = vh / 2 - 78;
  const pRowPitch = Math.max(pTileH + 24, Math.min(122, pBandBottom - pBandTop - pTileH));
  const pTop = pBandTop + Math.max(0, (pBandBottom - pBandTop - (pRowPitch + pTileH)) / 2) + pTileH / 2;
  const portraitBand = (i) => ({
    x: ((i % pCols) - (pCols - 1) / 2) * pColPitch * dir,
    y: pTop + Math.floor(i / pCols) * pRowPitch,
    s: pTileS,
  });

  const tile = isPortrait ? portraitBand : band;

  // The plate sits behind the bands and is sized to them, so the scene
  // and the tiles stay one composition at any window size. Height is a
  // constraint as much as width: sized on width alone, the scene ran off
  // the bottom of a short window, where the pin clips it.
  const PLATE_AR = 340 / 900;
  const plateW = Math.min(vw * 0.86, 940, (vh * 0.46) / PLATE_AR);
  const plateH = plateW * PLATE_AR;

  // Centred between the bands, the plate put its tallest element — the
  // teacher's head — directly under the upper band, so four tiles sat on
  // her face. The scene is dropped so that its top edge clears the upper
  // band and the teacher reads in the open drench BETWEEN the two bands;
  // the lower band then floats over the desk and floor, which is where
  // overlap is wanted. Clamped so the plate can never leave the pin.
  const plateY = isPortrait
    ? pTop + pRowPitch / 2
    : Math.min(bandB - plateH * 0.06, vh / 2 - plateH / 2 - 6);

  // The cue line sits under the whole composition, and is CLAMPED into
  // the pin rather than hung off the plate: derived from the plate alone
  // it fell either off the bottom of a short window or, on a phone,
  // straight through the middle of the tile grid.
  const lastTileY = isPortrait ? pTop + pRowPitch + (pTileH - TILE) / 2 : bandB + bowB;
  const cueY = Math.min(
    Math.max(lastTileY + half + (isPortrait ? 34 : 52), plateY + plateH / 2 + 6),
    vh / 2 - 26
  );

  // A card starts life the size of the tile it is replacing, so the
  // cross-fade lands on matching silhouettes instead of a card popping
  // out of a much smaller square.
  const cardStartScale = (TILE * (isPortrait ? pTileS : 1) * 1.06) / CARD_W;

  return {
    tile,
    tileSize: TILE * (isPortrait ? pTileS : 1),
    /** Portrait names the modules in the contents list instead. */
    showLabels: !isPortrait,
    lockScale,
    lockShiftY,
    plate: { x: 0, y: plateY, w: plateW, h: plateH },
    cueY,
    cardStartScale,
    isPortrait,
  };
}

export { CARD_H, CARD_W };
