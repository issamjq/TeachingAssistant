// The chooser for the seven studio designs.
//
// Every card sends you to a full-screen render of the SAME session —
// the same prompt, the same lesson plan, the same eight-slide deck, the
// same six-question quiz, the same fourteen days of activity. So what
// you are choosing between on those pages is a design, and nothing else.

import { VARIANTS, pathFor } from "./registry";
import g from "./Gallery.module.css";

export default function Gallery() {
  return (
    <main className={g.page}>
      <header className={g.head}>
        <span className={g.eyebrow}>Studio · screen design</span>
        <h1 className={g.title}>
          Seven studios, <em>one session.</em>
        </h1>
        <p className={g.lead}>
          The AI studio at <code>/studio</code>, redrawn seven ways. Each one
          renders an identical fixed session — a Grade 7 photosynthesis brief
          with two attachments, and everything it came back with: a
          six-phase lesson plan, an eight-slide deck with its artwork, a
          six-question quiz with the answer key, and the usage data that
          sits around the edges.
        </p>
        <p className={g.note}>
          Nothing here calls the model or the database. The content is
          pinned in <code>fixture.ts</code>, so a difference you notice
          between two of these pages is a design decision, never a
          different answer.
        </p>
      </header>

      <ol className={g.grid}>
        {VARIANTS.map((v, i) => (
          <li key={v.id}>
            <a className={g.card} href={pathFor(i)}>
              <div className={g.cardTop}>
                <span className={g.num}>{String(i + 1).padStart(2, "0")}</span>
                <span className={g.route}>{pathFor(i)}</span>
                <span className={g.swatch}>
                  {v.swatch.map((c) => (
                    <span key={c} className={g.chip} style={{ background: c }} />
                  ))}
                </span>
              </div>

              <h2 className={g.name}>{v.name}</h2>
              <p className={g.mood}>{v.mood}</p>
              <p className={g.line}>{v.line}</p>
              <p className={g.why}>{v.why}</p>
              <p className={g.shape}>
                <b>Shape — </b>
                {v.shape}
              </p>

              <span className={g.go} aria-hidden="true">
                Open the studio
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M3 11 L11 3 M11 3 H5 M11 3 V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            </a>
          </li>
        ))}
      </ol>

      <footer className={g.foot}>
        <a className={g.footLink} href="/studio">Open the studio that ships today</a>
        <span className={g.footNote}>
          All seven are noindex and read-only — nothing on them writes to your library.
        </span>
      </footer>
    </main>
  );
}
