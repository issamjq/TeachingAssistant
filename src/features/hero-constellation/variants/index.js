// =====================================================================
// Stage-one variants — the registry
//
// Twelve treatments of the landing's opening frame. Everything after the
// opening — the contents index, the walkthrough deck, and the whole rest
// of the page — is identical across all twelve, so what is being compared
// here really is just the first screen.
//
// `sourceKind` decides what the eight things look like at rest:
//
//   tile   a glass square with a line glyph, captioned
//   type   a numbered row set in Fraunces — the row IS the label
//   card   the real card face, already itself; no cross-fade needed,
//          the morph is pure position and scale
//
// Route numbering is stable: variants[i] is served at /preview{i+1}, and
// /preview lists them. Reordering this array renumbers the routes, so
// add to the end rather than inserting.
//
// 10-12 are one family: an arch, then the arch made literal as an
// arcade, then the arch given a star to hold the modules.
// =====================================================================

import * as L from "./layouts";

export const VARIANTS = [
  {
    id: "atelier",
    name: "Atelier",
    line: "The studio window, flanked by its eight modules.",
    why: "Shows the actual product in the first frame. The safest of the ten and the hardest to get wrong.",
    layout: L.atelier,
    sourceKind: "tile",
  },
  {
    id: "cover",
    name: "Cover",
    line: "A magazine cover: one specimen plate, a numbered contents column.",
    why: "Reads as a considered publication before a word is read. Strongest editorial signal of the set.",
    layout: L.cover,
    sourceKind: "type",
  },
  {
    id: "aperture",
    name: "Aperture",
    line: "A shallow arc of stage light with the modules standing on it.",
    why: "Cinematic and calm. Geometry only, so nothing in it can date or render badly.",
    layout: L.aperture,
    sourceKind: "tile",
  },
  {
    id: "bureau",
    name: "Bureau",
    line: "The desk from above — the studio laid back, objects set around it.",
    why: "The warmest of the ten. Perspective and irregular rotations make it feel handled rather than designed.",
    layout: L.bureau,
    sourceKind: "tile",
  },
  {
    id: "spread",
    name: "Spread",
    line: "A magazine spread: masthead left, studio right, modules down the gutter.",
    why: "The only asymmetric one. Closest to a real editorial page, and the most confident.",
    layout: L.spread,
    sourceKind: "tile",
  },
  {
    id: "index",
    name: "Index",
    line: "No imagery at all — the eight modules set large as a contents poster.",
    why: "Pure typography on a page whose identity is typography. Reads across a room; nothing to date.",
    layout: L.index,
    sourceKind: "type",
  },
  {
    id: "orbit",
    name: "Orbit",
    line: "Two faint rings with the modules standing on the outer one.",
    why: "Says 'one studio, everything in it' geometrically, without a word of explanation.",
    layout: L.orbit,
    sourceKind: "tile",
  },
  {
    id: "shingle",
    name: "Shingle",
    line: "The eight cards themselves, overlapped so every title strip reads.",
    why: "What the original fan was reaching for. No cross-fade at all — the morph is pure position and scale.",
    layout: L.shingle,
    sourceKind: "card",
  },
  {
    id: "signal",
    name: "Signal",
    line: "One luminous line with the modules stepping above and below it.",
    why: "The most graphic and the most modern. Carries the light-ribbon motif the rest of the page already uses.",
    layout: L.signal,
    sourceKind: "tile",
  },
  {
    id: "mihrab",
    name: "Mihrab",
    line: "A monumental arch with the whole masthead inside it, modules set into its outline.",
    why: "Draws on where this product actually is. Struck as geometry, so it stays architecture rather than becoming ornament.",
    layout: L.mihrab,
    sourceKind: "tile",
  },
  {
    id: "colonnade",
    name: "Colonnade",
    line: "An arcade of eight arches — one per module — with the masthead above.",
    why: "Mihrab taken literally: eight modules, eight arches. A facade says 'institution' faster than any copy can.",
    layout: L.colonnade,
    sourceKind: "tile",
  },
  {
    id: "khatim",
    name: "Khatim",
    line: "An eight-pointed star inside the arch, a module standing at each point.",
    why: "The count is the argument — eight modules, eight points. The arrangement is the content's own number made into a shape.",
    layout: L.khatim,
    sourceKind: "tile",
  },
];

/** Route path for variant index i (0-based). */
export const pathFor = (i) => `/preview${i + 1}`;

export function variantById(id) {
  return VARIANTS.find((v) => v.id === id) || VARIANTS[0];
}
