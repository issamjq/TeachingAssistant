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
import { HOME, parse, roleOf, serialise, subjectOf, type Route, type Surface } from "./route";
import { Failed, Loading, classLine } from "./parts";
import { Home, KindList, Library, SubjectHome, Week } from "./TeacherScreens";
import { Detail } from "./Detail";
import { StudentHome, StudentSubjectView } from "./StudentScreens";
import GoalPlanner from "./GoalPlanner";
import Composer from "./Composer";
import AdminHome, { grantedSurfaces, isAdmin } from "./AdminScreens";
import Rollover, { academicYear } from "./Rollover";

export default function SubjectPreview() {
  const [route, setRoute] = useState<Route>(HOME);

  const [teacher, setTeacher] = useState<TeacherModel | null>(null);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentModel | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  // The studio is a panel over whatever screen you are on, not a place.
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioKind, setStudioKind] = useState<KindKey | null>(null);
  const openStudio = useCallback((k?: KindKey) => {
    setStudioKind(k ?? null);
    setStudioOpen(true);
  }, []);

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
    loadTeacher()
      .then((m) => { if (alive) { setTeacher(m); setTeacherError(null); } })
      .catch((e) => alive && setTeacherError(e?.message || "Supabase did not answer."));
    return () => { alive = false; };
  }, [reload]);

  // The student's world is only fetched once someone looks at it — two
  // RPCs a teacher previewing their own screens has no use for.
  useEffect(() => {
    if (role !== "student" || student) return;
    let alive = true;
    loadStudent()
      .then((m) => { if (alive) { setStudent(m); setStudentError(null); } })
      .catch((e) => alive && setStudentError(e?.message || "Supabase did not answer."));
    return () => { alive = false; };
  }, [role, student, reload]);

  const onRole = useCallback(
    (r: Surface) => go(r === "teacher" ? HOME : r === "student" ? { v: "student" } : { v: "admin" }),
    [go],
  );

  // Admin is offered off the account's real grants, never off a guess:
  // `roles` from my_roles(), plus the resolved admin.* capability map.
  const identity = teacher?.identity ?? null;
  const showAdmin = !!identity && isAdmin(identity);
  const consoles = useMemo(
    () => (identity ? grantedSurfaces(identity).map(({ key, label, icon }) => ({ key, label, icon })) : []),
    [identity],
  );

  const sideSubjects: SideSubject[] = useMemo(
    () =>
      (teacher?.subjects ?? []).map((sub) => ({
        key: sub.key,
        name: sub.name,
        grade: sub.grade ? classLine(sub.grade, null) : null,
        gradeKey: sub.gradeKey,
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
  // subjectOf() already knows which routes carry a class key; asking it
  // rather than repeating the list is what stops the next route added
  // from resolving to null the way `rollover` just did.
  const subjectKey = subjectOf(route);
  const subject: SubjectGroup | null =
    subjectKey && teacher ? teacher.subjects.find((x) => x.key === subjectKey) ?? null : null;

  const studentSubject =
    route.v === "studentSubject" && student
      ? student.subjects.find((x) => x.studentRowId === route.id) ?? null
      : null;

  let title: string;
  let crumbs: Crumb[] = [];

  if (role === "teacher") {
    switch (route.v) {
      case "week":
        title = "This week";
        crumbs = [{ label: "Home", to: HOME }];
        break;
      case "planner":
        title = "Goal planner";
        crumbs = [{ label: "Home", to: HOME }];
        break;
      case "library":
        title = "My library";
        crumbs = [{ label: "Home", to: HOME }];
        break;
      case "rollover":
        title = `A new year for ${subject?.name ?? "this class"}`;
        crumbs = [
          { label: subject?.name ?? "Class", to: { v: "subject", s: route.s } },
          { label: academicYear() },
        ];
        break;
      case "subject":
        title = subject?.name ?? "Subject";
        crumbs = subject?.grade ? [{ label: classLine(subject.grade, null) }] : [];
        break;
      case "kind": {
        const def = KINDS.find((k) => k.key === route.k);
        title = def?.label ?? "Materials";
        crumbs = [
          { label: subject?.name ?? "Subject", to: { v: "subject", s: route.s } },
          ...(subject?.grade ? [{ label: classLine(subject.grade, null) }] : []),
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
  } else if (role === "admin") {
    title = "Platform";
    crumbs = [{ label: "Preview" }];
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
    role === "admin"
      ? {
          name: teacher?.name ?? "…",
          initials: teacher?.initials ?? "—",
          role: identity?.roles.join(" · ") || "Admin",
        }
      : role === "teacher"
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
      showAdmin={showAdmin}
      adminSurfaces={consoles}
      fab={role === "teacher" ? "Ask the studio" : "Ask for help"}
      onFab={() => setStudioOpen(true)}
    >
      {role === "teacher" ? renderTeacher() : role === "admin" ? renderAdmin() : renderStudent()}

      {/* Open over any screen, already knowing what that screen is
          about. The class and kind below are the whole proposal: a
          teacher standing in Physics → Quizzes has already said what she
          is making and who for, and being asked again is the friction
          this removes. */}
      {studioOpen && teacher && role === "teacher" && (
        <Composer
          classes={teacher.subjects}
          rosterClasses={teacher.rosterClasses}
          contextClass={subject}
          contextKind={studioKind ?? (route.v === "kind" || route.v === "item" ? route.k : null)}
          starters={(subject?.units ?? [])
            .filter((u) => u.status !== "achieved")
            .slice(0, 3)
            .map((u) => u.title)}
          onClose={() => { setStudioOpen(false); setStudioKind(null); }}
        />
      )}
    </Shell>
  );

  function renderTeacher() {
    if (teacherError) return <Failed message={teacherError} onRetry={() => setReload((n) => n + 1)} />;
    if (!teacher) return <Loading />;

    switch (route.v) {
      case "week":
        return <Week m={teacher} go={go} />;
      case "planner":
        return (
          <GoalPlanner
            classes={teacher.subjects}
            rosterClasses={teacher.rosterClasses}
            units={teacher.units}
            all={teacher.all}
            go={go}
          />
        );
      case "rollover":
        return subject ? <Rollover sub={subject} go={go} /> : <Missing what="class" go={go} />;
      case "library":
        return <Library m={teacher} go={go} />;
      case "subject":
        return subject
          ? <SubjectHome sub={subject} go={go} onMake={openStudio} />
          : <Missing what="class" go={go} />;
      case "kind":
        return subject
          ? <KindList sub={subject} kind={route.k} go={go} classes={teacher.subjects} rosterClasses={teacher.rosterClasses} />
          : <Missing what="class" go={go} />;
      case "item": {
        if (!subject) return <Missing what="subject" go={go} />;
        const item = subject.items[route.k].find((x) => x.id === route.id);
        return item ? <Detail sub={subject} item={item} go={go} /> : <Missing what="piece of work" go={go} />;
      }
      default:
        return <Home m={teacher} go={go} onMake={openStudio} />;
    }
  }

  function renderAdmin() {
    if (teacherError) return <Failed message={teacherError} onRetry={() => setReload((n) => n + 1)} />;
    if (!identity) return <Loading rows={2} />;
    return <AdminHome identity={identity} />;
  }

  function renderStudent() {
    if (studentError) return <Failed message={studentError} onRetry={() => setReload((n) => n + 1)} />;
    if (!student) return <Loading rows={2} />;
    if (route.v === "studentSubject") {
      return studentSubject
        ? <StudentSubjectView key={studentSubject.studentRowId} sub={studentSubject} go={go} />
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
