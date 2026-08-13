"use client";

// 02 · Canvas — the conversation on the left, the work on the right.
//
// The structural argument: what the studio produced is not a message. A
// deck is an object you keep coming back to, so it gets a pane that
// never scrolls away, and the three outcomes in the reply are pickers
// for that pane rather than cards you read once.

import { useState } from "react";
import {
  Sparkles, FileText, Layers, GraduationCap, ChevronRight, ChevronLeft,
  Save, Download, Play, Paperclip, Send, Check,
} from "lucide-react";
import SlideArt from "../../SlideArt";
import { KIND_LABEL, SESSIONS } from "../../fixture";
import StudioFrame from "../../StudioFrame";
import s from "./Canvas.module.css";

const LETTER = ["A", "B", "C", "D"];
type Tab = "lesson" | "deck" | "quiz";

const TAB_ICON = { plan: FileText, deck: Layers, check: GraduationCap };

export default function Canvas() {
  const [session, setSession] = useState(0);
  const [tab, setTab] = useState<Tab>("deck");
  const [i, setI] = useState(2);
  const S = SESSIONS[session];
  const slide = S.deck.slides[Math.min(i, S.deck.slides.length - 1)];

  // Built from the session, not from the module, so the labels follow it:
  // the second conversation's tabs read Activity / Deck / Homework.
  const TABS: { id: Tab; label: string; icon: typeof FileText; count: string }[] = [
    { id: "lesson", label: KIND_LABEL[S.plan.kind], icon: TAB_ICON.plan, count: `${S.plan.phases.length}` },
    { id: "deck", label: "Deck", icon: TAB_ICON.deck, count: `${S.deck.slides.length}` },
    { id: "quiz", label: KIND_LABEL[S.check.kind], icon: TAB_ICON.check, count: `${S.check.questions.length}` },
  ];

  return (
    <StudioFrame
      theme={s.theme}
      session={session}
      onSession={(n) => { setSession(n); setI(0); setTab("deck"); }}
    >
    <div className={s.page}>
      {/* ── the session bar ───────────────────────────────────────── */}
      <header className={s.top}>
        <span className={s.sessionName}>
          <b>{S.title}</b> · {S.grade}
        </span>
        <span className={s.status}>
          <span className={s.statusDot} />
          {S.made.length} outcomes ready · {S.run.totalSeconds}s · {S.run.credits} credits
        </span>
      </header>

      <div className={s.split}>
        {/* ── left · conversation ─────────────────────────────────── */}
        <section className={s.chat}>
          <div className={s.thread}>
            <div className={s.userRow}>
              <div>
                <div className={s.bubble}>{S.prompt.text}</div>
                <div className={s.clips}>
                  {S.prompt.attachments.map((a) => (
                    <span key={a.name} className={s.clip}>
                      <Paperclip size={9} /> {a.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className={s.botRow}>
              <span className={s.spark}>
                <Sparkles size={13} />
              </span>
              <div className={s.botBody}>
                <p className={s.said}>
                  I read both attachments and matched all three MoE outcomes. Here is a{" "}
                  <b>{S.plan.duration}</b> lesson in six phases, the deck to project alongside it,
                  and a {S.check.questions.length}-question quiz you can set as homework tonight.
                </p>

                <div className={s.steps}>
                  {S.run.stages.map((st) => (
                    <div key={st.label} className={s.step}>
                      <Check size={11} className={s.stepTick} />
                      <b>{st.label}</b>
                      <span>· {st.detail}</span>
                      <span className={s.stepMs}>{(st.ms / 1000).toFixed(1)}s</span>
                    </div>
                  ))}
                </div>

                <div className={s.picks}>
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={s.pick}
                      data-on={tab === t.id}
                      onClick={() => setTab(t.id)}
                    >
                      <span className={s.pickIcon}>
                        <t.icon size={14} />
                      </span>
                      <span className={s.pickText}>
                        <span className={s.pickTitle}>
                          {t.id === "deck" ? S.deck.title : t.id === "quiz" ? S.check.title : S.plan.title}
                        </span>
                        <span className={s.pickMeta}>
                          {t.label} ·{" "}
                          {t.id === "deck"
                            ? `${S.deck.slides.length} slides`
                            : t.id === "quiz"
                              ? `${S.check.marks} marks · ${S.check.minutes} min`
                              : `${S.plan.phases.length} phases · ${S.plan.duration}`}
                        </span>
                      </span>
                      <ChevronRight size={15} className={s.pickGo} />
                    </button>
                  ))}
                </div>

                <div className={s.actions}>
                  <button type="button" className={s.chip} data-primary="true">
                    <Save size={11} /> Save all three
                  </button>
                  <button type="button" className={s.chip}>Ask for a change</button>
                  <button type="button" className={s.chip}>Save this approach</button>
                </div>
              </div>
            </div>
          </div>

          <div className={s.composer}>
            <div className={s.box}>
              <p className={s.input}>Ask for a change, or start the next one…</p>
              <div className={s.bar}>
                {(["lesson_plan", "presentation", "quiz", "homework", "activity"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={s.kind}
                    data-on={k === "lesson_plan" || k === "presentation" || k === "quiz"}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
                <button type="button" className={s.send} aria-label="Send">
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── right · canvas ──────────────────────────────────────── */}
        <section className={s.canvas}>
          <div className={s.tabs}>
            {TABS.map((t) => (
              <button key={t.id} type="button" className={s.tab} data-on={tab === t.id} onClick={() => setTab(t.id)}>
                <t.icon size={13} />
                {t.label}
                <span className={s.tabCount}>{t.count}</span>
              </button>
            ))}
            <span className={s.tools}>
              <button type="button" className={s.tool}>
                <Download size={12} /> Export
              </button>
              <button type="button" className={s.tool}>
                <Save size={12} /> Save
              </button>
              {tab === "deck" && (
                <button type="button" className={s.tool} data-primary="true">
                  <Play size={12} /> Present
                </button>
              )}
            </span>
          </div>

          <div className={s.pane}>
            {tab === "deck" && (
              <div className={s.stageWrap}>
                <div className={s.stage} data-layout={slide.layout}>
                  <SlideArt seed={slide.art} className={s.stageArt} />
                  <div className={s.stageText}>
                    <h2 className={s.stageTitle}>{slide.title}</h2>
                    <ul className={s.stageBullets}>
                      {slide.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className={s.stageBar}>
                  <button type="button" className={s.nav} onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} aria-label="Previous slide">
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className={s.nav}
                    onClick={() => setI((v) => Math.min(S.deck.slides.length - 1, v + 1))}
                    disabled={i === S.deck.slides.length - 1}
                    aria-label="Next slide"
                  >
                    <ChevronRight size={15} />
                  </button>
                  <span className={s.counter}>
                    Slide {slide.n} of {S.deck.slides.length}
                  </span>
                  <span className={s.speaker}>
                    <b>Speaker notes</b>
                    {slide.notes}
                  </span>
                </div>

                <div className={s.film}>
                  {S.deck.slides.map((sl, k) => (
                    <button key={sl.n} type="button" className={s.frame} data-on={k === i} onClick={() => setI(k)} aria-current={k === i}>
                      <SlideArt seed={sl.art} />
                      <span className={s.frameCap}>
                        <span className={s.frameNum}>{sl.n}</span>
                        {sl.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === "lesson" && (
              <div className={s.doc}>
                <div className={s.docHead}>
                  <h2 className={s.docTitle}>{S.plan.title}</h2>
                  <p className={s.docSub}>
                    {S.plan.grade} · {S.plan.subject} · {S.plan.duration}
                  </p>
                  <div className={s.pills}>
                    {S.plan.materials.map((m) => (
                      <span key={m} className={s.pill}>{m}</span>
                    ))}
                  </div>
                </div>

                <div className={s.tl}>
                  {S.plan.phases.map((p) => (
                    <div key={p.n} className={s.tlItem}>
                      <div className={s.tlTop}>
                        <h3 className={s.tlName}>{p.name}</h3>
                        <span className={s.tlMin}>{p.minutes} min</span>
                      </div>
                      <p className={s.tlBody}>{p.body}</p>
                      <p className={s.tlNote}>{p.teacher}</p>
                    </div>
                  ))}
                </div>

                <div className={s.grid3}>
                  <div className={s.mini}>
                    <span className={s.miniKey}>Support</span>
                    <span className={s.miniVal}>{S.plan.differentiation.support}</span>
                  </div>
                  <div className={s.mini}>
                    <span className={s.miniKey}>Stretch</span>
                    <span className={s.miniVal}>{S.plan.differentiation.stretch}</span>
                  </div>
                  <div className={s.mini}>
                    <span className={s.miniKey}>Language</span>
                    <span className={s.miniVal}>{S.plan.differentiation.ell}</span>
                  </div>
                </div>
              </div>
            )}

            {tab === "quiz" && (
              <div className={s.doc}>
                <div className={s.docHead}>
                  <h2 className={s.docTitle}>{S.check.title}</h2>
                  <p className={s.docSub}>
                    {S.check.grade} · {S.check.marks} marks · {S.check.minutes} minutes · answer key shown
                  </p>
                </div>
                {S.check.questions.map((q, k) => (
                  <article key={q.q} className={s.qCard}>
                    <div className={s.qTop}>
                      <span className={s.qNum}>{k + 1}</span>
                      <p className={s.qText}>{q.q}</p>
                      <span className={s.qTag}>{q.difficulty}</span>
                    </div>
                    <div className={s.qOpts}>
                      {q.options.map((o, oi) => (
                        <div key={o} className={s.qOpt} data-right={oi === q.answer}>
                          <span className={s.qLetter}>{LETTER[oi]}</span>
                          {o}
                        </div>
                      ))}
                    </div>
                    <p className={s.qWhy}>
                      <b>Why this one — </b>
                      {q.why}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
    </StudioFrame>
  );
}
