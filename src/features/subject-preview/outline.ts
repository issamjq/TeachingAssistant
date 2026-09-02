// =====================================================================
// An artefact in four lines, for the card under a reply
//
// The reference design puts a lesson plan's run-sheet inside the result
// card — a left column and a right one, four rows, so you can tell from
// the conversation whether the thing it made is the thing you wanted
// without opening it. This produces those rows from whatever the row
// actually holds.
//
// The left column carries the PHASE, not a time. Murchid stores a plan
// as intro / main_activity / conclusion with no per-phase minutes, and
// the reference's "0–5 min / 5–20 min" would have to be invented. A
// teacher is about to stand in front of a class with this; a made-up
// timing is the one thing it must not contain.
// =====================================================================

import type { Item } from "./types";

export type OutlineRow = { left: string; right: string };

/** Real fields of a lesson plan, in the order a teacher reads them. */
const PHASES: [string, string][] = [
  ["intro", "Opening"],
  ["main_activity", "Main activity"],
  ["conclusion", "Closing"],
  ["assessment_method", "Checking it landed"],
];

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

export function outlineOf(item: Item, limit = 4): OutlineRow[] {
  const r = item.raw;
  const rows: OutlineRow[] = [];

  for (const [field, label] of PHASES) {
    const text = clean(r[field]);
    if (text) rows.push({ left: label, right: text });
  }
  if (rows.length) return rows.slice(0, limit);

  const questions = Array.isArray(r.questions) ? r.questions : [];
  if (questions.length) {
    return questions.slice(0, limit).map((q: any, i: number) => ({
      left: String(i + 1).padStart(2, "0"),
      right: clean(q.question ?? q.prompt ?? q.text) || "Untitled question",
    }));
  }

  const slides = Array.isArray(r.slides) ? r.slides : [];
  if (slides.length) {
    return slides.slice(0, limit).map((s: any, i: number) => ({
      left: `Slide ${i + 1}`,
      right: clean(s.title ?? s.heading) || "Untitled slide",
    }));
  }

  const objectives = Array.isArray(r.objectives) ? r.objectives.filter(Boolean) : [];
  if (objectives.length) {
    // No left column: an objective has no phase or number to sit beside,
    // and labelling only the first row left the rest with a 108px hole.
    return objectives.slice(0, limit).map((o: string) => ({ left: "", right: clean(o) }));
  }

  // A document kept as prose. Its first lines are still its shape.
  const body = clean(r.body_md ?? r.body ?? r.instructions ?? "");
  if (body) {
    return String(r.body_md ?? r.body ?? r.instructions)
      .split("\n")
      .map((l) => clean(l).replace(/^[#*\-\d.\s]+/, ""))
      .filter(Boolean)
      .slice(0, limit)
      .map((line) => ({ left: "", right: line }));
  }

  return [];
}

/** How many pieces are behind it, said the way the reference says it. */
export function outlineMeta(item: Item): string | null {
  const r = item.raw;
  if (r.duration_minutes) return `${r.duration_minutes} minutes`;
  if (Array.isArray(r.questions) && r.questions.length) return `${r.questions.length} questions`;
  if (Array.isArray(r.slides) && r.slides.length) return `${r.slides.length} slides`;
  return null;
}
