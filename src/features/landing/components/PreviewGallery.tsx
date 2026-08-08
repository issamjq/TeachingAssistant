"use client";

// The chooser for the stage-one variants, plus the design they replaced.
//
// Deliberately NOT a page of screenshots. Stage one is a scroll
// sequence — a still frame of one tells you almost nothing about how it
// resolves — so this lists what each variant is and what it is for, and
// sends you to the real thing. Reading two lines and opening the page
// beats squinting at ten thumbnails of a composition that moves.
//
// Styled with the landing's own tokens rather than a preview theme, so
// the chooser sits on the same drench the variants do and nothing here
// misrepresents the palette.

import { pathFor, VARIANTS } from "@/features/hero-constellation/variants";
import g from "./PreviewGallery.module.css";

export default function PreviewGallery() {
  return (
    <main className={g.page}>
      <div className={g.grain} aria-hidden="true" />

      <header className={g.head}>
        <span className={g.eyebrow}>Landing · stage one</span>
        <h1 className={g.title}>
          Six openings, <em>and the one they replaced.</em>
        </h1>
        <p className={g.lead}>
          Every variant below changes only the first screen. The contents
          index, the walkthrough deck and everything under them are
          identical across all of them — so what differs on screen is the
          design, not a second implementation of the page. Slot 02 is the
          old card fan, kept for comparison; slot 01 is what now ships.
        </p>
        <p className={g.note}>
          Each one is a scroll sequence, and each carries its own light —
          watch the opening frame for a moment before you scroll. Then
          scroll: the eight modules leave their arrangement and become the
          contents grid, and then the deck.
        </p>
      </header>

      <ol className={g.grid}>
        {VARIANTS.map((v, i) => (
          <li key={v.id}>
            <a className={g.card} href={pathFor(i)}>
              <div className={g.cardTop}>
                <span className={g.num}>{String(i + 1).padStart(2, "0")}</span>
                <span className={g.route}>{pathFor(i)}</span>
              </div>
              <h2 className={g.name}>{v.name}</h2>
              <p className={g.line}>{v.line}</p>
              <p className={g.why}>{v.why}</p>
              <span className={g.go} aria-hidden="true">
                Open
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 11 L11 3 M11 3 H5 M11 3 V9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </a>
          </li>
        ))}
      </ol>

      <footer className={g.foot}>
        <a className={g.footLink} href="/">
          Open “/” — currently shipping the Atelier cut
        </a>
      </footer>
    </main>
  );
}
