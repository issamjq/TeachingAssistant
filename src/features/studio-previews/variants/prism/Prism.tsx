"use client";

// 10 · Prism — a colour per kind, all the way down.
//
// The only design where the artwork is not identical in every section.
// Each outcome owns a hue, and that hue sets its band's ground, its
// rules, its type AND the --art-* variables the plates paint from — so
// the deck's slides come out violet, the plan's green, the check's
// amber. Same eight drawings, three inks, and you can tell which part of
// the session you are in from across the room.

import { useState } from "react";
import { Paperclip, Check, Send, Plus } from "lucide-react";
import SlideArt from "../../SlideArt";
import StudioFrame from "../../StudioFrame";
import {
  KIND_LABEL, KINDS, olderSessions, pulse, SESSIONS, streak, type Kind,
} from "../../fixture";
import { KIND_ICON } from "../../kinds";

// Threads grouped the way a teacher remembers them — by when, not by kind.
const DAYS = [
  { label: "Today", items: [SESSIONS[0]] },
  { label: "Yesterday", items: [SESSIONS[1]] },
  { label: "Earlier this week", items: olderSessions },
];
import s from "./Prism.module.css";

const LETTER = ["a", "b", "c", "d"];

export default function Prism() {
  const [session, setSession] = useState(0);
  const [i, setI] = useState(2);
  const S = SESSIONS[session];
  const slide = S.deck.slides[Math.min(i, S.deck.slides.length - 1)];
  const peak = Math.max(...pulse);

  return (
    <StudioFrame>
      <div className={s.page}>
        {/* ── conversations · grouped by day, on the ink ground ───── */}
        <aside className={s.days} aria-label="Conversations">
          <div className={s.daysHead}>
            <h2 className={s.daysTitle}>Threads</h2>
            <span className={s.daysCount}>{SESSIONS.length + olderSessions.length}</span>
          </div>
          {DAYS.map((day) => (
            <div key={day.label}>
              <span className={s.dayLabel}>{day.label}</span>
              {day.items.map((x) => {
                const open = "made" in x;
                const k = open ? SESSIONS.findIndex((y) => y.id === x.id) : -1;
                const kinds = open ? (x as (typeof SESSIONS)[number]).made : [(x as { kind: Kind }).kind];
                return (
                  <button
                    key={x.id}
                    type="button"
                    className={s.dayItem}
                    data-on={k === session}
                    onClick={k >= 0 ? () => { setSession(k); setI(0); } : undefined}
                    aria-current={k === session}
                  >
                    <span className={s.dayTitle}>{x.title}</span>
                    <span className={s.dayMeta}>
                      {x.turns} turns
                      <span className={s.dayMade}>
                        {kinds.map((kind) => {
                          const Icon = KIND_ICON[kind];
                          return (
                            <span key={kind} className={s.dayChip} title={KIND_LABEL[kind]}>
                              <Icon size={9} />
                            </span>
                          );
                        })}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          <button type="button" className={s.daysNew}>
            <Plus size={13} /> New conversation
          </button>
        </aside>

        <div className={s.bands}>
        {/* ── the brief ───────────────────────────────────────────── */}
        <header className={s.hero}>
          <div className={s.heroTop}>
            <span className={s.heroKey}>
              {S.grade} · {S.subject} · {S.prompt.at}
            </span>
            <span className={s.heroTime}>
              {S.run.totalSeconds}s · {S.run.credits} credits · {S.turns} turns
            </span>
          </div>
          <h1 className={s.heroText}>{S.prompt.text}</h1>

          <div className={s.heroMeta}>
            {S.prompt.attachments.map((a) => (
              <span key={a.name} className={s.heroChip}>
                <Paperclip size={11} />
                {a.name} <b>{a.pages}pp</b>
              </span>
            ))}
            {S.run.grounding.map((g) => (
              <span key={g} className={s.heroChip}>
                <Check size={11} />
                <b>{g}</b>
              </span>
            ))}
            {S.prompt.skills.map((sk) => (
              <span key={sk} className={s.heroChip}>{sk}</span>
            ))}
          </div>

          <div className={s.heroSteps}>
            {S.run.stages.map((st, k) => (
              <div key={st.label} className={s.hStep}>
                <span className={s.hStepN}>{String(k + 1).padStart(2, "0")}</span>
                <p className={s.hStepT}>{st.label}</p>
                <p className={s.hStepS}>
                  {st.detail} · {(st.ms / 1000).toFixed(1)}s
                </p>
              </div>
            ))}
          </div>
        </header>

        {/* ── deck band ───────────────────────────────────────────── */}
        <section className={`${s.band} ${s.bDeck}`}>
          <div className={s.bandHead}>
            <span className={s.bandKind}>{KIND_LABEL[S.deck.kind]}</span>
            <span className={s.bandMeta}>
              Slide {slide.n} of {S.deck.slides.length}
            </span>
          </div>
          <h2 className={s.bandTitle}>{S.deck.title}</h2>
          <p className={s.bandSub}>{S.deck.subtitle}</p>

          <div className={s.deckMain}>
            <div className={s.plate}>
              <SlideArt seed={slide.art} />
            </div>
            <div>
              <h3 className={s.slideTitle}>{slide.title}</h3>
              <ul className={s.bullets}>
                {slide.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className={s.slideNote}>
                <b>Speaker notes</b>
                {slide.notes}
              </p>
            </div>
          </div>

          <div className={s.strip}>
            {S.deck.slides.map((sl, k) => (
              <button key={sl.n} type="button" className={s.chip} data-on={k === i} onClick={() => setI(k)} aria-current={k === i}>
                <SlideArt seed={sl.art} />
                <span className={s.chipN}>
                  {String(sl.n).padStart(2, "0")} {sl.title}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── plan band ───────────────────────────────────────────── */}
        <section className={`${s.band} ${s.bPlan}`}>
          <div className={s.bandHead}>
            <span className={s.bandKind}>{KIND_LABEL[S.plan.kind]}</span>
            <span className={s.bandMeta}>
              {S.plan.duration} · {S.plan.phases.length} phases
            </span>
          </div>
          <h2 className={s.bandTitle}>{S.plan.title}</h2>
          <p className={s.bandSub}>
            {S.plan.grade} · {S.plan.materials.join(" · ")}
          </p>

          <div className={s.phases}>
            {S.plan.phases.map((p) => (
              <article key={p.n} className={s.phase}>
                <div className={s.pTop}>
                  <span className={s.pN}>{p.n}</span>
                  <h3 className={s.pName}>{p.name}</h3>
                  <span className={s.pMin}>{p.minutes} min</span>
                </div>
                <p className={s.pBody}>{p.body}</p>
                <p className={s.pNote}>{p.teacher}</p>
              </article>
            ))}
          </div>

          <div className={s.tri}>
            <div className={s.triCell}>
              <span className={s.triK}>Support</span>
              <span className={s.triV}>{S.plan.differentiation.support}</span>
            </div>
            <div className={s.triCell}>
              <span className={s.triK}>Stretch</span>
              <span className={s.triV}>{S.plan.differentiation.stretch}</span>
            </div>
            <div className={s.triCell}>
              <span className={s.triK}>Language</span>
              <span className={s.triV}>{S.plan.differentiation.ell}</span>
            </div>
            <div className={s.triCell}>
              <span className={s.triK}>Outcomes</span>
              <span className={s.triV}>{S.plan.outcomes.join(" ")}</span>
            </div>
          </div>
        </section>

        {/* ── check band ──────────────────────────────────────────── */}
        <section className={`${s.band} ${s.bCheck}`}>
          <div className={s.bandHead}>
            <span className={s.bandKind}>{KIND_LABEL[S.check.kind]}</span>
            <span className={s.bandMeta}>
              {S.check.marks} marks · {S.check.minutes} min
            </span>
          </div>
          <h2 className={s.bandTitle}>{S.check.title}</h2>
          <p className={s.bandSub}>{S.check.grade} · the correct answer is filled, not ticked</p>

          {S.check.questions.map((q, k) => (
            <article key={q.q} className={s.q}>
              <div className={s.qTop}>
                <span className={s.qN}>{k + 1}</span>
                <p className={s.qText}>{q.q}</p>
                <span className={s.qLvl}>{q.difficulty}</span>
              </div>
              <ul className={s.opts}>
                {q.options.map((o, oi) => (
                  <li key={o} className={s.opt} data-right={oi === q.answer}>
                    <span className={s.optL}>{LETTER[oi]}</span>
                    {o}
                  </li>
                ))}
              </ul>
              <p className={s.qWhy}>{q.why}</p>
            </article>
          ))}
        </section>

        {/* ── the numbers ─────────────────────────────────────────── */}
        <div className={s.foot}>
          <div className={s.fCell}>
            <span className={s.fK}>Made today</span>
            <div className={s.fV}>{pulse.at(-1)}</div>
          </div>
          <div className={s.fCell}>
            <span className={s.fK}>Day streak</span>
            <div className={s.fV}>{streak.days}</div>
          </div>
          <div className={s.fCell}>
            <span className={s.fK}>Hours saved</span>
            <div className={s.fV}>{streak.hours}</div>
            <p className={s.fF}>{streak.label}</p>
          </div>
          <div className={s.fBars} role="img" aria-label="Fourteen days of activity">
            {pulse.map((v, k) => (
              <span key={k} className={s.fBar} data-hot={k >= pulse.length - 3} style={{ height: `${Math.max(8, (v / peak) * 100)}%` }} />
            ))}
          </div>
        </div>

        {/* ── composer ────────────────────────────────────────────── */}
        <div className={s.dock}>
          <div className={s.dockRow}>
            <span className={s.dockText}>Ask for a change, or start the next one…</span>
            <button type="button" className={s.send}>
              Send <Send size={13} />
            </button>
          </div>
          <div className={s.dockKinds}>
            {KINDS.map((k) => (
              <button key={k} type="button" className={s.kind} data-on={S.made.includes(k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>
    </StudioFrame>
  );
}
