// The ten studio designs, and where each one lives.
//
// One list, read by the chooser at /preview and by nothing else. Adding
// a design means adding a row here and a route folder — the chooser
// picks it up without being edited.

export type VariantId =
  | "atelier" | "canvas" | "aurora" | "nova" | "slate"
  | "desk" | "focus" | "ribbon" | "terrace" | "prism";

export type VariantMeta = {
  id: VariantId;
  name: string;
  /** One line on the chooser card — what it IS. */
  line: string;
  /** What it is good at, and what it costs you. */
  why: string;
  /** The structural move that makes it different from the other nine. */
  shape: string;
  mood: string;
  /** Two swatches for the chooser card, as CSS colours. */
  swatch: [string, string];
};

export const VARIANTS: VariantMeta[] = [
  {
    id: "atelier",
    name: "Atelier",
    line: "The studio as a printed journal — one column, wide margins, plates.",
    why: "Best reading experience of the ten. Every outcome is set like a page in a book, with the teacher's notes in the margin where a proof-reader would put them. Slowest to scan if you only want a number.",
    shape: "Single measure with a live margin rail",
    mood: "Editorial · warm paper · serif",
    swatch: ["#e8e7e2", "#16646c"],
  },
  {
    id: "canvas",
    name: "Canvas",
    line: "Chat on the left, a permanent working canvas on the right.",
    why: "The one that scales to a long session. The conversation never pushes the deck off screen, and switching between the three outcomes is a tab, not a scroll. Costs you a column — four of them at once is a lot of chrome.",
    shape: "Two panes, tabbed canvas",
    mood: "Modern product · crisp · confident",
    swatch: ["#f4f3ef", "#16646c"],
  },
  {
    id: "aurora",
    name: "Aurora",
    line: "Dark, lit from behind. Glass over a slow indigo-and-mint field.",
    why: "The showpiece, recoloured: the first cut ran teal light over a teal ground and went muddy, so the ground is now true slate with no green in it and the light travels indigo → violet → mint. Presents beautifully; the most expensive to keep legible.",
    shape: "Floating glass over an ambient ground",
    mood: "Cinematic · dark · luminous",
    swatch: ["#07080f", "#6ee7d0"],
  },
  {
    id: "nova",
    name: "Nova",
    line: "Gradient banner, elevated cards, a colour per kind, a button on every card.",
    why: "The one that looks most like software people already pay for. A deck and a quiz can never be confused at a glance, and every card ends in the action you would take next. The busiest of the light designs.",
    shape: "Result banner over an outcome grid",
    mood: "Product · vivid · actionable",
    swatch: ["#5b4bdb", "#10b3a3"],
  },
  {
    id: "slate",
    name: "Slate",
    line: "Flat charcoal, hairline borders, one lime accent used only where something is true.",
    why: "Dark without the theatre — no glow, no blur, no gradient. A segmented switch shows one outcome at full width, which is the calmest way to read a long lesson plan. The one you would still want at 4pm on a Thursday.",
    shape: "Segmented switch over one full-width pane",
    mood: "Pro app · restrained · dark",
    swatch: ["#0c0d0f", "#a8e05f"],
  },
  {
    id: "desk",
    name: "Desk",
    line: "Things on a table. Photo prints, index cards, a clipped paper.",
    why: "The most human of the ten and the one teachers recognise fastest — a deck looks like a strip of prints, a quiz looks like a marked paper. The tilt and shadow cost a little precision.",
    shape: "Layered objects on a surface",
    mood: "Tactile · warm · analogue",
    swatch: ["#cbc5b6", "#a0453c"],
  },
  {
    id: "focus",
    name: "Focus",
    line: "Almost nothing. Type, rules, air, and one accent used four times.",
    why: "The quietest, and the only one that never competes with what it is showing. Runs the sidebar as icons only, because thirteen labels is thirteen more words than its argument allows. Least to grab hold of if you scan rather than read.",
    shape: "One measure, no containers, icon rail",
    mood: "Minimal · typographic · calm",
    swatch: ["#f4f3ef", "#101718"],
  },
  {
    id: "ribbon",
    name: "Ribbon",
    line: "The deck runs sideways — four slides legible at once, not one.",
    why: "The only one that lets you check a deck the way you actually do: by scanning its whole shape rather than clicking through it. Plan and check run as two newspaper columns underneath. Needs width to be worth it.",
    shape: "Horizontal scroll-snap ribbon + two columns",
    mood: "Cinematic · wide · editorial",
    swatch: ["#f2efe7", "#c8502a"],
  },
  {
    id: "terrace",
    name: "Terrace",
    line: "A warm gradient, deep soft cards, and the session read as a morning.",
    why: "The softest of the ten and the one aimed at how the work feels. Everything is one spine top to bottom — you asked, it read, it made, here is the class it is for. The least efficient, and the most pleasant.",
    shape: "Vertical timeline, one spine",
    mood: "Warm · rounded · friendly",
    swatch: ["#fbf1e8", "#e0664a"],
  },
  {
    id: "prism",
    name: "Prism",
    line: "A colour per kind — and the colour goes into the artwork too.",
    why: "The only design where the plates are not the same picture everywhere: the deck's slides come out violet, the plan's green, the check's amber, from the same eight drawings. You can tell which part of a session you are in from across the room. Loud on purpose.",
    shape: "Full-bleed colour-blocked bands",
    mood: "Bold · colour-blocked · graphic",
    swatch: ["#6d4bd6", "#c9781a"],
  },
];

export const pathFor = (i: number) => `/preview${i + 1}`;
