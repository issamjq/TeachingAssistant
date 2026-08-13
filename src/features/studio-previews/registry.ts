// The ten studio designs, and where each one lives.
//
// One list, read by the chooser at /preview and by nothing else. Adding
// a design means adding a row here and a route folder — the chooser
// picks it up without being edited.
//
// Note what the copy talks about. Colour is NOT a differentiator: every
// design draws from the same --p-* tokens, and the sidebar and top bar
// are identical in all ten. What separates them is where the
// conversation list goes, what form it takes, and how the three outcomes
// are arranged — so that is what each row describes.

export type VariantId =
  | "atelier" | "canvas" | "aurora" | "nova" | "slate"
  | "desk" | "focus" | "ribbon" | "terrace" | "prism";

export type VariantMeta = {
  id: VariantId;
  name: string;
  /** Where the conversation list lives, and in what form. */
  threads: string;
  /** How the work itself is arranged. */
  line: string;
  /** What it is good at, and what it costs you. */
  why: string;
  mood: string;
};

export const VARIANTS: VariantMeta[] = [
  {
    id: "atelier",
    name: "Atelier",
    threads: "A printed index at the head of the margin",
    line: "One measure down the middle, outcomes set as numbered plates.",
    why: "Best reading experience of the ten, and the thread list costs nothing — the margin column was already there carrying the run log, so the index sits above it without adding a rail. Slowest to scan if you only want a number.",
    mood: "Editorial · paper · serif",
  },
  {
    id: "canvas",
    name: "Canvas",
    threads: "The innermost of three columns, always open",
    line: "Threads, chat, and a tabbed canvas that never scrolls away.",
    why: "The one that scales to a long session: the deck stays put while the conversation grows, and the thread list never moves. Three columns inside the content area is the most chrome of any design here.",
    mood: "Product · crisp · confident",
  },
  {
    id: "aurora",
    name: "Aurora",
    threads: "A strip of cards across the top, scrolling sideways",
    line: "The product's dark theme, lit from behind, deck stacked in depth.",
    why: "Nothing else in this design is a list, so the threads are not one either — each is a card the width of a hand carrying what it produced. Presents beautifully; the dark ground is the shipped theme, not a variant palette.",
    mood: "Dark · ambient · cinematic",
  },
  {
    id: "nova",
    name: "Nova",
    threads: "A table — title, produced, class, turns, last active",
    line: "A result banner over an outcome grid, an action on every card.",
    why: "The only design that treats threads as data rather than navigation. At forty conversations a rail stops working and sortable columns start. Costs the most vertical space before you reach the work.",
    mood: "Product · structured · direct",
  },
  {
    id: "slate",
    name: "Slate",
    threads: "A steady right rail, grouped open and earlier",
    line: "Dark theme, one outcome at full width behind a segmented switch.",
    why: "The classic answer, and this is the design that argues for it: the list is always in the same place at the same width. Reading one outcome full-width is the calmest way through a six-phase plan. The least surprising of the ten.",
    mood: "Dark · dense · steady",
  },
  {
    id: "desk",
    name: "Desk",
    threads: "A fanned stack of cards you slide apart",
    line: "Things on a table — photo prints, index cards, a clipped paper.",
    why: "Threads behave like a deck of cards here because everything else does. The most human of the ten and the one teachers recognise fastest; the overlap costs you a little precision at a glance.",
    mood: "Tactile · warm · analogue",
  },
  {
    id: "focus",
    name: "Focus",
    threads: "One line — two names inline, the rest behind a count",
    line: "Almost nothing. Type, rules, air, and no containers at all.",
    why: "A permanent list of seven threads would be the largest object on a page whose whole argument is that there is nothing on it, so it collapses to a sentence. Gives you the least to grab hold of if you scan rather than read.",
    mood: "Minimal · typographic · calm",
  },
  {
    id: "ribbon",
    name: "Ribbon",
    threads: "A horizontal chip row under the top bar",
    line: "The deck runs sideways — four slides legible at once, not one.",
    why: "Both lists read sideways, which suits a wide screen: the thread row costs 46px of height and no width at all. Lets you check a deck by scanning its shape rather than clicking through it. Needs width to be worth it.",
    mood: "Wide · editorial · cinematic",
  },
  {
    id: "terrace",
    name: "Terrace",
    threads: "A grid at the foot — pick the next one up",
    line: "The session read as a morning, down one timeline.",
    why: "The only design where the thread list is a destination rather than a control: the timeline ends, and what follows is the shelf you choose the next piece of work from. The least efficient, and the most pleasant.",
    mood: "Soft · rounded · unhurried",
  },
  {
    id: "prism",
    name: "Prism",
    threads: "A column grouped by day, on the ink ground",
    line: "Full-bleed bands, one tint of firozeh per outcome.",
    why: "Threads grouped the way a teacher remembers them — today, yesterday, earlier — beside colour blocks that run edge to edge. You can tell which part of a session you are in from across the room. The boldest, and the least neutral.",
    mood: "Graphic · banded · bold",
  },
];

export const pathFor = (i: number) => `/preview${i + 1}`;
