// =====================================================================
// Path → Supabase. The one place that knows what moved.
//
// Every screen still calls api("/api/students"). This decides whether
// that is answered by Supabase directly or forwarded to the API, and it
// exists so the answer changes in ONE file rather than in the 193 call
// sites spread across 47 components.
//
// That is not a shim standing in for a real migration — it IS the
// migration. The data genuinely comes from Postgres over PostgREST, with
// RLS doing the authorisation the API used to do in middleware. What the
// indirection buys is that it could be done a surface at a time with the
// app working throughout, and that the remaining HTTP routes are listed
// in one visible place instead of being whatever happens to be left.
//
// What is deliberately NOT here, because it needs a secret or a
// privilege the browser must never hold:
//
//   /api/studio/*      the AI key
//   /api/onboarding/*  the AI key, for reading a CV
//   /api/auth/*        bcrypt'd verification codes, single-device sessions
//   /api/admin/*, /api/superadmin/*, /api/owner/*, /api/moe/*, /api/dev/*
//                      role escalation, and writes to audit_log — which
//                      has RLS on and no policy, so no client can reach it
//   /api/images/*      serves stored bytes
//
// Those five prefixes are what the separate backend project is for.
// =====================================================================
import * as A from "./artifacts";
import * as E from "./entities";
import * as SA from "./superadmin";
import { KIND_BY_PATH } from "./artifacts";

export type Handled = { handled: true; data: unknown } | { handled: false };

const SERVER_ONLY = [
  "/api/studio", "/api/onboarding", "/api/images",
  // admin / superadmin are answered locally now (see ./superadmin.ts) —
  // SECURITY DEFINER RPCs gated on is_super_admin() replace the backend
  // endpoints. The one exception, creating an account, still needs the
  // GoTrue admin key, so that single path returns { handled: false } from
  // the resolver and falls through to the backend here.
  "/api/owner", "/api/moe", "/api/dev",
  "/api/teachers",
  // The shared template library — curated CBSE materials the service
  // publishes and moderates. It lives on the API rather than in each
  // teacher's Supabase rows, so a cold service degrades to "not
  // connected yet" instead of a bare 404.
  "/api/library",
  // Most of /api/auth moved: provisioning is a database trigger and the
  // device claim is a policy, so only the parts that need a mail sender
  // and a bcrypt secret are left.
  "/api/auth/email-verify",
  "/api/auth/renew",
];

/** Does this path still need the API? */
export const needsServer = (path: string) =>
  SERVER_ONLY.some((p) => path === p || path.startsWith(p + "/"));

/**
 * Answer a request from Supabase, or report that it is not ours.
 *
 * Returning `{handled:false}` rather than throwing is what lets api()
 * fall through to HTTP for anything unmigrated — a typo in a path
 * becomes a 404 from the server, exactly as before, instead of a silent
 * empty result.
 */
export async function resolve(
  path: string,
  method: string,
  body: any
): Promise<Handled> {
  if (needsServer(path)) return { handled: false };

  const url = new URL(path, "http://x");
  const seg = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "").split("/");
  const q = url.searchParams;
  const [root, a, b, c] = seg;
  const yes = (data: unknown): Handled => ({ handled: true, data });

  // ── generated work: drafts, quizzes, homework, … ──────────────────
  const kind = KIND_BY_PATH[root];
  if (kind) {
    // /api/quizzes/:id/questions and friends
    if (a && b === "questions") {
      if (method === "GET") return yes(await A.questions(a));
      const qs = await A.questions(a);
      if (method === "POST") {
        const added = { ...body, qid: crypto.randomUUID(), position: qs.length + 1 };
        await A.saveQuestions(a, [...qs, added]);
        return yes({ ...added, id: added.qid, quiz_id: a });
      }
      if (method === "PATCH" && c) {
        const i = qs.findIndex((x: any) => x.qid === c);
        if (i === -1) throw notFound();
        qs[i] = { ...qs[i], ...body };
        await A.saveQuestions(a, qs);
        return yes({ ...qs[i], id: qs[i].qid, quiz_id: a });
      }
      if (method === "DELETE" && c) {
        const left = qs.filter((x: any) => x.qid !== c);
        if (left.length === qs.length) throw notFound();
        // Renumber so positions stay 1..n rather than developing a hole
        // the next insert would collide with.
        await A.saveQuestions(a, left.map((x: any, i: number) => ({ ...x, position: i + 1 })));
        return yes({ ok: true });
      }
    }
    if (a === "bulk" && method === "POST") {
      const { questions = [], ...rest } = body || {};
      return yes(await A.create("quiz", {
        ...rest,
        questions: questions.map((x: any, i: number) => ({
          qid: x.qid || crypto.randomUUID(), position: x.position ?? i + 1, ...x,
        })),
      }));
    }
    if (a && b === "sync" && method === "POST") {
      const qs = (body?.questions || []).map((x: any, i: number) => ({
        qid: x.qid || crypto.randomUUID(), position: x.position ?? i + 1, ...x,
      }));
      return yes(await A.saveQuestions(a, qs));
    }

    // Grids live under the artifact, so they are matched BEFORE the
    // by-id branch — otherwise /api/homework/:id/submissions is read as
    // "get homework :id" and returns the wrong thing entirely.
    if (a && (b === "submissions" || b === "completions" || b === "scores")) {
      if (method === "GET" && !c) return yes(await E.submissionGrid(a));
      if (method === "PUT" && c) return yes(await E.recordAttempt(a, c, body));
      return { handled: false };
    }

    if (a === "trash" && method === "GET") return yes(await A.list(kind, { trash: true }));
    if (a && b === "restore" && method === "POST") return yes(await A.restore(kind, a));
    if (a && b === "forever" && method === "DELETE") return yes(await A.purge(kind, a));

    if (!a) {
      if (method === "GET") return yes(await A.list(kind));
      if (method === "POST") return yes(await A.create(kind, body));
    }
    if (a) {
      if (method === "GET") return yes(await A.get(kind, a));
      if (method === "PATCH") return yes(await A.update(kind, a, body));
      if (method === "DELETE") return yes(await A.remove(kind, a));
    }
    return { handled: false };
  }

  switch (root) {
    // The privileged consoles. Every path here lands on a SECURITY DEFINER
    // RPC that checks is_super_admin() first; account creation is the lone
    // path that returns { handled: false } and falls through to the backend.
    case "admin":
      return SA.resolveAdmin(seg, method, body);
    case "superadmin":
      return SA.resolveSuperadmin(seg, method, body, q);

    case "auth":
      // Sign-in. Provisioning is a trigger and the device claim is an
      // RLS predicate, so neither needs a server any more.
      if (a === "supabase" && method === "POST") return yes(await E.provisionTeacher());
      if (a === "claim-session" && method === "POST") return yes(await E.claimSession());
      if (a === "me" && method === "GET") return yes(await E.getProfile());
      return { handled: false };

    case "me":
      if (method === "GET") return yes(await E.getProfile());
      if (method === "PATCH") return yes(await E.updateProfile(body));
      return { handled: false };

    case "dashboard":
      if (method === "GET") return yes(await E.dashboard());
      return { handled: false };

    case "students":
      if (!a && method === "GET") return yes(await E.listStudents());
      if (!a && method === "POST") return yes(await E.createStudent(body));
      if (a && method === "GET") return yes(await E.getStudent(a));
      if (a && method === "PATCH") return yes(await E.updateStudent(a, body));
      if (a && method === "DELETE") return yes(await E.deleteStudent(a));
      return { handled: false };

    case "schedule":
      if (!a && method === "GET") return yes(await E.listSchedule(q));
      if (!a && method === "POST") return yes(await E.createSchedule(body));
      if (a && method === "PATCH") return yes(await E.updateSchedule(a, body));
      if (a && method === "DELETE") return yes(await E.deleteSchedule(a));
      return { handled: false };

    case "attendance":
      if (!a && method === "GET") return yes(await E.listAttendance(q));
      if (a && method === "PUT") return yes(await E.markAttendance(a, body));
      return { handled: false };

    case "grades":
      if (a === "summary" && method === "GET") return yes(await E.gradeSummary());
      if (!a && method === "GET") return yes(await E.listGrades(q));
      if (!a && method === "POST") return yes(await E.createGrade(body));
      if (a && method === "PATCH") return yes(await E.updateGrade(a, body));
      if (a && method === "DELETE") return yes(await E.deleteGrade(a));
      return { handled: false };

    case "notifications":
      if (!a && method === "GET") return yes(await E.listNotifications(q));
      if (a === "mark-read" && method === "POST") return yes(await E.markNotificationsRead(body?.ids));
      // The sweep that raised reminders needed assignments, which have no
      // UI yet. Answering "nothing new" is truthful and keeps the bell
      // from erroring on every page load.
      if (a === "refresh" && method === "POST") return yes({ ok: true, created: 0 });
      if (a && method === "DELETE") return yes(await E.deleteNotification(a));
      return { handled: false };

    case "schools":
      if (!a && method === "GET") return yes(await E.listSchools(q));
      if (!a && method === "POST") return yes(await E.createSchool(body));
      if (a === "mine" && method === "GET") return yes(await E.listMySchools());
      if (a === "mine" && method === "POST") return yes(await E.attachSchool(body));
      if (a === "mine" && b && method === "PATCH") return yes(await E.updateMySchool(b, body));
      if (a === "mine" && b && method === "DELETE") return yes(await E.detachSchool(b));
      return { handled: false };

    case "quiz-scores":
      if (!a && method === "GET") return yes(await E.listQuizScores(q));
      if (!a && method === "POST") {
        const { quiz_id, student_id, ...rest } = body || {};
        if (!quiz_id || !student_id) {
          throw Object.assign(new Error("quiz_id and student_id are required"), { status: 400 });
        }
        return yes(await E.recordAttempt(quiz_id, student_id, { ...rest, status: "graded", submitted_at: new Date().toISOString() }));
      }
      if (a && method === "DELETE") return yes(await E.deleteQuizScore(a));
      return { handled: false };

    case "goals":
      if (!a && method === "GET") return yes(await E.listGoals());
      if (!a && method === "POST") return yes(await E.createGoal(body));
      if (a && method === "PATCH") return yes(await E.updateGoal(a, body));
      if (a && method === "DELETE") return yes(await E.deleteGoal(a));
      return { handled: false };

    case "skills":
      if (!a && method === "GET") return yes(await E.listSkills());
      if (!a && method === "POST") return yes(await E.createSkill(body));
      if (a && method === "PATCH") return yes(await E.updateSkill(a, body));
      if (a && method === "DELETE") return yes(await E.deleteSkill(a));
      return { handled: false };

    case "skill-assignments":
      if (!a && method === "GET") return yes(await E.listSkillAssignments());
      if (!a && method === "POST") return yes(await E.createSkillAssignment(body));
      if (a && method === "DELETE") return yes(await E.deleteSkillAssignment(a));
      return { handled: false };

    case "bulletin":
      if (!a && method === "GET") return yes(await E.listBulletin(q));
      if (a === "share" && method === "GET") return yes(await E.getBulletinShare());
      if (!a && method === "POST") return yes(await E.createBulletin(body));
      if (a && method === "PATCH") return yes(await E.updateBulletin(a, body));
      if (a && method === "DELETE") return yes(await E.deleteBulletin(a));
      return { handled: false };

    case "library":
      if (!a && method === "GET") return yes(await E.listLibrary());
      if (!a && method === "POST") return yes(await E.createLibrary(body));
      if (a && method === "PATCH") return yes(await E.updateLibrary(a, body));
      if (a && method === "DELETE") return yes(await E.deleteLibrary(a));
      return { handled: false };

    default:
      return { handled: false };
  }
}

function notFound() {
  return Object.assign(new Error("Not found"), { status: 404 });
}
