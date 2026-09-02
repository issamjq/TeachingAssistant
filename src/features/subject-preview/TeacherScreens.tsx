"use client";

// =====================================================================
// The teacher's five screens
//
// Home and This week are flat, because a teaching day is one timetable
// with four subjects in it and filing it by subject would be a lie about
// how it is lived. Everything a teacher MAKES is nested, because a quiz
// belongs to a class and always did — the shipped studio just kept them
// in one heap and made her filter.
//
// Every number, title, time and status on these screens comes from the
// account's own Supabase rows. Nothing is placeholder.
// =====================================================================

import { useMemo, useState } from "react";
import {
  BookMarked, CalendarDays, CheckCheck, FileWarning, FolderOpen, Inbox,
  Pencil, Printer, RefreshCw, Sparkles, Upload,
} from "lucide-react";
import { KINDS, KIND_BY_KEY, type Item, type KindKey, type SubjectGroup, type TeacherModel } from "./types";
import { KIND_ICON } from "./Shell";
import type { Route } from "./route";
import {
  Empty, Go, Ring, SectionHead, WorkCard, ago, classLine, hhmm, longDate,
} from "./parts";
import s from "./Screens.module.css";

type Nav = { go: (r: Route) => void };

/** The status a timetabled class is in, in the teacher's words. */
function lessonState(l: { hasPlan: boolean; status: string | null; endTime: string | null; date: string }) {
  const past =
    l.status === "taught" ||
    (l.date < new Date().toISOString().slice(0, 10)) ||
    (!!l.endTime && l.date === new Date().toISOString().slice(0, 10) &&
      l.endTime.slice(0, 5) < new Date().toTimeString().slice(0, 5));
  if (past && l.hasPlan) return { label: "Taught", cls: s.pillDone };
  if (l.hasPlan) return { label: "Plan ready", cls: s.pillReady };
  return { label: "No plan yet", cls: s.pillNone };
}

// ── Home ──────────────────────────────────────────────────────────────

export function Home({ m, go }: { m: TeacherModel } & Nav) {
  // Which kind the teacher just picked, waiting on a subject. Home is the
  // one screen with no subject in scope, so rather than guessing one — or
  // opening a modal for a two-click decision — the grid asks in place.
  const [pending, setPending] = useState<KindKey | null>(null);
  const missing = m.weekTotal - m.weekWithPlan;
  const firstFour = KINDS.filter((k) =>
    ["lesson_plan", "quiz", "student_notes", "activity"].includes(k.key));

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section className={s.split}>
        <div>
          <SectionHead title="Your classes today" meta={longDate(m.today)} />
          <div className={`${s.card} ${s.tight}`}>
            {m.todayLessons.length ? (
              <div className={s.rows}>
                {m.todayLessons.map((l) => {
                  const state = lessonState(l);
                  const key = l.subject ? l.subject.trim().toLowerCase() : null;
                  return (
                    <div key={l.id} className={s.row}>
                      <div className={s.when}>
                        <div className={s.time}>{hhmm(l.startTime)}</div>
                        {l.location && <div className={s.where}>{l.location}</div>}
                      </div>
                      <div className={s.rowMain}>
                        <div className={s.rowTitle}>{l.title}</div>
                        <div className={s.rowSub}>
                          {key ? (
                            <button type="button" onClick={() => go({ v: "subject", s: key })}>
                              {l.subject}
                            </button>
                          ) : (
                            "No subject set"
                          )}
                          {classLine(l.grade, l.section) && ` · ${classLine(l.grade, l.section)}`}
                        </div>
                      </div>
                      <span className={`${s.pill} ${state.cls}`}>{state.label}</span>
                      {l.hasPlan ? (
                        <button
                          type="button"
                          className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`}
                          onClick={() => key && go({ v: "subject", s: key })}
                        >
                          Open <Go />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${s.btn} ${s.btnMake} ${s.btnSmall}`}
                          onClick={() => key && go({ v: "kind", s: key, k: "lesson_plan" })}
                        >
                          <Sparkles size={13} /> Make one now
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 20 }}>
                <Empty
                  icon={<CalendarDays size={19} />}
                  title="Nothing on the timetable today"
                  text="Classes you add to your calendar appear here with the plan behind them, or with a prompt to make one."
                  action={<a className={`${s.btn} ${s.btnQuiet}`} href="/planner">Open the calendar</a>}
                />
              </div>
            )}
          </div>
        </div>

        <div className={s.rail}>
          <div className={s.card}>
            <p className={s.railHead}>This week&rsquo;s prep</p>
            <div className={s.prep}>
              <Ring done={m.weekWithPlan} total={m.weekTotal} />
              <p className={s.prepText}>
                {m.weekTotal === 0 ? (
                  <>Nothing timetabled in the next seven days.</>
                ) : missing === 0 ? (
                  <>All <b>{m.weekTotal}</b> of this week&rsquo;s classes already have a plan.</>
                ) : (
                  <>
                    <b>{m.weekWithPlan}</b> of your <b>{m.weekTotal}</b> classes this week already
                    have a plan. <b>{missing}</b> still need one.
                  </>
                )}
              </p>
            </div>
            {missing > 0 && (
              <button type="button" className={`${s.btn} ${s.btnMake} ${s.btnWide}`} onClick={() => go({ v: "week" })}>
                <Sparkles size={14} /> Prepare the missing {missing}
              </button>
            )}
          </div>

          <div className={s.card}>
            <p className={s.railHead}>
              Waiting for you
              {m.waiting.length > 0 && <span className={s.badge}>{m.waiting.length}</span>}
            </p>
            {m.waiting.length ? (
              m.waiting.map((w) => (
                <div key={w.id} className={s.taskRow}>
                  <span className={s.taskIcon}>
                    {w.kind === "empty" ? <FileWarning size={14} /> : <Pencil size={14} />}
                  </span>
                  <span>
                    <span className={s.taskTitle}>{w.title}</span>
                    <span className={s.taskMeta}>{w.meta}</span>
                  </span>
                </div>
              ))
            ) : (
              <p className={s.prepText}>
                Nothing half-finished. Everything you have started is either done or scheduled.
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionHead
          title="What would you like to make?"
          meta={pending ? "Pick the class it is for" : "Everything you make belongs to a subject"}
        />
        <div className={s.makeGrid}>
          {firstFour.map((k) => {
            const Icon = KIND_ICON[k.key];
            return (
              <button
                key={k.key}
                type="button"
                className={s.make}
                data-on={pending === k.key}
                onClick={() => setPending(pending === k.key ? null : k.key)}
              >
                <span className={s.makeIcon}><Icon size={17} strokeWidth={1.9} /></span>
                <span className={s.makeTitle}>{k.label}</span>
                <span className={s.makeBlurb}>{k.blurb}</span>
                <span className={s.makeGo}>
                  {pending === k.key ? "Which subject?" : "Make one"} <Go />
                </span>
              </button>
            );
          })}
        </div>

        {pending && (
          <div className={s.chips} style={{ marginTop: 14, marginBottom: 0 }}>
            <span className={s.sectionMeta} style={{ alignSelf: "center", marginInlineEnd: 4 }}>
              {KIND_BY_KEY[pending].one} for
            </span>
            {m.subjects.map((sub) => (
              <button
                key={sub.key}
                type="button"
                className={s.chip}
                onClick={() => go({ v: "kind", s: sub.key, k: pending })}
              >
                {sub.name}
                {sub.grades[0] ? ` · ${classLine(sub.grades[0], null)}` : ""}
              </button>
            ))}
            {!m.subjects.length && (
              <span className={s.sectionMeta}>No subjects yet — add a class first.</span>
            )}
          </div>
        )}
      </section>

      <section>
        <SectionHead title="Where you left off" action="See all in My library" onAction={() => go({ v: "library" })} />
        {m.recent.length ? (
          <div className={s.workGrid}>
            {m.recent.map((it) => (
              <WorkCard
                key={`${it.kind}-${it.id}`}
                item={it}
                subtitle={[it.subject, classLine(it.grade, it.section)].filter(Boolean).join(" · ") || undefined}
                onOpen={() =>
                  it.subject
                    ? go({ v: "item", s: it.subject.trim().toLowerCase(), k: it.kind, id: it.id })
                    : go({ v: "library" })
                }
              />
            ))}
          </div>
        ) : (
          <Empty
            icon={<Sparkles size={19} />}
            title="Nothing made yet"
            text="Lesson plans, quizzes and everything else you generate will collect here, newest first."
            action={<a className={`${s.btn} ${s.btnMake}`} href="/studio">Open the studio</a>}
          />
        )}
      </section>
    </div>
  );
}

// ── This week ─────────────────────────────────────────────────────────

export function Week({ m, go }: { m: TeacherModel } & Nav) {
  const days = useMemo(() => {
    const byDate = new Map<string, typeof m.subjects[number]["lessons"]>();
    for (const sub of m.subjects) {
      for (const l of sub.lessons) {
        if (!byDate.has(l.date)) byDate.set(l.date, []);
        byDate.get(l.date)!.push(l);
      }
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, list]) => ({
        date,
        list: [...list].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")),
      }));
  }, [m.subjects]);

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section>
        <SectionHead
          title="The next seven days"
          meta={`${m.weekWithPlan} of ${m.weekTotal} classes have a plan`}
        />
        {days.length ? (
          <div style={{ display: "grid", gap: 16 }}>
            {days.map((d) => (
              <div key={d.date}>
                <p className={s.sectionMeta} style={{ marginBottom: 8 }}>{longDate(d.date)}</p>
                <div className={`${s.card} ${s.tight}`}>
                  <div className={s.rows}>
                    {d.list.map((l) => {
                      const state = lessonState(l);
                      const key = l.subject ? l.subject.trim().toLowerCase() : null;
                      return (
                        <div key={l.id} className={s.row}>
                          <div className={s.when}>
                            <div className={s.time}>{hhmm(l.startTime)}</div>
                            {l.location && <div className={s.where}>{l.location}</div>}
                          </div>
                          <div className={s.rowMain}>
                            <div className={s.rowTitle}>{l.title}</div>
                            <div className={s.rowSub}>
                              {l.subject ?? "No subject set"}
                              {classLine(l.grade, l.section) && ` · ${classLine(l.grade, l.section)}`}
                            </div>
                          </div>
                          <span className={`${s.pill} ${state.cls}`}>{state.label}</span>
                          <button
                            type="button"
                            className={`${s.btn} ${l.hasPlan ? s.btnQuiet : s.btnMake} ${s.btnSmall}`}
                            onClick={() => key && go(l.hasPlan
                              ? { v: "subject", s: key }
                              : { v: "kind", s: key, k: "lesson_plan" })}
                            disabled={!key}
                          >
                            {l.hasPlan ? <>Open <Go /></> : <><Sparkles size={13} /> Plan it</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={<CalendarDays size={19} />}
            title="No classes timetabled this week"
            text="Add your lessons to the calendar and this becomes the list of what still needs preparing."
            action={<a className={`${s.btn} ${s.btnQuiet}`} href="/planner">Open the calendar</a>}
          />
        )}
      </section>
    </div>
  );
}

// ── One subject ───────────────────────────────────────────────────────

const UNIT_DONE = new Set(["achieved"]);

export function SubjectHome({ sub, go }: { sub: SubjectGroup } & Nav) {
  const [allUnits, setAllUnits] = useState(false);
  const covered = sub.units.filter((u) => UNIT_DONE.has(u.status ?? "")).length;
  const shown = allUnits ? sub.units : sub.units.slice(0, 4);

  const facts = [
    classLine(sub.grades[0] ?? null, sub.sections[0] ?? null),
    sub.students ? `${sub.students} student${sub.students === 1 ? "" : "s"}` : null,
    sub.weekTotal ? `${sub.weekTotal} class${sub.weekTotal === 1 ? "" : "es"} this week` : null,
    sub.total ? `${sub.total} piece${sub.total === 1 ? "" : "s"} of material` : null,
  ].filter(Boolean);

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section>
        {facts.length > 0 && (
          <p className={s.sectionMeta} style={{ marginBottom: 10 }}>{facts.join(" · ")}</p>
        )}
        {sub.syllabus ? (
          <div className={s.banner}>
            <span className={s.bannerIcon}><BookMarked size={19} /></span>
            <span className={s.bannerText}>
              <span className={s.bannerTitle}>
                Your {sub.syllabus.kind === "textbook" ? "textbook" : "syllabus"} is loaded
              </span>
              <span className={s.bannerMeta}>
                {sub.syllabus.fileName ?? sub.syllabus.title}
                {sub.syllabus.pages ? ` · ${sub.syllabus.pages} pages` : ""}
                {sub.materials.length > 1 ? ` · ${sub.materials.length - 1} more file${sub.materials.length === 2 ? "" : "s"}` : ""}
              </span>
            </span>
            <a className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`} href="/materials">
              <RefreshCw size={13} /> Replace
            </a>
          </div>
        ) : (
          <div className={s.banner}>
            <span className={s.bannerIcon}><Upload size={19} /></span>
            <span className={s.bannerText}>
              <span className={s.bannerTitle}>No syllabus loaded for {sub.name}</span>
              <span className={s.bannerMeta}>
                {sub.materials.length
                  ? `${sub.materials.length} file${sub.materials.length === 1 ? "" : "s"} on the shelf, none of them tagged as the syllabus.`
                  : "Upload one and everything below is written against it."}
              </span>
            </span>
            <a className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`} href="/materials">Upload</a>
          </div>
        )}
      </section>

      <section>
        <SectionHead title="What would you like to make?" meta={`For ${sub.name}`} />
        <div className={s.makeGrid}>
          {KINDS.map((k) => {
            const Icon = KIND_ICON[k.key];
            const n = sub.items[k.key].length;
            return (
              <button
                key={k.key}
                type="button"
                className={s.make}
                onClick={() => go({ v: "kind", s: sub.key, k: k.key })}
              >
                <span className={s.makeIcon}><Icon size={17} strokeWidth={1.9} /></span>
                <span className={s.makeTitle}>{k.label}</span>
                <span className={s.makeBlurb}>
                  {n ? `${n} already here. ${k.blurb}` : k.blurb}
                </span>
                <span className={s.makeGo}>{n ? "Open" : "Make one"} <Go /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHead
          title="Your units"
          meta={sub.units.length ? `${covered} of ${sub.units.length} covered` : undefined}
        />
        {sub.units.length ? (
          <>
            <div className={`${s.card} ${s.tight}`}>
              {shown.map((u, i) => {
                const done = UNIT_DONE.has(u.status ?? "");
                return (
                  <div key={u.id} className={s.unit}>
                    <span className={`${s.unitMark} ${done ? s.unitDone : ""}`}>
                      {done ? <CheckCheck size={13} /> : i + 1}
                    </span>
                    <span className={s.unitName}>{u.title}</span>
                    <span className={s.unitMeta}>
                      {done ? "Covered" : u.status === "active" ? "In progress" : "Not started"}
                      {u.days ? ` · ${u.days} days` : ""}
                    </span>
                    <a className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`} href="/goals">View</a>
                  </div>
                );
              })}
            </div>
            {sub.units.length > 4 && (
              <button type="button" className={s.more} onClick={() => setAllUnits(!allUnits)}>
                {allUnits ? "Show fewer" : `Show all ${sub.units.length} units`}
              </button>
            )}
          </>
        ) : (
          <Empty
            icon={<BookMarked size={19} />}
            title={`${sub.name} has no units yet`}
            text="A unit is a portion of the subject — a term, a chapter, a book. Set them out once and everything you make can be filed against one."
            action={<a className={`${s.btn} ${s.btnMake}`} href="/goals">Plan the term</a>}
          />
        )}
      </section>
    </div>
  );
}

// ── One subject, one kind ─────────────────────────────────────────────

export function KindList({ sub, kind, go }: { sub: SubjectGroup; kind: KindKey } & Nav) {
  const def = KIND_BY_KEY[kind];
  const Icon = KIND_ICON[kind];
  const items = sub.items[kind];
  const starters = sub.units.filter((u) => !UNIT_DONE.has(u.status ?? "")).slice(0, 2);

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section className={s.compose}>
        <h2 className={s.composeTitle}>Make a new {def.one}</h2>
        <p className={s.composeLede}>
          Type what you need.{" "}
          {sub.syllabus
            ? `The studio writes it against your ${sub.name} syllabus.`
            : `It will be filed under ${sub.name}${sub.grades[0] ? `, ${classLine(sub.grades[0], null)}` : ""}.`}
        </p>
        <div className={s.field}>
          <input
            placeholder={`A 45-minute ${def.one} on…`}
            aria-label={`Describe the ${def.one} you want`}
          />
          <a className={`${s.btn} ${s.btnMake}`} href="/studio">Create <Go /></a>
        </div>
        {starters.length > 0 && (
          <div className={s.starters}>
            <span className={s.startersLabel}>Or start with:</span>
            {starters.map((u) => (
              <a key={u.id} className={s.starter} href="/studio">{u.title}</a>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHead
          title={`${def.label} you already have`}
          meta={`${items.length} for ${sub.name}`}
        />
        {items.length ? (
          <div className={s.workGrid}>
            {items.map((it) => (
              <WorkCard
                key={it.id}
                item={it}
                subtitle={
                  [classLine(it.grade, it.section), it.raw.duration_minutes ? `${it.raw.duration_minutes} min` : null]
                    .filter(Boolean).join(" · ") || undefined
                }
                onOpen={() => go({ v: "item", s: sub.key, k: kind, id: it.id })}
              />
            ))}
          </div>
        ) : (
          <Empty
            icon={<Icon size={19} />}
            title={`No ${def.label.toLowerCase()} for ${sub.name} yet`}
            text={`${def.blurb} The first one you make lands here and stays filed under this subject.`}
          />
        )}
      </section>
    </div>
  );
}

// ── My library ────────────────────────────────────────────────────────

export function Library({ m, go }: { m: TeacherModel } & Nav) {
  const [subject, setSubject] = useState<string | null>(null);
  const [kind, setKind] = useState<KindKey | null>(null);

  const shown = m.all.filter(
    (it) =>
      (!subject || (it.subject ?? "").trim().toLowerCase() === subject) &&
      (!kind || it.kind === kind),
  );

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section>
        <div className={s.chips}>
          <button type="button" className={s.chip} data-on={!subject} onClick={() => setSubject(null)}>
            Everything
          </button>
          {m.subjects.map((sub) => (
            <button
              key={sub.key}
              type="button"
              className={s.chip}
              data-on={subject === sub.key}
              onClick={() => setSubject(sub.key)}
            >
              {sub.name}
            </button>
          ))}
        </div>

        <div className={s.chips}>
          <button type="button" className={s.chip} data-on={!kind} onClick={() => setKind(null)}>
            All kinds
          </button>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={s.chip}
              data-on={kind === k.key}
              onClick={() => setKind(k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>

        <SectionHead
          title={subject ? (m.subjects.find((x) => x.key === subject)?.name ?? "Everything") : "Everything you have made"}
          meta={`${shown.length} of ${m.all.length}`}
        />

        {shown.length ? (
          <div className={s.workGrid}>
            {shown.map((it) => (
              <WorkCard
                key={`${it.kind}-${it.id}`}
                item={it}
                subtitle={[it.subject, classLine(it.grade, it.section)].filter(Boolean).join(" · ") || "No subject set"}
                onOpen={() =>
                  it.subject
                    ? go({ v: "item", s: it.subject.trim().toLowerCase(), k: it.kind, id: it.id })
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <Empty
            icon={<FolderOpen size={19} />}
            title="Nothing matches those filters"
            text="Clear one of them, or make the first piece of work for this class."
            action={
              <button type="button" className={`${s.btn} ${s.btnQuiet}`} onClick={() => { setSubject(null); setKind(null); }}>
                Clear filters
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}

// ── One artefact, opened ──────────────────────────────────────────────

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
      {objectives[0] && <p className={s.docLede}>{objectives[0]}</p>}

      <div className={s.docActions}>
        <a className={`${s.btn} ${s.btnMake}`} href={def.route}>
          {item.kind === "lesson_plan" ? "Start teaching" : "Open in the studio"} <Go />
        </a>
        <button type="button" className={`${s.btn} ${s.btnQuiet}`}><Printer size={14} /> Print</button>
        <a className={`${s.btn} ${s.btnQuiet}`} href={def.route}><Pencil size={14} /> Edit</a>
      </div>

      {objectives.length > 1 && (
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
