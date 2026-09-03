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
  BookMarked, CalendarDays, CheckCheck, FileWarning, FolderOpen,
  Pencil, RefreshCw, Sparkles, Upload,
} from "lucide-react";
import { KINDS, KIND_BY_KEY, type KindKey, type Lesson, type RosterClass, type SubjectGroup, type TeacherModel } from "./types";
import Composer from "./Composer";
import ClassSettings from "./ClassSettings";

import { KIND_ICON } from "./Shell";
import type { Route } from "./route";
import {
  Empty, Go, Ring, SectionHead, WorkCard, classLine, hhmm, longDate,
} from "./parts";
import s from "./Screens.module.css";
import Link from "next/link";

type Nav = { go: (r: Route) => void };
/** Open the studio panel, already making this kind. */
type Make = { onMake: (k: KindKey) => void };

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

export function Home({ m, go, onMake }: { m: TeacherModel } & Nav & Make) {
  // Home is the one screen with no class in scope. It does not have to
  // guess one or ask before the teacher has said anything: the card opens
  // the composer on that kind, and the composer already carries a class —
  // the one she used last, correctable in a tap.
  const missing = m.weekTotal - m.weekWithPlan;
  const firstFour = KINDS.filter((k) =>
    ["lesson_plan", "quiz", "student_notes", "activity"].includes(k.key));

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section className={s.split}>
        <div style={{ display: "grid", gap: 30, alignContent: "start" }}>
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

          <div>
            <SectionHead
              title="What would you like to make?"
              meta="The studio opens knowing the class"
            />
            <div className={s.makeGrid}>
              {firstFour.map((k) => {
                const Icon = KIND_ICON[k.key];
                return (
                  <button
                    key={k.key}
                    type="button"
                    className={`${s.make} ${s.makeWide}`}
                    onClick={() => onMake(k.key)}
                  >
                    <span className={s.makeIcon}><Icon size={17} strokeWidth={1.9} /></span>
                    <span className={s.makeTitle}>{k.label}</span>
                    <span className={s.makeBlurb}>{k.blurb}</span>
                    <span className={s.makeGo}>Make one <Go /></span>
                  </button>
                );
              })}
            </div>
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
            action={<Link className={`${s.btn} ${s.btnMake}`} href="/studio">Open the studio</Link>}
          />
        )}
      </section>
    </div>
  );
}

// ── This week ─────────────────────────────────────────────────────────

export function Week({ m, go }: { m: TeacherModel } & Nav) {
  const days = useMemo(() => {
    const byDate = new Map<string, Lesson[]>();
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

export function SubjectHome({ sub, go, onMake }: { sub: SubjectGroup } & Nav & Make) {
  const [allUnits, setAllUnits] = useState(false);
  const covered = sub.units.filter((u) => UNIT_DONE.has(u.status ?? "")).length;
  const shown = allUnits ? sub.units : sub.units.slice(0, 4);

  const facts = [
    classLine(sub.grade, sub.sections.length === 1 ? sub.sections[0] : null),
    sub.divisions.length > 1 ? `${sub.divisions.length} divisions` : null,
    sub.students ? `${sub.students} student${sub.students === 1 ? "" : "s"}` : null,
    sub.weekTotal ? `${sub.weekTotal} class${sub.weekTotal === 1 ? "" : "es"} this week` : null,
    sub.total ? `${sub.total} piece${sub.total === 1 ? "" : "s"} of material` : null,
  ].filter(Boolean);

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section>
        <div className={s.sectionHead} style={{ marginBottom: 10 }}>
          {facts.length > 0 && <span className={s.sectionMeta}>{facts.join(" · ")}</span>}
          {/* The year the class belongs to, and the way into a new one.
              Proposed rather than stored — the rollover screen says so. */}
          <button
            type="button"
            className={s.sectionLink}
            onClick={() => go({ v: "rollover", s: sub.key })}
          >
            {sub.academicYear ?? "No year set"} · start a new year
          </button>
        </div>
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
        <div className={`${s.makeGrid} ${s.makeGrid3}`}>
          {KINDS.map((k) => {
            const Icon = KIND_ICON[k.key];
            const n = sub.items[k.key].length;
            return (
              <button
                key={k.key}
                type="button"
                className={s.make}
                onClick={() => (n ? go({ v: "kind", s: sub.key, k: k.key }) : onMake(k.key))}
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

      <ClassSettings sub={sub} go={go} />
    </div>
  );
}

// ── One subject, one kind ─────────────────────────────────────────────

export function KindList({
  sub, kind, go, classes, rosterClasses,
}: { sub: SubjectGroup; kind: KindKey; classes: SubjectGroup[]; rosterClasses: RosterClass[] } & Nav) {
  const def = KIND_BY_KEY[kind];
  const Icon = KIND_ICON[kind];
  const items = sub.items[kind];

  return (
    <div className={`${s.page} ${s.enter}`}>
      {/* The same composer the launcher opens, run full width — one
          implementation, so the destination rules cannot drift between
          the panel and the page. It arrives already set to this class
          and this kind, which is the whole argument for nesting. */}
      <Composer
        classes={classes}
        rosterClasses={rosterClasses}
        contextClass={sub}
        contextKind={kind}
        variant="page"
        starters={sub.units.filter((u) => !UNIT_DONE.has(u.status ?? "")).map((u) => u.title)}
      />

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
