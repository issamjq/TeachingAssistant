"use client";

// 04 · Console — everything as a record.
//
// One screen, three columns, no scroll in the frame that matters: the
// run log on the left, the outcome under inspection in the middle, the
// deck as a contact sheet on the right. The quiz is a table with a KEY
// column because that is the fastest a teacher can check an answer key,
// and the answer key is the thing they check most.

import { useState } from "react";
import SlideArt from "../../SlideArt";
import {
  classes, deck, lesson, prompt, pulse, quiz, recents, run, streak, tally, teacher, KIND_LABEL,
} from "../../fixture";
import s from "./Console.module.css";

const LETTER = ["A", "B", "C", "D"];
type Tab = "lesson" | "deck" | "quiz";

// A run log reads as a log only if it carries clock time.
const CLOCK = ["09:42:03", "09:42:05", "09:42:06", "09:42:10", "09:42:17"];

export default function Console() {
  const [tab, setTab] = useState<Tab>("quiz");
  const [i, setI] = useState(2);
  const slide = deck.slides[i];
  const peak = Math.max(...pulse);
  const maxMade = Math.max(...tally.map((t) => t.made));

  return (
    <div className={s.page}>
      {/* ── status ────────────────────────────────────────────────── */}
      <div className={s.strip}>
        <span className={`${s.cell} ${s.cellHot}`}>
          Murchid<b>//</b>Studio
        </span>
        <span className={s.cell}>
          Session <b>0x4F2A</b>
        </span>
        <span className={s.cell}>
          User <b>{teacher.initials}</b> · {teacher.role}
        </span>
        <span className={s.cell}>
          Model <b>{run.model}</b>
        </span>
        <span className={`${s.cell} ${s.push}`}>
          Run <b>{run.totalSeconds}s</b>
        </span>
        <span className={s.cell}>
          Credits <b>−{run.credits}</b> / {teacher.creditsTotal - teacher.creditsUsed}
        </span>
        <span className={`${s.cell} ${s.cellHot}`}>
          <b>OK</b> 3/3
        </span>
      </div>

      <div className={s.body}>
        {/* ── left · log ──────────────────────────────────────────── */}
        <div className={`${s.col} ${s.log}`}>
          <div className={s.blockHead}>
            Run log <span>{run.stages.length} steps</span>
          </div>
          {run.stages.map((st, k) => (
            <div key={st.label} className={s.logRow}>
              <span className={s.logT}>{CLOCK[k]}</span>
              <span className={s.logOk}>OK</span>
              <span className={s.logMsg}>
                {st.label}
                <i>
                  {st.detail} · {(st.ms / 1000).toFixed(1)}s
                </i>
              </span>
            </div>
          ))}

          <div className={s.blockHead}>Grounding</div>
          {run.grounding.map((g) => (
            <div key={g} className={s.kv}>
              <span className={s.kvK}>src</span>
              <span className={s.kvV}>
                <b>{g}</b>
              </span>
            </div>
          ))}
          {prompt.attachments.map((a) => (
            <div key={a.name} className={s.kv}>
              <span className={s.kvK}>file</span>
              <span className={s.kvV}>
                {a.pages}pp · {a.size}
              </span>
            </div>
          ))}

          <div className={s.blockHead}>
            Activity <span>14d</span>
          </div>
          <div className={s.bars} role="img" aria-label="Fourteen days of activity">
            {pulse.map((v, k) => (
              <span
                key={k}
                className={s.bar}
                data-hot={k >= pulse.length - 3}
                style={{ height: `${Math.max(4, (v / peak) * 100)}%` }}
              />
            ))}
          </div>
          <div className={s.kv}>
            <span className={s.kvK}>today</span>
            <span className={s.kvV}>
              <b>{pulse.at(-1)}</b> made
            </span>
          </div>
          <div className={s.kv}>
            <span className={s.kvK}>streak</span>
            <span className={s.kvV}>
              <b>{streak.days}d</b> · {streak.hours}h saved
            </span>
          </div>

          <div className={s.blockHead}>By kind · term</div>
          <div className={s.tally}>
            {tally.map((t) => (
              <div key={t.kind} className={s.tallyRow}>
                <span className={s.tallyName}>{KIND_LABEL[t.kind].split(" ")[0]}</span>
                <span className={s.tallyBar}>
                  <span className={s.tallyFill} style={{ width: `${(t.made / maxMade) * 100}%` }} />
                </span>
                <span className={s.tallyNum}>
                  {t.made}
                  <span className={t.delta >= 0 ? s.up : s.down}>
                    {t.delta >= 0 ? "▲" : "▼"}
                    {Math.abs(t.delta)}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className={s.blockHead}>Classes</div>
          {classes.map((c) => (
            <div key={c.name} className={s.kv}>
              <span className={s.kvK}>{c.name}</span>
              <span className={s.kvV}>
                {c.next} · <b>{c.ready ? "READY" : "OPEN"}</b>
              </span>
            </div>
          ))}
        </div>

        {/* ── centre · manifest ───────────────────────────────────── */}
        <div className={`${s.col} ${s.main}`}>
          <div className={s.brief}>
            <span className={s.briefLabel}>Input · {prompt.at}</span>
            <p className={s.briefText}>{prompt.text}</p>
            <div className={s.briefTags}>
              {prompt.attachments.map((a) => (
                <span key={a.name} className={s.tag}>
                  <b>attach</b> {a.name}
                </span>
              ))}
              {prompt.skills.map((sk) => (
                <span key={sk} className={s.tag}>
                  <b>skill</b> {sk}
                </span>
              ))}
            </div>
          </div>

          <div className={s.tabs}>
            <button type="button" className={s.tab} data-on={tab === "lesson"} onClick={() => setTab("lesson")}>
              01 / Lesson<b>{lesson.phases.length} phases · {lesson.duration}</b>
            </button>
            <button type="button" className={s.tab} data-on={tab === "deck"} onClick={() => setTab("deck")}>
              02 / Deck<b>{deck.slides.length} slides</b>
            </button>
            <button type="button" className={s.tab} data-on={tab === "quiz"} onClick={() => setTab("quiz")}>
              03 / Quiz<b>{quiz.questions.length} q · {quiz.marks} marks</b>
            </button>
          </div>

          <div className={s.pane}>
            {tab === "lesson" && (
              <>
                <div className={s.blockHead}>
                  {lesson.title} <span>{lesson.grade}</span>
                </div>
                {lesson.phases.map((p) => (
                  <div key={p.n} className={s.row}>
                    <span className={s.rowN}>{p.n}</span>
                    <span className={s.rowMin}>{p.minutes}m</span>
                    <div className={s.rowBody}>
                      <h3 className={s.rowTitle}>{p.name}</h3>
                      <p className={s.rowText}>{p.body}</p>
                      <p className={s.rowNote}>{p.teacher}</p>
                    </div>
                  </div>
                ))}
                <div className={s.blockHead}>Differentiation</div>
                {Object.entries(lesson.differentiation).map(([k, v]) => (
                  <div key={k} className={s.row}>
                    <span className={s.rowN}>·</span>
                    <span className={s.rowMin}>{k}</span>
                    <div className={s.rowBody}>
                      <p className={s.rowText}>{v}</p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {tab === "deck" && (
              <>
                <div className={s.blockHead}>
                  {deck.title} <span>{deck.subtitle}</span>
                </div>
                {deck.slides.map((sl, k) => (
                  <div key={sl.n} className={s.slideRow} data-on={k === i}>
                    <SlideArt seed={sl.art} />
                    <div className={s.slideMeta}>
                      <h3 className={s.slideT}>
                        <span>{String(sl.n).padStart(2, "0")}</span>
                        {sl.title}
                      </h3>
                      <ul className={s.slideB}>
                        {sl.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                      <p className={s.slideN}>{sl.notes}</p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {tab === "quiz" && (
              <>
                <div className={s.blockHead}>
                  {quiz.title} <span>{quiz.minutes} min · {quiz.marks} marks</span>
                </div>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Question and options</th>
                      <th>Key</th>
                      <th>Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quiz.questions.map((q, k) => (
                      <tr key={q.q}>
                        <td className={s.tdN}>{String(k + 1).padStart(2, "0")}</td>
                        <td className={s.tdQ}>
                          {q.q}
                          <ul className={s.optList}>
                            {q.options.map((o, oi) => (
                              <li key={o} data-right={oi === q.answer}>
                                <b>{LETTER[oi]}</b>
                                {o}
                              </li>
                            ))}
                          </ul>
                          <span className={s.tdWhy}>{q.why}</span>
                        </td>
                        <td className={s.tdKey}>{LETTER[q.answer]}</td>
                        <td className={s.tdLvl}>{q.difficulty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* ── right · contact sheet ───────────────────────────────── */}
        <div className={`${s.col} ${s.sheet}`}>
          <div className={s.blockHead}>
            Contact sheet <span>{deck.slides.length} frames</span>
          </div>
          <div className={s.frames}>
            {deck.slides.map((sl, k) => (
              <button
                key={sl.n}
                type="button"
                className={s.frame}
                data-on={k === i}
                onClick={() => { setI(k); setTab("deck"); }}
                aria-current={k === i}
              >
                <span className={s.frameN}>{String(sl.n).padStart(2, "0")}</span>
                <SlideArt seed={sl.art} />
                <span className={s.frameCap}>{sl.title}</span>
              </button>
            ))}
          </div>

          <div className={s.blockHead}>
            Selected <span>frame {String(slide.n).padStart(2, "0")}</span>
          </div>
          <div className={s.kv}>
            <span className={s.kvK}>layout</span>
            <span className={s.kvV}>
              <b>{slide.layout}</b>
            </span>
          </div>
          <div className={s.kv}>
            <span className={s.kvK}>bullets</span>
            <span className={s.kvV}>{slide.bullets.length}</span>
          </div>
          <div className={s.kv}>
            <span className={s.kvK}>art</span>
            <span className={s.kvV}>{slide.art}</span>
          </div>

          <div className={s.blockHead}>
            Library <span>{recents.length}</span>
          </div>
          {recents.map((r) => (
            <div key={r.title} className={s.shelfRow}>
              <span className={s.shelfK}>{r.grade}</span>
              <span className={s.shelfT}>{r.title}</span>
              <span className={s.shelfW}>{r.when}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── command line ──────────────────────────────────────────── */}
      <div className={s.cmd}>
        <span className={s.prompt}>murchid ~</span>
        <span className={s.cmdInput}>
          make --from &quot;that lesson&quot; --change tone
          <span className={s.caret} />
        </span>
        {(["lesson_plan", "presentation", "quiz", "homework", "activity"] as const).map((k) => (
          <button key={k} type="button" className={s.flag} data-on={k === "lesson_plan" || k === "presentation" || k === "quiz"}>
            {KIND_LABEL[k].split(" ")[0]}
          </button>
        ))}
        <button type="button" className={s.run}>Run</button>
      </div>
    </div>
  );
}
