"use client";

// 08 · Ribbon — the deck runs sideways.
//
// The only one of the ten that does not show you a single slide. A deck
// is laid out as a scroll-snapped ribbon at a size where three or four
// frames are legible together, because checking a deck is a scan of the
// whole shape, not a click through eight of them. The selected frame is
// the one that shows its speaker notes.
//
// Below it the plan and the check run as two newspaper columns, which is
// the same reason: both readable at once beats one at a time.

import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import SlideArt from "../../SlideArt";
import StudioFrame from "../../StudioFrame";
import { KIND_LABEL, KINDS, pulse, SESSIONS, streak } from "../../fixture";
import s from "./Ribbon.module.css";

const LETTER = ["a", "b", "c", "d"];

export default function Ribbon() {
  const [session, setSession] = useState(0);
  const [i, setI] = useState(2);
  const S = SESSIONS[session];
  const peak = Math.max(...pulse);

  return (
    <StudioFrame theme={s.theme} session={session} onSession={(n) => { setSession(n); setI(0); }}>
      <div className={s.page}>
        {/* ── the brief ───────────────────────────────────────────── */}
        <header className={s.head}>
          <div className={s.headTop}>
            <span className={s.eyebrow}>
              {S.grade} · {S.subject}
            </span>
            <span className={s.headTime}>
              {S.prompt.at} · {S.run.totalSeconds}s · {S.run.credits} credits
            </span>
          </div>
          <h1 className={s.brief}>{S.prompt.text}</h1>
          <div className={s.headRow}>
            {S.prompt.attachments.map((a) => (
              <span key={a.name} className={s.fact}>
                Read <b>{a.name}</b> · {a.pages}pp
              </span>
            ))}
            <span className={s.rule} />
            {S.run.grounding.map((g) => (
              <span key={g} className={s.fact}>
                Grounded in <b>{g}</b>
              </span>
            ))}
          </div>
        </header>

        {/* ── the ribbon ──────────────────────────────────────────── */}
        <section className={s.band}>
          <div className={s.bandHead}>
            <h2 className={s.bandTitle}>{S.deck.title}</h2>
            <span className={s.bandMeta}>
              {KIND_LABEL[S.deck.kind]} · {S.deck.slides.length} slides
            </span>
          </div>

          <div className={s.ribbon}>
            {S.deck.slides.map((sl, k) => (
              <button
                key={sl.n}
                type="button"
                className={s.frame}
                data-on={k === i}
                onClick={() => setI(k)}
                aria-current={k === i}
              >
                <span className={s.framePlate}>
                  <SlideArt seed={sl.art} />
                </span>
                <span className={s.frameCap}>
                  <span className={s.frameN}>{String(sl.n).padStart(2, "0")}</span>
                  <span className={s.frameT}>{sl.title}</span>
                </span>
                <ul className={s.frameBullets}>
                  {sl.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <span className={s.frameNote}>{sl.notes}</span>
              </button>
            ))}
          </div>

          <p className={s.scrollHint}>
            <span className={s.hintLine} />
            Scroll the ribbon
            <ArrowRight size={12} />
          </p>
        </section>

        {/* ── plan and check, side by side ────────────────────────── */}
        <div className={s.split}>
          <section className={s.col}>
            <div className={s.colHead}>
              <span className={s.colKind}>{KIND_LABEL[S.plan.kind]}</span>
              <span className={s.colMeta}>
                {S.plan.duration} · {S.plan.phases.length} phases
              </span>
            </div>
            <h2 className={s.colTitle}>{S.plan.title}</h2>
            <p className={s.colSub}>
              {S.plan.grade} · {S.plan.materials.join(" · ")}
            </p>

            {S.plan.phases.map((p) => (
              <article key={p.n} className={s.phase}>
                <div className={s.pMin}>
                  {p.minutes}
                  <span>MIN</span>
                </div>
                <div>
                  <h3 className={s.pName}>{p.name}</h3>
                  <p className={s.pBody}>{p.body}</p>
                  <p className={s.pNote}>{p.teacher}</p>
                </div>
              </article>
            ))}

            <div className={s.diffs}>
              <div className={s.diffRow}>
                <span className={s.diffK}>Support</span>
                <span className={s.diffV}>{S.plan.differentiation.support}</span>
              </div>
              <div className={s.diffRow}>
                <span className={s.diffK}>Stretch</span>
                <span className={s.diffV}>{S.plan.differentiation.stretch}</span>
              </div>
              <div className={s.diffRow}>
                <span className={s.diffK}>Language</span>
                <span className={s.diffV}>{S.plan.differentiation.ell}</span>
              </div>
            </div>
          </section>

          <section className={s.col}>
            <div className={s.colHead}>
              <span className={s.colKind}>{KIND_LABEL[S.check.kind]}</span>
              <span className={s.colMeta}>
                {S.check.marks} marks · {S.check.minutes} min
              </span>
            </div>
            <h2 className={s.colTitle}>{S.check.title}</h2>
            <p className={s.colSub}>{S.check.grade} · the correct answer carries the rule</p>

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
        </div>

        {/* ── numbers ─────────────────────────────────────────────── */}
        <div className={s.strip}>
          <div className={s.cell}>
            <span className={s.cellK}>Made today</span>
            <div className={s.cellV}>{pulse.at(-1)}</div>
            <div className={s.bars} role="img" aria-label="Fourteen days of activity">
              {pulse.map((v, k) => (
                <span key={k} className={s.bar} data-hot={k >= pulse.length - 3} style={{ height: `${Math.max(8, (v / peak) * 100)}%` }} />
              ))}
            </div>
          </div>
          <div className={s.cell}>
            <span className={s.cellK}>Day streak</span>
            <div className={s.cellV}>{streak.days}</div>
            <p className={s.cellF}>unbroken since term began</p>
          </div>
          <div className={s.cell}>
            <span className={s.cellK}>Hours saved</span>
            <div className={s.cellV}>{streak.hours}</div>
            <p className={s.cellF}>{streak.label}</p>
          </div>
          <div className={s.cell}>
            <span className={s.cellK}>This conversation</span>
            <div className={s.cellV}>{S.turns}</div>
            <p className={s.cellF}>
              turns · {S.made.map((k) => KIND_LABEL[k].toLowerCase()).join(", ")}
            </p>
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
    </StudioFrame>
  );
}
