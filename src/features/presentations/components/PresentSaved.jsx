"use client";

// =====================================================================
// Present a saved deck the way it was made
//
// The Present button on a card opened the legacy presenter, which has its
// own dark theme and its own fonts and reads bullets only — so a studio
// deck went on the wall as a heading over empty space, in a palette it was
// never designed in.
//
// The row is fetched first because a list card carries a summary, not the
// slides, and the shape of those slides is what decides which presenter is
// the right one. Hand-built decks still belong to the old one.
// =====================================================================
import React, { useEffect, useState } from "react";
import { api } from "@/views/_shared";
import { PresentDeck, resolveTheme } from "@/views/SlideBuilder";
import { SlideFullscreen } from "@/features/studio-ai/artifacts";


/** Slides shaped by the studio rather than typed into the manual editor. */
export function isStudioDeck(row) {
  const slides = row?.slides;
  if (!Array.isArray(slides) || !slides.length) return false;
  return slides.some(
    (sl) => sl && (Array.isArray(sl.items) && sl.items.length || sl.note),
  );
}

export default function PresentSaved({ presentation, onClose }) {
  const id = presentation?.id;
  const [row, setRow] = useState(isStudioDeck(presentation) ? presentation : null);
  const [ready, setReady] = useState(isStudioDeck(presentation));

  useEffect(() => {
    if (!id || ready) return;
    let alive = true;
    api(`/api/presentations/${id}`)
      .then((r) => { if (alive) { setRow(r); setReady(true); } })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [id, ready]);

  // Nothing is shown until the shape is known: opening the wrong presenter
  // for a moment is a flash of the wrong deck in front of a class.
  if (!ready) return null;

  const source = row || presentation;

  if (isStudioDeck(source)) {
    const slides = (source.slides || []).map((sl) => {
      /**
       * The colour she chose, not the one the deck was born with.
       *
       * The presenter worked the theme out from the deck's title, so a
       * background changed in the editor was saved, shown in the editor, and
       * then ignored on the wall — the two previews of one deck disagreed.
       * A slide that carries a background is drawn in it; one that does not
       * still falls back to the deck's own tone.
       */
      const t = sl.bg ? resolveTheme(sl.bg) : null;
      return {
        title: sl.title || "",
        layout: sl.studioLayout || sl.layout || "",
        bullets: Array.isArray(sl.bullets) ? sl.bullets.filter(Boolean) : [],
        items: Array.isArray(sl.items) ? sl.items : [],
        note: sl.note || "",
        visual: sl.visual || "",
        notes: sl.notes || "",
        ...(t
          ? {
              tone: {
                "--s-bg": t.bg,
                "--s-accent": t.dot,
                "--s-card": `color-mix(in srgb, ${t.text} 10%, ${t.bg})`,
                "--s-edge": `color-mix(in srgb, ${t.text} 22%, ${t.bg})`,
                "--s-text": t.text,
              },
            }
          : {}),
      };
    });
    return <SlideFullscreen slides={slides} start={0} onClose={onClose} />;
  }

  return <PresentDeck presentation={source} onClose={onClose} />;
}
