import React, { useEffect, useMemo, useState } from "react";
import { api } from "./_shared";
import SlideBuilder, { deckFromPresentation } from "./SlideBuilder";
import BrandLoader from "../components/BrandLoader";

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

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    api(`/api/presentations/${id}`)
      .then((r) => { if (alive) { setRow(r); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

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
