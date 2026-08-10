"use client";

import StudioChat from "../StudioChat";

// /studio and /studio/:kind — the AI workspace, as a chat.
//
// `kind` preselects what is being made (lesson · quiz · homework ·
// presentation · activity), so the dashboard's "Build a quiz" still
// lands with Quiz already chosen. It is a control the teacher can
// change, not a mode they are locked into.
//
// Replaced views/Studio.jsx, a 4,057-line wizard: pick a kind, fill six
// fields, press Generate, land on a separate result screen. The wizard
// asked for its parameters up front; a conversation lets the teacher say
// the same things in a sentence and change their mind afterwards.
const KINDS = new Set(["lesson_plan", "quiz", "homework", "presentation", "activity"]);

export default function StudioRoute({ slug = [] }: { slug?: string[] }) {
  const first = slug[0];
  const initial = first && KINDS.has(first) ? first : "lesson_plan";
  return <StudioChat initialKind={initial} />;
}
