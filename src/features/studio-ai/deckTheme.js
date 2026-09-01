// =====================================================================
// One theme, wherever a deck is shown
//
// A deck is themed in three places — the studio chat, the Presentations
// editor and the projector — and each had worked it out for itself, from
// a different seed and a different palette. The same deck came out teal
// in the chat and plum in the editor, which is not two themes, it is a
// bug with a colour.
//
// The tone and the palette live here, and all three read them.
// =====================================================================

/**
 * Six tones, drawn from the warm editorial range Murchid uses elsewhere.
 *
 * `field` is the page a teaching slide sits on and `accent` is the colour it
 * is titled and carded in; an opener is the accent used as the whole field,
 * which is what gives a deck its one strong page.
 */
export const DECK_TONES = [
  { key: "sage",   field: "#f3f1ea", card: "#e4e7dd", accent: "#5b7355", edge: "#c9d0bf" },
  { key: "clay",   field: "#f5efe9", card: "#eddfd3", accent: "#a2643f", edge: "#e0c9b4" },
  { key: "blue",   field: "#eef1f3", card: "#dde5ea", accent: "#4a6d84", edge: "#c2d2dc" },
  { key: "ochre",  field: "#f4f1e8", card: "#eae3cf", accent: "#8a7333", edge: "#ddd2ae" },
  { key: "teal",   field: "#eff2f1", card: "#dbe6e3", accent: "#16646c", edge: "#bcd4d1" },
  { key: "rust",   field: "#f5eeee", card: "#ecdcda", accent: "#95504c", edge: "#dfc2bf" },
];

/**
 * Which tone a deck is, from the deck itself.
 *
 * Seeded on the first slide's title because that is the one label every
 * caller has: the chat holds slides before the row exists, and the editor
 * holds the row. Stable across reloads, and different between decks.
 */
export function deckToneIndex(slides) {
  /**
   * The generator's own choice, when it made one.
   *
   * Hashing the title gave every deck a stable colour and an arbitrary one:
   * a Grade 2 phonics deck and a Grade 11 organic chemistry deck were as
   * likely to come out the same as different, and the palette the writer had
   * chosen for the subject was thrown away before anything drew it. Now it
   * picks — sage for biology, teal for water, rust for the youngest rooms —
   * and this reads what it picked.
   *
   * Any slide may carry it, though the format asks for the first; a deck
   * written before the field existed has none, and falls through to the hash
   * so that its colour never moves under a teacher who has seen it.
   */
  const named = slides?.find((s) => s?.theme)?.theme;
  if (named) {
    const at = DECK_TONES.findIndex((t) => t.key === String(named).toLowerCase());
    if (at >= 0) return at;
  }

  const seed = String(slides?.[0]?.title || "deck");
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % DECK_TONES.length;
}

export function deckTone(slides) {
  return DECK_TONES[deckToneIndex(slides)];
}

/** The layouts that are one thing on a colour field rather than a page of content. */
export const HERO_LAYOUTS = new Set(["title", "section", "question", "statement", "term", "stat"]);
