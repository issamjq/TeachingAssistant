"use client";

// 05 · Bento — the session as tiles.
//
// Everything the session produced, and everything it did to the week,
// on one board. The deck gets the biggest tile because it is the thing
// that goes on a projector; the plan gets the tallest because it is the
// thing with the most steps; the numbers get the smallest because they
// are numbers.

import { useState } from "react";
import {
  FileText, GraduationCap, Activity, CalendarDays, Library, Send, Sparkles, Paperclip,
} from "lucide-react";
import SlideArt from "../../SlideArt";
import {
  classes, deck, lesson, prompt, pulse, quiz, recents, run, streak, tally, teacher, KIND_LABEL,
} from "../../fixture";
import s from "./Bento.module.css";

const LETTER = ["A", "B", "C", "D"];
const KINDS = ["lesson_plan", "presentation", "quiz", "homework", "activity"] as const;

export default function Bento() {
  const [i, setI] = useState(2);
  const slide = deck.slides[i];
  const peak = Math.max(...pulse);
  const maxMade = Math.max(...tally.map((t) => t.made));

  return (
    <div className={s.page}>
      <header className={s.top}>
        <div>
          <h1 className={s.hello}>
            Three things, <em>ready to teach.</em>
          </h1>
          <p className={s.helloSub}>
            {teacher.name} · {teacher.role} · {teacher.school}
          </p>
        </div>
        <div className={s.topRight}>
          <span className={s.badge}>
            <b>{run.totalSeconds}s</b> · {run.credits} credits
          </span>
          <span className={s.badge}>
            {teacher.creditsTotal - teacher.creditsUsed} left
          </span>
          <span className={s.face}>{teacher.initials}</span>
        </div>
      </header>

      <div className={s.board}>
        {/* ── the ask ─────────────────────────────────────────────── */}
        <section className={`${s.tile} ${s.ask}`}>
          <div className={s.askBox}>
            <span className={s.tileIcon}>
              <Sparkles size={14} />
            </span>
            <p className={s.askText}>
              <b>You asked — </b>
              {prompt.text}
            </p>
            <span className={s.askKinds}>
              {KINDS.map((k) => (
                <button key={k} type="button" className={s.kind} data-on={k === "lesson_plan" || k === "presentation" || k === "quiz"}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </span>
            <button type="button" className={s.askSend} aria-label="Send">
              <Send size={15} />
            </button>
            <div className={s.clips}>
              {prompt.attachments.map((a) => (
                <span key={a.name} className={s.clip}>
                  <Paperclip size={9} /> {a.name} · {a.pages}pp
                </span>
              ))}
              {prompt.skills.map((sk) => (
                <span key={sk} className={s.clip}>Skill · {sk}</span>
              ))}
              {run.grounding.map((g) => (
                <span key={g} className={s.clip}>Grounded · {g}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── the deck ────────────────────────────────────────────── */}
        <section className={`${s.tile} ${s.deckT}`}>
          <div className={s.deckArt}>
            <SlideArt seed={slide.art} />
            <div className={s.deckOver}>
              <span className={s.deckKind}>
                {KIND_LABEL.presentation} · slide {slide.n} of {deck.slides.length}
              </span>
              <h2 className={s.deckTitle}>{slide.title}</h2>
              <ul className={s.deckBullets}>
                {slide.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className={s.deckStrip}>
            {deck.slides.map((sl, k) => (
              <button key={sl.n} type="button" className={s.deckPip} data-on={k === i} onClick={() => setI(k)} aria-label={`Slide ${sl.n} — ${sl.title}`}>
                <SlideArt seed={sl.art} />
              </button>
            ))}
          </div>
          <p className={s.deckNote}>
            <b>Speaker notes</b>
            {slide.notes}
          </p>
        </section>

        {/* ── the plan ────────────────────────────────────────────── */}
        <section className={`${s.tile} ${s.planT}`}>
          <div className={s.tileHead}>
            <span className={s.tileIcon}>
              <FileText size={14} />
            </span>
            <span className={s.tileKey}>{KIND_LABEL.lesson_plan}</span>
            <button type="button" className={s.tileMore}>Open</button>
          </div>
          <h2 className={s.planTitle}>{lesson.title}</h2>
          <p className={s.planSub}>
            {lesson.grade} · {lesson.duration} · {lesson.phases.length} phases
          </p>
          {lesson.phases.map((p) => (
            <div key={p.n} className={s.phase}>
              <span className={s.phaseMin}>{p.minutes}</span>
              <div>
                <h3 className={s.phaseName}>{p.name}</h3>
                <p className={s.phaseBody}>{p.body}</p>
              </div>
            </div>
          ))}
          <div className={s.planFoot}>
            {lesson.materials.map((m) => (
              <span key={m} className={s.mini}>{m}</span>
            ))}
          </div>
        </section>

        {/* ── the quiz ────────────────────────────────────────────── */}
        <section className={`${s.tile} ${s.quizT}`}>
          <div className={s.tileHead}>
            <span className={s.tileIcon}>
              <GraduationCap size={14} />
            </span>
            <span className={s.tileKey}>
              {KIND_LABEL.quiz} · {quiz.marks} marks · {quiz.minutes} min
            </span>
            <button type="button" className={s.tileMore}>Set as homework</button>
          </div>
          {quiz.questions.slice(0, 3).map((q, k) => (
            <div key={q.q} className={s.qRow}>
              <span className={s.qN}>{k + 1}</span>
              <div style={{ minWidth: 0 }}>
                <p className={s.qText}>{q.q}</p>
                <div className={s.qOpts}>
                  {q.options.map((o, oi) => (
                    <span key={o} className={s.qOpt} data-right={oi === q.answer}>
                      {LETTER[oi]} · {o}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <p className={s.numFoot}>
            + {quiz.questions.length - 3} more, answer key marked throughout.
          </p>
        </section>

        {/* ── the fortnight ───────────────────────────────────────── */}
        <section className={`${s.tile} ${s.pulseT} ${s.dark}`}>
          <div className={s.tileHead}>
            <span className={s.tileIcon}>
              <Activity size={14} />
            </span>
            <span className={s.tileKey}>Last 14 days</span>
          </div>
          <div className={s.bigNum}>{pulse.at(-1)}</div>
          <p className={s.numFoot}>
            made today · {streak.days}-day streak · {streak.hours} {streak.label}
          </p>
          <div className={s.spark} role="img" aria-label="Fourteen days of activity">
            {pulse.map((v, k) => (
              <span key={k} className={s.sparkBar} data-hot={k >= pulse.length - 3} style={{ height: `${Math.max(6, (v / peak) * 100)}%` }} />
            ))}
          </div>
        </section>

        {/* ── by kind ─────────────────────────────────────────────── */}
        <section className={`${s.tile} ${s.tallyT}`}>
          <div className={s.tileHead}>
            <span className={s.tileKey}>Made this term</span>
          </div>
          {tally.map((t) => (
            <div key={t.kind} className={s.tallyRow}>
              <span className={s.tallyName}>{KIND_LABEL[t.kind]}</span>
              <span className={s.tallyTrack}>
                <span className={s.tallyFill} style={{ width: `${(t.made / maxMade) * 100}%` }} />
              </span>
              <span className={s.tallyNum}>
                {t.made}
                <span className={`${s.delta} ${t.delta >= 0 ? s.up : s.down}`}>
                  {t.delta >= 0 ? "+" : ""}
                  {t.delta}
                </span>
              </span>
            </div>
          ))}
        </section>

        {/* ── classes ─────────────────────────────────────────────── */}
        <section className={`${s.tile} ${s.classT}`}>
          <div className={s.tileHead}>
            <span className={s.tileIcon}>
              <CalendarDays size={14} />
            </span>
            <span className={s.tileKey}>Who this is for</span>
          </div>
          {classes.map((c) => (
            <div key={c.name} className={s.classRow}>
              <span className={s.classDot}>{c.name}</span>
              <span className={s.classText}>
                <span className={s.classWhen}>{c.next}</span>
                <span className={s.classSub}>{c.students} students</span>
              </span>
              <span className={`${s.ready} ${c.ready ? s.readyYes : s.readyNo}`}>
                {c.ready ? "Ready" : "No plan"}
              </span>
            </div>
          ))}
        </section>

        {/* ── the shelf ───────────────────────────────────────────── */}
        <section className={`${s.tile} ${s.shelfT}`}>
          <div className={s.tileHead}>
            <span className={s.tileIcon}>
              <Library size={14} />
            </span>
            <span className={s.tileKey}>Recently made</span>
          </div>
          {recents.slice(0, 6).map((r) => (
            <div key={r.title} className={s.shelfRow}>
              <span className={s.shelfTitle}>{r.title}</span>
              {r.live && <span className={s.new}>new</span>}
              <span className={s.shelfWhen}>{r.when}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
