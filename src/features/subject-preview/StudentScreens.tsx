"use client";

// =====================================================================
// The student's side of the same structure
//
// For a student the nesting is already true in the database: a roster
// row IS a subject, one per teacher (db/tune.sql, student_subjects()).
// What the portal does today is flatten it back out into one feed of
// "work", so a child with five teachers reads five subjects' homework
// as one undifferentiated list.
//
// Here the subject is the container on their side too, and inside it the
// work is grouped by what it is — read this, do this, sit this — because
// that is the only distinction a student actually acts on.
// =====================================================================

import { useEffect, useState } from "react";
import {
  CheckCheck, ClipboardList, GraduationCap, Inbox, School, TrendingUp,
} from "lucide-react";
import { KINDS, KIND_BY_KEY, type KindKey } from "./types";
import type { StudentModel, StudentSubject, StudentWorkItem } from "./types";
import { KIND_ICON } from "./Shell";
import type { Route } from "./route";
import { Empty, Go, SectionHead, classLine, shortDate } from "./parts";
import { loadStudentSubject } from "./model";
import s from "./Screens.module.css";

type Nav = { go: (r: Route) => void };

// ── the student's home ────────────────────────────────────────────────

export function StudentHome({ m, go }: { m: StudentModel } & Nav) {
  const att = m.attendance;
  const rate = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null;

  if (m.noClasses) {
    // Two different situations answer identically from the database, and
    // telling a teacher "you are not in any classes" when she is looking
    // at the student design would read as the preview being broken.
    return (
      <div className={`${s.page} ${s.enter}`}>
        <Empty
          icon={<School size={19} />}
          title={m.isStudent ? "You are not in any classes yet" : "You are signed in as a teacher"}
          text={
            m.isStudent
              ? "When a teacher invites you, the subject appears here with everything they have set for it."
              : "This side of the preview reads the signed-in student's own rows, and row-level security means a teacher cannot read a child's. Sign in with a student account to see it filled in — the structure is the same: one card per subject, and inside each one the work grouped by what it is."
          }
          action={
            m.isStudent
              ? <a className={`${s.btn} ${s.btnQuiet}`} href="/student-classes">Check for invitations</a>
              : <a className={`${s.btn} ${s.btnQuiet}`} href="/signin">Sign in as a student</a>
          }
        />
      </div>
    );
  }

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section className={s.split}>
        <div>
          <SectionHead
            title="Your subjects"
            meta={classLine(m.grade, m.section) || undefined}
          />
          <div className={s.workGrid}>
            {m.subjects.map((sub) => (
              <article key={sub.studentRowId} className={s.work}>
                <div className={s.workTop}>
                  <span className={s.workKind}>
                    <GraduationCap size={13} strokeWidth={2} aria-hidden="true" />
                    {classLine(sub.grade, sub.section) || "Your class"}
                  </span>
                </div>
                <h3 className={s.workTitle}>{sub.subject}</h3>
                <p className={s.workMeta}>
                  {sub.teacher ? `Taught by ${sub.teacher}` : "Teacher not named yet"}
                </p>
                <span className={s.workTime}>
                  {sub.workCount
                    ? `${sub.workCount} thing${sub.workCount === 1 ? "" : "s"} set for you`
                    : "Nothing set yet"}
                </span>
                <div className={s.workActions}>
                  <button
                    type="button"
                    className={s.btn}
                    onClick={() => go({ v: "studentSubject", id: sub.studentRowId })}
                  >
                    Open <Go />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className={s.rail}>
          <div className={s.card}>
            <p className={s.railHead}>Attendance</p>
            {att && att.total > 0 ? (
              <>
                <p className={s.prepText}>
                  You have been in class <b>{att.present}</b> of <b>{att.total}</b> days
                  {rate != null && <> — <b>{rate}%</b></>}.
                </p>
                <p className={s.taskMeta} style={{ marginTop: 6 }}>
                  {att.late} late · {att.absent} absent
                </p>
              </>
            ) : (
              <p className={s.prepText}>No register has been taken yet.</p>
            )}
          </div>

          <div className={s.card}>
            <p className={s.railHead}>
              Your marks
              {m.scores.length > 0 && <span className={s.badge}>{m.scores.length}</span>}
            </p>
            {m.scores.length ? (
              m.scores.slice(0, 5).map((sc) => (
                <div key={sc.id} className={s.taskRow}>
                  <span className={s.taskIcon}><TrendingUp size={14} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className={s.taskTitle}>{sc.title}</span>
                    <span className={s.taskMeta}>
                      {sc.score != null && sc.maxScore != null
                        ? `${sc.score} out of ${sc.maxScore}`
                        : "Waiting to be marked"}
                      {sc.submittedAt ? ` · ${shortDate(sc.submittedAt.slice(0, 10))}` : ""}
                    </span>
                  </span>
                </div>
              ))
            ) : (
              <p className={s.prepText}>Nothing marked yet. Scores appear here as your teachers grade them.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// ── one subject, for the student ──────────────────────────────────────

/** Work a student cannot act on is still work they should be able to read. */
const STUDENT_LABEL: Record<KindKey | "other", string> = {
  lesson_plan: "Lessons",
  student_notes: "Notes to read",
  homework: "Homework",
  activity: "Activities",
  quiz: "Quizzes",
  presentation: "Slides",
  other: "Everything else",
};

export function StudentSubjectView({ sub, go }: { sub: StudentSubject } & Nav) {
  // Mounted fresh per subject (the caller keys on studentRowId), so the
  // initial state IS the reset — an effect that cleared three pieces of
  // state by hand was doing the remount's job one render too late.
  const [work, setWork] = useState<StudentWorkItem[] | null>(sub.work);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    loadStudentSubject(sub.studentRowId)
      .then((w) => alive && setWork(w))
      .catch((e) => alive && setError(e?.message || "That class did not load."))
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [sub.studentRowId]);

  if (busy) {
    return (
      <div className={s.page} aria-busy="true">
        <span className="sr-only">Loading {sub.subject}…</span>
        <div className={s.skel} style={{ height: 26, width: 190 }} />
        <div className={s.workGrid}>
          {Array.from({ length: 6 }, (_, i) => <div key={i} className={s.skel} style={{ height: 132 }} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.error} role="alert">
        <p className={s.errorTitle}>{sub.subject} did not load</p>
        <p className={s.errorText}>{error}</p>
        <button type="button" className={s.btn} onClick={() => go({ v: "student" })}>Back to your subjects</button>
      </div>
    );
  }

  const list = work ?? [];
  const upcoming = list.filter((w) => w.upcoming);
  const groups = [...KINDS.map((k) => k.key), "other" as const]
    .map((k) => ({ key: k, items: list.filter((w) => w.kind === k) }))
    .filter((g) => g.items.length);

  return (
    <div className={`${s.page} ${s.enter}`}>
      <section>
        <p className={s.sectionMeta} style={{ marginBottom: 10 }}>
          {[classLine(sub.grade, sub.section), sub.teacher && `Taught by ${sub.teacher}`, `${list.length} in total`]
            .filter(Boolean).join(" · ")}
        </p>

        {upcoming.length > 0 && (
          <div className={s.banner}>
            <span className={s.bannerIcon}><ClipboardList size={19} /></span>
            <span className={s.bannerText}>
              <span className={s.bannerTitle}>
                {upcoming.length} thing{upcoming.length === 1 ? "" : "s"} coming up
              </span>
              <span className={s.bannerMeta}>
                Next: {upcoming[upcoming.length - 1].title}
                {upcoming[upcoming.length - 1].date ? ` on ${shortDate(upcoming[upcoming.length - 1].date)}` : ""}
              </span>
            </span>
          </div>
        )}
      </section>

      {groups.length ? (
        groups.map((g) => {
          const Icon = g.key === "other" ? Inbox : KIND_ICON[g.key as KindKey];
          const def = g.key === "other" ? null : KIND_BY_KEY[g.key as KindKey];
          return (
            <section key={g.key}>
              <SectionHead
                title={STUDENT_LABEL[g.key]}
                meta={`${g.items.length}${def ? "" : ""}`}
              />
              <div className={`${s.card} ${s.tight}`}>
                {g.items.map((w) => (
                  <div key={w.entryId} className={s.row}>
                    <span className={s.taskIcon}><Icon size={14} /></span>
                    <div className={s.rowMain}>
                      <div className={s.rowTitle}>{w.title}</div>
                      <div className={s.rowSub}>
                        {w.date ? shortDate(w.date) : "No date set"}
                        {w.startTime ? ` · ${w.startTime.slice(0, 5)}` : ""}
                      </div>
                    </div>
                    <StudentState w={w} />
                    <a className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`} href="/student-classes">
                      Open <Go />
                    </a>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <Empty
          icon={<Inbox size={19} />}
          title={`Nothing set for ${sub.subject} yet`}
          text="When your teacher schedules work for this class it appears here, sorted by what it is."
        />
      )}
    </div>
  );
}

/** Done, marked, or still owed — the only three things a student needs. */
function StudentState({ w }: { w: StudentWorkItem }) {
  if (w.score != null && w.maxScore != null) {
    return <span className={`${s.pill} ${s.pillReady}`}><CheckCheck size={12} /> {w.score}/{w.maxScore}</span>;
  }
  if (w.submitted || w.attemptStatus === "submitted") {
    return <span className={`${s.pill} ${s.pillDone}`}>Handed in</span>;
  }
  if (w.upcoming) return <span className={`${s.pill} ${s.pillNone}`}>Coming up</span>;
  return <span className={`${s.pill} ${s.pillDone}`}>Not handed in</span>;
}
