// =====================================================================
// Where you are in the preview, kept in the URL hash
//
// A hash rather than real App Router segments on purpose. The preview
// exists to be argued about — "look at Biology → Quizzes" has to be a
// link someone can paste — but the routes it proposes are not the ones
// the product ships yet, and minting a dozen real segments under
// app/(previews) would make the shape look decided before it is.
//
// When the structure is accepted, these become the real segments:
//   #/subject/biology/quiz  →  app/(studio)/subjects/[subject]/quizzes
// =====================================================================

import type { KindKey } from "./types";
import { KINDS } from "./types";

export type Route =
  | { v: "home" }
  | { v: "week" }
  | { v: "planner" }
  | { v: "library" }
  | { v: "subject"; s: string }
  | { v: "kind"; s: string; k: KindKey }
  | { v: "rollover"; s: string }
  | { v: "item"; s: string; k: KindKey; id: string }
  | { v: "student" }
  | { v: "studentSubject"; id: string }
  | { v: "admin" };

export const HOME: Route = { v: "home" };

const KIND_KEYS = new Set(KINDS.map((k) => k.key));
const asKind = (v: string): KindKey | null => (KIND_KEYS.has(v as KindKey) ? (v as KindKey) : null);

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c, d] = parts;

  if (a === "week") return { v: "week" };
  if (a === "planner") return { v: "planner" };
  if (a === "library") return { v: "library" };
  if (a === "student") return b ? { v: "studentSubject", id: b } : { v: "student" };
  if (a === "admin") return { v: "admin" };
  if (a === "subject" && b) {
    if (c === "new-year") return { v: "rollover", s: b };
    const k = c ? asKind(c) : null;
    if (k && d) return { v: "item", s: b, k, id: d };
    if (k) return { v: "kind", s: b, k };
    return { v: "subject", s: b };
  }
  return HOME;
}

export function serialise(r: Route): string {
  const e = encodeURIComponent;
  switch (r.v) {
    case "week": return "#/week";
    case "planner": return "#/planner";
    case "library": return "#/library";
    case "student": return "#/student";
    case "studentSubject": return `#/student/${e(r.id)}`;
    case "admin": return "#/admin";
    case "subject": return `#/subject/${e(r.s)}`;
    case "rollover": return `#/subject/${e(r.s)}/new-year`;
    case "kind": return `#/subject/${e(r.s)}/${r.k}`;
    case "item": return `#/subject/${e(r.s)}/${r.k}/${e(r.id)}`;
    default: return "#/";
  }
}

export type Surface = "teacher" | "student" | "admin";

/** Which of the three people this route belongs to. */
export const roleOf = (r: Route): Surface =>
  r.v === "admin" ? "admin"
    : r.v === "student" || r.v === "studentSubject" ? "student"
    : "teacher";

/** The subject a route is inside, if any — the sidebar reads this. */
export const subjectOf = (r: Route): string | null =>
  r.v === "subject" || r.v === "kind" || r.v === "item" || r.v === "rollover" ? r.s : null;
