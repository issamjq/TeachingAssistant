"use client";

// 04 · Nova — the modern product cut.
//
// The one that looks like software people already pay for: a gradient
// result banner, outcome cards with soft elevation instead of borders,
// and a colour per kind so a deck and a quiz are never mistaken for one
// another at a glance. Every card ends in the action you would take
// next, which is the difference between a design that displays work and
// one that expects you to do something with it.

import { useState } from "react";
import {
  Sparkles, Clock, Paperclip, Check, FileText, MonitorPlay, GraduationCap,
  Save, Download, Play, Send, ChevronRight,
} from "lucide-react";
import SlideArt from "../../SlideArt";
import StudioFrame from "../../StudioFrame";
import { KIND_LABEL, KINDS, pulse, SESSIONS, streak, tally } from "../../fixture";
import s from "./Nova.module.css";

const LETTER = ["A", "B", "C", "D"];

export default function Nova() {
  const [session, setSession] = useState(0);
  const [i, setI] = useState(2);
  const S = SESSIONS[session];
  const slide = S.deck.slides[Math.min(i, S.deck.slides.length - 1)];
  const peak = Math.max(...pulse);
  const maxMade = Math.max(...tally.map((t) => t.made));

  return (
    <StudioFrame theme={s.theme} session={session} onSession={(n) => { setSession(n); setI(0); }}>
      <div className={s.page}>
        {/* ── what you asked, and what happened ─────────────────── */}
        <section className={s.banner}>
          <span className={s.bannerGlow} aria-hidden="true" />
          <div className={s.bannerTop}>
            <Sparkles size={15} />
            <span className={s.bannerKey}>
              {S.grade} · {S.subject} · {S.prompt.at}
            </span>
            <span className={s.bannerTime}>
              <Clock size={12} />
              {S.run.totalSeconds}s · {S.run.credits} credits
            </span>
          </div>
          <p className={s.bannerText}>{S.prompt.text}</p>

          <div className={s.bannerMeta}>
            {S.prompt.attachments.map((a) => (
              <span key={a.name} className={s.bannerChip}>
                <Paperclip size={11} /> {a.name} · {a.pages}pp
              </span>
            ))}
            {S.run.grounding.map((g) => (
              <span key={g} className={s.bannerChip}>
                <Check size={11} /> {g}
              </span>
            ))}
          </div>

          <div className={s.bannerSteps}>
            {S.run.stages.map((st) => (
              <span key={st.label} className={s.step}>
                <Check size={10} />
                {st.label} · {st.detail}
              </span>
            ))}
          </div>
        </section>

        <div className={s.grid}>
          {/* ── the deck ───────────────────────────────────────── */}
          <section className={s.card}>
            <div className={s.cardHead}>
              <span className={`${s.kindChip} ${s.kDeck}`}>
                <MonitorPlay size={12} /> {KIND_LABEL[S.deck.kind]}
              </span>
              <span className={s.cardCount}>
                Slide {slide.n} of {S.deck.slides.length}
              </span>
            </div>
            <h2 className={s.cardTitle}>{S.deck.title}</h2>
            <p className={s.cardSub}>{S.deck.subtitle}</p>

            <div className={s.stage}>
              <SlideArt seed={slide.art} />
              <div className={s.stageCap}>
                <h3 className={s.stageTitle}>{slide.title}</h3>
                <ul className={s.stageBullets}>
                  {slide.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className={s.thumbs}>
              {S.deck.slides.map((sl, k) => (
                <button key={sl.n} type="button" className={s.thumb} data-on={k === i} onClick={() => setI(k)} aria-label={`Slide ${sl.n} — ${sl.title}`}>
                  <SlideArt seed={sl.art} />
                </button>
              ))}
            </div>

            <p className={s.notes}>
              <b>Speaker notes</b>
              {slide.notes}
            </p>

            <div className={s.cardFoot}>
              <button type="button" className={`${s.btn} ${s.btnMain}`}>
                <Play size={13} /> Present
              </button>
              <button type="button" className={s.btn}>
                <Save size={13} /> Save to library
              </button>
              <button type="button" className={s.btn}>
                <Download size={13} /> Export .pptx
              </button>
            </div>
          </section>

          {/* ── the plan ───────────────────────────────────────── */}
          <section className={s.card}>
            <div className={s.cardHead}>
              <span className={`${s.kindChip} ${s.kPlan}`}>
                <FileText size={12} /> {KIND_LABEL[S.plan.kind]}
              </span>
              <span className={s.cardCount}>
                {S.plan.phases.length} phases · {S.plan.duration}
              </span>
            </div>
            <h2 className={s.cardTitle}>{S.plan.title}</h2>
            <p className={s.cardSub}>
              {S.plan.grade} · {S.plan.subject} · {S.plan.outcomes.length} outcomes
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
                      <Sparkles size={11} />
                      {p.teacher}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div className={s.diffs}>
              <div className={s.diff}>
                <span className={s.diffKey}>Support</span>
                <span className={s.diffVal}>{S.plan.differentiation.support}</span>
              </div>
              <div className={s.diff}>
                <span className={s.diffKey}>Stretch</span>
                <span className={s.diffVal}>{S.plan.differentiation.stretch}</span>
              </div>
              <div className={s.diff}>
                <span className={s.diffKey}>Language</span>
                <span className={s.diffVal}>{S.plan.differentiation.ell}</span>
              </div>
            </div>

            <div className={s.cardFoot}>
              <button type="button" className={`${s.btn} ${s.btnMain}`}>
                <Save size={13} /> Save to library
              </button>
              <button type="button" className={s.btn}>
                Add to Sunday 08:15 <ChevronRight size={13} />
              </button>
            </div>
          </section>
        </div>

        {/* ── the check ────────────────────────────────────────── */}
        <section className={s.card} style={{ marginTop: 16 }}>
          <div className={s.cardHead}>
            <span className={`${s.kindChip} ${s.kCheck}`}>
              <GraduationCap size={12} /> {KIND_LABEL[S.check.kind]}
            </span>
            <span className={s.cardCount}>
              {S.check.questions.length} questions · {S.check.marks} marks · {S.check.minutes} min
            </span>
          </div>
          <h2 className={s.cardTitle}>{S.check.title}</h2>
          <p className={s.cardSub}>{S.check.grade} · answer key shown to you only</p>

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

          <div className={s.cardFoot}>
            <button type="button" className={`${s.btn} ${s.btnMain}`}>
              Set for {S.grade} tonight
            </button>
            <button type="button" className={s.btn}>
              <Download size={13} /> Print teacher copy
            </button>
          </div>
        </section>

        {/* ── the numbers ──────────────────────────────────────── */}
        <div className={s.stats}>
          <div className={s.stat}>
            <span className={s.statKey}>Made today</span>
            <div className={s.statNum}>{pulse.at(-1)}</div>
            <div className={s.spark} role="img" aria-label="Fourteen days of activity">
              {pulse.map((v, k) => (
                <span key={k} className={s.sparkBar} data-hot={k >= pulse.length - 3} style={{ height: `${Math.max(8, (v / peak) * 100)}%` }} />
              ))}
            </div>
          </div>
          <div className={s.stat}>
            <span className={s.statKey}>Streak</span>
            <div className={s.statNum}>{streak.days}</div>
            <p className={s.statFoot}>
              days running · {streak.hours} {streak.label}
            </p>
          </div>
          <div className={s.stat} style={{ gridColumn: "span 2" }}>
            <span className={s.statKey}>Made this term</span>
            <div style={{ marginTop: 8 }}>
              {tally.map((t) => (
                <div key={t.kind} className={s.tallyRow}>
                  <span className={s.tallyName}>{KIND_LABEL[t.kind]}</span>
                  <span className={s.tallyTrack}>
                    <span className={s.tallyFill} style={{ width: `${(t.made / maxMade) * 100}%` }} />
                  </span>
                  <span className={s.tallyNum}>{t.made}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── composer ─────────────────────────────────────────── */}
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
