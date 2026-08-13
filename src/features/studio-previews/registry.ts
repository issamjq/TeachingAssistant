// The seven studio designs, and where each one lives.
//
// One list, read by the chooser at /preview and by nothing else. Adding
// a design means adding a row here and a route folder — the chooser
// picks it up without being edited.

export type VariantId =
  | "atelier" | "canvas" | "aurora" | "console" | "bento" | "desk" | "focus";

export type VariantMeta = {
  id: VariantId;
  name: string;
  /** One line on the chooser card — what it IS. */
  line: string;
  /** What it is good at, and what it costs you. */
  why: string;
  /** The structural move that makes it different from the other six. */
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
    why: "Best reading experience of the seven. Every outcome is set like a page in a book, with the teacher's notes in the margin where a proof-reader would put them. Slowest to scan if you only want a number.",
    shape: "Single measure with a live margin rail",
    mood: "Editorial · warm paper · serif",
    swatch: ["#e8e7e2", "#16646c"],
  },
  {
    id: "canvas",
    name: "Canvas",
    line: "Chat on the left, a permanent working canvas on the right.",
    why: "The one that scales to a long session. The conversation never pushes the deck off screen, and switching Lesson / Deck / Quiz is a tab, not a scroll. Costs you half the width for the chat.",
    shape: "Two panes, tabbed canvas",
    mood: "Modern product · crisp · confident",
    swatch: ["#f4f3ef", "#16646c"],
  },
  {
    id: "aurora",
    name: "Aurora",
    line: "Dark, lit from behind. Glass panels over a slow turquoise field.",
    why: "The showpiece. Presents beautifully on a projector and in a screenshot, and the deck reads as a real object because the slides stack in depth. The most expensive to keep legible.",
    shape: "Floating glass over an ambient ground",
    mood: "Cinematic · dark · luminous",
    swatch: ["#0b3c42", "#8fc9c4"],
  },
  {
    id: "console",
    name: "Console",
    line: "Everything as a record. Hairline grid, monospace, answer key in a column.",
    why: "The densest by far — a whole session fits on one screen with no scrolling, and the quiz is checkable at a glance. Reads as a tool, not as a document. Least warm of the seven.",
    shape: "Fixed grid, tabular outcomes",
    mood: "Technical · precise · high contrast",
    swatch: ["#101718", "#57a6ad"],
  },
  {
    id: "bento",
    name: "Bento",
    line: "The session as tiles — deck, quiz, plan, pulse, classes, all at once.",
    why: "Nothing is hidden. You see what was made and what it did to your week in the same glance, which is what the dashboard never manages. Long prose has to be truncated to fit a tile.",
    shape: "Asymmetric tile grid",
    mood: "Dashboard · rounded · lively",
    swatch: ["#f4f3ef", "#0b3c42"],
  },
  {
    id: "desk",
    name: "Desk",
    line: "Things on a table. Photo prints, index cards, a clipped stack.",
    why: "The most human of the seven and the one teachers recognise fastest — a deck looks like a strip of prints, a quiz looks like a marked paper. The tilt and shadow cost a little precision.",
    shape: "Layered objects on a surface",
    mood: "Tactile · warm · analogue",
    swatch: ["#e0dfd9", "#a0453c"],
  },
  {
    id: "focus",
    name: "Focus",
    line: "Almost nothing. Type, rules, air, and one accent used four times.",
    why: "The quietest, and the only one that never competes with what it is showing — the artwork and the words carry it alone. Gives you the least chrome to hold on to, which some teachers dislike.",
    shape: "One measure, no containers",
    mood: "Minimal · typographic · calm",
    swatch: ["#f4f3ef", "#101718"],
  },
];

export const pathFor = (i: number) => `/preview${i + 1}`;
