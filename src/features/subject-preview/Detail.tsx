"use client";

// =====================================================================
// One artefact, opened
//
// Split out of TeacherScreens because it is the only screen here that
// reads an artefact's BODY rather than its row — objectives, phases,
// questions, slides — and that is a different job from listing things.
//
// It renders whatever the stored row actually holds and nothing it does
// not. A lesson plan is kept as intro / main_activity / conclusion with
// no per-phase minutes, so the left column carries the phase name; the
// reference design's timed run-sheet would mean inventing the timings,
// which is the one thing a plan a teacher is about to teach from must
// not contain.
// =====================================================================

import { Pencil, Printer, Inbox } from "lucide-react";
import { KIND_BY_KEY, type Item, type SubjectGroup } from "./types";
import type { Route } from "./route";
import { Empty, Go, ago, classLine } from "./parts";
import s from "./Screens.module.css";

type Nav = { go: (r: Route) => void };

/** The phases a lesson plan is stored in — real fields, in reading order. */
const PHASES: { field: string; label: string }[] = [
  { field: "intro", label: "Opening" },
  { field: "main_activity", label: "Main activity" },
  { field: "conclusion", label: "Closing" },
  { field: "assessment_method", label: "Checking it landed" },
];

export function Detail({ sub, item, go }: { sub: SubjectGroup; item: Item } & Nav) {
  const def = KIND_BY_KEY[item.kind];
  const r = item.raw;
  const objectives: string[] = Array.isArray(r.objectives) ? r.objectives.filter(Boolean) : [];
  const materials: string[] = Array.isArray(r.materials) ? r.materials.filter(Boolean) : [];
  const questions: any[] = Array.isArray(r.questions) ? r.questions : [];
  const slides: any[] = Array.isArray(r.slides) ? r.slides : [];
  const phases = PHASES.map((p) => ({ ...p, text: String(r[p.field] ?? "").trim() })).filter((p) => p.text);
  // The lede is a summary, not the first objective. Promoting objectives[0]
  // printed the same sentence twice — once under the title and again at the
  // head of the list below it.
  const lede = String(r.summary ?? r.description ?? r.overview ?? "").trim()
    || (objectives.length === 1 ? objectives[0] : "");
  const body = String(r.body_md ?? r.body ?? r.instructions ?? "").trim();

  const meta = [
    classLine(item.grade, item.section),
    r.duration_minutes ? `${r.duration_minutes} minutes` : null,
    questions.length ? `${questions.length} questions` : null,
    slides.length ? `${slides.length} slides` : null,
    ago(item.updatedAt),
  ].filter(Boolean).join(" · ");

  return (
    <article className={`${s.doc} ${s.enter}`}>
      <p className={s.docMeta}>{meta}</p>
      <h2 className={s.docTitle}>{item.title}</h2>
      {lede && <p className={s.docLede}>{lede}</p>}

      <div className={s.docActions}>
        <a className={`${s.btn} ${s.btnMake}`} href={def.route}>
          {item.kind === "lesson_plan" ? "Start teaching" : "Open in the studio"} <Go />
        </a>
        <button type="button" className={`${s.btn} ${s.btnQuiet}`}><Printer size={14} /> Print</button>
        <a className={`${s.btn} ${s.btnQuiet}`} href={def.route}><Pencil size={14} /> Edit</a>
      </div>

      {objectives.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h3 className={s.docSection}>What students should walk out with</h3>
          <ul className={s.bullets} style={{ marginTop: 14 }}>
            {objectives.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </section>
      )}

      {phases.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h3 className={s.docSection}>How the class runs</h3>
          {phases.map((p) => (
            <div key={p.field} className={s.step}>
              <span className={s.stepWhen}>{p.label}</span>
              <span className={s.stepBody}><span className={s.stepText}>{p.text}</span></span>
            </div>
          ))}
        </section>
      )}

      {questions.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h3 className={s.docSection}>The questions</h3>
          {questions.map((q, i) => (
            <div key={q.qid ?? i} className={s.step}>
              <span className={s.stepWhen}>{String(i + 1).padStart(2, "0")}</span>
              <span className={s.stepBody}>
                <span className={s.stepTitle}>{q.question ?? q.prompt ?? q.text ?? "Untitled question"}</span>
                {Array.isArray(q.options) && q.options.length > 0 && (
                  <span className={s.stepText}>{q.options.length} options · {q.marks ?? 1} mark{(q.marks ?? 1) === 1 ? "" : "s"}</span>
                )}
              </span>
            </div>
          ))}
        </section>
      )}

      {slides.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h3 className={s.docSection}>The deck</h3>
          {slides.map((sl, i) => (
            <div key={i} className={s.step}>
              <span className={s.stepWhen}>Slide {i + 1}</span>
              <span className={s.stepBody}>
                <span className={s.stepTitle}>{sl.title ?? sl.heading ?? "Untitled slide"}</span>
              </span>
            </div>
          ))}
        </section>
      )}

      {!phases.length && !questions.length && !slides.length && body && (
        <section style={{ marginBottom: 28 }}>
          <h3 className={s.docSection}>What it says</h3>
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {body.split(/\n{2,}/).slice(0, 24).map((para, i) => (
              <p key={i} className={s.stepText} style={{ margin: 0 }}>{para.replace(/^#+\s*/, "")}</p>
            ))}
          </div>
        </section>
      )}

      {materials.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h3 className={s.docSection}>What you need in the room</h3>
          <ul className={s.bullets} style={{ marginTop: 14 }}>
            {materials.map((mm, i) => <li key={i}>{mm}</li>)}
          </ul>
        </section>
      )}

      {!phases.length && !questions.length && !slides.length && !body && !objectives.length && (
        <Empty
          icon={<Inbox size={19} />}
          title="This one is still empty"
          text={`It was created under ${sub.name} but has no content saved yet. Open it in the studio to finish it.`}
          action={<a className={`${s.btn} ${s.btnMake}`} href={def.route}>Finish it</a>}
        />
      )}

      <button
        type="button"
        className={s.more}
        onClick={() => go({ v: "kind", s: sub.key, k: item.kind })}
      >
        ← All {def.label.toLowerCase()} for {sub.name}
      </button>
    </article>
  );
}
