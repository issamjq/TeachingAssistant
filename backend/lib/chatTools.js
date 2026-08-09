// =====================================================================
// What the studio assistant can actually do
//
// Each tool is a declaration the model sees plus a handler that runs it.
// The handlers go to the database directly rather than back through HTTP
// — the request is already authenticated, and re-entering Express to
// call ourselves would mean re-verifying a token we have already
// verified.
//
// Two rules hold everywhere here, and they are the reason this file is
// separate from the route:
//
//   1. Every query is scoped to the caller's own faculty id, taken from
//      the verified session — NEVER from a tool argument. A model can be
//      talked into passing another teacher's id; it cannot be talked
//      into changing req.account.
//
//   2. Nothing destructive is exposed. There is no delete tool. A
//      chatbot that can be argued into removing a term's lesson plans is
//      not worth the convenience, and the UI has delete with an undo.
// =====================================================================
import { pool } from "./db.js";

const str = (description) => ({ type: "STRING", description });
const arr = (description) => ({ type: "ARRAY", items: { type: "STRING" }, description });

/**
 * Client-side actions. These are not database work — they are things
 * only the browser can do, so the handler returns a directive and the
 * widget carries it out. Keeping them in the same list means the teacher
 * can say "open my quizzes" or "make the text bigger" and be understood
 * the same way as "how many students do I have".
 */
const CLIENT_ACTIONS = new Set(["navigate", "set_accessibility"]);

export const TOOLS = [
  // ---- reading -------------------------------------------------------
  {
    name: "get_overview",
    description:
      "The teacher's dashboard at a glance: how many lesson plans, quizzes, homework, students and classes they have, plus today's timetable. Use this when asked how things stand, what is on today, or how much of anything they have.",
    parameters: { type: "OBJECT", properties: {} },
    run: async ({ fid }) => {
      const [counts, today] = await Promise.all([
        pool.query(
          `SELECT
             (SELECT COALESCE(jsonb_object_agg(type, n), '{}'::jsonb)
                FROM (SELECT type, COUNT(*)::int n FROM ai_studio
                       WHERE faculty_id = $1 AND deleted_at IS NULL GROUP BY type) g) AS by_type,
             (SELECT COUNT(*)::int FROM classes WHERE faculty_id = $1 AND NOT is_archived) AS classes,
             (SELECT COUNT(*)::int FROM students s
               WHERE s.created_by = $1
                  OR EXISTS (SELECT 1 FROM class_members cm JOIN classes c ON c.id = cm.class_id
                              WHERE cm.student_id = s.id AND c.faculty_id = $1)) AS students`,
          [fid]
        ),
        pool.query(
          `SELECT title, subject, grade, start_time FROM schedule_entries
            WHERE faculty_id = $1 AND date = CURRENT_DATE ORDER BY start_time NULLS LAST`,
          [fid]
        ),
      ]);
      const c = counts.rows[0];
      return {
        lesson_plans: c.by_type.lesson_plan || 0,
        quizzes: c.by_type.quiz || 0,
        homework: c.by_type.homework || 0,
        presentations: c.by_type.presentation || 0,
        activities: c.by_type.activity || 0,
        classes: c.classes,
        students: c.students,
        today: today.rows,
      };
    },
  },
  {
    name: "list_work",
    description:
      "List the teacher's saved work of one kind, newest first. Use for 'show me my quizzes', 'what lesson plans do I have on forces', and similar.",
    parameters: {
      type: "OBJECT",
      properties: {
        kind: str("One of: lesson_plan, quiz, homework, presentation, activity, template"),
        search: str("Optional words to match against the title or subject"),
      },
      required: ["kind"],
    },
    run: async ({ fid, args }) => {
      const kinds = ["lesson_plan", "quiz", "homework", "presentation", "activity", "template"];
      if (!kinds.includes(args.kind)) return { error: `kind must be one of ${kinds.join(", ")}` };
      const params = [fid, args.kind];
      let extra = "";
      if (args.search) {
        params.push(`%${args.search}%`);
        extra = ` AND (content->>'title' ILIKE $3 OR content->>'name' ILIKE $3 OR content->>'subject' ILIKE $3)`;
      }
      const r = await pool.query(
        `SELECT id,
                COALESCE(content->>'title', content->>'name') AS title,
                content->>'subject' AS subject, content->>'grade' AS grade,
                status, updated_at
           FROM ai_studio
          WHERE faculty_id = $1 AND type = $2 AND deleted_at IS NULL${extra}
          ORDER BY updated_at DESC LIMIT 15`,
        params
      );
      return { count: r.rowCount, items: r.rows };
    },
  },
  {
    name: "list_students",
    description: "The teacher's students. Optionally filtered by grade or class name.",
    parameters: {
      type: "OBJECT",
      properties: { grade: str("e.g. 'Grade 9'"), search: str("Part of a student's name") },
    },
    run: async ({ fid, args }) => {
      const params = [fid];
      let extra = "";
      if (args.grade)  { params.push(args.grade);            extra += ` AND s.grade = $${params.length}`; }
      if (args.search) { params.push(`%${args.search}%`);    extra += ` AND (s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length})`; }
      const r = await pool.query(
        `SELECT s.id, s.first_name, s.last_name, s.grade, s.division AS section, s.student_id
           FROM students s
          WHERE (s.created_by = $1
                 OR EXISTS (SELECT 1 FROM class_members cm JOIN classes c ON c.id = cm.class_id
                             WHERE cm.student_id = s.id AND c.faculty_id = $1))${extra}
          ORDER BY s.grade, s.division, s.last_name LIMIT 60`,
        params
      );
      return { count: r.rowCount, students: r.rows };
    },
  },
  {
    name: "get_schedule",
    description: "The teacher's timetable between two dates. Defaults to the next seven days.",
    parameters: {
      type: "OBJECT",
      properties: { from: str("YYYY-MM-DD"), to: str("YYYY-MM-DD") },
    },
    run: async ({ fid, args }) => {
      const r = await pool.query(
        `SELECT id, title, subject, grade, section, date, start_time, end_time, location, status
           FROM schedule_entries
          WHERE faculty_id = $1
            AND date >= COALESCE($2::date, CURRENT_DATE)
            AND date <= COALESCE($3::date, CURRENT_DATE + INTERVAL '7 days')
          ORDER BY date, start_time NULLS LAST`,
        [fid, args.from || null, args.to || null]
      );
      return { count: r.rowCount, entries: r.rows };
    },
  },

  // ---- writing -------------------------------------------------------
  {
    name: "create_work",
    description:
      "Create and save a piece of work — a lesson plan, quiz, homework, presentation or activity. Write the actual content; do not leave placeholders. The teacher reviews it afterwards, so make it genuinely usable rather than an outline.",
    parameters: {
      type: "OBJECT",
      properties: {
        kind: str("One of: lesson_plan, quiz, homework, presentation, activity"),
        title: str("A specific title, e.g. 'Newton's Third Law — paired practical'"),
        subject: str("e.g. Physics"),
        grade: str("e.g. Grade 9"),
        objectives: arr("What a student should be able to do by the end"),
        body: str("The main content, written out in full. For a lesson plan this is the main activity; for homework, the instructions."),
        intro: str("Lesson plans only: how the lesson opens"),
        conclusion: str("Lesson plans only: how it closes"),
        assessment_method: str("How learning is checked"),
        duration_minutes: str("A number, as text"),
      },
      required: ["kind", "title"],
    },
    run: async ({ fid, args }) => {
      const kinds = ["lesson_plan", "quiz", "homework", "presentation", "activity"];
      if (!kinds.includes(args.kind)) return { error: `kind must be one of ${kinds.join(", ")}` };
      const content = {
        // Both names, because the studio's screens were written against
        // different ones and either may be what renders this row.
        name: args.title, title: args.title,
        subject: args.subject ?? null, grade: args.grade ?? null,
        objectives: args.objectives ?? null,
        main_activity: args.body ?? null,
        instructions: args.body ?? null,
        intro: args.intro ?? null,
        conclusion: args.conclusion ?? null,
        assessment_method: args.assessment_method ?? null,
        duration_minutes: args.duration_minutes ? Number(args.duration_minutes) || null : null,
        created_by_assistant: true,
      };
      for (const k of Object.keys(content)) if (content[k] == null) delete content[k];
      const r = await pool.query(
        `INSERT INTO ai_studio (faculty_id, type, status, content)
         VALUES ($1, $2, 'complete', $3::jsonb) RETURNING id`,
        [fid, args.kind, JSON.stringify(content)]
      );
      return { ok: true, id: r.rows[0].id, kind: args.kind, title: args.title };
    },
  },
  {
    name: "add_student",
    description: "Add a student to the teacher's register.",
    parameters: {
      type: "OBJECT",
      properties: {
        first_name: str(""), last_name: str(""),
        grade: str("e.g. Grade 9"), section: str("e.g. A"),
      },
      required: ["first_name"],
    },
    run: async ({ fid, args }) => {
      const r = await pool.query(
        `INSERT INTO students (created_by, first_name, last_name, grade, division)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, first_name, last_name, grade, division AS section`,
        [fid, args.first_name, args.last_name ?? null, args.grade ?? null, args.section ?? null]
      );
      return { ok: true, student: r.rows[0] };
    },
  },
  {
    name: "add_schedule_entry",
    description: "Put a lesson on the timetable.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: str(""), date: str("YYYY-MM-DD"),
        start_time: str("HH:MM, 24-hour"), end_time: str("HH:MM, 24-hour"),
        subject: str(""), grade: str(""), section: str(""), location: str(""),
      },
      required: ["title", "date"],
    },
    run: async ({ fid, args }) => {
      const r = await pool.query(
        `INSERT INTO schedule_entries
           (faculty_id, title, date, start_time, end_time, subject, grade, section, location)
         VALUES ($1,$2,$3::date,$4::time,$5::time,$6,$7,$8,$9)
         RETURNING id, title, date, start_time`,
        [fid, args.title, args.date, args.start_time || null, args.end_time || null,
         args.subject || null, args.grade || null, args.section || null, args.location || null]
      );
      return { ok: true, entry: r.rows[0] };
    },
  },

  // ---- things only the browser can do --------------------------------
  {
    name: "navigate",
    description:
      "Open a screen in the studio for the teacher. Use when they ask to go somewhere, or after creating something they will want to see.",
    parameters: {
      type: "OBJECT",
      properties: {
        where: str("One of: dashboard, planner, lesson-plans, quizzes, homework, presentations, activities, students, schedule, settings"),
      },
      required: ["where"],
    },
    run: async ({ args }) => ({ client: { action: "navigate", where: args.where } }),
  },
  {
    name: "set_accessibility",
    description:
      "Change how the site looks for readability: text size, a dyslexia-friendly font, higher contrast, letter and line spacing, stopping animation, or a larger cursor. Use when the teacher says they cannot read something or asks for bigger text.",
    parameters: {
      type: "OBJECT",
      properties: {
        textStep: str("0 to 4 — text size, 0 is normal"),
        readableFont: str("true or false — a dyslexia-friendly typeface"),
        contrast: str("true or false"),
        letterStep: str("0 to 3 — letter spacing"),
        lineStep: str("0 to 3 — line height"),
        bigCursor: str("true or false"),
        stopAnim: str("true or false — stop all motion"),
        reset: str("true to put everything back to normal"),
      },
    },
    run: async ({ args }) => ({ client: { action: "set_accessibility", settings: args } }),
  },
];

export const TOOL_DECLARATIONS = TOOLS.map(({ name, description, parameters }) => ({
  name, description, parameters,
}));

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/**
 * Run one tool call.
 *
 * Errors are RETURNED, not thrown: the model has to be told a tool
 * failed so it can say so, and an exception here would abandon a
 * half-finished conversation instead.
 */
export async function runTool(name, args, ctx) {
  const tool = BY_NAME.get(name);
  if (!tool) return { error: `No such tool: ${name}` };
  try {
    return await tool.run({ ...ctx, args: args || {} });
  } catch (e) {
    console.error(`[chat] tool ${name} failed:`, e.message);
    return { error: e.message };
  }
}

export { CLIENT_ACTIONS };
