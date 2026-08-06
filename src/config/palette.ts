// Brand palette selection.
//
// Two palettes ship. Firozeh & Plaster is the default; Verdigris & Bone is
// the alternate. The choice is a DEVICE preference applied everywhere,
// including the logged-out landing page — signing in is only where the
// control lives, so a returning teacher never sees the palette change under
// them at login.
//
// The values live on <html data-palette="…">; the CSS side is the palette
// layer at the top of app/globals.css.

import { readStorage, writeStorage } from "@/shared/lib/storage";

export const PALETTES = ["firozeh", "verdigris"] as const;
export type Palette = (typeof PALETTES)[number];

export const DEFAULT_PALETTE: Palette = "firozeh";

/** Kept in sync with the inline script in app/layout.tsx. */
export const PALETTE_STORAGE_KEY = "murchid.palette";

export interface PaletteMeta {
  id: Palette;
  name: string;
  /** What the palette is drawn from — shown in the picker. */
  origin: string;
  /** Swatches for the picker preview: [paper, line, accent]. */
  swatches: [string, string, string];
}

export const PALETTE_META: Record<Palette, PaletteMeta> = {
  firozeh: {
    id: "firozeh",
    name: "Firozeh & Plaster",
    origin: "Turquoise from tilework and dome glaze, on cool lime plaster.",
    swatches: ["#e8e7e2", "#cdcdc6", "#16646c"],
  },
  verdigris: {
    id: "verdigris",
    name: "Verdigris & Bone",
    origin: "The patina of aged bronze, on bone. Quieter and more archival.",
    swatches: ["#edeae1", "#d5d0c4", "#3c6b60"],
  },
};

export const isPalette = (v: unknown): v is Palette =>
  typeof v === "string" && (PALETTES as readonly string[]).includes(v);

export function getPalette(): Palette {
  const v = readStorage(PALETTE_STORAGE_KEY);
  return isPalette(v) ? v : DEFAULT_PALETTE;
}

type PaletteListener = (p: Palette) => void;
const listeners = new Set<PaletteListener>();

export function setPalette(p: Palette): void {
  if (!isPalette(p)) return;
  writeStorage(PALETTE_STORAGE_KEY, p);
  applyPalette(p);
  listeners.forEach((fn) => fn(p));
}

export function onPaletteChange(fn: PaletteListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Stamp the palette onto <html>.
 *
 * The default is written as an explicit attribute rather than left absent.
 * An absent attribute and `data-palette="firozeh"` style identically, but
 * being explicit means the DOM always states which palette is active —
 * which is what makes the state debuggable and testable.
 */
export function applyPalette(p: Palette): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.palette = p;
}
