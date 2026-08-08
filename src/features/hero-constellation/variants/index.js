// =====================================================================
// Stage-one variants — the registry
//
// Seven treatments of the landing's opening frame. Everything after the
// opening — the contents index, the walkthrough deck, and the whole rest
// of the page — is identical across all seven, so what is being compared
// here really is just the first screen.
//
// All seven rest their eight sources as captioned glass tiles; the type
// and card treatments were cut with the variants that used them.
//
// Every variant captions its sources with the module's NAME and
// what it DOES. Naming eight features without saying what any of them
// are is the failure the opening frame exists to avoid.
//
// Route numbering is stable: variants[i] is served at /preview{i+1}, and
// /preview lists them. Reordering this array renumbers the routes, so
// add to the end rather than inserting.
//
// 6 and 7 are one family: an arch with the masthead standing inside it,
// then the same arch given an eight-pointed star to hold the modules.
//
// Each variant also carries its own light — see pulseAt/pulseDur in its
// layout, and the matching motion on its centre piece.
// =====================================================================

import * as L from "./layouts";

export const VARIANTS = [
  {
    id: "atelier",
    name: "Atelier",
    line: "The studio window, flanked by its eight modules.",
    why: "Shows the actual product in the first frame. The safest of the seven and the hardest to get wrong.",
    layout: L.atelier,
    sourceKind: "tile",
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
    why: "The warmest of the seven. Perspective and irregular rotations make it feel handled rather than designed.",
    layout: L.bureau,
    sourceKind: "tile",
  },
  {
    id: "ribbon",
    name: "Ribbon",
    line: "One flowing line of light with the eight modules riding its wave.",
    why: "Carries the motif the rest of the landing runs on, and says the eight are one thing, not eight products.",
    layout: L.ribbon,
    sourceKind: "tile",
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
