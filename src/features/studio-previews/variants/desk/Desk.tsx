"use client";

// 06 · Desk — things on a table.
//
// The deck is a strip of photo prints, the plan is a set of index cards
// pinned to the board, the quiz is a paper under a bulldog clip with the
// answers ticked in red. Teachers recognise all three shapes before they
// read a word of them, which is the entire argument for this direction.

import { useState } from "react";
import { Paperclip, Plus, Send } from "lucide-react";
import SlideArt from "../../SlideArt";
import {
  KIND_LABEL, KINDS, olderSessions, pulse, SESSIONS, streak, teacher,
} from "../../fixture";
import StudioFrame from "../../StudioFrame";
import s from "./Desk.module.css";

const LETTER = ["a", "b", "c", "d"];

/** A hand-drawn tick, so the marking does not look typeset. */
function Tick() {
  return (
    <svg className={s.tick} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 11 q 3 1 5 5 q 3 -9 10 -13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function Desk() {
  const [session, setSession] = useState(0);
  const [i, setI] = useState(2);
  const S = SESSIONS[session];
  const slide = S.deck.slides[Math.min(i, S.deck.slides.length - 1)];
  const peak = Math.max(...pulse);

  return (
    <StudioFrame>
    <div className={s.page}>
      {/* ── conversations · a stack you fan through ───────────────── */}
      <div className={s.fan}>
        {SESSIONS.map((x, k) => (
          <button
            key={x.id}
            type="button"
            className={s.fanCard}
            data-on={k === session}
            onClick={() => { setSession(k); setI(0); }}
            aria-current={k === session}
          >
            <span className={s.fanTitle}>{x.title}</span>
            <span className={s.fanWhen}>
              {x.when} · {x.turns} turns
            </span>
          </button>
        ))}
        {olderSessions.map((x) => (
          <button key={x.id} type="button" className={s.fanCard}>
            <span className={s.fanTitle}>{x.title}</span>
            <span className={s.fanWhen}>
              {x.when} · {x.turns} turns
            </span>
          </button>
        ))}
        <button type="button" className={s.fanNew}>
          <Plus size={15} />
          New
        </button>
      </div>

      {/* ── the tray ──────────────────────────────────────────────── */}
      <div className={s.tray}>
        <div className={s.note}>
          <span className={s.tape} aria-hidden="true" />
          <p className={s.noteKey}>
            {teacher.name} · {S.prompt.at}
          </p>
          <p className={s.noteText}>{S.prompt.text}</p>
          <div className={s.clips}>
            {S.prompt.attachments.map((a) => (
              <span key={a.name} className={s.pdf}>
                <Paperclip size={11} />
                {a.name} · {a.pages}pp
              </span>
            ))}
            {S.prompt.skills.map((sk) => (
              <span key={sk} className={s.pdf}>{sk}</span>
            ))}
          </div>
        </div>

        <div className={s.sticky}>
          <p className={s.stickyKey}>This fortnight</p>
          <p className={s.stickyNum}>{pulse.at(-1)}</p>
          <p className={s.stickySub}>
            made today. {streak.days}-day run — {streak.hours} {streak.label}.
          </p>
          <div className={s.stickyBars} role="img" aria-label="Fourteen days of activity">
            {pulse.map((v, k) => (
              <span key={k} className={s.stickyBar} data-hot={k >= pulse.length - 3} style={{ height: `${Math.max(8, (v / peak) * 100)}%` }} />
            ))}
          </div>
        </div>

        <div className={s.stamp}>
          Ready
          <span>
            {S.run.totalSeconds}s · {S.run.credits} credits
          </span>
        </div>
      </div>

      {/* ── the deck, as prints ───────────────────────────────────── */}
      <section className={s.section}>
        <div className={s.label}>
          <h2 className={s.labelText}>{S.deck.title}</h2>
          <span className={s.labelRule} />
          <span className={s.labelMeta}>
            {KIND_LABEL[S.deck.kind]} · {S.deck.slides.length} slides
          </span>
        </div>

        <div className={s.printRow}>
          <figure className={`${s.bigPrint}`}>
            <SlideArt seed={slide.art} />
            <figcaption className={s.printCap}>
              <span className={s.printNum}>
                Slide {slide.n} of {S.deck.slides.length}
              </span>
              <h3 className={s.printTitle}>{slide.title}</h3>
              <ul className={s.printBullets}>
                {slide.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className={s.printNote}>{slide.notes}</p>
            </figcaption>
          </figure>

          <div className={s.stripCol}>
            {S.deck.slides.map((sl, k) => (
              <button key={sl.n} type="button" className={s.smallPrint} data-on={k === i} onClick={() => setI(k)} aria-current={k === i}>
                <SlideArt seed={sl.art} />
                <span className={s.smallCap}>
                  <b>{String(sl.n).padStart(2, "0")}</b> {sl.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── the plan, as index cards ──────────────────────────────── */}
      <section className={s.section}>
        <div className={s.label}>
          <h2 className={s.labelText}>{S.plan.title}</h2>
          <span className={s.labelRule} />
          <span className={s.labelMeta}>
            {S.plan.duration} · {S.plan.grade}
          </span>
        </div>

        <div className={s.cards}>
          {S.plan.phases.map((p) => (
            <article key={p.n} className={s.card}>
              <span className={s.pin} aria-hidden="true" />
              <div className={s.cardTop}>
                <span className={s.cardN}>{p.n}</span>
                <span className={s.cardMin}>{p.minutes} min</span>
              </div>
              <h3 className={s.cardName}>{p.name}</h3>
              <p className={s.cardBody}>{p.body}</p>
              <p className={s.cardNote}>{p.teacher}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── the quiz, marked ──────────────────────────────────────── */}
      <section className={s.section}>
        <div className={s.label}>
          <h2 className={s.labelText}>Marked copy</h2>
          <span className={s.labelRule} />
          <span className={s.labelMeta}>
            {KIND_LABEL[S.check.kind]} · {S.check.marks} marks
          </span>
        </div>

        <div className={s.paper}>
          <span className={s.clipTop} aria-hidden="true" />
          <div className={s.paperHead}>
            <h3 className={s.paperTitle}>{S.check.title}</h3>
            <span className={s.paperMeta}>
              {S.check.grade} · {S.check.minutes} minutes · teacher copy
            </span>
          </div>

          {S.check.questions.map((q, k) => (
            <article key={q.q} className={s.q}>
              <div className={s.qTop}>
                <span className={s.qN}>{k + 1}.</span>
                <p className={s.qText}>{q.q}</p>
                <span className={s.qLvl}>{q.difficulty}</span>
              </div>
              <ul className={s.opts}>
                {q.options.map((o, oi) => (
                  <li key={o} className={s.opt} data-right={oi === q.answer}>
                    {oi === q.answer && <Tick />}
                    <span className={s.optL}>{LETTER[oi]})</span>
                    {o}
                  </li>
                ))}
              </ul>
              <p className={s.qWhy}>{q.why}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── the pad ───────────────────────────────────────────────── */}
      <div className={s.pad}>
        <div className={s.padInner}>
          <p className={s.padText}>Ask for a change, or start the next one…</p>
          <div className={s.padBar}>
            {KINDS.map((k) => (
              <button key={k} type="button" className={s.padKind} data-on={k === "lesson_plan" || k === "presentation" || k === "quiz"}>
                {KIND_LABEL[k]}
              </button>
            ))}
            <button type="button" className={s.padSend}>
              Send <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
    </StudioFrame>
  );
}
