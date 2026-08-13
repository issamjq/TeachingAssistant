"use client";

// 03 · Aurora — dark, lit from behind.
//
// The one that photographs well. Two ideas carry it: the ground is a
// slow-moving field of light rather than a flat colour, and the deck is
// a stack in depth — the next slide sits behind the current one, tilted
// and dimmed, so eight slides read as one object you can feel the
// thickness of.

import { useState } from "react";
import {
  Sparkles, ChevronLeft, ChevronRight, Send, Paperclip, Check, Plus,
} from "lucide-react";
import SlideArt from "../../SlideArt";
import {
  classes, KIND_LABEL, KINDS, olderSessions, pulse, recents, SESSIONS, streak, teacher,
} from "../../fixture";
import StudioFrame from "../../StudioFrame";
import { KIND_ICON } from "../../kinds";
import s from "./Aurora.module.css";


export default function Aurora() {
  const [session, setSession] = useState(0);
  const [i, setI] = useState(2);
  const S = SESSIONS[session];
  const n = S.deck.slides.length;
  const slide = S.deck.slides[Math.min(i, n - 1)];
  const peak = Math.max(...pulse);

  // Three cards: the one behind, the one in front, and the one after.
  const stack = [-1, 0, 1]
    .map((d) => ({ d, k: i + d }))
    .filter((x) => x.k >= 0 && x.k < n);

  return (
    <StudioFrame dark>
    <div className={s.page}>
      <div className={s.field} aria-hidden="true">
        <span className={`${s.blob} ${s.b1}`} />
        <span className={`${s.blob} ${s.b2}`} />
        <span className={`${s.blob} ${s.b3}`} />
      </div>
      <div className={s.mesh} aria-hidden="true" />

      <div className={s.wrap}>
        {/* ── conversations · a strip, not a list ─────────────────── */}
        <div className={s.strip}>
          {SESSIONS.map((x, k) => (
            <button
              key={x.id}
              type="button"
              className={s.stripCard}
              data-on={k === session}
              onClick={() => { setSession(k); setI(0); }}
              aria-current={k === session}
            >
              <span className={s.stripTitle}>{x.title}</span>
              <span className={s.stripMeta}>
                {x.live && <span className={s.stripLive} />}
                {x.when}
                <span className={s.stripMade}>
                  {x.made.map((kind) => {
                    const Icon = KIND_ICON[kind];
                    return (
                      <span key={kind} className={s.stripChip} title={KIND_LABEL[kind]}>
                        <Icon size={10} />
                      </span>
                    );
                  })}
                </span>
              </span>
            </button>
          ))}
          {olderSessions.map((x) => {
            const Icon = KIND_ICON[x.kind];
            return (
              <button key={x.id} type="button" className={s.stripCard}>
                <span className={s.stripTitle}>{x.title}</span>
                <span className={s.stripMeta}>
                  {x.when} · {x.turns} turns
                  <span className={s.stripMade}>
                    <span className={s.stripChip} title={KIND_LABEL[x.kind]}>
                      <Icon size={10} />
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
          <button type="button" className={s.stripNew}>
            <Plus size={16} />
            New
          </button>
        </div>

        <header className={s.head}>
          <p className={s.kicker}>
            {S.prompt.at} · {teacher.role}
          </p>
          <h1 className={s.brief}>{S.prompt.text}</h1>
          <div className={s.headMeta}>
            {S.prompt.attachments.map((a) => (
              <span key={a.name} className={s.metaChip}>
                <Paperclip size={11} /> <b>{a.name}</b> {a.pages}pp
              </span>
            ))}
            {S.run.grounding.map((g) => (
              <span key={g} className={s.metaChip}>
                <Check size={11} /> {g}
              </span>
            ))}
            <span className={s.metaChip}>
              <Sparkles size={11} /> <b>{S.run.totalSeconds}s</b> · 3 outcomes
            </span>
          </div>
        </header>

        {/* ── the deck, in depth ────────────────────────────────── */}
        <section className={s.section}>
          <div className={s.secHead}>
            <h2 className={s.secTitle}>{S.deck.title}</h2>
            <span className={s.secMeta}>
              {KIND_LABEL[S.deck.kind]} · {n} slides
            </span>
          </div>

          <div className={s.deckStage}>
            {stack.map(({ d, k }) => {
              const sl = S.deck.slides[k];
              const front = d === 0;
              return (
                <div
                  key={sl.n}
                  className={s.card}
                  data-pos={front ? "front" : "behind"}
                  style={{
                    transform: front
                      ? "translate3d(0,0,0)"
                      : `translate3d(${d * 13}%, ${Math.abs(d) * -3}%, -220px) rotateY(${d * -13}deg) scale(0.92)`,
                    zIndex: front ? 3 : 1,
                  }}
                  aria-hidden={!front}
                >
                  <SlideArt seed={sl.art} />
                  <span className={s.cardVeil} />
                  {front && (
                    <div className={s.cardText}>
                      <h3 className={s.cardTitle}>{sl.title}</h3>
                      <ul className={s.cardBullets}>
                        {sl.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <span className={s.glow} />
                </div>
              );
            })}
          </div>

          <div className={s.deckBar}>
            <button type="button" className={s.orb} onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} aria-label="Previous slide">
              <ChevronLeft size={16} />
            </button>
            <span className={s.pips}>
              {S.deck.slides.map((sl, k) => (
                <button key={sl.n} type="button" className={s.pip} data-on={k === i} onClick={() => setI(k)} aria-label={`Slide ${sl.n}`} />
              ))}
            </span>
            <button type="button" className={s.orb} onClick={() => setI((v) => Math.min(n - 1, v + 1))} disabled={i === n - 1} aria-label="Next slide">
              <ChevronRight size={16} />
            </button>
          </div>
          <p className={s.noteLine}>
            <b>Speaker notes · slide {slide.n}</b>
            {slide.notes}
          </p>
        </section>

        {/* ── glass panels ──────────────────────────────────────── */}
        <section className={s.section}>
          <div className={s.panels}>
            <div className={`${s.panel} ${s.panelWide}`}>
              <div className={s.panelHead}>
                <h2 className={s.panelTitle}>{S.plan.title}</h2>
                <span className={s.panelTag}>
                  {S.plan.duration} · {S.plan.phases.length} phases
                </span>
              </div>
              {S.plan.phases.map((p) => (
                <div key={p.n} className={s.phase}>
                  <span className={s.phaseMin}>
                    {p.minutes}
                    <span>MIN</span>
                  </span>
                  <div>
                    <h3 className={s.phaseName}>{p.name}</h3>
                    <p className={s.phaseBody}>{p.body}</p>
                    <p className={s.phaseNote}>{p.teacher}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className={`${s.panel} ${s.panelWide}`}>
              <div className={s.panelHead}>
                <h2 className={s.panelTitle}>{S.check.title}</h2>
                <span className={s.panelTag}>
                  {S.check.marks} marks · key lit
                </span>
              </div>
              {S.check.questions.map((q, k) => (
                <div key={q.q} className={s.q}>
                  <p className={s.qText}>
                    <span className={s.qN}>{String(k + 1).padStart(2, "0")}</span>
                    {q.q}
                  </p>
                  <div className={s.opts}>
                    {q.options.map((o, oi) => (
                      <div key={o} className={s.opt} data-right={oi === q.answer}>
                        {oi === q.answer && <Check size={12} className={s.tick} />}
                        {o}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={s.panel}>
              <div className={s.panelHead}>
                <h2 className={s.panelTitle}>This fortnight</h2>
                <span className={s.panelTag}>live</span>
              </div>
              <div className={s.stats}>
                <div className={s.stat}>
                  <div className={s.statNum}>{pulse.at(-1)}</div>
                  <span className={s.statKey}>made today</span>
                </div>
                <div className={s.stat}>
                  <div className={s.statNum}>{streak.days}</div>
                  <span className={s.statKey}>day streak</span>
                </div>
                <div className={s.stat}>
                  <div className={s.statNum}>{streak.hours}</div>
                  <span className={s.statKey}>hours saved</span>
                </div>
              </div>
              <div className={s.spark} role="img" aria-label="Fourteen days of activity">
                {pulse.map((v, k) => (
                  <span key={k} className={s.sparkBar} style={{ height: `${Math.max(7, (v / peak) * 100)}%` }} />
                ))}
              </div>
            </div>

            <div className={s.panel}>
              <div className={s.panelHead}>
                <h2 className={s.panelTitle}>Next up</h2>
                <span className={s.panelTag}>{classes.length} classes</span>
              </div>
              {classes.map((c) => (
                <div key={c.name} className={s.shelfRow}>
                  <span className={s.shelfKind}>{c.name}</span>
                  <span className={s.shelfTitle}>
                    {c.students} students · {c.next}
                  </span>
                  <span className={s.shelfWhen}>{c.ready ? "ready" : "no plan yet"}</span>
                </div>
              ))}
              <div style={{ height: 12 }} />
              {recents.slice(0, 4).map((r) => (
                <div key={r.title} className={s.shelfRow}>
                  <span className={s.shelfKind}>{KIND_LABEL[r.kind]}</span>
                  <span className={s.shelfTitle}>{r.title}</span>
                  <span className={s.shelfWhen}>{r.when}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className={s.dock}>
        <div className={s.dockInner}>
          <p className={s.dockInput}>Ask for a change, or start the next one…</p>
          <div className={s.dockBar}>
            {KINDS.map((k) => (
              <button key={k} type="button" className={s.dockKind} data-on={k === "lesson_plan" || k === "presentation" || k === "quiz"}>
                {KIND_LABEL[k]}
              </button>
            ))}
            <button type="button" className={s.dockSend} aria-label="Send">
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
    </StudioFrame>
  );
}
