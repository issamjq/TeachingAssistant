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
// The arrangement is two bands of four, not a ring. The bands ARE the
// two rows of the 4×2 contents grid, pushed under the lockup — so the
// morph reads as the constellation straightening into the index, and
// tile i never has to cross tile j to get home. A ring looked better
// standing still and turned into a knot the moment it moved.
//
// Within a band the four tiles are pushed OUTWARD (-1, -0.62, +0.62, +1
// of the spread) rather than spaced evenly. Evenly spaced, the two inner
// tiles of each band sat in the middle of the frame — which is where the
// studio stage lives. Biased out, the eight tiles frame the stage
// instead of covering it, and they still arrive at an evenly-spaced grid
// because the morph interpolates to indexLayout's positions, not to
// their own.
// =====================================================================

import { CARD_H, CARD_W } from "../hero-artifacts/indexLayout";
import { STAGE_H, STAGE_W } from "./StudioStage";

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
 *   stage:{x:number,y:number,w:number,h:number,k:number,compact:boolean},
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

  // Tiles give up a little size on a short window so the stage, the two
  // bands and their captions all still fit inside the pin.
  const tileS = isPortrait ? 0.7 : Math.min(1, Math.max(0.78, (vh - 520) / 380));
  const tileSize = TILE * tileS;
  const half = tileSize / 2;

  // Four per band, biased outward so the middle of the frame stays clear
  // for the stage. See the note at the top of this file.
  const U = [-1, -0.62, 0.62, 1];
  const cols = U.length;
  const spread = Math.min(vw * 0.4, 500);
  const innerX = Math.abs(U[1]) * spread;

  // ── the studio stage ─────────────────────────────────────────────
  // Sized by BOTH constraints and never by one: wide enough to be a
  // legible depiction, but narrow enough to clear the inner tiles, and
  // short enough to sit between the lockup and the bottom of the pin.
  const stageTopY = lockBottom + 34;
  const kByW = ((innerX - half - 34) * 2) / STAGE_W;
  const kByH = (vh / 2 - 34 - stageTopY) / STAGE_H;
  const stageK = Math.max(0.42, Math.min(1, kByW, kByH));
  const stageW = STAGE_W * stageK;
  const stageH = STAGE_H * stageK;

  // Bands sit either side of the stage's upper and lower thirds, so the
  // eight tiles read as a frame around it rather than as a list beneath.
  const stageY = stageTopY + stageH / 2;
  const bandA = stageY - stageH * 0.26;
  const bandB = stageY + stageH * 0.26;

  const band = (i) => ({
    x: U[i % cols] * spread * dir,
    y: (Math.floor(i / cols) === 0 ? bandA : bandB),
    s: tileS,
  });

  // ── portrait ─────────────────────────────────────────────────────
  // Four across, two down, below the stage, and NO captions.
  //
  // Two columns of four with a caption under each was the obvious
  // arrangement and it did not survive contact with a phone: eight rows
  // of tile-plus-caption need about 390px of the 844 available, which
  // forced the lockup down to a third of its size, and even then each
  // caption ran into the tile below it. Nothing is lost by dropping the
  // captions — portrait already names all eight, in full, in the
  // contents LIST a beat later (.atl-mlist).
  const pStageK = Math.min(0.82, (vw - 36) / STAGE_W);
  const pStageW = STAGE_W * pStageK;
  // Portrait renders the compact crop of the stage — see StudioStage.
  const pStageH = 150 * pStageK;
  const pStageY = lockBottom + 26 + pStageH / 2;
  const pCols = 4;
  const pColPitch = Math.min((vw - 40) / pCols, 96);
  const pRowPitch = tileSize + 21;
  const pTop = Math.min(
    pStageY + pStageH / 2 + 34 + half,
    vh / 2 - 34 - half - pRowPitch
  );
  const portraitBand = (i) => ({
    x: ((i % pCols) - (pCols - 1) / 2) * pColPitch * dir,
    y: pTop + Math.floor(i / pCols) * pRowPitch,
    s: tileS,
  });

  const tile = isPortrait ? portraitBand : band;
  const stage = isPortrait
    ? { x: 0, y: pStageY, w: pStageW, h: pStageH, k: pStageK, compact: true }
    : { x: 0, y: stageY, w: stageW, h: stageH, k: stageK, compact: false };

  // The cue line goes under the whole composition, clamped into the pin.
  // Where there is genuinely no room for it — a short laptop window, a
  // small phone — it is DROPPED rather than squeezed onto the tiles: the
  // line is a nicety, the tiles are the content.
  const lastTileY = (isPortrait ? pTop + pRowPitch : bandB) + half;
  const captionDrop = isPortrait ? 0 : 30;
  const cueFloor = Math.max(lastTileY + captionDrop + 34, stage.y + stage.h / 2 + 14);
  const cueY = Math.min(cueFloor, vh / 2 - 24);
  const showCue = cueFloor <= vh / 2 - 24;

  // A card starts life the size of the tile it is replacing, so the
  // cross-fade lands on matching silhouettes instead of a card popping
  // out of a much smaller square.
  const cardStartScale = (tileSize * 1.06) / CARD_W;

  return {
    tile,
    tileSize,
    /** Portrait names the modules in the contents list instead. */
    showLabels: !isPortrait,
    lockScale,
    lockShiftY,
    stage,
    cueY,
    showCue,
    cardStartScale,
    isPortrait,
  };
}

export { CARD_H, CARD_W };
