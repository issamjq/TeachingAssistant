"use client";

// 07 · Focus — almost nothing.
//
// No cards, no panels, no tiles. Everything is set on the same ground
// and separated by space and a single hairline, and the accent is spent
// exactly four times: the timestamp, the slide rules, the correct
// answer, and the send. The artwork therefore does all the shouting,
// which is the point — it is the only thing on the page with a colour
// field behind it.

import { useState } from "react";
import SlideArt from "../../SlideArt";
import {
  deck, lesson, prompt, pulse, quiz, recents, run, streak, teacher, KIND_LABEL,
} from "../../fixture";
import s from "./Focus.module.css";

const LETTER = ["a", "b", "c", "d"];
const KINDS = ["lesson_plan", "presentation", "quiz", "homework", "activity"] as const;

/** Fourteen days as one line, because a bar chart would be a container. */
function PulseLine() {
  const peak = Math.max(...pulse);
  const pts = pulse.map((v, k) => {
    const x = (k / (pulse.length - 1)) * 100;
    const y = 40 - (v / peak) * 36;
    return `${x},${y}`;
  });
  return (
    <svg viewBox="0 0 100 44" preserveAspectRatio="none" role="img" aria-label="Fourteen days of activity">
      <polyline points={pts.join(" ")} fill="none" stroke="var(--p-accent)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
      <circle cx="100" cy={40 - (pulse[pulse.length - 1] / peak) * 36} r="2" fill="var(--p-accent)" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Focus() {
  const [i, setI] = useState(2);
  const slide = deck.slides[i];

  return (
    <div className={s.page}>
      <div className={s.bar}>
        <span className={s.barMark}>Murchid Studio</span>
        <span className={s.barRight}>
          <span>{teacher.role}</span>
          <span>{teacher.creditsTotal - teacher.creditsUsed} credits</span>
        </span>
      </div>

      {/* ── the brief ─────────────────────────────────────────────── */}
      <header className={s.wrap}>
        <div className={s.head}>
          <p className={s.time}>
            {prompt.at} · {teacher.name}
          </p>
          <h1 className={s.brief}>{prompt.text}</h1>
          <div className={s.briefMeta}>
            <span>
              Read <b>{prompt.attachments.map((a) => a.name).join(", ")}</b>
            </span>
            <span>
              Grounded in <b>{run.grounding.join(" and ")}</b>
            </span>
            <span>
              Three outcomes in <b>{run.totalSeconds} seconds</b>, {run.credits} credits
            </span>
          </div>
        </div>
      </header>

      {/* ── the deck ──────────────────────────────────────────────── */}
      <section className={s.wide}>
        <div className={s.rule}>
          <span className={s.ruleN}>I</span>
          <span className={s.ruleLine} />
          <span className={s.ruleWhat}>
            {KIND_LABEL.presentation} · {deck.slides.length} slides
          </span>
        </div>
        <h2 className={s.h2}>{deck.title}</h2>
        <p className={s.sub}>{deck.subtitle}</p>

        <SlideArt seed={slide.art} className={s.plate} />
        <p className={s.plateCap}>
          <b>Slide {String(slide.n).padStart(2, "0")}</b>
          <span>{slide.layout}</span>
        </p>

        <h3 className={s.slideTitle}>{slide.title}</h3>
        <ul className={s.slideBullets}>
          {slide.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className={s.slideNote}>
          <b>Speaker notes</b>
          {slide.notes}
        </p>

        <div className={s.nums}>
          {deck.slides.map((sl, k) => (
            <button key={sl.n} type="button" className={s.num} data-on={k === i} onClick={() => setI(k)} aria-label={`Slide ${sl.n} — ${sl.title}`} aria-current={k === i}>
              {String(sl.n).padStart(2, "0")}
            </button>
          ))}
        </div>
      </section>

      {/* ── the plan ──────────────────────────────────────────────── */}
      <section className={s.wrap}>
        <div className={s.rule}>
          <span className={s.ruleN}>II</span>
          <span className={s.ruleLine} />
          <span className={s.ruleWhat}>
            {KIND_LABEL.lesson_plan} · {lesson.duration}
          </span>
        </div>
        <h2 className={s.h2}>{lesson.title}</h2>
        <p className={s.sub}>
          {lesson.grade} · {lesson.subject} · {lesson.outcomes.length} outcomes
        </p>

        {lesson.phases.map((p) => (
          <article key={p.n} className={s.phase}>
            <div className={s.phaseMin}>
              {p.minutes}
              <span>MIN</span>
            </div>
            <div>
              <h3 className={s.phaseName}>{p.name}</h3>
              <p className={s.phaseBody}>{p.body}</p>
              <p className={s.phaseNote}>{p.teacher}</p>
            </div>
          </article>
        ))}

        <div className={s.diffs}>
          <div className={s.diffRow}>
            <span className={s.diffKey}>Support</span>
            <span className={s.diffVal}>{lesson.differentiation.support}</span>
          </div>
          <div className={s.diffRow}>
            <span className={s.diffKey}>Stretch</span>
            <span className={s.diffVal}>{lesson.differentiation.stretch}</span>
          </div>
          <div className={s.diffRow}>
            <span className={s.diffKey}>Language</span>
            <span className={s.diffVal}>{lesson.differentiation.ell}</span>
          </div>
        </div>
      </section>

      {/* ── the quiz ──────────────────────────────────────────────── */}
      <section className={s.wrap}>
        <div className={s.rule}>
          <span className={s.ruleN}>III</span>
          <span className={s.ruleLine} />
          <span className={s.ruleWhat}>
            {KIND_LABEL.quiz} · {quiz.marks} marks
          </span>
        </div>
        <h2 className={s.h2}>{quiz.title}</h2>
        <p className={s.sub}>
          {quiz.minutes} minutes · the correct answer carries the rule
        </p>

        {quiz.questions.map((q, k) => (
          <article key={q.q} className={s.q}>
            <p className={s.qText}>
              <b>{String(k + 1).padStart(2, "0")}</b>
              {q.q}
            </p>
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

      {/* ── the data ──────────────────────────────────────────────── */}
      <section className={s.wrap}>
        <div className={s.rule}>
          <span className={s.ruleN}>IV</span>
          <span className={s.ruleLine} />
          <span className={s.ruleWhat}>Last fourteen days</span>
        </div>

        <div className={s.dataLine}>
          <div className={s.datum}>
            <div className={s.datumN}>{pulse.at(-1)}</div>
            <span className={s.datumK}>made today</span>
          </div>
          <div className={s.datum}>
            <div className={s.datumN}>{streak.days}</div>
            <span className={s.datumK}>day streak</span>
          </div>
          <div className={s.datum}>
            <div className={s.datumN}>{streak.hours}</div>
            <span className={s.datumK}>hours saved</span>
          </div>
          <div className={s.line}>
            <PulseLine />
          </div>
        </div>

        <div className={s.shelf}>
          {recents.slice(0, 5).map((r) => (
            <div key={r.title} className={s.shelfRow}>
              <span className={s.shelfKind}>{KIND_LABEL[r.kind]}</span>
              <span className={s.shelfTitle}>{r.title}</span>
              <span className={s.shelfWhen}>{r.when}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── the composer ──────────────────────────────────────────── */}
      <div className={s.dock}>
        <div className={s.dockInner}>
          <div className={s.dockRule}>
            <span className={s.dockText}>Ask for a change, or start the next one…</span>
            <button type="button" className={s.dockSend}>Send</button>
          </div>
          <div className={s.dockKinds}>
            {KINDS.map((k) => (
              <button key={k} type="button" className={s.dockKind} data-on={k === "lesson_plan" || k === "presentation" || k === "quiz"}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className={s.dockNote}>Murchid drafts; you decide.</p>
        </div>
      </div>
    </div>
  );
}
