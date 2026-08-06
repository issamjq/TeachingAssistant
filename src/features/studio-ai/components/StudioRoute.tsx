"use client";

import Studio from "@/views/Studio";

// /studio and /studio/:kind — the AI generation workspace.
//
// `kind` selects which builder opens (lesson · quiz · homework ·
// presentation · activity). Studio.jsx is still a single 5,199-line view;
// decomposing it into this feature module is its own step and does not block
// the route peel.
//
// App.jsx also passed onJump here — Studio never destructured it, so it was
// dead. Not carried over.
export default function StudioRoute({ slug = [] }: { slug?: string[] }) {
  return <Studio initialKind={slug[0] || null} />;
}
