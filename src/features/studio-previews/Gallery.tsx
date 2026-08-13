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
          Ten studios, <em>two sessions.</em>
        </h1>
        <p className={g.lead}>
          The AI studio at <code>/studio</code>, redrawn ten ways. The sidebar
          and top bar are <em>identical</em> in all ten — same nav as{" "}
          <code>config/nav.ts</code>, same spacing, same colours — and every
          design draws from the same <code>--p-*</code> tokens as the rest of
          the product. No preview invents a palette.
        </p>
        <p className={g.note}>
          What differs is everything else: where the conversation list lives
          and what form it takes — a margin index, a table, a card strip, a
          fanned stack, a single collapsed line — and how the three outcomes
          are arranged. Two conversations are open on every design and they
          are different <em>shapes</em> of work (a lesson plan, deck and quiz
          in one; a card-sort activity, deck and homework in the other), so
          opening the second shows each design handling work it was not drawn
          for. Nothing calls the model or the database; the content is pinned
          in <code>fixture.ts</code>.
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
              <p className={g.mood}>{v.mood}</p>
              <p className={g.line}>{v.line}</p>
              <p className={g.why}>{v.why}</p>
              <p className={g.shape}>
                <b>Conversations — </b>
                {v.threads}
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
          All ten are noindex and read-only — nothing on them writes to your library.
        </span>
      </footer>
    </main>
  );
}
