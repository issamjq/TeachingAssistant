"use client";

// 05 · Slate — the quiet dark one.
//
// The working answer to Aurora. Same darkness, none of the theatre: flat
// charcoal, one-pixel borders, and lime spent only where something is
// actually true — a finished step, the active slide, the correct option.
//
// Structurally it is a segmented switch over one pane rather than a
// board or a thread. You look at one outcome at a time, at full width,
// and the segment tells you what else is there.

import { useState } from "react";
import {
  Check, Paperclip, FileText, MonitorPlay, GraduationCap, Save, Play,
  Download, Send, Plus,
} from "lucide-react";
import SlideArt from "../../SlideArt";
import StudioFrame from "../../StudioFrame";
import {
  KIND_LABEL, KINDS, olderSessions, pulse, SESSIONS, streak, tally,
} from "../../fixture";
import { KIND_ICON } from "../../kinds";
import s from "./Slate.module.css";

const LETTER = ["a", "b", "c", "d"];
type Pane = "plan" | "deck" | "check";

export default function Slate() {
  const [session, setSession] = useState(0);
  const [pane, setPane] = useState<Pane>("deck");
  const [i, setI] = useState(2);
  const S = SESSIONS[session];
  const slide = S.deck.slides[Math.min(i, S.deck.slides.length - 1)];
  const peak = Math.max(...pulse);
  const madeThisTerm = tally.reduce((a, t) => a + t.made, 0);

  return (
    <StudioFrame dark>
      <div className={s.page}>
        <div className={s.work}>
        {/* ── brief ───────────────────────────────────────────────── */}
        <section className={s.brief}>
          <div className={s.briefTop}>
            <span className={s.tag}>{S.grade}</span>
            <span className={s.tag}>{S.subject}</span>
            {S.prompt.skills.map((sk) => (
              <span key={sk} className={`${s.tag} ${s.tagOn}`}>{sk}</span>
            ))}
            <span className={s.briefTime}>
              {S.prompt.at} · {S.run.totalSeconds}s · {S.run.credits} credits
            </span>
          </div>
          <p className={s.briefText}>{S.prompt.text}</p>

          <div className={s.briefFiles}>
            {S.prompt.attachments.map((a) => (
              <span key={a.name} className={s.file}>
                <Paperclip size={11} />
                <b>{a.name}</b> {a.pages}pp · {a.size}
              </span>
            ))}
            {S.run.grounding.map((g) => (
              <span key={g} className={s.file}>
                <Check size={11} /> {g}
              </span>
            ))}
          </div>

          <div className={s.steps}>
            {S.run.stages.map((st, k) => (
              <div key={st.label} className={s.stepCell}>
                <span className={s.stepTop}>
                  <Check size={12} className={s.stepTick} />
                  <span className={s.stepName}>{st.label}</span>
                </span>
                <span className={s.stepSub}>
                  {st.detail} · {(st.ms / 1000).toFixed(1)}s · {S.run.clock[k]}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── segmented switch ────────────────────────────────────── */}
        <div className={s.segWrap}>
          <div className={s.seg}>
            <button type="button" className={s.segBtn} data-on={pane === "plan"} onClick={() => setPane("plan")}>
              <FileText size={13} />
              {KIND_LABEL[S.plan.kind]}
              <span className={s.segCount}>{S.plan.phases.length}</span>
            </button>
            <button type="button" className={s.segBtn} data-on={pane === "deck"} onClick={() => setPane("deck")}>
              <MonitorPlay size={13} />
              Deck
              <span className={s.segCount}>{S.deck.slides.length}</span>
            </button>
            <button type="button" className={s.segBtn} data-on={pane === "check"} onClick={() => setPane("check")}>
              <GraduationCap size={13} />
              {KIND_LABEL[S.check.kind]}
              <span className={s.segCount}>{S.check.questions.length}</span>
            </button>
          </div>
          <span className={s.segTools}>
            <button type="button" className={s.tool}>
              <Download size={12} /> Export
            </button>
            {pane === "deck" && (
              <button type="button" className={s.tool}>
                <Play size={12} /> Present
              </button>
            )}
            <button type="button" className={`${s.tool} ${s.toolOn}`}>
              <Save size={12} /> Save all
            </button>
          </span>
        </div>

        {/* ── panes ───────────────────────────────────────────────── */}
        {pane === "deck" && (
          <section className={s.pane}>
            <div className={s.paneHead}>
              <h2 className={s.paneTitle}>{S.deck.title}</h2>
              <span className={s.paneMeta}>{S.deck.subtitle}</span>
            </div>
            <div className={s.deckGrid}>
              <div className={s.stage}>
                <SlideArt seed={slide.art} />
                <div className={s.stageText}>
                  <h3 className={s.stageTitle}>{slide.title}</h3>
                  <ul className={s.stageBullets}>
                    {slide.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <p className={s.stageNote}>
                    <b>Speaker notes</b>
                    {slide.notes}
                  </p>
                </div>
              </div>
              <div className={s.list}>
                {S.deck.slides.map((sl, k) => (
                  <button key={sl.n} type="button" className={s.listItem} data-on={k === i} onClick={() => setI(k)} aria-current={k === i}>
                    <span className={s.listThumb}>
                      <SlideArt seed={sl.art} />
                    </span>
                    <span className={s.listText}>
                      <span className={s.listN}>{String(sl.n).padStart(2, "0")}</span>
                      {sl.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {pane === "plan" && (
          <section className={s.pane}>
            <div className={s.paneHead}>
              <h2 className={s.paneTitle}>{S.plan.title}</h2>
              <span className={s.paneMeta}>
                {S.plan.grade} · {S.plan.duration} · {S.plan.materials.length} materials
              </span>
            </div>
            {S.plan.phases.map((p) => (
              <article key={p.n} className={s.row}>
                <div className={s.rowMin}>
                  {p.minutes}
                  <span>MIN</span>
                </div>
                <div>
                  <h3 className={s.rowName}>{p.name}</h3>
                  <p className={s.rowBody}>{p.body}</p>
                  <p className={s.rowNote}>{p.teacher}</p>
                </div>
              </article>
            ))}
            <div className={s.kvGrid}>
              <div className={s.kv}>
                <span className={s.kvK}>Support</span>
                <span className={s.kvV}>{S.plan.differentiation.support}</span>
              </div>
              <div className={s.kv}>
                <span className={s.kvK}>Stretch</span>
                <span className={s.kvV}>{S.plan.differentiation.stretch}</span>
              </div>
              <div className={s.kv}>
                <span className={s.kvK}>Language</span>
                <span className={s.kvV}>{S.plan.differentiation.ell}</span>
              </div>
              <div className={s.kv}>
                <span className={s.kvK}>Materials</span>
                <span className={s.kvV}>{S.plan.materials.join(" · ")}</span>
              </div>
            </div>
          </section>
        )}

        {pane === "check" && (
          <section className={s.pane}>
            <div className={s.paneHead}>
              <h2 className={s.paneTitle}>{S.check.title}</h2>
              <span className={s.paneMeta}>
                {S.check.marks} marks · {S.check.minutes} min · key highlighted
              </span>
            </div>
            {S.check.questions.map((q, k) => (
              <article key={q.q} className={s.q}>
                <div className={s.qTop}>
                  <span className={s.qN}>{String(k + 1).padStart(2, "0")}</span>
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
          </section>
        )}

        {/* ── numbers ─────────────────────────────────────────────── */}
        <div className={s.numbers}>
          <div className={s.num}>
            <span className={s.numK}>Made today</span>
            <div className={s.numV}>{pulse.at(-1)}</div>
            <div className={s.bars} role="img" aria-label="Fourteen days of activity">
              {pulse.map((v, k) => (
                <span key={k} className={s.bar} data-hot={k >= pulse.length - 3} style={{ height: `${Math.max(6, (v / peak) * 100)}%` }} />
              ))}
            </div>
          </div>
          <div className={s.num}>
            <span className={s.numK}>Streak</span>
            <div className={s.numV}>
              {streak.days}
              <small>days</small>
            </div>
          </div>
          <div className={s.num}>
            <span className={s.numK}>Saved this term</span>
            <div className={s.numV}>
              {streak.hours}
              <small>hours</small>
            </div>
          </div>
          <div className={s.num}>
            <span className={s.numK}>In your library</span>
            <div className={s.numV}>
              {madeThisTerm}
              <small>pieces</small>
            </div>
          </div>
        </div>

        {/* ── composer ────────────────────────────────────────────── */}
        <div className={s.dock}>
          <p className={s.dockText}>Ask for a change, or start the next one…</p>
          <div className={s.dockBar}>
            {KINDS.map((k) => (
              <button key={k} type="button" className={s.kind} data-on={S.made.includes(k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
            <button type="button" className={s.send}>
              Send <Send size={13} />
            </button>
          </div>
        </div>
        </div>

        {/* ── conversations · a steady right rail ─────────────────── */}
        <aside className={s.rail} aria-label="Conversations">
          <div className={s.railHead}>
            Conversations
            <span className={s.railCount}>{SESSIONS.length + olderSessions.length}</span>
          </div>
          <button type="button" className={s.railNew}>
            <Plus size={13} /> New conversation
          </button>
          <span className={s.railGroup}>Open</span>
          {SESSIONS.map((x, k) => (
            <button
              key={x.id}
              type="button"
              className={s.railItem}
              data-on={k === session}
              onClick={() => { setSession(k); setI(0); setPane("deck"); }}
              aria-current={k === session}
            >
              <span className={s.railTitle}>{x.title}</span>
              <span className={s.railMeta}>
                {x.live && <span className={s.railLive} />}
                {x.when}
                <span className={s.railMade}>
                  {x.made.map((kind) => {
                    const Icon = KIND_ICON[kind];
                    return (
                      <span key={kind} className={s.railChip} title={KIND_LABEL[kind]}>
                        <Icon size={9} />
                      </span>
                    );
                  })}
                </span>
              </span>
            </button>
          ))}
          <span className={s.railGroup}>Earlier</span>
          {olderSessions.map((x) => {
            const Icon = KIND_ICON[x.kind];
            return (
              <button key={x.id} type="button" className={s.railItem}>
                <span className={s.railTitle}>{x.title}</span>
                <span className={s.railMeta}>
                  {x.when} · {x.turns} turns
                  <span className={s.railMade}>
                    <span className={s.railChip} title={KIND_LABEL[x.kind]}>
                      <Icon size={9} />
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
          <p className={s.railNote}>
            Kept for 30 days. Anything you save goes to your library and stays.
          </p>
        </aside>
      </div>
    </StudioFrame>
  );
}
