"use client";

// =====================================================================
// /preview — the subject-first studio, on real data
//
// One question is being previewed: should the things a teacher makes be
// filed by KIND, as they are today, or by SUBJECT? Today's studio has
// seven libraries side by side and each one holds every class at once,
// so "the Grade 11 Biology quizzes" is a filter you reapply every time
// rather than a place you go. Here a subject is a place, and the six
// kinds live inside it.
//
// It reads the signed-in account's own Supabase rows and writes nothing.
// A design argument made on invented data is an argument about the
// invented data, so every count, time, title and status here is the
// account's own — including the empty ones.
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { KINDS, type KindKey } from "./types";
import type { StudentModel, SubjectGroup, TeacherModel } from "./types";
import { loadStudent, loadTeacher } from "./model";
import Shell, { type Crumb, type SideSubject } from "./Shell";
import { HOME, parse, roleOf, serialise, type Route } from "./route";
import { Failed, Loading, classLine } from "./parts";
import { Detail, Home, KindList, Library, SubjectHome, Week } from "./TeacherScreens";
import { StudentHome, StudentSubjectView } from "./StudentScreens";

export default function SubjectPreview() {
  const [route, setRoute] = useState<Route>(HOME);

  const [teacher, setTeacher] = useState<TeacherModel | null>(null);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentModel | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const role = roleOf(route);

  // ── the hash is the address bar ────────────────────────────────────
  // Read once on mount and on every back/forward, so a screen deep in
  // the structure is a link someone can paste into a review thread.
  useEffect(() => {
    const read = () => setRoute(parse(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = useCallback((r: Route) => {
    const next = serialise(r);
    if (window.location.hash !== next) window.history.pushState(null, "", next);
    setRoute(r);
  }, []);

  useEffect(() => {
    let alive = true;
    setTeacherError(null);
    loadTeacher()
      .then((m) => alive && setTeacher(m))
      .catch((e) => alive && setTeacherError(e?.message || "Supabase did not answer."));
    return () => { alive = false; };
  }, [reload]);

  // The student's world is only fetched once someone looks at it — two
  // RPCs a teacher previewing their own screens has no use for.
  useEffect(() => {
    if (role !== "student" || student) return;
    let alive = true;
    setStudentError(null);
    loadStudent()
      .then((m) => alive && setStudent(m))
      .catch((e) => alive && setStudentError(e?.message || "Supabase did not answer."));
    return () => { alive = false; };
  }, [role, student, reload]);

  const onRole = useCallback(
    (r: "teacher" | "student") => go(r === "teacher" ? HOME : { v: "student" }),
    [go],
  );

  const sideSubjects: SideSubject[] = useMemo(
    () =>
      (teacher?.subjects ?? []).map((sub) => ({
        key: sub.key,
        name: sub.name,
        grade: sub.grades[0] ? classLine(sub.grades[0], null) : null,
        counts: Object.fromEntries(
          KINDS.map((k) => [k.key, sub.items[k.key].length]),
        ) as Record<KindKey, number>,
      })),
    [teacher],
  );

  const studentSideSubjects = useMemo(
    () =>
      (student?.subjects ?? []).map((sub) => ({
        id: sub.studentRowId,
        name: sub.subject,
        grade: sub.grade,
        count: sub.workCount,
      })),
    [student],
  );

  // ── what this route is called, and how you got here ────────────────
  const subject: SubjectGroup | null =
    (route.v === "subject" || route.v === "kind" || route.v === "item") && teacher
      ? teacher.subjects.find((x) => x.key === route.s) ?? null
      : null;

  const studentSubject =
    route.v === "studentSubject" && student
      ? student.subjects.find((x) => x.studentRowId === route.id) ?? null
      : null;

  let title = "Home";
  let crumbs: Crumb[] = [];

  if (role === "teacher") {
    switch (route.v) {
      case "week":
        title = "This week";
        crumbs = [{ label: "Home", to: HOME }];
        break;
      case "library":
        title = "My library";
        crumbs = [{ label: "Home", to: HOME }];
        break;
      case "subject":
        title = subject?.name ?? "Subject";
        crumbs = subject?.grades[0] ? [{ label: classLine(subject.grades[0], null) }] : [];
        break;
      case "kind": {
        const def = KINDS.find((k) => k.key === route.k);
        title = def?.label ?? "Materials";
        crumbs = [
          { label: subject?.name ?? "Subject", to: { v: "subject", s: route.s } },
          ...(subject?.grades[0] ? [{ label: classLine(subject.grades[0], null) }] : []),
        ];
        break;
      }
      case "item": {
        const def = KINDS.find((k) => k.key === route.k);
        const item = subject?.items[route.k].find((x) => x.id === route.id);
        title = item?.title ?? def?.label ?? "Untitled";
        crumbs = [
          { label: subject?.name ?? "Subject", to: { v: "subject", s: route.s } },
          { label: def?.label ?? "Materials", to: { v: "kind", s: route.s, k: route.k } },
        ];
        break;
      }
      default:
        title = teacher ? `Good day, ${teacher.name.split(" ")[0]}.` : "Home";
    }
  } else if (route.v === "studentSubject") {
    title = studentSubject?.subject ?? "Subject";
    crumbs = [
      { label: "Your subjects", to: { v: "student" } },
      ...(studentSubject ? [{ label: classLine(studentSubject.grade, studentSubject.section) }] : []),
    ];
  } else {
    title = student ? `Hello, ${student.name.split(" ")[0]}.` : "Home";
  }

  const who =
    role === "teacher"
      ? { name: teacher?.name ?? "…", initials: teacher?.initials ?? "—", role: teacher?.school ?? "Teacher" }
      : {
          name: student?.name ?? "…",
          initials: student?.initials ?? "—",
          role: classLine(student?.grade ?? null, student?.section ?? null) || "Student",
        };

  return (
    <Shell
      route={route}
      go={go}
      onRole={onRole}
      who={who}
      title={title}
      crumbs={crumbs}
      subjects={sideSubjects}
      studentSubjects={studentSideSubjects}
      fab={role === "teacher" ? "Ask the studio" : "Ask for help"}
    >
      {role === "teacher"
        ? renderTeacher()
        : renderStudent()}
    </Shell>
  );

  function renderTeacher() {
    if (teacherError) return <Failed message={teacherError} onRetry={() => setReload((n) => n + 1)} />;
    if (!teacher) return <Loading />;

    switch (route.v) {
      case "week":
        return <Week m={teacher} go={go} />;
      case "library":
        return <Library m={teacher} go={go} />;
      case "subject":
        return subject ? <SubjectHome sub={subject} go={go} /> : <Missing what="subject" go={go} />;
      case "kind":
        return subject ? <KindList sub={subject} kind={route.k} go={go} /> : <Missing what="subject" go={go} />;
      case "item": {
        if (!subject) return <Missing what="subject" go={go} />;
        const item = subject.items[route.k].find((x) => x.id === route.id);
        return item ? <Detail sub={subject} item={item} go={go} /> : <Missing what="piece of work" go={go} />;
      }
      default:
        return <Home m={teacher} go={go} />;
    }
  }

  function renderStudent() {
    if (studentError) return <Failed message={studentError} onRetry={() => setReload((n) => n + 1)} />;
    if (!student) return <Loading rows={2} />;
    if (route.v === "studentSubject") {
      return studentSubject
        ? <StudentSubjectView sub={studentSubject} go={go} />
        : <Missing what="subject" go={go} />;
    }
    return <StudentHome m={student} go={go} />;
  }
}

/**
 * A hash that points at something this account does not have.
 *
 * Reachable in one obvious way — a link shared from another teacher's
 * preview — so it says which one, rather than rendering an empty screen
 * that looks like the data failed.
 */
function Missing({ what, go }: { what: string; go: (r: Route) => void }) {
  return (
    <div style={{ maxWidth: 520 }}>
      <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 14 }}>
        That {what} is not in this account. The link probably came from someone
        else&rsquo;s preview, where the subjects are different.
      </p>
      <button
        type="button"
        onClick={() => go(HOME)}
        style={{
          padding: "8px 16px", borderRadius: 999, border: 0, cursor: "pointer",
          background: "var(--p-invert)", color: "var(--p-on-invert)",
          font: "inherit", fontSize: 13, fontWeight: 500,
        }}
      >
        Back to your studio
      </button>
    </div>
  );
}
