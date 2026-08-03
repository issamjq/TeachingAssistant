import React, { useEffect, useMemo, useState } from "react";
import { api } from "./_shared";
import SlideBuilder, { deckFromPresentation } from "./SlideBuilder";
import BrandLoader from "../components/BrandLoader";
import { Button } from "@/components/ui/button";

// Blank deck for a brand-new presentation (mirrors the one Presentations.jsx
// used for its old inline overlay).
const BLANK_DECK = {
  deckTitle: "Untitled presentation",
  metaLine: "",
  slides: [
    { title: "Title slide", bullets: [""], notes: "", imageQuery: "", image: null, layout: "title", bg: "ink" },
  ],
};

// Routed full-page presentation builder — the SlideBuilder is the editor,
// this wrapper just resolves the deck/meta the same way the old inline
// overlay did. On `new` we hand SlideBuilder a blank deck; on `edit/:id` we
// fetch the row first (the Presentations list isn't mounted when we're
// routed standalone, so its in-memory copy isn't available — same approach
// QuizBuilder takes).
export default function PresentationBuilder({ presentation, onClose }) {
  const id = presentation?.id || null;
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(!!id);

  // A failed load has to be distinguishable from a slow one. It previously was
  // not: the catch cleared `loading` but left `row` null, and the render guard
  // below tested `loading || !deck` — so a deck that could not be fetched sat
  // on the loading spinner forever, with no error and no way out but the back
  // button. Reachable any time a presentation is opened after being deleted
  // (a stale tab, a bookmark, the browser restoring the session), and on any
  // network drop.
  const [loadError, setLoadError] = useState(null);
  // Bumped by "Try again" to re-run the fetch effect without a full remount.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    setLoadError(null);
    api(`/api/presentations/${id}`)
      .then((r) => { if (alive) { setRow(r); setLoading(false); } })
      .catch((err) => {
        if (!alive) return;
        if (err?.code === "aborted") return;
        setLoadError(err?.status === 404 ? "notfound" : "error");
        setLoading(false);
      });
    return () => { alive = false; };
  }, [id, reloadKey]);

  const deck = useMemo(
    () => (id ? (row ? deckFromPresentation(row) : null) : BLANK_DECK),
    [id, row]
  );
  const meta = useMemo(
    () =>
      id
        ? row
          ? {
              subject: row.subject,
              grade: row.grade,
              section: row.section,
              status: row.status,
              scheduled_for: row.scheduled_for,
            }
          : null
        : { status: "Draft" },
    [id, row]
  );

  if (id && loadError) {
    const gone = loadError === "notfound";
    return (
      <div className="flex items-center justify-center py-24 px-6">
        <div className="max-w-md text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
            {gone ? "Presentation not found" : "Could not open this presentation"}
          </p>
          <h2 className="font-serif text-2xl text-ink mb-3">
            {gone ? "This deck is no longer here." : "Something went wrong."}
          </h2>
          <p className="text-sm text-muted mb-6">
            {gone
              ? "It may have been deleted, or moved to the trash from another tab. Deleted decks can be restored from Recently deleted for 30 days."
              : "The deck could not be loaded. Check your connection and try again."}
          </p>
          <div className="flex items-center justify-center gap-3">
            {!gone && (
              <Button onClick={() => { setLoadError(null); setRow(null); setReloadKey((k) => k + 1); }}>
                Try again
              </Button>
            )}
            <Button variant={gone ? undefined : "ghost"} onClick={onClose}>
              Back to presentations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (id && (loading || !deck)) {
    return (
      <BrandLoader fullscreen={false} />
    );
  }

  return (
    <SlideBuilder
      key={id || "new"}
      deck={deck}
      presentationId={id}
      meta={meta}
      onClose={onClose}
    />
  );
}
