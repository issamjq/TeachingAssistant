"use client";

// 01 · Atelier — the studio as a printed journal.
//
// The reading direction taken to its end: one measure down the middle, a
// margin rail on the left carrying the run log and the fortnight's
// activity, and each outcome set as a numbered plate. Teacher notes are
// marginalia in red italic, so the thing the teacher must not miss is
// the one thing on the page that is a different colour.

import { useState } from "react";
import SlideArt from "../../SlideArt";
import {
  classes, deck, lesson, prompt, pulse, quiz, recents, run, streak, teacher, KIND_LABEL,
} from "../../fixture";
import s from "./Atelier.module.css";

const LETTER = ["a", "b", "c", "d"];
const KINDS = ["lesson_plan", "presentation", "quiz", "homework", "activity"] as const;

export default function Atelier() {
  const [i, setI] = useState(2);
  const slide = deck.slides[i];
  const peak = Math.max(...pulse);

  return (
    <div className={s.page}>
      <div className={s.grain} aria-hidden="true" />

      <header className={s.masthead}>
        <span className={s.mark}>
          Murchid <em>Studio</em>
        </span>
        <span className={s.mastRule} aria-hidden="true" />
        <span className={s.mastMeta}>
          {teacher.name} · {teacher.role} · {teacher.creditsTotal - teacher.creditsUsed} credits
        </span>
      </header>

      <div className={s.body}>
        {/* ── margin rail ─────────────────────────────────────────── */}
        <aside className={s.rail}>
          <p className={s.railHead}>How it was made</p>
          {run.stages.map((st) => (
            <div key={st.label} className={s.stage}>
              <span className={s.stageTick}>✓</span>
              <span>
                <span className={s.stageName}>{st.label}</span>
                <span className={s.stageDetail}>
                  {st.detail} · {(st.ms / 1000).toFixed(1)}s
                </span>
              </span>
            </div>
          ))}

          <div className={s.railBlock}>
            <span className={s.railKey}>Grounded in</span>
            {run.grounding.map((gd) => (
              <span key={gd} className={s.ground}>{gd}</span>
            ))}
          </div>

          <div className={s.railBlock}>
            <span className={s.railKey}>Last 14 days</span>
            <div className={s.pulse} role="img" aria-label={`Activity over fourteen days, ending at ${pulse.at(-1)}`}>
              {pulse.map((v, k) => (
                <span key={k} className={s.pulseBar} style={{ height: `${Math.max(6, (v / peak) * 100)}%` }} />
              ))}
            </div>
            <span style={{ display: "block", marginTop: 6 }}>
              {streak.hours} {streak.label}
            </span>
          </div>

          <div className={s.railBlock}>
            <span className={s.railKey}>Ready to teach</span>
            {classes.map((c) => (
              <span key={c.name} style={{ display: "block" }}>
                {c.name} · {c.next} {c.ready ? "✓" : "—"}
              </span>
            ))}
          </div>
        </aside>

        {/* ── the measure ─────────────────────────────────────────── */}
        <main>
          <section className={s.brief}>
            <p className={s.briefLabel}>The brief · {prompt.at}</p>
            <p className={s.briefText}>“{prompt.text}”</p>
            <div className={s.briefMeta}>
              {prompt.attachments.map((a) => (
                <span key={a.name} className={s.tag}>
                  {a.name} <b>{a.pages}pp</b>
                </span>
              ))}
              {prompt.skills.map((sk) => (
                <span key={sk} className={s.tag}>
                  Skill · <b>{sk}</b>
                </span>
              ))}
              <span className={s.tag}>
                {run.totalSeconds}s · <b>{run.credits} credits</b>
              </span>
            </div>
          </section>

          {/* plate 01 — the lesson */}
          <section className={s.plate}>
            <div className={s.plateHead}>
              <span className={s.plateNum}>Plate 01</span>
              <span className={s.plateKind}>{KIND_LABEL.lesson_plan}</span>
            </div>
            <h2 className={s.plateTitle}>{lesson.title}</h2>
            <p className={s.plateSub}>
              {lesson.grade} · {lesson.subject} · {lesson.duration} · {lesson.materials.length} materials
            </p>

            <ol className={s.outcomes}>
              {lesson.outcomes.map((o) => (
                <li key={o} className={s.outcome}>{o}</li>
              ))}
            </ol>

            {lesson.phases.map((p) => (
              <article key={p.n} className={s.phase}>
                <div className={s.phaseMin}>
                  {p.minutes}
                  <span>MIN</span>
                </div>
                <div>
                  <h3 className={s.phaseName}>
                    <i>{p.n}</i>
                    {p.name}
                  </h3>
                  <p className={s.phaseBody}>{p.body}</p>
                  <em className={s.marginal}>{p.teacher}</em>
                </div>
              </article>
            ))}

            <div className={s.diff}>
              <div className={s.diffCell}>
                <span className={s.diffKey}>Support</span>
                <span className={s.diffVal}>{lesson.differentiation.support}</span>
              </div>
              <div className={s.diffCell}>
                <span className={s.diffKey}>Stretch</span>
                <span className={s.diffVal}>{lesson.differentiation.stretch}</span>
              </div>
              <div className={s.diffCell}>
                <span className={s.diffKey}>Language</span>
                <span className={s.diffVal}>{lesson.differentiation.ell}</span>
              </div>
            </div>
          </section>

          {/* plate 02 — the deck */}
          <section className={s.plate}>
            <div className={s.plateHead}>
              <span className={s.plateNum}>Plate 02</span>
              <span className={s.plateKind}>
                {KIND_LABEL.presentation} · {deck.slides.length} slides
              </span>
            </div>
            <h2 className={s.plateTitle}>{deck.title}</h2>
            <p className={s.plateSub}>{deck.subtitle}</p>

            <figure className={s.figure} style={{ marginTop: 20 }}>
              <SlideArt seed={slide.art} className={s.plateArt} />
              <figcaption className={s.caption}>
                <span className={s.captionNum}>Fig. {slide.n}</span>
                <span>{slide.title}</span>
                <span style={{ marginInlineStart: "auto" }}>{slide.layout}</span>
              </figcaption>
            </figure>

            <div className={s.slideText}>
              <h3 className={s.slideTitle}>{slide.title}</h3>
              <ul className={s.slideBullets}>
                {slide.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className={s.notes}>
                <b>Speaker notes</b>
                {slide.notes}
              </p>
            </div>

            <div className={s.strip}>
              {deck.slides.map((sl, k) => (
                <button
                  key={sl.n}
                  type="button"
                  className={s.thumb}
                  data-on={k === i}
                  onClick={() => setI(k)}
                  aria-label={`Slide ${sl.n} — ${sl.title}`}
                  aria-current={k === i}
                >
                  <SlideArt seed={sl.art} />
                </button>
              ))}
            </div>
          </section>

          {/* plate 03 — the quiz */}
          <section className={s.plate}>
            <div className={s.plateHead}>
              <span className={s.plateNum}>Plate 03</span>
              <span className={s.plateKind}>
                {KIND_LABEL.quiz} · {quiz.marks} marks · {quiz.minutes} min
              </span>
            </div>
            <h2 className={s.plateTitle}>{quiz.title}</h2>
            <p className={s.plateSub}>Answer key marked. {quiz.grade}.</p>

            <div style={{ marginTop: 18 }}>
              {quiz.questions.map((q, k) => (
                <article key={q.q} className={s.q}>
                  <span className={s.qNum}>{k + 1}</span>
                  <div>
                    <p className={s.qText}>
                      {q.q}
                      <span className={s.qDiff}>{q.difficulty}</span>
                    </p>
                    <ul className={s.opts}>
                      {q.options.map((o, oi) => (
                        <li key={o} className={s.opt} data-right={oi === q.answer}>
                          <span className={s.optLetter}>{LETTER[oi]}</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                    <em className={s.marginal}>{q.why}</em>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>

      <section className={s.shelf}>
        <p className={s.shelfHead}>On the shelf</p>
        {recents.map((r) => (
          <div key={r.title} className={s.shelfRow}>
            <span className={s.shelfKind}>{KIND_LABEL[r.kind]}</span>
            <span className={s.shelfTitle}>{r.title}</span>
            {r.live && <span className={s.live}>new</span>}
            <span className={s.shelfWhen}>{r.when}</span>
          </div>
        ))}
      </section>

      <div className={s.composerWrap}>
        <div className={s.composer}>
          <p className={s.input}>Ask for a change, or start the next one…</p>
          <div className={s.composerBar}>
            {KINDS.map((k) => (
              <button key={k} type="button" className={s.kindWord} data-on={k === "lesson_plan" || k === "presentation" || k === "quiz"}>
                {KIND_LABEL[k]}
              </button>
            ))}
            <button type="button" className={s.sendWord}>Send</button>
          </div>
        </div>
        <p className={s.disclaimer}>Murchid drafts; you decide. Check anything before it reaches a class.</p>
      </div>
    </div>
  );
}
