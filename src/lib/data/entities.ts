// =====================================================================
// The rest of the teacher's data, straight from Supabase
//
// Profile, register, timetable, attendance, gradebook, notices, schools
// and uploaded material. Each function returns the shape the screens were
// already written against, so the translation lives here rather than in
// forty components.
//
// Two translations recur and are worth naming once:
//   section  ↔ students.division / schedule_entries.section
//   category ↔ student_grades.label
// Both were renamed in the schema for good reasons; neither is worth
// renaming forty call sites over.
//
// Nothing here filters by owner. RLS does that — every one of these
// tables carries an owner policy, so `select * from students` returns
// this teacher's students and nobody else's. Adding a redundant
// `.eq("faculty_id", …)` would only be a second place to get it wrong.
// The owner id IS supplied on insert, because a policy checks it rather
// than filling it in.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";
import { api } from "@/shared/lib/apiClient";
import { clearIdent, facultyId, ident } from "./session";
import { daysFromToday } from "../localDate";
import { resolvePermissions } from "@/lib/permissions";

const iso = () => new Date().toISOString();
const notFound = () => Object.assign(new Error("Not found"), { status: 404 });

/**
 * The same address twice on one teacher's roster.
 *
 * Postgres reports 23505 against students_teacher_email_unique. Passed
 * through raw it reads as an internal failure, which is the wrong story:
 * nothing broke, the child is simply already in this class. Without the
 * index a slow Create pressed twice made two rows and two invitations to
 * the same inbox.
 */
function duplicateStudent(email: string) {
  return Object.assign(
    new Error(
      `${email} is already a student in your class. ` +
      `Find them in the list to edit or re-invite them.`,
    ),
    { status: 409, code: "duplicate_student" },
  );
}

/**
 * A roster row with no address cannot become a person.
 *
 * NOT NULL in the schema catches it, but a constraint violation reaching a
 * teacher reads as a crash. This is the same rule said in her language,
 * and it covers every caller — the modal, the bulk import, and whatever
 * writes students next.
 */
function requireEmail(body: Record<string, any>) {
  const email = String(body?.email ?? "").trim();
  if (!email) {
    throw Object.assign(
      new Error("Add an email for this student — it is what they sign in with."),
      { status: 400, code: "email_required" },
    );
  }
  return email;
}

const isDuplicateEmail = (e: any) =>
  e?.code === "23505" && String(e?.message ?? "").includes("students_teacher_email_unique");

// ── profile ───────────────────────────────────────────────────────────

/**
 * What she has, what things cost, and what the last few actually cost.
 *
 * One call rather than three, because the studio needs all of it on every
 * load: the balance for the header, the price list for the estimate on
 * the generate button, and the recent charges so a number that moved can
 * be accounted for.
 */
export async function myCredits() {
  const { data, error } = await supabase.rpc("my_credits");
  if (error) throw error;
  return data;
}

/**
 * Her own spending, broken down.
 *
 * Credits only. The token counts and the dollar cost behind them are our
 * supply price, not hers — my_ai_usage() does not return them at all, so
 * this cannot leak them by forgetting to strip a field.
 */
export async function myAiUsage(days = 30) {
  const { data, error } = await supabase.rpc("my_ai_usage", { p_days: days });
  if (error) throw error;
  return data;
}

/**
 * Her plan, her spend, her receipts.
 *
 * Credits and dirhams only. What a lesson costs us upstream lives on the
 * super admin's side of the glass, and my_billing() does not return it.
 */
export async function myBilling() {
  const { data, error } = await supabase.rpc("my_billing");
  if (error) throw error;
  return data;
}

/** /api/me — users ⨝ faculty ⨝ subscriptions ⨝ credits, flattened. */
/**
 * Every role this account holds, most privileged first.
 *
 * Derived in the database (db/tune.sql §37) from what is already true —
 * a faculty row makes you a teacher, a claimed roster row makes you a
 * student, users.role carries an assigned one — so there is no roles list
 * that can disagree with the rest of the schema. Best-effort: a profile
 * that loads without it is single-role, which is what it was before.
 */
async function myRoles(fallback: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("my_roles");
  if (error || !Array.isArray(data) || !data.length) return [fallback];
  return data as string[];
}

export async function getProfile() {
  const { userId, facultyId: fid } = await ident();
  if (!fid) {
    // No faculty row — but this might be a student, not a brand-new teacher.
    // A student becomes a user by claiming a roster row (link_student_account),
    // which sets students.user_id; detect that here and answer with a student
    // profile instead of the no_teacher_row that starts the sign-up funnel.
    //
    // maybeSingle() would now throw: a student invited by three teachers holds
    // three rows. The primary one — the first a teacher created — carries the
    // identity, and student_dashboard() reads across all of them.
    const { data: rows } = await supabase
      .from("students")
      .select("id, first_name, last_name, email, grade, division, subject, school_id")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1);
    const st = rows?.[0];

    /**
     * A student between classes is still a student.
     *
     * The roster row is the teacher's record of them, and she may delete
     * it — end of term, wrong class, a mistake. The PERSON survives that:
     * their account, their history, their sign-in. Requiring a row to
     * produce a profile meant a student whose only teacher removed them
     * was locked out of the product entirely, with no way back in but
     * another invitation they could not ask for.
     *
     * So the role decides, and the rows only decide what is on screen.
     */
    if (!st) {
      const { data: urow } = await supabase
        .from("users").select("role, email, first_name, last_name, full_name")
        .eq("id", userId).maybeSingle();
      if ((urow as any)?.role === "student") {
        return {
          roles: await myRoles("student"),
          id: null,
          user_id: userId,
          role: "student",
          first_name: (urow as any).first_name,
          last_name: (urow as any).last_name,
          full_name: (urow as any).full_name
            ?? [(urow as any).first_name, (urow as any).last_name].filter(Boolean).join(" "),
          email: (urow as any).email,
          grade: null,
          section: null,
          school_id: null,
          // Nothing to show, and that is a state rather than a failure.
          no_classes: true,
          onboarding_status: "complete",
        };
      }
    }

    if (st) {
      return {
        roles: await myRoles("student"),
        id: (st as any).id,
        user_id: userId,
        role: "student",
        first_name: (st as any).first_name,
        last_name: (st as any).last_name,
        full_name: [(st as any).first_name, (st as any).last_name].filter(Boolean).join(" "),
        email: (st as any).email,
        grade: (st as any).grade,
        section: (st as any).division,
        school_id: (st as any).school_id,
        onboarding_status: "complete",
      };
    }
    throw Object.assign(new Error("Your teaching profile hasn't been set up yet."), {
      status: 404, code: "no_teacher_row",
    });
  }

  // Apply a due monthly credit refresh before reading the balance, so the
  // number shown is the refreshed one on the first load past the boundary.
  // Best-effort — a missed refresh must never block the profile load.
  await supabase.rpc("refresh_credits_if_due").then(() => {}, () => {});

  const [u, f, s, c] = await Promise.all([
    supabase.from("users").select("*").eq("id", userId).single(),
    supabase.from("faculty").select("*").eq("id", fid).single(),
    supabase.from("subscriptions").select("plan,status,trial_ends_at,current_period_end").eq("faculty_id", fid).maybeSingle(),
    supabase.from("credits").select("balance,monthly_allowance").eq("faculty_id", fid).maybeSingle(),
  ]);
  for (const r of [u, f]) if (r.error) throw r.error;

  const user: any = u.data, fac: any = f.data, sub: any = s.data, cr: any = c.data;
  return {
    // Both at once is allowed: a teacher who is also on someone's roster
    // holds "teacher" and "student", and the shell offers a switch between
    // the two interfaces rather than picking one.
    roles: await myRoles(user.role || "teacher"),
    id: fac.id,
    user_id: user.id,
    faculty_code: fac.faculty_code,
    first_name: user.first_name,
    last_name: user.last_name,
    full_name:
      [user.first_name, user.last_name].filter(Boolean).join(" ") || user.full_name,
    email: user.email,
    phone: user.phone,
    avatar_url: user.avatar_url,
    role: user.role,
    sub_role: user.sub_role,
    // Resolved capability map — per-account overrides over role defaults.
    // Drives what a delegated sub-admin sees and can reach; the RPCs
    // re-check the same keys server-side.
    //
    // The admin.* half comes from the DATABASE, not from the JS defaults.
    // Since db/tune.sql §95 the role defaults live in role_capabilities,
    // editable from Roles & access without a deploy — so resolving them
    // here from a constant would mean a super admin granting `admin` the
    // billing capability watched the RPC start allowing it while the
    // sidebar kept the link hidden. my_capabilities() runs the same
    // admin_can() the gates run, which is the only way the two agree.
    permissions: {
      ...resolvePermissions({ role: user.role, permissions: user.permissions }),
      ...(await platformCapabilities()),
    },
    onboarding_status: user.onboarding_status,
    staff_id: fac.staff_id,
    // The renames the screens do not know about.
    majors: fac.expertise || [],
    grade_levels: fac.eligible_grades || [],
    languages: fac.languages || [],
    qualification: fac.qualification || [],
    nationality: fac.nationality,
    bio: fac.bio,
    years_experience: fac.years_experience,
    hire_date: fac.hire_date,
    organization: fac.organization,
    school_id: fac.school_id,
    credits_balance: cr?.balance ?? null,
    credits_allowance: cr?.monthly_allowance ?? null,
    subscription_plan: sub?.plan ?? null,
    subscription_status: sub?.status ?? null,
    subscription_ends_at: sub?.current_period_end ?? sub?.trial_ends_at ?? null,
    created_at: fac.created_at,
    updated_at: fac.updated_at,
  };
}

/**
 * The caller's platform capabilities, straight from the gate function.
 *
 * Best-effort by design: on a database where §95 has not been applied
 * the RPC does not exist, and the honest fallback is the JS defaults
 * already spread in above rather than an /api/me that fails outright —
 * a teacher signing in must not be blocked by a console's migration.
 */
async function platformCapabilities(): Promise<Record<string, boolean>> {
  try {
    const { data, error } = await supabase.rpc("my_capabilities");
    if (error || !data || typeof data !== "object") return {};
    return data as Record<string, boolean>;
  } catch {
    return {};
  }
}

const USER_FIELDS = ["first_name", "last_name", "email", "phone", "avatar_url", "locale"];
const FACULTY_MAP: Record<string, string> = {
  staff_id: "staff_id", nationality: "nationality", bio: "bio",
  hire_date: "hire_date", organization: "organization", school_id: "school_id",
  years_experience: "years_experience", qualification: "qualification",
  languages: "languages",
  majors: "expertise", grade_levels: "eligible_grades",
};

export async function updateProfile(patch: Record<string, any>) {
  const { userId, facultyId: fid } = await ident();
  if (!fid) throw notFound();

  // Never client-settable: role decides what you can see, and the
  // subscription and balance decide what you have paid for. RLS refuses
  // the latter two anyway; stripping them here means the write is not
  // silently dropped instead.
  const body = { ...patch };
  for (const k of ["role", "sub_role", "status", "subscription_plan", "subscription_status",
                   "credits_balance", "id", "user_id", "class_map", "grade_sections", "sections"]) {
    delete body[k];
  }

  const uPatch: Record<string, any> = {};
  for (const k of USER_FIELDS) if (body[k] !== undefined) uPatch[k] = body[k];
  const fPatch: Record<string, any> = {};
  for (const [from, to] of Object.entries(FACULTY_MAP)) if (body[from] !== undefined) fPatch[to] = body[from];

  if (Object.keys(uPatch).length) {
    uPatch.updated_at = iso();
    const { error } = await supabase.from("users").update(uPatch).eq("id", userId);
    if (error) throw error;
  }
  if (Object.keys(fPatch).length) {
    fPatch.updated_at = iso();
    const { error } = await supabase.from("faculty").update(fPatch).eq("id", fid);
    if (error) throw error;
  }
  return getProfile();
}

// ── students ──────────────────────────────────────────────────────────

const STUDENT_COLS =
  "id, student_code, first_name, last_name, student_id, date_of_birth, gender, grade, " +
  "division, subject, email, phone, nationality, address, primary_guardian_name, " +
  "primary_guardian_relationship, primary_guardian_email, primary_guardian_phone, " +
  "secondary_guardian_name, secondary_guardian_relationship, secondary_guardian_email, " +
  "secondary_guardian_phone, enrollment_date, notes, school_id, user_id, " +
  "invite_status, invited_at, created_at, updated_at";

const outStudent = (r: any) => (r ? { ...r, section: r.division } : r);
/** Date columns on students. An empty form field is NULL, never "". */
const STUDENT_DATE_FIELDS = ["date_of_birth", "enrollment_date"] as const;

const inStudent = (b: Record<string, any>) => {
  const o = { ...b };
  if ("section" in o) { o.division = o.section; delete o.section; }
  delete o.id; delete o.created_by; delete o.student_code;
  // Never client-settable through a plain create/update: linking an
  // account and opening the invite gate go through their own paths.
  delete o.user_id; delete o.invite_status; delete o.invited_at;

  /**
   * An untouched date input reads "", and Postgres will not take it:
   * `invalid input syntax for type date: ""`. The form has always sent
   * empty strings for the dates a teacher skipped — it only surfaced now
   * because the known-student picker fills the whole form at once, so a
   * blank enrollment date rides along with everything else instead of
   * being left out.
   *
   * Normalised here rather than in the modal because three paths write
   * students — the form, the bulk import and the picker — and all three
   * arrive through this function.
   */
  /**
   * Fields the UI adds, which are not columns.
   *
   * inviteStudent() returns the row with `invite_mail_error` attached so
   * the screen can explain a failed send. That object then becomes the
   * row in the list, and the edit form seeds itself from the row — so
   * saving a student who had ever been invited sent a column Postgres
   * has never had: "Could not find the 'invite_mail_error' column of
   * 'students' in the schema cache".
   */
  delete o.invite_mail_error;
  delete o.age;

  for (const k of STUDENT_DATE_FIELDS) {
    if (k in o && (o[k] === "" || o[k] === undefined)) o[k] = null;
  }
  // Same for the school select, whose "—" option is also "".
  if (o.school_id === "") o.school_id = null;
  return o;
};

export async function listStudents() {
  const { data, error } = await supabase
    .from("students").select(STUDENT_COLS)
    .order("grade").order("division").order("last_name");
  if (error) throw error;
  return (data || []).map(outStudent);
}

export async function getStudent(id: string) {
  const { data, error } = await supabase.from("students").select(STUDENT_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return outStudent(data);
}

export async function createStudent(body: Record<string, any>) {
  requireEmail(body);
  const fid = await facultyId();
  const { data, error } = await supabase
    .from("students").insert({ ...inStudent(body), created_by: fid })
    .select(STUDENT_COLS).single();
  if (isDuplicateEmail(error)) throw duplicateStudent(String(body?.email ?? "").trim());
  if (error) throw error;
  // Adding a student with an email invites them in the same action —
  // typing the address IS the intent to let them in. Best-effort: a
  // student who exists but was not emailed is recoverable from the
  // Invite button; a create that fails because the mailer is rate-limited
  // is not what anyone asked for.
  if ((data as any)?.email?.trim()) {
    try {
      const invited: any = await inviteStudent((data as any).id);

      /**
       * A teacher's address cannot be a student, so it does not belong on
       * the roster at all.
       *
       * Keeping the row and flagging it left a permanent entry for a
       * child who can never sign in — a name in her class list that is
       * not in her class, and that no amount of pressing Invite will
       * ever fix. The row was created a second ago and holds nothing she
       * would lose, so it goes, and she is told why.
       *
       * Only on create. Pressing Invite on a row she entered last term is
       * a different matter: that row may carry marks and attendance, and
       * deleting it because of one bad address is not ours to decide.
       */
      if (invited?.invite_status === "blocked_teacher") {
        await supabase.from("students").delete().eq("id", (data as any).id);
        throw Object.assign(new Error(
          `${(data as any).email} already has a teacher account on Murchid, so it can't ` +
          `also be a student — they haven't been added. Ask them for a different email ` +
          `address and use that instead.`,
        ), {
          status: 409,
          code: "already_teacher",
          email: (data as any).email,
        });
      }
      return invited;
    } catch (e: any) {
      if (e?.code === "already_teacher") throw e;
      /* the row is saved; the row's Invite button opens the gate later */
    }
  }
  return outStudent(data);
}

/**
 * Bulk-add students from an imported file (CSV / Excel / PDF), in one
 * insert. Rows missing a first name are dropped rather than failing the
 * whole batch — a stray blank line in a spreadsheet must not sink 200 good
 * rows. Returns the created students in the screen's shape.
 */
export async function bulkCreateStudents(rows: Record<string, any>[]) {
  const fid = await facultyId();
  const clean = (Array.isArray(rows) ? rows : [])
    .map((r) => ({ ...inStudent(r), created_by: fid }))
    .filter((r: any) => (r.first_name || "").toString().trim());
  if (!clean.length) {
    throw Object.assign(new Error("Nothing to import — no rows had a first name."), { status: 400 });
  }
  // Email is NOT NULL now, so one blank cell fails the whole insert. Say
  // whose it is: a constraint name is not something a teacher looking at a
  // spreadsheet of thirty can act on.
  const missing = clean.filter((r: any) => !String(r.email ?? "").trim());
  if (missing.length) {
    const who = missing
      .slice(0, 3)
      .map((r: any) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "an unnamed row")
      .join(", ");
    throw Object.assign(
      new Error(
        `Every student needs an email — it is what they sign in with. ` +
        `${missing.length} ${missing.length === 1 ? "row has" : "rows have"} none: ${who}` +
        `${missing.length > 3 ? `, and ${missing.length - 3} more` : ""}.`,
      ),
      { status: 400, code: "email_required" },
    );
  }
  const { data, error } = await supabase.from("students").insert(clean).select(STUDENT_COLS);
  if (isDuplicateEmail(error)) {
    throw Object.assign(
      new Error(
        "One of those students is already in your class. " +
        "Remove the duplicate rows from your file and import it again.",
      ),
      { status: 409, code: "duplicate_student" },
    );
  }
  if (error) throw error;
  return { created: (data || []).length, students: (data || []).map(outStudent) };
}

/**
 * Invite a student: open the gate, then email them the link that opens it.
 *
 * Both halves matter, and only the first used to happen. `invite_status`
 * decides whether a matching email may claim the roster row at all
 * (db/tune.sql §35) — but flipping it told nobody, so "Invite" moved a
 * label from `Invite` to `Invited` and the student never heard.
 *
 * The gate is flipped FIRST. If the mail fails, the student can still get
 * in the moment they reach /student on their own — a delivery problem
 * must not also be an access problem. The error says which half failed so
 * the teacher knows whether to resend or to send the link themselves.
 */
export async function inviteStudent(id: string) {
  const { data: row, error: readErr } = await supabase
    .from("students").select("email").eq("id", id).maybeSingle();
  if (readErr) throw readErr;
  if (!row) throw notFound();
  const email = ((row as any).email || "").trim();
  if (!email) {
    throw Object.assign(new Error("Add an email to this student before inviting them."), { status: 400 });
  }
  const { data, error } = await supabase
    .from("students")
    .update({ invite_status: "invited", invited_at: iso(), updated_at: iso() })
    .eq("id", id).select(STUDENT_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();

  // A failed send is reported ON the student, not as a thrown error. The
  // gate is open either way, so throwing would lose the very row the
  // screen needs to redraw — and would read as "the invite failed" when
  // the half that governs access succeeded.
  /**
   * The mail goes through the service, not through Supabase.
   *
   * Supabase's own mailer allows a handful of messages an hour, which is the
   * failure a teacher adding a class of thirty actually hits — the eleventh
   * student simply never hears anything. The service sends through Brevo with
   * a key the browser must never hold.
   *
   * It also means the invite is no longer auth mail. It carries no magic
   * link: the student signs in with Google and the roster row is claimed by
   * matching the address they arrive with. So it never expires, and pressing
   * Invite again is always safe.
   */
  /**
   * Someone this platform already knows needs no second invitation.
   *
   * The invite exists to prove the address belongs to a person a teacher
   * chose. That was settled the first time; the account on the other end
   * is already a student and can already sign in. Re-inviting them left
   * the row at `invited` while the person was plainly active, and put a
   * "you have been added" mail in an inbox that did not need one — which
   * is what happened every time a teacher removed a student and added
   * them back.
   */
  /**
   * Someone this platform already knows joins without a second sign-up —
   * but they are still told.
   *
   * A student holds one invitation PER SUBJECT, because each subject is
   * a different teacher's class. Claiming the row silently was right
   * about the account and wrong about the person: their English teacher
   * added them and nothing arrived, so the first they would know of it
   * is homework appearing in a class they were never told they were in.
   *
   * So the row is claimed (no sign-up, no waiting — it reads Active at
   * once) and the mail goes anyway, naming the class.
   */
  let claimed = false;
  try {
    const { data: attached } = await supabase.rpc("attach_known_student", { p_student: id });
    claimed = Boolean((attached as any)?.attached);
  } catch {
    /* not deployed yet — the invitation below still opens the gate */
  }

  let mailError: string | null = null;
  let alreadyTeacher = false;
  try {
    const sent = await api<{ already_teacher?: boolean }>("/api/invites/student", {
      method: "POST",
      body: { student_id: id },
    });
    alreadyTeacher = Boolean(sent?.already_teacher);
  } catch (e: any) {
    mailError =
      e?.code === "mail_unconfigured"
        ? `${email} can sign in now, but no invite was sent — email is not set up on this deployment yet.`
        : `${email} can sign in now, but the invite email failed to send. Press Invite again to retry.`;
  }

  /**
   * The service moved the row underneath us.
   *
   * An address that already teaches here cannot claim a roster row, and the
   * service writes that back as `blocked_teacher`. The optimistic UPDATE
   * above said `invited`, so returning it unchanged would show the teacher a
   * pending invitation that can never complete.
   */
  if (alreadyTeacher) {
    return {
      ...outStudent(data),
      invite_status: "blocked_teacher",
      invite_mail_error:
        `${email} already has a teacher account on Murchid, so it can't also be a student. ` +
        `They've been emailed an explanation — ask them for a different address, ` +
        `then edit this student and invite them again.`,
    };
  }
  if (claimed) {
    // The claim moved the row to `active` underneath the update above.
    const { data: fresh } = await supabase
      .from("students").select(STUDENT_COLS).eq("id", id).maybeSingle();
    return { ...outStudent(fresh ?? data), invite_mail_error: mailError };
  }
  return { ...outStudent(data), invite_mail_error: mailError };
}

export async function updateStudent(id: string, body: Record<string, any>) {
  // Only when the caller is touching the address — a partial update that
  // does not mention email must not be made to supply one.
  if ("email" in body) requireEmail(body);
  const { data, error } = await supabase
    .from("students").update({ ...inStudent(body), updated_at: iso() })
    .eq("id", id).select(STUDENT_COLS).maybeSingle();
  if (isDuplicateEmail(error)) throw duplicateStudent(String(body?.email ?? "").trim());
  if (error) throw error;
  if (!data) throw notFound();
  return outStudent(data);
}

export async function deleteStudent(id: string) {
  const fid = await facultyId();
  // Only the creator may delete. Seeing a student through a shared class
  // is not the same as being able to erase them from the school's
  // records — the policy allows the update, so the intent is enforced here.
  const { error, count } = await supabase
    .from("students").delete({ count: "exact" }).eq("id", id).eq("created_by", fid);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── schedule ──────────────────────────────────────────────────────────

const SCHED = "id, draft_id, class_id, title, subject, grade, section, date, start_time, end_time, location, notes, status, created_at, updated_at";

export async function listSchedule(params: URLSearchParams) {
  let q = supabase.from("schedule_entries").select(SCHED).order("date").order("start_time");
  const from = params.get("from"), to = params.get("to");
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Work with no audience reaches nobody.
 *
 * A schedule entry carrying a generation IS the assignment — students
 * receive it by matching their grade and subject against these two
 * fields (db/tune.sql §48). Left blank, the entry saves, appears on her
 * timetable, and is delivered to no one: the most expensive kind of
 * failure, because everything looks like it worked.
 *
 * An entry with no generation is just a slot in her own week — a free
 * period, a meeting, a reminder — and has no audience to miss. Those stay
 * free-form.
 *
 * Enforced here rather than in the modal because four screens create
 * entries: the schedule modal, the planner, the teaching rail and the
 * studio's save-and-schedule.
 */
function requireAudience(body: Record<string, any>, existing?: Record<string, any>) {
  const merged = { ...(existing ?? {}), ...body };
  if (!merged.draft_id) return;
  const missing = [
    !String(merged.grade ?? "").trim() && "a grade",
    !String(merged.subject ?? "").trim() && "a subject",
  ].filter(Boolean) as string[];
  if (!missing.length) return;
  throw Object.assign(
    new Error(
      `Add ${missing.join(" and ")} before scheduling this. ` +
      `Students receive work by matching their grade and subject, so without ` +
      `${missing.length > 1 ? "them" : "it"} nobody will see it.`,
    ),
    { status: 400, code: "no_audience" },
  );
}

export async function createSchedule(body: Record<string, any>) {
  requireAudience(body);
  const fid = await facultyId();
  const { data, error } = await supabase
    .from("schedule_entries").insert({ ...body, faculty_id: fid }).select(SCHED).single();
  if (error) throw error;
  return data;
}

export async function updateSchedule(id: string, body: Record<string, any>) {
  // Merged against what is already stored: a PATCH that only moves the
  // date must not be asked to resupply a subject it is not touching.
  const { data: current } = await supabase
    .from("schedule_entries").select("draft_id, grade, subject").eq("id", id).maybeSingle();
  requireAudience(body, current ?? undefined);
  const { data, error } = await supabase
    .from("schedule_entries").update({ ...body, updated_at: iso() })
    .eq("id", id).select(SCHED).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function deleteSchedule(id: string) {
  const { error, count } = await supabase.from("schedule_entries").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── attendance ────────────────────────────────────────────────────────

export async function listAttendance(params: URLSearchParams) {
  const studentId = params.get("student_id");
  if (studentId) {
    const { data, error } = await supabase
      .from("attendance").select("id, date, status, note, class_id, schedule_id")
      .eq("student_id", studentId).order("date", { ascending: false }).limit(200);
    if (error) throw error;
    return (data || []).map((r: any) => ({ ...r, notes: r.note }));
  }

  const date = params.get("date");
  if (!date) throw Object.assign(new Error("date or student_id is required"), { status: 400 });

  // The register lists EVERY student, marked or not — so it is the
  // roster that drives it, with marks joined on. Two queries rather than
  // an embedded join, because PostgREST cannot express "left join on a
  // second condition (this date)" in one.
  const [roster, marks] = await Promise.all([
    listStudents(),
    supabase.from("attendance").select("id, student_id, status, note, source").eq("date", date),
  ]);
  if (marks.error) throw marks.error;
  const byStudent = new Map((marks.data || []).map((m: any) => [m.student_id, m]));

  const grade = params.get("grade"), section = params.get("section");
  return roster
    .filter((s: any) => (!grade || s.grade === grade) && (!section || s.section === section))
    .map((s: any) => {
      const m: any = byStudent.get(s.id);
      return {
        student_id: s.id, first_name: s.first_name, last_name: s.last_name,
        code: s.student_id, grade: s.grade, section: s.section,
        attendance_id: m?.id ?? null, status: m?.status ?? null, notes: m?.note ?? null,
        // 'portal' = the student was marked by opening their portal, not
        // by the teacher — her register renders the two differently.
        source: m?.source ?? null,
      };
    });
}

export async function markAttendance(studentId: string, body: Record<string, any>) {
  const fid = await facultyId();
  const { date, status, notes, class_id, schedule_id, notes_only } = body || {};
  if (!date) throw Object.assign(new Error("date is required"), { status: 400 });
  if (!status) throw Object.assign(new Error("status is required"), { status: 400 });

  // Taking the register twice must correct it, not double it. The key is
  // (student, date, schedule_key) where schedule_key is a generated
  // column folding "no session" into a fixed uuid — one ordinary
  // constraint covering both cases, which is what onConflict can name.
  // Partial indexes could not be targeted this way.
  const row = {
    faculty_id: fid, student_id: studentId, date, status,
    note: notes ?? null, class_id: class_id ?? null, schedule_id: schedule_id ?? null,
    // Her hand outranks the portal: a corrected mark stops carrying the
    // "marked by portal sign-in" hint.
    //
    // But only when she actually set the MARK. Annotating a portal row
    // reused this same write and relabelled it as hand-marked — the row
    // then claimed a provenance nobody had given it, which is the exact
    // lie the source column was added to stop.
    ...(notes_only ? {} : { source: "teacher" }),
  };
  const { data, error } = await supabase
    .from("attendance")
    .upsert(row, { onConflict: "student_id,date,schedule_key", ignoreDuplicates: false })
    .select("id, student_id, date, status, note, class_id, schedule_id").single();
  if (error) throw error;
  return { ...data, notes: (data as any).note };
}

// ── gradebook ─────────────────────────────────────────────────────────

const GRADE_COLS = "id, student_id, class_id, source_id, subject, term, label, score, max_score, recorded_on";
const outGrade = (r: any) => (r ? { ...r, category: r.label, recorded_at: r.recorded_on } : r);
const inGrade = (b: Record<string, any>) => {
  const o = { ...b };
  if ("category" in o) { o.label = o.category; delete o.category; }
  delete o.recorded_at; delete o.id;
  return o;
};

export async function listGrades(params: URLSearchParams) {
  let q = supabase.from("student_grades").select(GRADE_COLS).order("recorded_on", { ascending: false });
  for (const k of ["student_id", "subject", "term"]) {
    const v = params.get(k);
    if (v) q = q.eq(k, v);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(outGrade);
}

export async function createGrade(body: Record<string, any>) {
  const fid = await facultyId();
  const { data, error } = await supabase
    .from("student_grades").insert({ ...inGrade(body), faculty_id: fid })
    .select(GRADE_COLS).single();
  if (error) throw error;
  return outGrade(data);
}

export async function updateGrade(id: string, body: Record<string, any>) {
  const { data, error } = await supabase
    .from("student_grades").update({ ...inGrade(body), updated_at: iso() })
    .eq("id", id).select(GRADE_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return outGrade(data);
}

export async function deleteGrade(id: string) {
  const { error, count } = await supabase.from("student_grades").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

/**
 * Per-student averages across BOTH typed-in marks and work the studio
 * scored. A teacher's sense of how a student is doing does not
 * distinguish between the two, so neither does this.
 */
export async function gradeSummary() {
  const [roster, typed, scored] = await Promise.all([
    listStudents(),
    supabase.from("student_grades").select("student_id, score, max_score"),
    supabase.from("quiz_attempts").select("student_id, score, max_score"),
  ]);
  if (typed.error) throw typed.error;
  if (scored.error) throw scored.error;

  const acc = new Map<string, { n: number; sum: number }>();
  for (const r of [...(typed.data || []), ...(scored.data || [])] as any[]) {
    if (r.score == null || !r.max_score) continue;
    const cur = acc.get(r.student_id) || { n: 0, sum: 0 };
    cur.n += 1;
    cur.sum += (Number(r.score) / Number(r.max_score)) * 100;
    acc.set(r.student_id, cur);
  }
  return roster.map((s: any) => {
    const a = acc.get(s.id);
    return {
      student_id: s.id, first_name: s.first_name, last_name: s.last_name,
      grade: s.grade, section: s.section,
      entries: a?.n ?? 0,
      average_pct: a && a.n ? Number((a.sum / a.n).toFixed(1)) : 0,
    };
  });
}

// ── notifications ─────────────────────────────────────────────────────

const outNote = (r: any) => ({ ...r, message: r.body, is_read: r.read_at != null });

export async function listNotifications(params: URLSearchParams) {
  let q = supabase
    .from("notifications")
    .select("id, kind, title, body, link, ref_table, ref_id, read_at, created_at")
    .order("created_at", { ascending: false }).limit(50);
  if (params.get("unread") === "true") q = q.is("read_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(outNote);
}

export async function markNotificationsRead(ids?: string[]) {
  const { userId } = await ident();
  let q = supabase.from("notifications")
    .update({ read_at: iso(), updated_at: iso() })
    .eq("user_id", userId).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) throw error;
  return { ok: true };
}

export async function deleteNotification(id: string) {
  const { error, count } = await supabase.from("notifications").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── schools ───────────────────────────────────────────────────────────

const SCHOOL_COLS = "id, name, name_ar, emirate, city, type, curriculum, website";

export async function listSchools(params: URLSearchParams) {
  let q = supabase.from("schools").select(SCHOOL_COLS).order("emirate").order("name");
  const em = params.get("emirate");
  if (em) q = q.eq("emirate", em);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createSchool(body: Record<string, any>) {
  const { name, emirate } = body || {};
  if (!name || !emirate) throw Object.assign(new Error("name and emirate are required"), { status: 400 });
  // Return the existing row rather than a duplicate — the "my school
  // isn't listed" fallback is used by many teachers at the same school.
  const { data: existing } = await supabase
    .from("schools").select(SCHOOL_COLS).ilike("name", name).eq("emirate", emirate).maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase.from("schools").insert(body).select(SCHOOL_COLS).single();
  if (error) throw error;
  return data;
}

export async function listMySchools() {
  const { data, error } = await supabase
    .from("faculty_schools")
    .select(`is_primary, grade_sections, school:schools(${SCHOOL_COLS})`)
    .order("is_primary", { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r.school, is_primary: r.is_primary, grade_sections: r.grade_sections }));
}

export async function attachSchool(body: Record<string, any>) {
  const fid = await facultyId();
  const { school_id, is_primary } = body || {};
  if (!school_id) throw Object.assign(new Error("school_id is required"), { status: 400 });
  if (is_primary) await clearPrimary(fid);
  const { error } = await supabase
    .from("faculty_schools")
    .upsert({ faculty_id: fid, school_id, is_primary: !!is_primary }, { onConflict: "faculty_id,school_id" });
  if (error) throw error;
  return listMySchools();
}

export async function updateMySchool(schoolId: string, body: Record<string, any>) {
  const fid = await facultyId();
  // At most one primary, and the unique index enforces it — so the old
  // one has to be cleared first or the update fails on the constraint
  // rather than moving the flag.
  if (body?.is_primary) await clearPrimary(fid);
  const { error } = await supabase
    .from("faculty_schools").update(body).eq("faculty_id", fid).eq("school_id", schoolId);
  if (error) throw error;
  return listMySchools();
}

export async function detachSchool(schoolId: string) {
  const fid = await facultyId();
  const { error } = await supabase
    .from("faculty_schools").delete().eq("faculty_id", fid).eq("school_id", schoolId);
  if (error) throw error;
  return { ok: true };
}

async function clearPrimary(fid: string) {
  await supabase.from("faculty_schools").update({ is_primary: false })
    .eq("faculty_id", fid).eq("is_primary", true);
}

// ── materials (the teacher's own uploads) ─────────────────────────────
//
// Served at /api/materials, NOT /api/library. The two were one word for
// two different things: /api/library is the curated shelf the API
// service publishes, and it is on the SERVER_ONLY list — so it shadowed
// this local handler completely and every function below was
// unreachable. The collision is why a whole personal-material feature
// existed in the codebase and could not be opened.
//
// extracted_text is deliberately NOT in the list column set. It is the
// full text of a textbook; a shelf of twenty files would ship megabytes
// to render a list of names.

const MAT = "id, title, file_name, file_path, mime_type, status, kind, grade, subject, section, pages, created_at, updated_at";

export async function listMaterials(query: Record<string, any> = {}) {
  let q = supabase
    .from("materials").select(MAT).is("deleted_at", null)
    .order("updated_at", { ascending: false });
  // Narrowing is optional: the shelf shows everything by default, and a
  // class filter is a view of it rather than a different query.
  if (query.grade) q = q.eq("grade", query.grade);
  if (query.subject) q = q.eq("subject", query.subject);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createMaterial(body: Record<string, any>) {
  const fid = await facultyId();
  const { data, error } = await supabase
    .from("materials").insert({ ...body, faculty_id: fid }).select(MAT).single();
  if (error) throw error;
  return data;
}

export async function updateMaterial(id: string, body: Record<string, any>) {
  // Only what a teacher may change by hand. status, extracted_text and
  // pages belong to the extraction service — a browser that could write
  // them could claim a file was read when it never was.
  const patch: Record<string, any> = { updated_at: iso() };
  for (const k of ["title", "kind", "grade", "subject", "section"]) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabase
    .from("materials").update(patch).eq("id", id).select(MAT).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function deleteMaterial(id: string) {
  const { error, count } = await supabase
    .from("materials").update({ deleted_at: iso() }, { count: "exact" }).eq("id", id).is("deleted_at", null);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── dashboard ─────────────────────────────────────────────────────────

export async function dashboard() {
  const today = daysFromToday(0);
  const weekOut = daysFromToday(7);
  const { facultyId: fid } = await ident();

  // Six round trips became four. `head: true` counts without shipping
  // rows, and one scan of ai_studio serves both the counts and the
  // recent list — a second query for five rows it already had was the
  // easiest thing here to stop doing.
  const [schedule, work, notes, roster] = await Promise.all([
    supabase.from("schedule_entries").select(SCHED)
      .gte("date", today).lte("date", weekOut).order("date").order("start_time"),
    supabase.from("ai_studio").select("id, type, status, content, updated_at")
      .is("deleted_at", null).order("updated_at", { ascending: false }),
    supabase.from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .is("read_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("students").select("id", { count: "exact", head: true }),
  ]);
  for (const r of [schedule, work, notes]) if (r.error) throw r.error;

  const days = (schedule.data || []) as any[];
  const rows = (work.data || []) as any[];
  const countOf = (t: string) => rows.filter((r) => r.type === t).length;

  return {
    today_lessons: days.filter((d) => d.date === today),
    upcoming_lessons: days.filter((d) => d.date > today).slice(0, 8),
    recent_drafts: rows.slice(0, 6).map((r) => ({
      id: r.id,
      name: r.content?.title || r.content?.name || "Untitled",
      type: r.type,
      status: r.status,
      subject: r.content?.subject ?? null,
      grade: r.content?.grade ?? null,
      progress: r.content?.progress ?? null,
      last_edited: r.updated_at,
    })),
    counts: {
      students: roster.count ?? 0,
      drafts: countOf("lesson_plan"),
      quizzes: countOf("quiz"),
      homework: countOf("homework"),
      presentations: countOf("presentation"),
      activities: countOf("activity"),
      templates: countOf("template"),
      total: rows.length,
    },
    recent_notifications: (notes.data || []).map(outNote),

    // ── what the charts and the calendar need ──────────────────────
    //
    // Derived from rows already fetched. A chart is not worth a second
    // round trip when the data for it is sitting in `rows`.
    activity: activitySeries(rows, 8),
    by_type: [
      { key: "lesson_plan",  label: "Lessons",       n: countOf("lesson_plan") },
      { key: "quiz",         label: "Quizzes",       n: countOf("quiz") },
      { key: "homework",     label: "Homework",      n: countOf("homework") },
      { key: "presentation", label: "Presentations", n: countOf("presentation") },
      { key: "activity",     label: "Activities",    n: countOf("activity") },
    ],
    // Every dated thing in the next fortnight, for the mini-calendar.
    calendar: days.map((d: any) => ({
      date: d.date, title: d.title, subject: d.subject,
      start_time: d.start_time, kind: "lesson",
    })),
    tasks: buildTasks(days, rows, today),
    // Trial and balance, so the dashboard can say how much runway is
    // left instead of the teacher discovering it at the moment a write
    // is refused.
    plan: await planSummary(fid),
  };
}

/**
 * Work created per week, oldest first. Eight buckets is two months —
 * enough to show a shape without pretending a new account has a trend.
 */
function activitySeries(rows: any[], weeks: number) {
  const out: { week: string; n: number }[] = [];
  const now = new Date();
  // Monday-based buckets, because a teaching week is not a calendar week
  // starting on Sunday.
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  for (let i = weeks - 1; i >= 0; i--) {
    const from = new Date(monday.getTime() - i * 7 * 864e5);
    const to = new Date(from.getTime() + 7 * 864e5);
    out.push({
      week: from.toISOString().slice(0, 10),
      n: rows.filter((r) => {
        const t = new Date(r.created_at ?? r.updated_at).getTime();
        return t >= from.getTime() && t < to.getTime();
      }).length,
    });
  }
  return out;
}

/**
 * What needs attention — derived, not typed in.
 *
 * A manual to-do list is another thing to maintain, and an empty one is
 * just a reproach. These come from work that is already in an unfinished
 * state, so the list is right without anyone tending it and empties
 * itself as the work gets done.
 */
function buildTasks(days: any[], rows: any[], today: string) {
  const tasks: any[] = [];

  for (const d of days.filter((x) => x.date === today && x.status === "planned")) {
    tasks.push({
      id: `lesson-${d.id}`, kind: "lesson",
      title: `Teach ${d.title}`,
      meta: d.start_time ? d.start_time.slice(0, 5) : "today",
      section: "schedule", urgent: true,
    });
  }

  for (const r of rows.filter((x) => x.status === "generating" || x.status === "processing")) {
    tasks.push({
      id: `stuck-${r.id}`, kind: "stuck",
      title: `Finish "${r.content?.title || r.content?.name || "Untitled"}"`,
      meta: "still drafting", section: sectionFor(r.type), urgent: true,
    });
  }

  for (const r of rows.filter((x) => {
    const p = Number(x.content?.progress);
    return Number.isFinite(p) && p > 0 && p < 100;
  }).slice(0, 4)) {
    tasks.push({
      id: `wip-${r.id}`, kind: "wip",
      title: r.content?.title || r.content?.name || "Untitled",
      meta: `${r.content.progress}% done`, section: sectionFor(r.type), urgent: false,
    });
  }

  const empty = rows.filter((x) => x.type === "quiz" && !(x.content?.questions?.length));
  for (const r of empty.slice(0, 3)) {
    tasks.push({
      id: `q-${r.id}`, kind: "empty",
      title: `Add questions to "${r.content?.title || "Untitled quiz"}"`,
      meta: "no questions yet", section: "quizzes", urgent: false,
    });
  }

  return tasks.slice(0, 8);
}

const sectionFor = (type: string) =>
  ({ lesson_plan: "lesson-plans", quiz: "quizzes", homework: "homework",
     presentation: "presentations", activity: "activities" }[type] || "lesson-plans");

/**
 * Whole days from today until `iso`, counted in CALENDAR days in the
 * reader's own timezone.
 *
 * Not `ceil(ms / 864e5)`. That counts 24-hour blocks from the current
 * instant, so the same subscription reads 20 in the morning and 19 that
 * evening — the number moves when the clock passes an arbitrary time of
 * day rather than when the date changes. Flattening both ends to local
 * midnight means it falls by exactly one, exactly at midnight.
 */
function daysUntil(iso: string): number {
  const midnight = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  return Math.max(0, Math.round((midnight(new Date(iso)) - midnight(new Date())) / 864e5));
}

/** Plan, status and days remaining. Null when there is no faculty row. */
async function planSummary(fid: string | null) {
  if (!fid) return null;
  // Same lazy refresh as getProfile — the dashboard's credit ring reads
  // from here, so a due reset shows the moment the teacher opens it.
  await supabase.rpc("refresh_credits_if_due").then(() => {}, () => {});
  const [sub, cr, mode] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, status, trial_ends_at, current_period_start, current_period_end")
      .maybeSingle(),
    supabase.from("credits").select("balance, monthly_allowance").maybeSingle(),
    // Which billing mode the platform is in (db/tune.sql §89). The
    // dashboard's runway card is the last surface that talked about a
    // "trial plan" during a free period — it reads subscriptions
    // directly rather than my_credits(), so the flag has to come with
    // it. Third leg of a Promise.all that was already there, so no extra
    // round trip.
    supabase.rpc("public_billing_mode"),
  ]);
  const s: any = sub.data;
  if (!s) return null;
  const ends = s.current_period_end ?? s.trial_ends_at;
  return {
    plan: s.plan,
    status: s.status,
    ends_at: ends,
    started_at: s.current_period_start ?? null,
    days_left: ends ? daysUntil(ends) : null,
    credits: cr.data?.balance ?? null,
    allowance: cr.data?.monthly_allowance ?? null,
    // `!== false` so a failed RPC reads as billing on, matching every
    // other surface.
    billing_enabled: (mode.data as any)?.enabled !== false,
  };
}

// ── submission grids ──────────────────────────────────────────────────
//
// Homework submissions, activity completions and quiz scores are one
// question — "who has done this, and how did they do" — answered by
// three tables: assignments (who it was set to), class_members (who is
// in those classes) and quiz_attempts (what came back).
//
// PostgREST cannot express "left join attempts on assignment AND
// student" in one request, so this is four small queries composed in
// code. Four round trips to answer one screen is worth it against the
// alternative of a database view per screen.

/** Every student the work was assigned to, with their attempt if any. */
export async function submissionGrid(artifactId: string) {
  const { data: asg, error: e1 } = await supabase
    .from("assignments").select("id, class_id").eq("generation_id", artifactId);
  if (e1) throw e1;
  if (!asg?.length) return [];

  const classIds = asg.map((a: any) => a.class_id).filter(Boolean);
  const asgIds = asg.map((a: any) => a.id);

  const [members, attempts, classes] = await Promise.all([
    supabase.from("class_members").select("class_id, student_id").in("class_id", classIds),
    supabase.from("quiz_attempts")
      .select("id, assignment_id, student_id, status, started_at, submitted_at, score, max_score, feedback, answers")
      .in("assignment_id", asgIds),
    supabase.from("classes").select("id, name").in("id", classIds),
  ]);
  for (const r of [members, attempts, classes]) if (r.error) throw r.error;

  const studentIds = [...new Set((members.data || []).map((m: any) => m.student_id))];
  if (!studentIds.length) return [];
  const { data: students, error: e2 } = await supabase
    .from("students").select("id, student_code, first_name, last_name, grade, division")
    .in("id", studentIds);
  if (e2) throw e2;

  const className = new Map((classes.data || []).map((c: any) => [c.id, c.name]));
  const classOf = new Map((members.data || []).map((m: any) => [m.student_id, m.class_id]));
  const attemptOf = new Map((attempts.data || []).map((a: any) => [a.student_id, a]));

  return (students || [])
    .map((s: any) => {
      const at: any = attemptOf.get(s.id) || {};
      const cid = classOf.get(s.id);
      return {
        student_id: s.id, code: s.student_code,
        first_name: s.first_name, last_name: s.last_name,
        name: [s.first_name, s.last_name].filter(Boolean).join(" "),
        grade: s.grade, section: s.division,
        class_id: cid ?? null, class_name: cid ? className.get(cid) ?? null : null,
        status: at.status ?? null, started_at: at.started_at ?? null,
        submitted_at: at.submitted_at ?? null,
        score: at.score ?? null, max_score: at.max_score ?? null,
        feedback: at.feedback ?? null, answers: at.answers ?? null,
      };
    })
    .sort((a, b) =>
      (a.grade || "").localeCompare(b.grade || "") ||
      (a.section || "").localeCompare(b.section || "") ||
      (a.last_name || "").localeCompare(b.last_name || ""));
}

/** Record or correct one student's attempt at a piece of assigned work. */
export async function recordAttempt(artifactId: string, studentId: string, body: Record<string, any>) {
  // The assignment this student is actually on. This is the
  // authorisation as well as the lookup: a student on none of this
  // artifact's assignments produces no row, and the write stops rather
  // than creating an orphan attempt.
  const { data: asg, error } = await supabase
    .from("assignments").select("id, class_id").eq("generation_id", artifactId);
  if (error) throw error;
  if (!asg?.length) throw Object.assign(new Error("That work hasn't been assigned to a class yet."), { status: 404 });

  const { data: member, error: e2 } = await supabase
    .from("class_members").select("class_id")
    .eq("student_id", studentId)
    .in("class_id", asg.map((a: any) => a.class_id).filter(Boolean))
    .maybeSingle();
  if (e2) throw e2;
  if (!member) throw Object.assign(new Error("That student isn't assigned this work."), { status: 404 });

  const assignmentId = asg.find((a: any) => a.class_id === member.class_id)!.id;
  const row: Record<string, any> = { assignment_id: assignmentId, student_id: studentId };
  for (const k of ["status", "submitted_at", "score", "max_score", "feedback", "answers"]) {
    if (body?.[k] !== undefined) row[k] = body[k];
  }
  const { data, error: e3 } = await supabase
    .from("quiz_attempts")
    .upsert(row, { onConflict: "assignment_id,student_id", ignoreDuplicates: false })
    .select("*").single();
  if (e3) throw e3;
  return data;
}

/** /api/quiz-scores — the same attempts, keyed by quiz rather than by grid. */
export async function listQuizScores(params: URLSearchParams) {
  let q = supabase
    .from("quiz_attempts")
    .select("id, student_id, score, max_score, feedback, submitted_at, assignment:assignments!inner(id, generation_id)")
    .order("submitted_at", { ascending: false });
  const quizId = params.get("quiz_id");
  const studentId = params.get("student_id");
  if (quizId) q = q.eq("assignment.generation_id", quizId);
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id, quiz_id: r.assignment?.generation_id ?? null, student_id: r.student_id,
    score: r.score, max_score: r.max_score, feedback: r.feedback, recorded_at: r.submitted_at,
  }));
}

export async function deleteQuizScore(id: string) {
  const { error, count } = await supabase.from("quiz_attempts").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── goals ─────────────────────────────────────────────────────────────
//
// A goal is a whole portion of a subject — a term, a unit, a book —
// that the AI breaks into a week-by-week teaching plan grounded in the
// teacher's own profile. The row is created here, browser-side; the
// PLANNING runs on the API service, because it needs the model key.
//
// plan (jsonb) belongs to the AI. The one exception is `brief`, written
// at creation: the teacher's own description of what the goal covers is
// input the planner needs, and the table has no other column for it.

const GOAL_COLS = "id, title, material_ids, timeline_days, plan, ai_verdict, status, grade, subject, section, start_date, periods_per_week, created_at, updated_at";

export async function listGoals() {
  const { data, error } = await supabase
    .from("goals").select(GOAL_COLS).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createGoal(body: Record<string, any>) {
  const fid = await facultyId();
  const { title, brief, timeline_days, material_ids,
          grade, subject, section, start_date, periods_per_week } = body || {};
  if (!title?.trim()) throw Object.assign(new Error("Give the goal a name."), { status: 400 });
  const { data, error } = await supabase
    .from("goals")
    .insert({
      faculty_id: fid,
      title: title.trim(),
      timeline_days: timeline_days ?? null,
      material_ids: material_ids?.length ? material_ids : null,
      grade: grade ?? null,
      subject: subject ?? null,
      section: section ?? null,
      start_date: start_date ?? null,
      periods_per_week: periods_per_week ?? null,
      plan: brief?.trim() ? { brief: brief.trim() } : null,
      status: "processing",
    })
    .select(GOAL_COLS).single();
  if (error) throw error;
  return data;
}

export async function updateGoal(id: string, body: Record<string, any>) {
  const patch: Record<string, any> = { updated_at: iso() };
  // Only what a teacher may change by hand. The plan and the verdict are
  // the AI's to write, through the service.
  // grade/subject/section/start_date/periods_per_week are hers to set:
  // they are what turns a plan into dated hours in her week (§97).
  for (const k of [
    "title", "timeline_days", "status",
    "grade", "subject", "section", "start_date", "periods_per_week",
  ]) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabase
    .from("goals").update(patch).eq("id", id).select(GOAL_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function deleteGoal(id: string) {
  const { error, count } = await supabase.from("goals").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── the curriculum, as structure (§99) ────────────────────────────────
//
// Reference data: readable by anyone signed in, writable by nobody.
// Units are a SEQUENCE and its outcomes — never textbook content, which
// is copyrighted and belongs in the teacher's own private bucket.

export async function listCurricula() {
  const { data, error } = await supabase
    .from("curricula").select("code, name, name_ar, region").order("name");
  if (error) throw error;
  return data || [];
}

export async function listCurriculumUnits(q: Record<string, any> = {}) {
  if (!q.curriculum || !q.grade || !q.subject) return [];
  const { data, error } = await supabase
    .from("curriculum_units")
    .select("id, curriculum_code, grade, subject, seq, title, outcomes, typical_weeks, source")
    .eq("curriculum_code", q.curriculum).eq("grade", q.grade).eq("subject", q.subject)
    .order("seq", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Which classes have a sequence at all, so the UI can offer only those. */
export async function curriculumCoverage() {
  const { data, error } = await supabase
    .from("curriculum_units").select("curriculum_code, grade, subject");
  if (error) throw error;
  const seen = new Map<string, any>();
  for (const r of data || []) {
    const k = `${r.curriculum_code}|${r.grade}|${r.subject}`;
    if (!seen.has(k)) seen.set(k, r);
  }
  return [...seen.values()];
}

// ── what a class found hard (§98) ─────────────────────────────────────
//
// Per-question marks, read back as a signal. Aggregates only — the
// function returns no student id and no per-child score, because the
// answer is destined for a prompt and these are minors.

export async function classWeakSpots(q: Record<string, any> = {}) {
  if (!q.grade) return [];
  const { data, error } = await supabase.rpc("class_weak_spots", {
    p_grade: q.grade,
    p_subject: q.subject ?? null,
    p_section: q.section ?? null,
    p_since: q.since ?? null,
    // A class of two dozen doing one quiz is thin evidence: two children
    // missing a question can mean the QUESTION was ambiguous. Speak only
    // when enough of them did, and only when the gap is real.
    p_min_n: Number(q.min_n) || 5,
    p_below: Number(q.below) || 0.6,
  });
  if (error) throw error;
  return data || [];
}

// ── goal days (§97) ───────────────────────────────────────────────────
//
// One row per teaching day of a plan. The narrative — a week's focus,
// its assessment, the risks — stays in `goals.plan`, which is prose
// about a week. This is the part that can be pointed at: a day carries
// the timetable slot it was placed in and the lesson drafted for it, and
// neither of those can live at an index in a jsonb array.

const DAY_COLS =
  "id, goal_id, week, day_index, date, title, outline, outcomes, schedule_entry_id, draft_id, status, created_at, updated_at";

export async function listGoalDays(goalId: string) {
  const { data, error } = await supabase
    .from("goal_days").select(DAY_COLS).eq("goal_id", goalId)
    .order("week", { ascending: true }).order("day_index", { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Write a plan's days, replacing whatever was there.
 *
 * Upsert on (goal_id, week, day_index) rather than delete-then-insert:
 * re-materialising after she moves the start date must correct the rows,
 * not orphan the slots and drafts already attached to them.
 */
export async function materialiseGoalDays(goalId: string, days: any[]) {
  const fid = await facultyId();
  if (!Array.isArray(days) || !days.length) return [];
  const rows = days.map((d, i) => ({
    goal_id: goalId,
    faculty_id: fid,
    week: Number(d.week) || 1,
    day_index: Number.isFinite(d.day_index) ? d.day_index : i,
    date: d.date ?? null,
    title: String(d.title || "Untitled day").slice(0, 300),
    outline: d.outline ?? null,
    outcomes: d.outcomes?.length ? d.outcomes : null,
  }));
  const { data, error } = await supabase
    .from("goal_days")
    .upsert(rows, { onConflict: "goal_id,week,day_index", ignoreDuplicates: false })
    .select(DAY_COLS);
  if (error) throw error;
  return data || [];
}

export async function updateGoalDay(id: string, body: Record<string, any>) {
  const patch: Record<string, any> = { updated_at: iso() };
  for (const k of ["date", "title", "outline", "status", "schedule_entry_id", "draft_id"]) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabase
    .from("goal_days").update(patch).eq("id", id).select(DAY_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

// ── teaching skills ──────────────────────────────────────────────────
//
// How this teacher teaches, as prose. skill_profile is a Markdown
// document — compiled from the skills interview, or extracted from a CV
// — and it is what the AI service reads to ground generation in this
// teacher's own practice. The rows are plain teacher-owned data, so they
// live browser→Supabase like everything else that needs no secret.

const SKILL_COLS =
  "id, name, source_type, skill_profile, status, source_session_id, created_at, updated_at";

export async function listSkills() {
  const { data, error } = await supabase
    .from("teaching_skills").select(SKILL_COLS).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createSkill(body: Record<string, any>) {
  const fid = await facultyId();
  const { name, source_type, skill_profile, source_session_id } = body || {};
  if (!skill_profile?.trim()) {
    throw Object.assign(new Error("The profile is empty — nothing to save."), { status: 400 });
  }
  const { data, error } = await supabase
    .from("teaching_skills")
    .insert({
      faculty_id: fid,
      name: name?.trim() || "Teaching profile",
      source_type: source_type || "interview",
      skill_profile: skill_profile.trim(),
      status: "ready",
      // Which conversation it came from, so the studio can stop offering to
      // take an approach it has already taken.
      ...(source_session_id ? { source_session_id } : {}),
    })
    .select(SKILL_COLS).single();
  if (error) throw error;
  return data;
}

export async function updateSkill(id: string, body: Record<string, any>) {
  const patch: Record<string, any> = { updated_at: iso() };
  for (const k of ["name", "skill_profile", "status"]) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabase
    .from("teaching_skills").update(patch).eq("id", id).select(SKILL_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function deleteSkill(id: string) {
  const { error, count } = await supabase
    .from("teaching_skills").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// Where each skill applies: grade/section/subject combos (NULL = any),
// the same audience vocabulary as the scheduler. One skill may cover
// several classes; one class may draw on several skills. The generator
// reads these rows server-side to pick which profiles ground a request.

const SKILL_ASSIGNMENT_COLS = "id, skill_id, grade, section, subject, created_at";

export async function listSkillAssignments() {
  const { data, error } = await supabase
    .from("skill_assignments")
    .select(SKILL_ASSIGNMENT_COLS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createSkillAssignment(body: Record<string, any>) {
  const fid = await facultyId();
  const { skill_id, grade, section, subject } = body || {};
  if (!skill_id) throw Object.assign(new Error("skill_id is required"), { status: 400 });
  const { data, error } = await supabase
    .from("skill_assignments")
    .insert({
      faculty_id: fid,
      skill_id,
      grade: grade || null,
      section: section || null,
      subject: subject?.trim() || null,
    })
    .select(SKILL_ASSIGNMENT_COLS)
    .single();
  if (error) {
    // The unique index refuses an exact repeat — say so in words.
    if ((error as any).code === "23505") {
      throw Object.assign(new Error("This skill already covers that exact combination."), { status: 409 });
    }
    throw error;
  }
  return data;
}

export async function deleteSkillAssignment(id: string) {
  const { error, count } = await supabase
    .from("skill_assignments").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── bulletin board ────────────────────────────────────────────────────
//
// Notices a teacher pins up: field trips, exam weeks, birthdays. Plain
// rows, not artifacts — see the note on section 19b of db/tune.sql.
// Audience is grade + section text (null = the whole board), the same
// vocabulary schedule_entries uses.

const BULLETIN_COLS =
  "id, title, body, kind, status, pinned, grade, section, event_on, expires_on, media, created_at, updated_at";

export async function listBulletin(q: URLSearchParams) {
  let query = supabase
    .from("bulletin_posts")
    .select(BULLETIN_COLS)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  const status = q.get("status");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createBulletin(body: Record<string, any>) {
  const fid = await facultyId();
  const { title, kind, grade, section, event_on, expires_on, pinned } = body || {};
  if (!title?.trim()) throw Object.assign(new Error("Give the post a title."), { status: 400 });
  const { data, error } = await supabase
    .from("bulletin_posts")
    .insert({
      faculty_id: fid,
      title: title.trim(),
      body: body?.body?.trim() || null,
      kind: kind || "notice",
      pinned: !!pinned,
      grade: grade || null,
      section: section || null,
      event_on: event_on || null,
      expires_on: expires_on || null,
      media: Array.isArray(body?.media) ? body.media : [],
    })
    .select(BULLETIN_COLS).single();
  if (error) throw error;
  return data;
}

export async function updateBulletin(id: string, body: Record<string, any>) {
  const patch: Record<string, any> = { updated_at: iso() };
  for (const k of ["title", "body", "kind", "status", "pinned", "grade", "section", "event_on", "expires_on", "media"]) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabase
    .from("bulletin_posts").update(patch).eq("id", id)
    .select(BULLETIN_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function deleteBulletin(id: string) {
  const { error, count } = await supabase
    .from("bulletin_posts").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

/**
 * The class share link, minted on first ask. One row per teacher; the
 * token goes into the /board/<token> URL the students bookmark, and the
 * board behind it is served by the bulletin_board_public() function —
 * see db/tune.sql §19b².
 */
export async function getBulletinShare() {
  const fid = await facultyId();
  const { data, error } = await supabase
    .from("bulletin_shares").select("token").eq("faculty_id", fid).maybeSingle();
  if (error) throw error;
  if (data) return { token: data.token };
  const { data: created, error: insErr } = await supabase
    .from("bulletin_shares").insert({ faculty_id: fid }).select("token").single();
  if (insErr) {
    // Two tabs racing to mint the first token: the loser's insert hits
    // the primary key, but the row now exists — read it instead.
    const { data: again } = await supabase
      .from("bulletin_shares").select("token").eq("faculty_id", fid).maybeSingle();
    if (again) return { token: again.token };
    throw insErr;
  }
  return { token: created.token };
}

/**
 * Every address this teacher has ever added, with the details behind it.
 *
 * Feeds the picker on the student form. A teacher re-adding a child she
 * removed last term should not retype a date of birth the platform still
 * holds — she picks the address and the rest arrives.
 */
export async function knownStudents() {
  const { data, error } = await supabase.rpc("my_known_students");
  if (error) {
    /**
     * Say so. Returning [] on error made a broken query indistinguishable
     * from "you have never added anyone" — the picker just never appeared,
     * with nothing in the console and no failed request to find. The
     * caller still degrades to no picker; the difference is that this
     * leaves a trail.
     */
    console.warn("[students] known-student picker unavailable:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

// ── sign-in ───────────────────────────────────────────────────────────

/**
 * Make sure the signed-in user is set up as a teacher, and claim this
 * device.
 *
 * All the browser creates is the `faculty` row. The credits balance and
 * the trial subscription follow from a database trigger
 * (`provision_faculty`), because those are entitlements — a teacher who
 * could write them could grant themselves a plan.
 *
 * Replaces POST /api/auth/supabase. There is no plan argument any more:
 * everyone starts on the same trial, and moving to a paid one is a
 * payment rather than a field on a form.
 */
export async function provisionTeacher() {
  const { userId } = await ident();

  // ── Is this person actually an invited student? ────────────────────
  //
  // Asked HERE, before a faculty row exists, because this is the only
  // place one is ever created — every door into the product ends up in
  // this function. The landing page mints a teacher from two separate
  // branches (the social fast-track and the plan picker at the end of the
  // email wizard), and a check bolted onto one of them left the other
  // wide open: a student who was invited, then signed up with the same
  // address, came out the far side a teacher with a trial, an empty
  // studio and no idea why.
  //
  // A faculty row is not easily undone — it is what makes someone a
  // teacher for good — so the question has to be asked before it is
  // written, not after.
  //
  // link_student_account() is its own guard: it claims only rows whose
  // teacher actually opened the invite gate, and answers `linked: false`
  // for everyone else.
  //
  // Anything other than a clear `linked: true` provisions a teacher, which
  // is the safe default in both directions that matter: an unmigrated
  // database (where the function does not exist yet, and rpc() reports an
  // error rather than throwing) must not stop teachers signing up, and a
  // transient failure must not either. The cost is that a student caught
  // by that rare window becomes a teacher — recoverable by a super admin,
  // where "no teacher can sign up today" is not.
  try {
    const { data: claim } = await supabase.rpc("link_student_account");
    if ((claim as any)?.linked) {
      // Same shape the teacher branch returns, device claim included —
      // the caller sets X-Session-Id from it, and a student who never got
      // one would be a device the policies do not recognise.
      clearIdent();
      const { claimDevice } = await import("./device");
      const active_session_id = await claimDevice().catch(() => null);
      return { ...(await getProfile()), active_session_id };
    }
  } catch {
    /* not deployed — carry on and provision a teacher, as before */
  }

  /**
   * A student signing in at the teacher door is still a student.
   *
   * The faculty INSERT below is refused by the schema for them (§44), so
   * without this they reach a raw constraint error and no session at all.
   * Their roster rows may all have been deleted — that is what put them
   * here — and it changes nothing about who they are.
   */
  {
    const { data: urow } = await supabase
      .from("users").select("role").eq("id", userId).maybeSingle();
    if ((urow as any)?.role === "student") {
      clearIdent();
      const { claimDevice } = await import("./device");
      const active_session_id = await claimDevice().catch(() => null);
      return { ...(await getProfile()), active_session_id };
    }
  }

  // The auth trigger normally mirrors this, but it swallows its own
  // errors by design, so a missing row is possible and cheap to fix.
  const { data: auth } = await supabase.auth.getUser();
  const meta: any = auth?.user?.user_metadata || {};
  await supabase.from("users").upsert(
    {
      id: userId,
      email: auth?.user?.email ?? null,
      full_name: meta.full_name ?? meta.name ?? null,
      first_name: meta.given_name ?? null,
      last_name: meta.family_name ?? null,
      avatar_url: meta.avatar_url ?? meta.picture ?? null,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  const { error } = await supabase
    .from("faculty")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw error;

  clearIdent();                       // the faculty id has just changed
  const { claimDevice } = await import("./device");
  const active_session_id = await claimDevice();
  // Record the sign-up in the audit trail (best-effort — a failure here
  // must never block provisioning). Feeds the super-admin signups chart.
  const { recordAuthEvent } = await import("./superadmin");
  await recordAuthEvent("signup").catch(() => {});
  return { ...(await getProfile()), active_session_id };
}

/**
 * Take over as the active device, for a teacher who already exists.
 *
 * Replaces POST /api/auth/claim-session, including its role as the
 * "does this account exist yet" probe: getProfile throws 404
 * `no_teacher_row` when there is no faculty row, which is what sends a
 * new user down the sign-up funnel.
 */
export async function claimSession() {
  const profile = await getProfile();
  const { claimDevice } = await import("./device");
  const active_session_id = await claimDevice();
  const { recordAuthEvent } = await import("./superadmin");
  await recordAuthEvent("login").catch(() => {});
  return { ...profile, active_session_id };
}

// ── student ───────────────────────────────────────────────────────────
//
// A student is a roster row a teacher typed in; they become a signed-in
// user by claiming that row with the email it carries. Both calls are
// SECURITY DEFINER functions (db/tune.sql §34) — the browser cannot set
// its own role or read grades RLS locks to the teacher.

/** Claim the roster row for the signed-in email and mark the user a student. */
export async function linkStudent() {
  const { data, error } = await supabase.rpc("link_student_account");
  if (error) throw error;
  return data;
}

/** The plans, the top-ups, and the price list they are described with. */
export async function planOptions() {
  const { data, error } = await supabase.rpc("plan_options");
  if (error) throw error;
  return data;
}

/** Her students, each with what they owe and what they have done. */
export async function studentReport() {
  const { data, error } = await supabase.rpc("teacher_student_report");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** One student opened: their work, their files, and what they wrote. */
export async function studentWorkReport(studentId: string) {
  const { data, error } = await supabase.rpc("teacher_student_work", { p_student: studentId });
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

/**
 * Finish marking a quiz: the total, her words, and the per-question
 * breakdown (keyed like the answers) that makes the total explainable.
 */
export async function gradeAttempt(
  attemptId: string,
  score: number,
  feedback?: string,
  marks?: Record<string, number> | null,
) {
  const { data, error } = await supabase.rpc("teacher_grade_attempt", {
    p_attempt: attemptId,
    p_score: score,
    p_feedback: feedback ?? null,
    p_marks: marks ?? null,
  });
  if (error) throw error;
  return data;
}

/** A signed link to one submitted file. Private bucket — never a public URL. */
export async function submissionFileUrl(path: string) {
  const { data, error } = await supabase.storage.from("submissions").createSignedUrl(path, 300);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

// ── the student's classes ─────────────────────────────────────────────
//
// A student holds one grade and several subjects, one per teacher, and
// each roster row IS a subject. Everything below is scoped by
// current_student_ids() inside the function, so a student can only ever
// reach their own — there is no id a caller could pass to see another
// child's work.

/**
 * Join a class from its invitation link.
 *
 * One invitation per subject, each a different teacher's class — so
 * following a link joins THAT class and leaves every other one alone.
 */
export async function joinClass(studentRowId: string) {
  const { data, error } = await supabase.rpc("student_join_class", {
    p_student_row: studentRowId,
  });
  if (error) throw error;
  return data;
}

/** Subjects this student is enrolled in, with the teacher and a work count. */
export async function studentSubjects() {
  const { data, error } = await supabase.rpc("student_subjects");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** One subject's classroom: everything their teacher has set. */
export async function studentClass(studentRowId: string) {
  const { data, error } = await supabase.rpc("student_class", { p_student_row: studentRowId });
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

/** One piece of work, opened. A lesson plan arrives already trimmed to the student's notes. */
export async function studentWork(entryId: string) {
  const { data, error } = await supabase.rpc("student_work", { p_entry: entryId });
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

/**
 * Present, because they are here.
 *
 * Called on portal load. Writes nothing on a day already marked, so a
 * teacher who corrected a record is not overruled by the next page load,
 * and best-effort throughout: a student must never be kept out of their
 * work because a register failed.
 */
export async function studentMarkPresent() {
  const { data, error } = await supabase.rpc("student_mark_present");
  if (error) return { marked: 0 };
  return data;
}

/** Hand in homework or an activity. Re-submitting replaces what was there. */
export async function submitWork(
  entryId: string,
  studentRowId: string,
  body: { files?: any[]; note?: string },
) {
  const { data, error } = await supabase
    .from("submissions")
    .upsert(
      {
        entry_id: entryId,
        student_id: studentRowId,
        files: body.files ?? [],
        note: body.note ?? null,
        submitted_at: iso(),
        updated_at: iso(),
      },
      { onConflict: "entry_id,student_id" },
    )
    .select("id, files, note, submitted_at")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Sit a quiz, once.
 *
 * The answers go to the database and the score comes back. Nothing here
 * computes it: marking needs the correct answers, and a browser that
 * holds those is a browser holding the answer key. Multiple choice is
 * marked on the spot, written answers wait for the teacher, and one
 * attempt is enforced by a unique index and a trigger rather than by
 * this function being polite.
 */
export async function submitQuiz(entryId: string, body: { answers: any }) {
  const { data, error } = await supabase.rpc("student_submit_quiz", {
    p_entry: entryId,
    p_answers: body.answers ?? {},
  });
  if (error) throw error;
  return data;
}

/** The student's own attendance, newest first. */
export async function studentAttendance() {
  const { data, error } = await supabase
    .from("attendance")
    .select("date, status, note")
    .order("date", { ascending: false })
    .limit(120);
  if (error) throw error;
  return data || [];
}

/** The student's own dashboard: assigned work, scores, attendance, marks. */
export async function studentDashboard() {
  const { data, error } = await supabase.rpc("student_dashboard");
  if (error) throw error;
  if (!data) {
    /**
     * No roster rows is a state, not an error.
     *
     * student_dashboard() reads across the rows a student holds and
     * answers null when there are none — which happens the moment their
     * only teacher removes them. Treating that as 404 turned an ordinary
     * gap between classes into a broken account, on a screen whose whole
     * job is to say what is going on.
     */
    const me: any = await getProfile().catch(() => null);
    if (me?.role === "student") {
      return {
        student: { first_name: me.first_name, last_name: me.last_name, email: me.email },
        teachers: [], work: [], scores: [], grades: [], attendance: {},
        no_classes: true,
      };
    }
    throw Object.assign(new Error("No student profile."), { status: 404, code: "no_student" });
  }
  return data;
}
