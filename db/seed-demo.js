// =====================================================================
// npm run db:demo — a term's worth of believable data on the test account
//
// Separate from db/seed.js on purpose. That one seeds REFERENCE data
// every install needs (the schools catalog, the feature flags) and is
// safe anywhere. This one writes EXAMPLES onto one named account so the
// screens can be judged against something that looks like a real
// teacher's term rather than against three rows typed in by hand.
//
// Two accounts come out of a run:
//
//   the demo teacher    filled — roster, timetable, marks, attendance,
//                       a library built over nine weeks, goals, threads
//   the empty teacher   onboarded and entitled, with nothing in it — so
//                       every empty state can be looked at directly
//
// The empty teacher is onboarded on purpose. A genuinely untouched
// sign-up lands on the onboarding wizard and never reaches the screens
// whose empty states are the point of having it. Pass --empty-fresh for
// that version: an account that has done literally nothing, which is
// the right one for checking the wizard itself.
//
// ── What this deletes ────────────────────────────────────────────────
//
// Re-running replaces the demo teacher's data rather than doubling it,
// so it starts by deleting rows owned by that ONE faculty id. It will
// not touch another account, and it refuses to run at all against an
// email that is not the configured test account unless --force says so.
// Nothing outside those two accounts is read or written.
//
// Writes go over DATABASE_URL as the table owner, which bypasses RLS —
// deliberately. Seeding through the browser would need the demo teacher
// signed in on this machine and would still be refused for credits and
// subscriptions, which are exactly the rows a plan-aware dashboard needs.
// =====================================================================
import "dotenv/config";
import { pool } from "./client.js";
import {
  TEACHER, CLASSES, STUDENTS, TIMETABLE, LESSON_ROTATION,
  ARTIFACTS, MATERIALS, GOALS, SKILLS, NOTIFICATIONS, THREADS, BULLETIN,
} from "./demo-data.js";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);

const DEMO_EMAIL = process.env.DEMO_ACCOUNT_EMAIL || process.env.TEST_ACCOUNT_EMAIL;
const EMPTY_EMAIL = process.env.DEMO_EMPTY_EMAIL || "test.empty@murchid.com";
const EMPTY_PASSWORD = process.env.DEMO_EMPTY_PASSWORD || process.env.TEST_ACCOUNT_PASSWORD;

/**
 * Days-from-today as a YYYY-MM-DD string, in local time.
 *
 * toISOString would render local midnight as the previous day anywhere
 * east of Greenwich, which in the UAE (+4) is every single date.
 */
const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const weeksAgo = (w) => ago(w * 7 * 864e5);

/**
 * Deterministic pseudo-randomness.
 *
 * Marks and attendance need to look uneven, but two runs producing
 * different numbers would mean a screenshot can never be compared with
 * the one before it. Same seed, same term, every time.
 */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

const q = (sql, params) => pool.query(sql, params);
const one = async (sql, params) => (await q(sql, params)).rows[0] || null;

// ── the filled account ────────────────────────────────────────────────

async function seedDemo() {
  const user = await one("SELECT id, email FROM public.users WHERE email = $1", [DEMO_EMAIL]);
  if (!user) {
    throw new Error(
      `No account for ${DEMO_EMAIL}. Sign in once through the app first — ` +
      `the user row is created by a trigger on auth.users, not here.`,
    );
  }
  if (DEMO_EMAIL !== process.env.TEST_ACCOUNT_EMAIL && !has("--force")) {
    throw new Error(
      `${DEMO_EMAIL} is not TEST_ACCOUNT_EMAIL. This deletes and rewrites ` +
      `that account's data — pass --force if you really mean this one.`,
    );
  }

  const faculty =
    (await one("SELECT id FROM public.faculty WHERE user_id = $1", [user.id])) ||
    (await one(
      "INSERT INTO public.faculty (user_id) VALUES ($1) RETURNING id",
      [user.id],
    ));
  const fid = faculty.id;
  console.log(`→ demo teacher ${DEMO_EMAIL}  user=${user.id}  faculty=${fid}`);

  await wipe(fid, user.id);

  const school = await one(
    `SELECT id, name FROM public.schools
      WHERE emirate = 'Dubai' ORDER BY name LIMIT 1`,
  );

  await profile(user.id, fid, school);
  const classIds = await classes(fid);
  const students = await roster(fid, school, classIds);
  const scheduleIds = await timetable(fid, classIds);
  await attendance(fid, students, classIds, scheduleIds);
  await marks(fid, students, classIds);
  const artifacts = await library(fid);
  await handOut(fid, artifacts, classIds, students);
  await materials(fid);
  await goals(fid);
  await bulletin(fid);
  await skills(fid);
  await notifications(user.id);
  await threads(user.id);
  await releaseDevice(user.id);

  return { fid, userId: user.id, students: students.length, school };
}

/**
 * Everything this script wrote last time, and nothing else.
 *
 * Scoped by faculty id (or user id, for the two tables keyed to the
 * account rather than the teaching role). Rows cascade from their
 * parents where the schema says so, but being explicit here means the
 * delete list can be read and checked rather than inferred.
 */
async function wipe(fid, userId) {
  const scoped = [
    ["quiz_attempts", `assignment_id IN (SELECT a.id FROM assignments a JOIN classes c ON c.id = a.class_id WHERE c.faculty_id = $1)`],
    ["assignments",   `class_id IN (SELECT id FROM classes WHERE faculty_id = $1)`],
    ["class_members", `class_id IN (SELECT id FROM classes WHERE faculty_id = $1)`],
    ["attendance",    `faculty_id = $1`],
    ["student_grades", `faculty_id = $1`],
    ["schedule_entries", `faculty_id = $1`],
    ["classes",       `faculty_id = $1`],
    ["students",      `created_by = $1`],
    ["ai_studio",     `faculty_id = $1`],
    ["materials",     `faculty_id = $1`],
    ["goals",         `faculty_id = $1`],
    ["bulletin_posts", `faculty_id = $1`],
    ["teaching_skills", `faculty_id = $1`],
    ["faculty_schools", `faculty_id = $1`],
  ];
  let total = 0;
  for (const [table, where] of scoped) {
    const r = await q(`DELETE FROM public.${table} WHERE ${where}`, [fid]);
    if (r.rowCount) console.log(`   cleared ${String(r.rowCount).padStart(4)} × ${table}`);
    total += r.rowCount;
  }
  for (const [table, where] of [
    ["chatbot_sessions", `user_id = $1`],
    ["notifications", `user_id = $1`],
  ]) {
    const r = await q(`DELETE FROM public.${table} WHERE ${where}`, [userId]);
    if (r.rowCount) console.log(`   cleared ${String(r.rowCount).padStart(4)} × ${table}`);
    total += r.rowCount;
  }
  console.log(`   ${total} row(s) cleared\n`);
}

/**
 * Let go of the device claim.
 *
 * The account is active on one device at a time, and RLS enforces it by
 * FILTERING rather than refusing — a superseded browser gets empty
 * results, not an error. So an account left claimed by a script that has
 * long since exited shows the teacher a working app with no students,
 * no lessons and flat graphs, and nothing anywhere says why.
 *
 * NULL means "no device holds this", which is_current_device() lets
 * through. The next real sign-in claims it properly.
 */
async function releaseDevice(userId) {
  await q("UPDATE public.users SET active_session_id = NULL WHERE id = $1", [userId]);
  console.log("   device claim released — next sign-in takes it");
}

async function profile(userId, fid, school) {
  const t = TEACHER;
  await q(
    `UPDATE public.users SET
       full_name = $2, first_name = $3, last_name = $4, phone = $5,
       locale = $6, role = 'teacher', onboarding_status = 'complete',
       account_status = 'active', last_login_at = now()
     WHERE id = $1`,
    [userId, t.full_name, t.first_name, t.last_name, t.phone, t.locale],
  );

  const f = t.faculty;
  await q(
    `UPDATE public.faculty SET
       staff_id = $2, organization = $3, nationality = $4, years_experience = $5,
       hire_date = $6, bio = $7, qualification = $8, expertise = $9,
       languages = $10, eligible_grades = $11, school_id = $12,
       approved_at = COALESCE(approved_at, now())
     WHERE id = $1`,
    [fid, f.staff_id, f.organization, f.nationality, f.years_experience,
     day(f.hire_date), f.bio, f.qualification, f.expertise, f.languages,
     f.eligible_grades, school?.id ?? null],
  );

  if (school) {
    await q(
      `INSERT INTO public.faculty_schools (faculty_id, school_id, role, is_primary, grade_sections)
       VALUES ($1, $2, 'teacher', true, $3)
       ON CONFLICT (faculty_id, school_id) DO UPDATE
         SET is_primary = true, grade_sections = EXCLUDED.grade_sections`,
      [fid, school.id, JSON.stringify({
        "Grade 9": ["A"], "Grade 10": ["A"], "Grade 11": ["B"],
      })],
    );
  }

  // A paying account rather than a trial: the runway tile, the plan
  // badge and the expiry gate all read differently on each, and the
  // trial is the one you get for free by doing nothing.
  //
  // The billing period is anchored to the CALENDAR, not to the moment
  // this script runs. It used to be `now() + 22 days`, which meant the
  // countdown reset to 22 every time the demo was re-seeded and never
  // appeared to move — the one thing a countdown has to do. Paid on the
  // first of the month, renews on the first of the next: re-seeding on
  // any day of the same month leaves the same dates behind, and the
  // number on the dashboard falls by one every midnight.
  await q(
    `INSERT INTO public.subscriptions
       (faculty_id, plan, status, current_period_start, current_period_end, trial_ends_at)
     VALUES ($1, 'monthly', 'active',
             date_trunc('month', now()),
             date_trunc('month', now()) + INTERVAL '1 month',
             date_trunc('month', now()) - INTERVAL '8 days')
     ON CONFLICT (faculty_id) DO UPDATE SET
       plan = 'monthly', status = 'active',
       current_period_start = date_trunc('month', now()),
       current_period_end = date_trunc('month', now()) + INTERVAL '1 month',
       trial_ends_at = date_trunc('month', now()) - INTERVAL '8 days',
       updated_at = now()`,
    [fid],
  );
  await q(
    `INSERT INTO public.credits (faculty_id, balance, monthly_allowance)
     VALUES ($1, 1340, 2000)
     ON CONFLICT (faculty_id) DO UPDATE
       SET balance = 1340, monthly_allowance = 2000, updated_at = now()`,
    [fid],
  );
  console.log(`   profile, ${school ? `${school.name}, ` : ""}monthly plan, 1340/2000 credits`);
}

async function classes(fid) {
  const ids = {};
  for (const c of CLASSES) {
    const row = await one(
      `INSERT INTO public.classes (faculty_id, name, subject, grade, division, class_code)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [fid, c.name, c.subject, c.grade, c.division, c.code],
    );
    ids[c.key] = row.id;
  }
  console.log(`   ${CLASSES.length} classes`);
  return ids;
}

async function roster(fid, school, classIds) {
  const r = rng(20260810);
  const out = [];
  for (const [i, s] of STUDENTS.entries()) {
    const cls = CLASSES.find((c) => c.key === s.c);
    // Ages that match the grade: a Grade 9 born in 2016 is the sort of
    // thing that makes a demo look generated.
    const birthYear = { "Grade 9": 2011, "Grade 10": 2010, "Grade 11": 2009 }[cls.grade];
    const dob = `${birthYear}-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-${String(1 + Math.floor(r() * 28)).padStart(2, "0")}`;
    const slug = `${s.first}.${s.last}`.toLowerCase().replace(/[^a-z.]/g, "");

    const row = await one(
      `INSERT INTO public.students (
         created_by, school_id, first_name, last_name, grade, division, subject,
         date_of_birth, gender, nationality, email, phone, enrollment_date,
         student_id, address,
         primary_guardian_name, primary_guardian_relationship,
         primary_guardian_email, primary_guardian_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id, first_name, last_name, grade`,
      [
        // subject is half of the delivery match (db/tune.sql §48): a
        // roster row without one can never receive subject-labelled
        // work, and a demo roster full of those demonstrates nothing.
        fid, school?.id ?? null, s.first, s.last, cls.grade, cls.division, cls.subject,
        dob, s.gender, s.nat,
        `${slug}@student.eis.ae`,
        `+971 5${pick(r, [0, 2, 4, 5, 6])} ${100 + Math.floor(r() * 890)} ${1000 + Math.floor(r() * 8999)}`,
        day(-Math.floor(300 + r() * 900)),
        `EIS${String(24000 + i * 7).padStart(6, "0")}`,
        pick(r, ["Al Barsha, Dubai", "Jumeirah 2, Dubai", "Mirdif, Dubai", "Dubai Silicon Oasis", "Al Warqa, Dubai", "Motor City, Dubai"]),
        s.g, s.rel,
        `${s.g.toLowerCase().replace(/[^a-z]/g, ".")}@example.ae`,
        `+971 5${pick(r, [0, 2, 5])} ${100 + Math.floor(r() * 890)} ${1000 + Math.floor(r() * 8999)}`,
      ],
    );
    await q(
      `INSERT INTO public.class_members (class_id, student_id) VALUES ($1, $2)
       ON CONFLICT (class_id, student_id) DO NOTHING`,
      [classIds[s.c], row.id],
    );
    out.push({ ...row, classKey: s.c, subject: cls.subject });
  }
  console.log(`   ${out.length} students, enrolled in their classes`);
  return out;
}

/**
 * Six weeks back and two weeks forward.
 *
 * Past lessons are marked done, today's and future ones planned — which
 * is what makes "Needs you" list today's teaching and the calendar show
 * something on both sides of now.
 */
async function timetable(fid, classIds) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const ids = [];
  let n = 0;
  for (let w = -6; w <= 2; w++) {
    for (const slot of TIMETABLE) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + w * 7 + (slot.dow - 1));
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const past = date < day(0);
      const rotation = LESSON_ROTATION[slot.c];
      const title = rotation[((w + 6) % rotation.length + rotation.length) % rotation.length];
      const cls = CLASSES.find((c) => c.key === slot.c);

      const row = await one(
        `INSERT INTO public.schedule_entries (
           faculty_id, class_id, title, subject, grade, section, date,
           start_time, end_time, location, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [fid, classIds[slot.c], title, cls.subject, cls.grade, cls.division,
         date, slot.start, slot.end, slot.room,
         past ? "done" : "planned",
         slot.title.startsWith("Practical") ? "Book the lab technician the day before." : null],
      );
      ids.push({ id: row.id, date, classKey: slot.c, past });
      n++;
    }
  }
  console.log(`   ${n} timetabled lessons, six weeks back to two weeks ahead`);
  return ids;
}

/**
 * Attendance for the last three weeks of lessons that actually happened.
 *
 * Weighted heavily to present, because a register that is 20% absent
 * reads as a broken school rather than a busy term.
 */
async function attendance(fid, students, classIds, schedule) {
  const r = rng(778812);
  const recent = schedule.filter((s) => s.past && s.date >= day(-21));
  const byClass = {};
  for (const s of students) (byClass[s.classKey] ??= []).push(s);

  let n = 0;
  for (const slot of recent) {
    for (const s of byClass[slot.classKey] || []) {
      const roll = r();
      const status = roll > 0.94 ? "absent" : roll > 0.89 ? "late" : roll > 0.875 ? "excused" : "present";
      await q(
        `INSERT INTO public.attendance (faculty_id, student_id, class_id, schedule_id, date, status, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (student_id, date, schedule_key) DO UPDATE SET status = EXCLUDED.status`,
        [fid, s.id, classIds[slot.classKey], slot.id, slot.date, status,
         status === "excused" ? "Medical note on file" : null],
      );
      n++;
    }
  }
  console.log(`   ${n} attendance marks over the last three weeks`);
}

/**
 * Marks that spread the way a class spreads.
 *
 * Each student gets a stable ability offset, so the same names sit near
 * the top across assessments — a table where the ranking reshuffles
 * every column looks like noise, not a class.
 */
async function marks(fid, students, classIds) {
  const r = rng(44120);
  const assessments = [
    { label: "Baseline test",        term: "Term 1", max: 40, dayOffset: -46 },
    { label: "Unit 1 quiz",          term: "Term 1", max: 20, dayOffset: -32 },
    { label: "Practical write-up",   term: "Term 1", max: 25, dayOffset: -18 },
    { label: "Mid-unit check",       term: "Term 1", max: 20, dayOffset: -9 },
  ];

  let n = 0;
  for (const s of students) {
    const ability = 0.55 + r() * 0.42;           // stable, per student
    for (const a of assessments) {
      const noise = (r() - 0.5) * 0.16;
      const frac = Math.max(0.25, Math.min(1, ability + noise));
      await q(
        `INSERT INTO public.student_grades
           (faculty_id, student_id, class_id, subject, term, label, score, max_score, recorded_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [fid, s.id, classIds[s.classKey], s.subject, a.term, a.label,
         Math.round(frac * a.max * 2) / 2, a.max, day(a.dayOffset)],
      );
      n++;
    }
  }
  console.log(`   ${n} recorded marks across four assessments`);
}

async function library(fid) {
  const made = {};
  for (const a of ARTIFACTS) {
    const content = { ...a.content };
    // The screens read title and name as each other's fallback; storing
    // both is what the app itself does on save.
    if (content.title && !content.name) content.name = content.title;
    if (content.name && !content.title) content.title = content.name;
    if (content.due_in_days != null) {
      content.due_date = day(content.due_in_days);
      delete content.due_in_days;
    }
    if (content.scheduled_in != null) {
      content.scheduled_for = day(content.scheduled_in);
      delete content.scheduled_in;
    }
    if (Array.isArray(content.questions)) {
      content.questions = content.questions.map((qq, i) => ({
        qid: crypto.randomUUID(), position: qq.position ?? i + 1, ...qq,
      }));
      // The quiz cards show a marks total. It is the sum of the paper, so
      // deriving it here is the only way it cannot disagree with the paper.
      content.total_marks = content.questions.reduce((n, qq) => n + (qq.marks || 0), 0);
    }
    // The library screens disagree about what a length is called —
    // templates say `duration`, quizzes and activities say
    // `duration_minutes`. Serving both is what the app already does for
    // name/title, and beats picking one and leaving the other blank.
    if (content.duration_minutes != null && content.duration == null) content.duration = content.duration_minutes;
    if (content.duration != null && content.duration_minutes == null) content.duration_minutes = content.duration;

    const at = weeksAgo(a.w);
    const row = await one(
      `INSERT INTO public.ai_studio
         (faculty_id, type, status, content, model_used, tokens_in, tokens_out, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [fid, a.type, a.status, JSON.stringify(content),
       a.status === "complete" ? "gemini-flash-latest" : null,
       a.status === "complete" ? 900 + Math.round(a.w * 130) : null,
       a.status === "complete" ? 1400 + Math.round(a.w * 210) : null,
       at, at],
    );
    if (a.key) made[a.key] = row.id;
  }
  console.log(`   ${ARTIFACTS.length} artifacts, spread over nine weeks`);
  return made;
}

/**
 * One quiz and one homework actually given to a class, with marks back.
 *
 * Without assignments the submission grids have nothing to draw, and
 * those are the screens most likely to be wrong precisely because
 * nobody has ever seen them with data in.
 */
async function handOut(fid, artifacts, classIds, students) {
  const r = rng(90211);
  let attempts = 0;

  const jobs = [
    { artifact: artifacts.quizForces, title: "Forces and motion — end of unit",
      classKey: "p9a", startedDays: -12, max: 11 },
    { artifact: artifacts.hwForces,   title: "Free-body diagrams — worksheet 3",
      classKey: "p9a", startedDays: -5,  max: 6 },
  ].filter((j) => j.artifact);

  for (const job of jobs) {
    const cls = CLASSES.find((c) => c.key === job.classKey);
    /**
     * The questions, so the attempts can carry a per-question breakdown.
     *
     * Without one the class_weak_spots signal (§98) has nothing to read
     * and a demo account can never show it — the seed wrote a total and
     * a comment, which is what marking looked like before per-question
     * marking existed. Keys are resolved exactly the way the graders and
     * the readers resolve them: qid, then id, then position, then index.
     */
    const questions = (await one(
      `SELECT COALESCE(content->'questions','[]'::jsonb) AS qs FROM public.ai_studio WHERE id = $1`,
      [job.artifact],
    ))?.qs || [];
    const keys = questions.map((qq, i) =>
      String(qq.qid ?? qq.id ?? qq.position ?? i));
    const maxes = questions.map((qq) => Number(qq.marks) || 1);
    /**
     * Spend the attempt's score across its questions, hardest last.
     *
     * The last two questions are deliberately the weak ones in every
     * attempt, so the signal has something true to find: a class that
     * genuinely struggled with the same thing, which is the shape a real
     * cohort produces and the whole reason the feature exists.
     */
    const breakdownFor = (earned) => {
      const total = maxes.reduce((a, b) => a + b, 0) || 1;
      let left = earned;
      const out = {};
      keys.forEach((k, i) => {
        const share = maxes[i] / total;
        // Later questions get a smaller fraction of what is left.
        const weight = i >= keys.length - 2 ? 0.35 : 1.15;
        const got = Math.min(maxes[i], Math.round(earned * share * weight * 2) / 2);
        out[k] = Math.max(0, Math.min(got, left));
        left -= out[k];
      });
      return out;
    };
    /**
     * The slot IS the assignment. Students receive work by matching
     * their grade + subject against a schedule entry carrying the
     * generation (db/tune.sql §48), and quiz_attempts.assignment_id is
     * a FK onto that entry. This used to write the dead `assignments`
     * table, which §48 repointed the FK away from — so the seed's last
     * step failed, and every artifact it made was invisible to every
     * student anyway.
     */
    const asg = await one(
      `INSERT INTO public.schedule_entries
         (faculty_id, class_id, draft_id, title, subject, grade, section, date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7, (now() + ($8 || ' days')::interval)::date, 'done')
       RETURNING id`,
      [fid, classIds[job.classKey], job.artifact, job.title,
       cls.subject, cls.grade, cls.division, String(job.startedDays)],
    );

    for (const s of students.filter((x) => x.classKey === job.classKey)) {
      const roll = r();
      // Three of the class have not handed it in. That is the number a
      // teacher chases on a Monday, and the screen should show it.
      if (roll > 0.88) {
        await q(
          `INSERT INTO public.quiz_attempts (assignment_id, student_id, status, max_score)
           VALUES ($1, $2, 'pending', $3)`,
          [asg.id, s.id, job.max],
        );
      } else {
        const score = Math.round(Math.max(0.35, Math.min(1, 0.62 + r() * 0.4)) * job.max * 2) / 2;
        await q(
          `INSERT INTO public.quiz_attempts
             (assignment_id, student_id, status, started_at, submitted_at, score, max_score,
              feedback, question_marks)
           VALUES ($1,$2,'graded', now() - ($3 || ' days')::interval,
                   now() - ($4 || ' days')::interval, $5, $6, $7, $8)`,
          [asg.id, s.id, String(-job.startedDays), String(-job.startedDays - 3),
           score, job.max,
           score / job.max > 0.85 ? "Clear method throughout. Try the stretch question next time."
             : score / job.max > 0.6 ? "Solid. Show the rearrangement step — it carries a mark."
             : "Come and see me: the free-body diagrams need another look together.",
           JSON.stringify(breakdownFor(score))],
        );
      }
      attempts++;
    }
  }
  console.log(`   ${jobs.length} assignments with ${attempts} student attempts`);
}

async function materials(fid) {
  for (const m of MATERIALS) {
    const at = weeksAgo(m.w);
    await q(
      `INSERT INTO public.materials
         (faculty_id, file_name, file_path, mime_type, extracted_text, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'ready',$6,$6)`,
      [fid, m.name, `${fid}/${m.name}`, m.mime, m.text, at],
    );
  }
  console.log(`   ${MATERIALS.length} uploaded materials`);
}

async function goals(fid) {
  for (const g of GOALS) {
    const at = weeksAgo(g.w);
    await q(
      `INSERT INTO public.goals
         (faculty_id, title, timeline_days, plan, ai_verdict, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [fid, g.title, g.timeline_days, g.plan ? JSON.stringify(g.plan) : null,
       g.ai_verdict, g.status, at],
    );
  }
  console.log(`   ${GOALS.length} goals`);
}

async function bulletin(fid) {
  for (const p of BULLETIN) {
    const at = weeksAgo(p.w);
    await q(
      `INSERT INTO public.bulletin_posts
         (faculty_id, title, body, kind, status, pinned, grade, section, event_on, expires_on, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
      [fid, p.title, p.body || null, p.kind, p.status || "published", !!p.pinned,
       p.grade || null, p.section || null,
       p.eventInDays != null ? day(p.eventInDays) : null,
       p.expiresInDays != null ? day(p.expiresInDays) : null, at],
    );
  }
  console.log(`   ${BULLETIN.length} bulletin posts`);
}

async function skills(fid) {
  for (const s of SKILLS) {
    const at = weeksAgo(s.w);
    await q(
      `INSERT INTO public.teaching_skills
         (faculty_id, name, source_type, skill_profile, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6)`,
      [fid, s.name, s.source_type, s.skill_profile, s.status, at],
    );
  }
  console.log(`   ${SKILLS.length} teaching skills`);
}

async function notifications(userId) {
  for (const n of NOTIFICATIONS) {
    const at = ago(n.hours * 36e5);
    await q(
      `INSERT INTO public.notifications (user_id, kind, title, body, link, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6)`,
      [userId, n.kind, n.title, n.body, n.link, at],
    );
  }
  console.log(`   ${NOTIFICATIONS.length} unread notifications`);
}

async function threads(userId) {
  let turns = 0;
  for (const t of THREADS) {
    const at = ago(t.days * 864e5);
    const s = await one(
      `INSERT INTO public.chatbot_sessions (user_id, page_scope, title, created_at, updated_at)
       VALUES ($1, 'studio', $2, $3, $3) RETURNING session_id`,
      [userId, t.title, at],
    );
    for (const [i, turn] of t.turns.entries()) {
      await q(
        `INSERT INTO public.chatbot_messages (session_id, role, content, kind, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$5)`,
        [s.session_id, turn.role, turn.content, turn.kind ?? null,
         new Date(new Date(at).getTime() + i * 45e3).toISOString()],
      );
      turns++;
    }
  }
  console.log(`   ${THREADS.length} studio threads, ${turns} turns`);
}

// ── the empty account ─────────────────────────────────────────────────

/**
 * A teacher who has signed up and done nothing else.
 *
 * Created straight in auth.users because there is no service-role key in
 * this project by design, and the anon key's sign-up needs a mail round
 * trip to a mailbox nobody owns. The row is written to match exactly
 * what GoTrue writes — including the identities row, without which a
 * password sign-in is rejected — and the public.users mirror then comes
 * from the same trigger that fires for a real sign-up.
 *
 * Nothing else is inserted. The faculty row, its credits and its trial
 * are what the app creates on first sign-in, and letting it do that here
 * is the point: it is the one path every new teacher walks.
 */
async function seedEmpty() {
  // Onboarded unless asked otherwise — see the note at the top of the file.
  const fresh = has("--empty-fresh");

  if (!EMPTY_PASSWORD) {
    console.log("\n! Skipping the empty account — no DEMO_EMPTY_PASSWORD or TEST_ACCOUNT_PASSWORD set.");
    return null;
  }

  const existing = await one("SELECT id FROM auth.users WHERE email = $1", [EMPTY_EMAIL]);
  if (existing) {
    // Reset it to untouched rather than leaving whatever a previous look
    // around created — an "empty account" that has been clicked through
    // is no longer an empty account.
    const faculty = await one("SELECT id FROM public.faculty WHERE user_id = $1", [existing.id]);
    if (faculty) {
      await wipe(faculty.id, existing.id);
      await q("DELETE FROM public.faculty WHERE id = $1", [faculty.id]);
    }
    await q(
      `UPDATE public.users SET
         full_name = NULL, first_name = NULL, last_name = NULL, phone = NULL,
         -- 'teacher', not NULL: what makes this account empty is having no
         -- faculty row and a pending onboarding, not an absent role. A NULL
         -- role rendered as a blank in the consoles and still landed on the
         -- teacher dashboard, because every reader falls back to teacher —
         -- so it was never a distinct state, only an unreadable one.
         -- users.role is NOT NULL as of tune.sql §38.
         role = 'teacher', onboarding_status = 'pending', active_session_id = NULL
       WHERE id = $1`,
      [existing.id],
    );
    await q(
      `UPDATE auth.users SET
         encrypted_password = crypt($2::text, gen_salt('bf')),
         confirmation_token = COALESCE(confirmation_token, ''),
         recovery_token = COALESCE(recovery_token, ''),
         email_change = COALESCE(email_change, ''),
         email_change_token_new = COALESCE(email_change_token_new, '')
       WHERE id = $1`,
      [existing.id, EMPTY_PASSWORD],
    );
    if (!fresh) await openTheDoor(existing.id);
    await releaseDevice(existing.id);
    console.log(`\n→ empty teacher ${EMPTY_EMAIL} reset  user=${existing.id}  (${fresh ? "brand new" : "onboarded, no data"})`);
    return { email: EMPTY_EMAIL, id: existing.id, created: false, fresh };
  }

  const row = await one(
    `INSERT INTO auth.users (
       instance_id, id, aud, role, email, encrypted_password,
       email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
       created_at, updated_at,
       -- GoTrue scans these into plain strings, so a NULL is not "no
       -- token pending" to it — it is a failed row scan, and every
       -- sign-in comes back "Database error querying schema". They
       -- default to NULL on a raw INSERT and to '' when GoTrue itself
       -- writes the row, which is why this only bites a seeded user.
       confirmation_token, recovery_token, email_change, email_change_token_new)
     VALUES (
       '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
       'authenticated', 'authenticated', $1::text, crypt($2::text, gen_salt('bf')),
       now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('email', $1::text, 'email_verified', true, 'phone_verified', false),
       now(), now(),
       '', '', '', '')
     RETURNING id`,
    [EMPTY_EMAIL, EMPTY_PASSWORD],
  );
  await q(
    `INSERT INTO auth.identities
       (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
     VALUES ($1::text, $1::uuid,
       jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true, 'phone_verified', false),
       'email', NULL, now(), now())`,
    [row.id, EMPTY_EMAIL],
  );
  // confirmed_at is a generated column that follows email_confirmed_at, so
  // it is left out above. The subject id in the metadata is only known
  // once the row exists, which is why it is patched in rather than built.
  await q(
    `UPDATE auth.users
        SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('sub', $1::text)
      WHERE id = $1`,
    [row.id],
  );
  if (!fresh) await openTheDoor(row.id);
  console.log(`\n→ empty teacher ${EMPTY_EMAIL} created  user=${row.id}  (${fresh ? "brand new" : "onboarded, no data"})`);
  return { email: EMPTY_EMAIL, id: row.id, created: true, fresh };
}

/**
 * Past the wizard, into the product, still carrying nothing.
 *
 * Only the rows a completed sign-up would have: a teacher role, a
 * finished onboarding flag, and a faculty row — whose own trigger issues
 * the trial and the starting credits, exactly as it does for a real one.
 * No students, no timetable, no library. That absence is the point.
 */
async function openTheDoor(userId) {
  await q(
    `UPDATE public.users SET
       role = 'teacher', onboarding_status = 'complete',
       first_name = 'Noor', last_name = 'Test', full_name = 'Noor Test'
     WHERE id = $1`,
    [userId],
  );
  await q(
    `INSERT INTO public.faculty (user_id, organization, expertise, eligible_grades)
     VALUES ($1, 'Murchid QA', ARRAY['Science'], ARRAY['Grade 7'])
     ON CONFLICT DO NOTHING`,
    [userId],
  );
}

// ── run ───────────────────────────────────────────────────────────────

try {
  const onlyEmpty = has("--empty-only");
  const demo = onlyEmpty ? null : await seedDemo();
  const empty = has("--no-empty") ? null : await seedEmpty();

  console.log("\n─────────────────────────────────────────────");
  if (demo) {
    console.log(`Filled:  ${DEMO_EMAIL}`);
    console.log(`         ${TEACHER.full_name} · ${demo.school?.name || "no school"} · ${demo.students} students`);
  }
  if (empty) {
    console.log(`Empty:   ${empty.email}${empty.created ? "  (new)" : "  (reset)"}`);
    console.log(`         ${empty.fresh ? "brand new — lands on the onboarding wizard" : "onboarded, no data — lands on an empty dashboard"}`);
    console.log(`         password: the one in DEMO_EMPTY_PASSWORD / TEST_ACCOUNT_PASSWORD`);
  }
  console.log("─────────────────────────────────────────────");
  console.log(
    "\nBoth accounts are unclaimed: the next sign-in on any device takes\n" +
    "them. Signing in somewhere else supersedes that device, and the one\n" +
    "left behind is told so rather than quietly emptied.",
  );
} catch (e) {
  console.error("\nseed-demo failed:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
