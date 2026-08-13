"use client";

// 09 · Terrace — the warm one.
//
// A session read as a morning rather than as a set of tabs: you asked at
// 09:42, it read your chapter, it made three things, and here is the
// class it is for — one spine, top to bottom, with a dot on it for every
// beat. Sand-to-apricot ground, real depth under white cards, coral and
// teal doing the work.
//
// It is the least efficient of the ten and the most pleasant, which is a
// trade some teachers will take.

import { useState } from "react";
import {
  Sparkles, Paperclip, Check, MonitorPlay, FileText, GraduationCap,
  CalendarDays, Send, MessageSquare, Plus,
} from "lucide-react";
import SlideArt from "../../SlideArt";
import StudioFrame from "../../StudioFrame";
import {
  classes, KIND_LABEL, KINDS, olderSessions, pulse, SESSIONS, streak,
} from "../../fixture";
import { KIND_ICON } from "../../kinds";
import s from "./Terrace.module.css";

const LETTER = ["A", "B", "C", "D"];

export default function Terrace() {
  const [session, setSession] = useState(0);
  const [i, setI] = useState(2);
  const S = SESSIONS[session];
  const slide = S.deck.slides[Math.min(i, S.deck.slides.length - 1)];
  const peak = Math.max(...pulse);

  return (
    <StudioFrame>
      <div className={s.page}>
        <div className={s.line}>
          {/* ── you asked ─────────────────────────────────────────── */}
          <section className={s.beat}>
            <span className={s.beatDot}>
              <MessageSquare size={12} />
            </span>
            <div className={s.card}>
              <p className={s.time}>
                {S.prompt.at} · you asked
              </p>
              <p className={s.said}>{S.prompt.text}</p>
              <div className={s.pills}>
                {S.prompt.attachments.map((a) => (
                  <span key={a.name} className={s.pill}>
                    <Paperclip size={11} />
                    {a.name} · {a.pages}pp
                  </span>
                ))}
                {S.prompt.skills.map((sk) => (
                  <span key={sk} className={`${s.pill} ${s.pillOn}`}>
                    <Sparkles size={11} />
                    {sk}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* ── it worked ─────────────────────────────────────────── */}
          <section className={s.beat}>
            <span className={s.beatDot}>
              <Sparkles size={12} />
            </span>
            <div className={s.card}>
              <p className={s.time}>
                {S.run.totalSeconds} seconds later · {S.run.credits} credits
              </p>
              <p className={s.said}>
                Read {S.prompt.attachments.reduce((a, x) => a + x.pages, 0)} pages, matched your
                outcomes, and made {S.made.length} things you can use on Sunday.
              </p>
              <div className={s.stepList}>
                {S.run.stages.map((st) => (
                  <span key={st.label} className={s.step}>
                    <Check size={10} />
                    {st.label} · {st.detail}
                  </span>
                ))}
              </div>
              <div className={s.pills}>
                {S.run.grounding.map((g) => (
                  <span key={g} className={`${s.pill} ${s.pillOn}`}>
                    <Check size={11} />
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* ── the deck ──────────────────────────────────────────── */}
          <section className={s.beat}>
            <span className={s.beatDot}>
              <MonitorPlay size={12} />
            </span>
            <div className={s.card}>
              <div className={s.beatHead}>
                <span className={s.chip}>
                  <MonitorPlay size={12} /> {KIND_LABEL[S.deck.kind]}
                </span>
                <span className={s.beatMeta}>
                  Slide {slide.n} of {S.deck.slides.length}
                </span>
              </div>
              <h2 className={s.title}>{S.deck.title}</h2>
              <p className={s.sub}>{S.deck.subtitle}</p>

              <div className={s.deckRow}>
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
                  <p className={s.note}>
                    <b>Speaker notes</b>
                    {slide.notes}
                  </p>
                </div>
              </div>

              <div className={s.dots}>
                {S.deck.slides.map((sl, k) => (
                  <button key={sl.n} type="button" className={s.dot} data-on={k === i} onClick={() => setI(k)} aria-label={`Slide ${sl.n} — ${sl.title}`}>
                    <SlideArt seed={sl.art} />
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── the plan ──────────────────────────────────────────── */}
          <section className={s.beat}>
            <span className={s.beatDot}>
              <FileText size={12} />
            </span>
            <div className={s.card}>
              <div className={s.beatHead}>
                <span className={`${s.chip} ${s.chipCoral}`}>
                  <FileText size={12} /> {KIND_LABEL[S.plan.kind]}
                </span>
                <span className={s.beatMeta}>
                  {S.plan.duration} · {S.plan.phases.length} phases
                </span>
              </div>
              <h2 className={s.title}>{S.plan.title}</h2>
              <p className={s.sub}>
                {S.plan.grade} · {S.plan.materials.join(" · ")}
              </p>

              <div className={s.phases}>
                {S.plan.phases.map((p) => (
                  <article key={p.n} className={s.phase}>
                    <span className={s.pMin}>
                      {p.minutes}
                      <span>MIN</span>
                    </span>
                    <div>
                      <h3 className={s.pName}>{p.name}</h3>
                      <p className={s.pBody}>{p.body}</p>
                      <p className={s.pNote}>
                        <Sparkles size={11} style={{ marginTop: 3, flexShrink: 0 }} />
                        {p.teacher}
                      </p>
                    </div>
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
              </div>
            </div>
          </section>

          {/* ── the check ─────────────────────────────────────────── */}
          <section className={s.beat}>
            <span className={s.beatDot}>
              <GraduationCap size={12} />
            </span>
            <div className={s.card}>
              <div className={s.beatHead}>
                <span className={`${s.chip} ${s.chipCoral}`}>
                  <GraduationCap size={12} /> {KIND_LABEL[S.check.kind]}
                </span>
                <span className={s.beatMeta}>
                  {S.check.marks} marks · {S.check.minutes} min
                </span>
              </div>
              <h2 className={s.title}>{S.check.title}</h2>
              <p className={s.sub}>{S.check.grade} · the answer key is yours only</p>

              {S.check.questions.map((q, k) => (
                <article key={q.q} className={s.q}>
                  <div className={s.qTop}>
                    <span className={s.qN}>{k + 1}</span>
                    <p className={s.qText}>{q.q}</p>
                    <span className={s.qLvl}>{q.difficulty}</span>
                  </div>
                  <div className={s.opts}>
                    {q.options.map((o, oi) => (
                      <div key={o} className={s.opt} data-right={oi === q.answer}>
                        <span className={s.optL}>{LETTER[oi]}</span>
                        {o}
                      </div>
                    ))}
                  </div>
                  <p className={s.qWhy}>{q.why}</p>
                </article>
              ))}
            </div>
          </section>

          {/* ── the week ──────────────────────────────────────────── */}
          <section className={s.beat}>
            <span className={s.beatDot}>
              <CalendarDays size={12} />
            </span>
            <div className={s.week}>
              <div className={s.wCell}>
                <span className={s.wK}>Made today</span>
                <div className={s.wV}>{pulse.at(-1)}</div>
                <div className={s.wBars} role="img" aria-label="Fourteen days of activity">
                  {pulse.map((v, k) => (
                    <span key={k} className={s.wBar} data-hot={k >= pulse.length - 3} style={{ height: `${Math.max(8, (v / peak) * 100)}%` }} />
                  ))}
                </div>
              </div>
              <div className={s.wCell}>
                <span className={s.wK}>Hours saved</span>
                <div className={s.wV}>{streak.hours}</div>
                <p className={s.wF}>
                  {streak.label} · {streak.days}-day streak
                </p>
              </div>
              <div className={s.wCell} style={{ gridColumn: "span 2" }}>
                <span className={s.wK}>Who this is for</span>
                <div style={{ marginTop: 8 }}>
                  {classes.map((c) => (
                    <div key={c.name} className={s.classRow}>
                      <span className={s.classDot}>{c.name}</span>
                      {c.students} students
                      <span className={s.classWhen}>
                        {c.next} · {c.ready ? "ready" : "no plan yet"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── conversations · the shelf you pick the next one off ─── */}
        <section className={s.pickup}>
          <div className={s.pickupHead}>
            <h2 className={s.pickupTitle}>Pick one back up</h2>
            <span className={s.pickupCount}>
              {SESSIONS.length + olderSessions.length} conversations, kept 30 days
            </span>
          </div>
          <div className={s.pickupGrid}>
            {SESSIONS.map((x, k) => {
              const Icon = KIND_ICON[x.made[0]];
              return (
                <button
                  key={x.id}
                  type="button"
                  className={s.pickupCard}
                  data-on={k === session}
                  onClick={() => { setSession(k); setI(0); }}
                  aria-current={k === session}
                >
                  <span className={s.pickupTop}>
                    <span className={s.pickupKind}>
                      <Icon size={13} />
                    </span>
                    {x.live && <span className={s.pickupLive}>Open</span>}
                  </span>
                  <span className={s.pickupName}>{x.title}</span>
                  <span className={s.pickupMeta}>
                    {x.grade} · {x.turns} turns · {x.when}
                  </span>
                </button>
              );
            })}
            {olderSessions.map((x) => {
              const Icon = KIND_ICON[x.kind];
              return (
                <button key={x.id} type="button" className={s.pickupCard}>
                  <span className={s.pickupTop}>
                    <span className={s.pickupKind}>
                      <Icon size={13} />
                    </span>
                  </span>
                  <span className={s.pickupName}>{x.title}</span>
                  <span className={s.pickupMeta}>
                    {KIND_LABEL[x.kind]} · {x.turns} turns · {x.when}
                  </span>
                </button>
              );
            })}
            <button type="button" className={s.pickupNew}>
              <Plus size={17} />
              New conversation
            </button>
          </div>
        </section>

        {/* ── composer ────────────────────────────────────────────── */}
        <div className={s.dock}>
          <div className={s.dockInner}>
            <p className={s.dockText}>Ask for a change, or start the next one…</p>
            <div className={s.dockBar}>
              {KINDS.map((k) => (
                <button key={k} type="button" className={s.kind} data-on={S.made.includes(k)}>
                  {KIND_LABEL[k]}
                </button>
              ))}
              <button type="button" className={s.send} aria-label="Send">
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </StudioFrame>
  );
}
