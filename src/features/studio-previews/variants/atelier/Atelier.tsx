"use client";

// 01 · Atelier — the studio as a printed journal.
//
// The reading direction taken to its end: one measure down the middle, a
// margin rail on the left carrying the run log and the fortnight's
// activity, and each outcome set as a numbered plate. Teacher notes are
// marginalia in red italic, so the thing the teacher must not miss is
// the one thing on the page that is a different colour.

import { useState } from "react";
import { Plus } from "lucide-react";
import SlideArt from "../../SlideArt";
import {
  classes, KIND_LABEL, KINDS, olderSessions, pulse, recents, SESSIONS, streak,
} from "../../fixture";
import StudioFrame from "../../StudioFrame";
import s from "./Atelier.module.css";

const LETTER = ["a", "b", "c", "d"];

export default function Atelier() {
  const [session, setSession] = useState(0);
  const [i, setI] = useState(2);
  const S = SESSIONS[session];
  // The two sessions have different-length decks, so the slide index has
  // to survive a switch rather than index off the end of a shorter one.
  const slide = S.deck.slides[Math.min(i, S.deck.slides.length - 1)];
  const peak = Math.max(...pulse);

  return (
    <StudioFrame>
    <div className={s.page}>
      <div className={s.grain} aria-hidden="true" />

      {/* Not a second app bar — the frame has one. This is the running
          head a printed journal carries: which piece you are inside, and
          what it is for. */}
      <header className={s.masthead}>
        <span className={s.mark}>
          {S.subject} <em>№ {String(session + 1).padStart(2, "0")}</em>
        </span>
        <span className={s.mastRule} aria-hidden="true" />
        <span className={s.mastMeta}>
          {S.title} · {S.grade}
        </span>
      </header>

      <div className={s.body}>
        {/* ── margin rail ─────────────────────────────────────────── */}
        <aside className={s.rail}>
          {/* Conversations, set as an index rather than housed in a rail
              of their own — the margin already is the rail. */}
          <div className={s.idx}>
            <p className={s.railHead}>Conversations</p>
            {SESSIONS.map((x, k) => (
              <button
                key={x.id}
                type="button"
                className={s.idxItem}
                data-on={k === session}
                onClick={() => { setSession(k); setI(0); }}
                aria-current={k === session}
              >
                <span className={s.idxTitle}>{x.title}</span>
                <span className={s.idxWhen}>
                  {x.when} · {x.turns} turns · {x.grade}
                </span>
              </button>
            ))}
            {olderSessions.map((x) => (
              <button key={x.id} type="button" className={`${s.idxItem} ${s.idxOlder}`}>
                <span className={s.idxTitle}>{x.title}</span>
                <span className={s.idxWhen}>
                  {x.when} · {x.turns} turns
                </span>
              </button>
            ))}
            <button type="button" className={s.idxNew}>
              <Plus size={12} /> New conversation
            </button>
          </div>

          <p className={s.railHead}>How it was made</p>
          {S.run.stages.map((st) => (
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
            {S.run.grounding.map((gd) => (
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
            <p className={s.briefLabel}>The brief · {S.prompt.at}</p>
            <p className={s.briefText}>“{S.prompt.text}”</p>
            <div className={s.briefMeta}>
              {S.prompt.attachments.map((a) => (
                <span key={a.name} className={s.tag}>
                  {a.name} <b>{a.pages}pp</b>
                </span>
              ))}
              {S.prompt.skills.map((sk) => (
                <span key={sk} className={s.tag}>
                  Skill · <b>{sk}</b>
                </span>
              ))}
              <span className={s.tag}>
                {S.run.totalSeconds}s · <b>{S.run.credits} credits</b>
              </span>
            </div>
          </section>

          {/* plate 01 — the lesson */}
          <section className={s.plate}>
            <div className={s.plateHead}>
              <span className={s.plateNum}>Plate 01</span>
              <span className={s.plateKind}>{KIND_LABEL[S.plan.kind]}</span>
            </div>
            <h2 className={s.plateTitle}>{S.plan.title}</h2>
            <p className={s.plateSub}>
              {S.plan.grade} · {S.plan.subject} · {S.plan.duration} · {S.plan.materials.length} materials
            </p>

            <ol className={s.outcomes}>
              {S.plan.outcomes.map((o) => (
                <li key={o} className={s.outcome}>{o}</li>
              ))}
            </ol>

            {S.plan.phases.map((p) => (
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
                <span className={s.diffVal}>{S.plan.differentiation.support}</span>
              </div>
              <div className={s.diffCell}>
                <span className={s.diffKey}>Stretch</span>
                <span className={s.diffVal}>{S.plan.differentiation.stretch}</span>
              </div>
              <div className={s.diffCell}>
                <span className={s.diffKey}>Language</span>
                <span className={s.diffVal}>{S.plan.differentiation.ell}</span>
              </div>
            </div>
          </section>

          {/* plate 02 — the deck */}
          <section className={s.plate}>
            <div className={s.plateHead}>
              <span className={s.plateNum}>Plate 02</span>
              <span className={s.plateKind}>
                {KIND_LABEL[S.deck.kind]} · {S.deck.slides.length} slides
              </span>
            </div>
            <h2 className={s.plateTitle}>{S.deck.title}</h2>
            <p className={s.plateSub}>{S.deck.subtitle}</p>

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
              {S.deck.slides.map((sl, k) => (
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
                {KIND_LABEL[S.check.kind]} · {S.check.marks} marks · {S.check.minutes} min
              </span>
            </div>
            <h2 className={s.plateTitle}>{S.check.title}</h2>
            <p className={s.plateSub}>Answer key marked. {S.check.grade}.</p>

            <div style={{ marginTop: 18 }}>
              {S.check.questions.map((q, k) => (
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
    </StudioFrame>
  );
}
