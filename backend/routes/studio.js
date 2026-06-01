import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

const router = Router();

// Build the user-turn `content` array. If the request includes an
// attachment, prepend an Anthropic image or document block so the model
// can see/read it; otherwise we send a plain string (cheaper, identical
// caching behaviour).
//
// `attachment` shape from the frontend:
//   { name, mediaType: "image/png" | "application/pdf" | …, dataBase64 }
//
// Hard caps here (in addition to express.json's 10mb gate):
//   - allowed media types: image/png, image/jpeg, image/webp, image/gif,
//     application/pdf
//   - base64 payload <= 7,500,000 chars (~5.5 MB after decode)
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/pdf",
]);

// Accepts an array of attachments (or a single object / null for older
// callers). Prepends one Anthropic image|document block per file.
const buildUserContent = (text, attachments) => {
  const list = Array.isArray(attachments)
    ? attachments
    : attachments ? [attachments] : [];
  const valid = list.filter((a) => a && a.dataBase64);
  if (valid.length === 0) return text;

  let total = 0;
  const blocks = valid.map((a) => {
    if (!ALLOWED_ATTACHMENT_TYPES.has(a.mediaType)) {
      throw Object.assign(
        new Error(`Attachment type "${a.mediaType}" isn't supported.`),
        { code: "ATTACHMENT_TYPE" }
      );
    }
    total += a.dataBase64.length;
    return a.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.dataBase64 } }
      : { type: "image", source: { type: "base64", media_type: a.mediaType, data: a.dataBase64 } };
  });
  if (total > 18_000_000) {
    throw Object.assign(
      new Error("Attachments are too large. Keep the total under ~13 MB."),
      { code: "ATTACHMENT_SIZE" }
    );
  }
  return [...blocks, { type: "text", text }];
};

// Flatten the kind-specific params bag the frontend sends into a
// single human-readable line we append to the user message. The AI
// reads it as a list of constraints, so the slide count, grade,
// language etc. become hard requirements instead of free-floating
// hints the model can ignore. Returns "" when params is empty/null.
function renderParamsLine(kind, params) {
  if (!params || typeof params !== "object") return "";
  const bits = [];
  const push = (label, value, suffix = "") => {
    if (value === "" || value == null) return;
    bits.push(`${label}: ${value}${suffix}`);
  };
  if (kind === "lesson_plan") {
    push("Grade", params.grade);
    push("Major", params.major);
    push("Language", params.language);
    if (Array.isArray(params.section)) push("Section(s)", params.section.join(", "));
    else push("Section", params.section);
    push("Duration", params.duration, " minutes (sum across stages must equal this)");
  } else if (kind === "homework") {
    push("Grade", params.grade);
    push("Major", params.major);
    push("Language", params.language);
    if (Array.isArray(params.section)) push("Section(s)", params.section.join(", "));
    else push("Section", params.section);
  } else if (kind === "activity") {
    push("Type", params.type);
    push("Major", params.major);
    push("Language", params.language);
    push("Duration", params.duration, " minutes");
  } else if (kind === "presentation") {
    push("Grade", params.grade);
    push("Major", params.major);
    push("Language", params.language);
    if (Array.isArray(params.section)) push("Section(s)", params.section.join(", "));
    else push("Section", params.section);
    if (params.slides) {
      // Slide count is a HARD constraint — emphasise it so the model
      // doesn't drift to 6 when the teacher picked 5.
      bits.push(`Slides: produce EXACTLY ${params.slides} "## Slide N — …" blocks (do not count the Title meta line or Speaker notes section as slides)`);
    }
  } else if (kind === "quiz") {
    push("Grade", params.grade);
    push("Major", params.major);
    push("Language", params.language);
    if (Array.isArray(params.section)) push("Section(s)", params.section.join(", "));
    else push("Section", params.section);
    push("Difficulty", params.difficulty);
    if (params.questions) bits.push(`Questions: produce EXACTLY ${params.questions}`);
    push("Duration", params.duration, " minutes");
    push("Types", params.types);
  }
  if (params.scheduled_for) push("Scheduled for", params.scheduled_for);
  return bits.join(" · ");
}

// Single, stable system prompt across every generation kind. Stable bytes →
// the Anthropic prompt-cache prefix matches across calls (subject to the
// model's minimum-prefix size). The user message carries the variable parts
// (kind, teacher context, the user's free-text prompt).
const SYSTEM_PROMPT = `You are Murchid's AI teaching co-pilot. You help individual school teachers (KG through Grade 12) draft lesson plans, quizzes, homework, classroom activities, presentation outlines, and student feedback.

Voice and style:
- Warm, professional, practical. Write like a senior teaching coach giving a colleague a focused starting draft they can refine.
- Be concrete: name materials, time-box stages, write actual question stems, give example student answers when illustrative.
- Match the grade level. KG–Grade 3: simple language, hands-on tasks, short attention spans. Grade 4–8: scaffolded explanations, structured group work. Grade 9–12: deeper analysis, independent inquiry, real-world application.
- Use neutral, inclusive examples. Avoid politically loaded scenarios or culturally specific assumptions unless the teacher explicitly asks for them.
- No filler. No "Of course!" or "Here is your lesson plan:" preamble. Start the artifact directly.
- NEVER narrate your reasoning, acknowledge the teacher's request, or explain how you reconciled conflicting inputs (e.g. do NOT write "I notice your prompt is in Arabic but the constraints say English — I'll honor the constraints"). If the CONSTRAINTS and the PROMPT disagree, silently follow the CONSTRAINTS and produce the artifact in that voice. The output must read as if it was written by a teacher from scratch — no meta talk about why you wrote it that way.
- Write the entire artifact in the LANGUAGE specified by CONSTRAINTS.Language. If that field is missing, write in the language the teacher's PROMPT is written in. Do not mix languages within the artifact.

Output format — VERY IMPORTANT:
- Return Markdown only. No HTML, no code fences around the whole document.
- Use headings (\`##\`, \`###\`), bullet lists, and numbered lists. Use a table only when comparing items side-by-side; otherwise prefer lists.
- Keep total length appropriate for the kind: lesson plans ~400–800 words; quizzes vary by question count; homework ~150–300 words; activities ~150–250 words; presentations ~5–10 slides; feedback ~80–150 words per student.

Per-kind structure. Each kind's sections MUST mirror the fields the
teacher would fill in manually for that surface, so the AI output is
a 1:1 stand-in for the manual form and can be edited in place.

LESSON_PLAN — mirrors the Lesson Plans → New Template form
(Template name · Subject · Grade · Section · Duration · Learning
objectives · Stages · Tags). Produce sections in this exact order:
  ## Template name
  *Subject · Grade · Section · Duration*

  ## Learning objectives
  3–5 bullet points, each phrased as "Students will be able to…".

  ## Stages
  Numbered list. For each stage, write "**<Stage name>** (<X> min)" on
  its own line, then a short note (one or two sentences) describing
  what happens. Total minutes across stages must equal the Duration
  on the meta line.

  ## Tags
  3–5 short comma-separated keywords (e.g. "Comprehension, Reading,
  Pair work"). Use noun phrases that would help filter the template
  later.

QUIZ — produce:
  ## Title
  Subject · Grade · Section · Total marks · Duration

  ## Instructions to students
  2–3 sentences.

  ## Questions
  Numbered list. For each: question stem, then sub-bullet with type (MCQ / TF / Short / Essay), marks, and (for MCQ) the four choices labelled A–D plus the correct letter on a separate line. For Short/Essay, give the expected answer or rubric outline.

HOMEWORK — mirrors the Homework → New Homework form
(Title · Subject · Grade · Section · Due date · Status · Instructions):
  ## Title
  *Subject · Grade · Section · Due date · Estimated time*

  ## Instructions to students
  Numbered steps the student follows at home. Be concrete: name the
  reading, the worksheet, the digital tool. Include estimated minutes
  per step if helpful.

  ## How it will be graded
  2–3 bullet points: criteria + weight if relevant.

  ## Submission
  One sentence: format (PDF / handwritten photo / Google Doc link) and
  where to submit.

ACTIVITY — mirrors the Activities → New Activity form
(Title · Type · Subject · Duration · Scheduled for · Instructions).
Note: activities do NOT carry Grade or Section per the chip rules.
  ## Title
  *Type · Subject · Duration · Scheduled for*

  ## Materials
  Bullet list of what the teacher needs ready before class.

  ## Instructions
  Numbered run-of-show with time estimates in minutes. Show what the
  teacher does AND what students do at each step.

  ## Differentiation
  One paragraph. How to scale up for fast finishers and scaffold for
  struggling students.

PRESENTATION — mirrors the Presentations → New Presentation form
(Title · Subject · Grade · Section · Slides · Scheduled for). Produce
a slide-by-slide outline:
  ## Title
  *Subject · Grade · Section · Scheduled for*

  ## Slide 1 — <Slide title>
  - Body bullet 1
  - Body bullet 2
  Image: <2–4 word literal photo search query for a REAL stock photo that
  fits this slide, e.g. "rain falling on leaves" or "students in classroom".
  Describe a concrete scene, never abstract concepts or text/diagrams.>
  Layout: <one of: text-image | image-text | full-image | text | title>
  Bg: <one of: paper | white | sand | ink | sage | clay | sky | ocean |
  plum | honey | forest | rose>
  ## Slide 2 — <Slide title>
  - …

  Every slide MUST end with its own "Image:" line, then "Layout:" line,
  then "Bg:" line (exactly those labels). Make slide 1 a "title" layout
  on a bold dark background ("ink", "ocean", "forest" or "plum"). Use
  "full-image" sparingly for high-impact slides; prefer "text-image" or
  "image-text" for content slides; use "text" only when a photo would
  not help. Vary the Bg across slides so the deck feels designed — pick
  a background whose mood matches the slide's topic (e.g. "sky"/"ocean"
  for water, "forest"/"sage" for nature, "honey"/"sand" for warmth),
  and never use the same Bg on three slides in a row. The Image query
  must be a real photographable scene so a stock-photo search returns a
  good match.

  After the last slide, add a short ## Speaker notes section with one
  or two sentences per slide.

  IMPORTANT — when the user's CONSTRAINTS line specifies a slide
  count, produce EXACTLY that many "## Slide N — …" blocks. The
  "## Title" meta header and the trailing "## Speaker notes" section
  do NOT count toward the slide total. If the teacher asked for 5
  slides, the document must contain "## Slide 1 — …" through
  "## Slide 5 — …" and nothing more in the slide range.

FEEDBACK — produce per-student paragraphs in this shape:
  ## <Student name>
  One paragraph. Lead with a specific strength, then a specific area to improve, then a concrete suggested next step. Avoid vague praise like "great job".

SCHEDULE — produce a week or term plan:
  ## Title
  Class · grade · weeks covered

  ## Weekly plan
  Day-by-day for one representative week. For each day:
  - **Monday**: subject, lesson title, key activity, ~minutes
  - **Tuesday**: …
  Use only the days the teacher actually teaches; don't invent extra days.

  ## Pacing notes
  2–4 bullets: prerequisites, sequencing rationale, room/equipment requirements,
  and any handoff to colleagues if relevant.

If the teacher's prompt is missing key context (subject, grade, duration), make a reasonable assumption and STATE IT in italics in one short line just under the title (e.g. *Assumed Grade 7, 45 minutes — adjust as needed.*). Don't pepper the body with caveats.

If the teacher's prompt is unsafe, off-topic, or asks you to write something a teacher shouldn't deliver to students, refuse briefly and suggest a constructive alternative.`;

router.post("/generate", async (req, res) => {
  try {
    // Gate behind the ai_studio feature flag — can be flipped from the Dev console.
    const flag = await pool.query(
      "SELECT enabled FROM feature_flags WHERE key = 'ai_studio'"
    );
    if (!flag.rows[0]?.enabled) {
      return res.status(403).json({
        error: "AI Studio is disabled. Toggle the ai_studio feature flag in the Dev console first.",
      });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: "ANTHROPIC_API_KEY isn't configured on the server. Add it in your .env (dev) or Render env vars (prod).",
      });
    }

    const { prompt, kind, params, enforceChips } = req.body || {};
    const attachments = Array.isArray(req.body?.attachments)
      ? req.body.attachments
      : (req.body?.attachment ? [req.body.attachment] : []);
    const promptText = String(prompt || "").trim();
    // An attachment alone is a valid signal — "make a quiz from this
    // worksheet" doesn't need extra prose. Require ONE of the two.
    if (!promptText && attachments.length === 0) {
      return res.status(400).json({ error: "Prompt or an attachment is required" });
    }
    const allowedKinds = new Set([
      "lesson_plan", "quiz", "homework", "activity", "presentation", "feedback", "schedule",
    ]);
    const k = allowedKinds.has(kind) ? kind : "lesson_plan";

    // Render the kind's params chips into plain English the AI can use
    // as hard constraints (e.g., "produce exactly 5 slides"). Only the
    // keys present in `params` are emitted, so the line stays clean
    // when the teacher leaves everything blank.
    const paramsLine = renderParamsLine(k, params);

    const cur = await loadCurrentTeacher(req);
    // Pass teacher context inside the user message so the system prompt stays
    // byte-stable across calls (and therefore cache-eligible).
    // When the client has detected a chip↔prompt conflict and the teacher
    // chose "Use settings", the chips become strictly authoritative — we
    // explicitly tell the model to override any conflicting Grade /
    // Duration / Slides / Questions value in the prompt below.
    const constraintsHeader = enforceChips
      ? "CONSTRAINTS (AUTHORITATIVE — if any value in the PROMPT below conflicts with a CONSTRAINT here, FOLLOW THE CONSTRAINT and IGNORE the prompt's value)"
      : "CONSTRAINTS (treat numeric counts as exact)";
    const userMessage =
      `KIND: ${k.toUpperCase()}\n` +
      `TEACHER CONTEXT: ${cur ? `id=${cur.id}, grades=${(cur.grade_levels || []).join(", ")}` : "none"}\n` +
      `${paramsLine ? `${constraintsHeader}: ${paramsLine}\n` : ""}` +
      `${attachments.length ? `\nNOTE: ${attachments.length} attachment(s) have been provided. Treat them as primary source material — base the output on what's in them.\n` : ""}` +
      `\nPROMPT:\n${promptText || "(no extra guidance — use the attached file(s) as the full source)"}`;

    let userContent;
    try {
      userContent = buildUserContent(userMessage, attachments);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const client = new Anthropic();

    // Stream Anthropic deltas to the browser as SSE. The browser renders
    // tokens as they arrive — same wall-clock time as the old buffered path,
    // but the user sees progress in ~1–2s instead of staring at a 12s
    // spinner. The final SSE event carries `usage` + `stop_reason` so the
    // frontend can show the same token-cost strip we had before.
    const stream = client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      thinking: { type: "disabled" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Hint for proxies (nginx etc.) to forward chunks without buffering.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    // If the client disconnects mid-stream, abort the upstream Anthropic call
    // so we stop paying for output tokens nobody will read.
    req.on("close", () => stream.abort?.());

    try {
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          send({ type: "delta", text: ev.delta.text });
        }
      }
      const message = await stream.finalMessage();
      send({
        type: "done",
        kind: k,
        stop_reason: message.stop_reason,
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
        },
      });
    } catch (e) {
      send({ type: "error", message: e.message });
    }
    res.end();
  } catch (err) {
    handleErr(res, "POST /api/studio/generate", err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/studio/quiz — STRUCTURED quiz generation.
//
// The studio's regular /generate path returns a free-form markdown blob,
// which is fine for human-readable outputs (lesson plans, homework, slides)
// but useless for quizzes — we can't tell question from answer, can't save
// per-question, can't render MCQ choices vs. essay rubrics differently.
//
// This endpoint forces the model to call a single `submit_quiz` tool whose
// JSON schema mirrors our quiz_questions table exactly:
//   type ∈ {mcq, tf, short, essay}, choices, correct_answer, marks, ...
//
// We stream Anthropic's `input_json_delta` events as SSE so the browser
// can show progress, and we wait until the tool_use block is complete to
// emit a final structured `done` event with the parsed object.
// ---------------------------------------------------------------------------
const QUIZ_TOOL = {
  name: "submit_quiz",
  description:
    "Submit the finished quiz with full structure. Call this exactly once with the entire quiz — every required field MUST be set. Do not respond with prose; only call this tool.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title for the quiz." },
      subject: { type: "string", description: "Subject e.g. Math, English." },
      grade: { type: "string", description: "Grade level e.g. 'Grade 8'." },
      language: {
        type: "string",
        description: "Language the quiz is written in. Echo back the SETTINGS value (e.g. 'English', 'Arabic'). Default to 'English' if no language was specified.",
      },
      section: {
        type: "string",
        description: "Class section the quiz is for. Echo back the SETTINGS value (e.g. 'Section A', 'All sections'). Empty string if no section was specified.",
      },
      difficulty: {
        type: "string",
        description: "Overall difficulty. Echo back the SETTINGS value if provided (one of 'Easy', 'Medium', 'Hard'); otherwise pick the level you actually targeted.",
      },
      duration_minutes: {
        type: "integer",
        description: "Estimated time to take the quiz, in minutes.",
      },
      total_marks: {
        type: "integer",
        description: "Sum of marks across all questions. Must equal Σ question.marks.",
      },
      instructions: {
        type: "string",
        description: "2–3 sentences for students. Plain text, no markdown.",
      },
      questions: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            position: { type: "integer", minimum: 1 },
            type: {
              type: "string",
              enum: ["mcq", "tf", "short", "essay"],
              description:
                "mcq = multiple choice (4 options, one correct letter); tf = true/false; short = short answer; essay = essay/long answer.",
            },
            prompt: { type: "string", description: "The question stem. Plain text." },
            choices: {
              type: ["array", "null"],
              description:
                "For mcq: an array of 4 strings labelled A–D (do NOT prefix the letter, only the option text). For tf: ['True', 'False']. For short/essay: null.",
              items: { type: "string" },
            },
            correct_answer: {
              description:
                "For mcq: the letter 'A'|'B'|'C'|'D'. For tf: true or false. For short: the expected answer text. For essay: a 1–2 sentence rubric outline.",
            },
            marks: { type: "integer", minimum: 1 },
          },
          required: ["position", "type", "prompt", "marks", "correct_answer"],
        },
      },
    },
    required: ["title", "subject", "grade", "total_marks", "instructions", "questions"],
  },
};

router.post("/quiz", async (req, res) => {
  try {
    const flag = await pool.query(
      "SELECT enabled FROM feature_flags WHERE key = 'ai_studio'"
    );
    if (!flag.rows[0]?.enabled) {
      return res.status(403).json({
        error: "AI Studio is disabled. Toggle the ai_studio feature flag in the Dev console first.",
      });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: "ANTHROPIC_API_KEY isn't configured on the server.",
      });
    }

    const { prompt, params, enforceChips } = req.body || {};
    const attachments = Array.isArray(req.body?.attachments)
      ? req.body.attachments
      : (req.body?.attachment ? [req.body.attachment] : []);
    const promptText = String(prompt || "").trim();
    if (!promptText && attachments.length === 0) {
      return res.status(400).json({ error: "Prompt or an attachment is required" });
    }

    // Render the optional pre-prompt knobs as a SETTINGS block. Empty /
    // null values are skipped so the AI infers them from prose. The
    // model treats these as hard constraints (count, duration) and
    // strong steers (difficulty, grade, subject).
    const settingsLines = [];
    if (params && typeof params === "object") {
      if (params.grade) settingsLines.push(`- Grade level: ${params.grade}`);
      if (params.major) {
        settingsLines.push(
          `- Major (school subject): ${params.major} (every question must be on-topic for this major; if the prompt drifts, prefer the major)`
        );
      }
      if (params.language) {
        settingsLines.push(
          `- Output language: ${params.language} (write the ENTIRE quiz in this language — title, prompts, choices, instructions, and answer key. Do NOT mix languages. If the language uses a non-Latin script, use that script natively).`
        );
      }
      if (params.section) {
        settingsLines.push(
          `- Class section: ${params.section} (mention on the cover page only; do not change the question difficulty for this)`
        );
      }
      if (Number.isFinite(Number(params.questions)) && Number(params.questions) > 0) {
        settingsLines.push(
          `- Question count: ${Number(params.questions)} (must produce exactly this many)`
        );
      }
      if (Number.isFinite(Number(params.duration)) && Number(params.duration) > 0) {
        settingsLines.push(`- Target duration: ${Number(params.duration)} minutes`);
      }
      if (params.difficulty) {
        settingsLines.push(`- Difficulty: ${params.difficulty}`);
      }
      if (params.types) {
        // "Identification" is the teacher-facing word for short-answer
        // recall — translate it to the underlying type code so the model
        // doesn't get confused. Hard constraint, not a suggestion. Essay
        // is never used by these presets; only mcq / short / tf.
        const mix = String(params.types);
        const MIX_RULES = {
          "MCQ only":
            `Every question MUST use type="mcq" (4 choices A–D, one correct letter). No other types are allowed.`,
          "Identification only":
            `Every question MUST use type="short" (short-answer / identification — one or two word expected answer). No multiple choice, no True/False, no essays.`,
          "True/False only":
            `Every question MUST use type="tf" with choices=["True","False"] and a boolean correct_answer. No other types are allowed.`,
          "MCQ + Identification":
            `Use ONLY type="mcq" and type="short". Mix them roughly evenly across the quiz. No True/False, no essays.`,
          "MCQ + True/False":
            `Use ONLY type="mcq" and type="tf". Mix them roughly evenly across the quiz. No identification / short answer, no essays.`,
          "Identification + True/False":
            `Use ONLY type="short" and type="tf". Mix them roughly evenly across the quiz. No multiple choice, no essays.`,
          "All three (MCQ + Identification + True/False)":
            `Use mcq, short, AND tf — each type must appear at least once. Distribute them so no type dominates. Do not use essays.`,
        };
        const rule = MIX_RULES[mix]
          || `Teacher requested: "${mix}". Honour it as a constraint on which question types to produce.`;
        settingsLines.push(`- Question types: ${mix}. ${rule}`);
      }
    }
    const settingsBlock = settingsLines.length
      ? `SETTINGS (teacher pre-set — honour these${enforceChips ? "; these OVERRIDE any conflicting value the prompt might mention" : ""}):\n${settingsLines.join("\n")}\n\n` +
        `IMPORTANT — sanity-check these settings before generating:\n` +
        `If any value is clearly in the wrong slot (e.g. a school subject like "Math" landed in the Grade field, or "Grade 8" landed in the Major field, or a difficulty word in Questions), silently swap them and proceed with the obviously-intended assignment. Do NOT mention the correction in the output. If a value is just impossible (negative count, garbage text), ignore that one field and pick a sensible default.\n\n`
      : "";

    const cur = await loadCurrentTeacher(req);
    // The quiz streams as MARKDOWN text (same token-by-token path as
    // lesson plans) so the teacher watches every question get written
    // live — forced tool_use streamed in coarse bursts and felt like
    // "nothing then boom done". A strict template keeps the markdown
    // both human-readable AND trivial to restructure afterwards.
    const userMessage =
      `KIND: QUIZ\n` +
      `TEACHER CONTEXT: ${cur ? `id=${cur.id}, grades=${(cur.grade_levels || []).join(", ")}` : "none"}\n\n` +
      settingsBlock +
      `${attachments.length ? `ATTACHMENT: ${attachments.length} file(s) provided. Base the quiz questions on the content of the attachment(s) (textbook page, worksheet, exam paper, etc.). Use the prompt as additional guidance.\n\n` : ""}` +
      `PROMPT:\n${promptText || "(no extra guidance — base every question on the attached file)"}\n\n` +
      `Write the quiz as Markdown in EXACTLY this template — no preamble, no extra prose:\n\n` +
      `## <Quiz title>\n` +
      `*<Subject> · <Grade> · <Section or "All sections"> · <Total marks> marks · <Duration> min*\n\n` +
      `**Instructions:** <2–3 sentences for students>\n\n` +
      `### Question 1 · MCQ · <marks> marks\n` +
      `<question stem>\n` +
      `- A) <option A>\n- B) <option B>\n- C) <option C>\n- D) <option D>\n` +
      `**Answer:** <A|B|C|D>\n\n` +
      `### Question 2 · True/False · <marks> marks\n` +
      `<statement>\n` +
      `**Answer:** <True|False>\n\n` +
      `### Question 3 · Short answer · <marks> marks\n` +
      `<question stem>\n` +
      `**Answer:** <expected answer>\n\n` +
      `### Question 4 · Essay · <marks> marks\n` +
      `<question stem>\n` +
      `**Answer:** <1–2 sentence rubric>\n\n` +
      `Rules: number questions sequentially starting at 1. Use only the ` +
      `question types the SETTINGS allow. Every "### Question N · <Type> · ` +
      `<marks> marks" header line must be exact (that middle separator is ` +
      `" · "). MCQ always has exactly four options A–D. Keep the same ` +
      `language throughout.`;

    let userContent;
    try {
      userContent = buildUserContent(userMessage, attachments);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const client = new Anthropic();

    const stream = client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      thinking: { type: "disabled" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    // Heartbeat: write an SSE comment every 800ms so reverse proxies
    // (Render's edge) don't buffer the stream waiting for their flush
    // threshold. Comments are ignored by the EventSource spec on the
    // client but they keep the bytes moving over the wire.
    const heartbeat = setInterval(() => {
      try { res.write(`: ping\n\n`); } catch { /* connection closed */ }
    }, 800);
    req.on("close", () => { clearInterval(heartbeat); stream.abort?.(); });

    try {
      // Stream the markdown token-by-token, exactly like /generate.
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          send({ type: "delta", text: ev.delta.text });
        }
      }
      const message = await stream.finalMessage();
      const markdown = (message.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");

      // Restructure the finished markdown into the typed quiz shape with a
      // single fast non-streaming tool call. The model only reformats —
      // it does not regenerate — so this is deterministic and cheap.
      const restructure = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        thinking: { type: "disabled" },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools: [QUIZ_TOOL],
        tool_choice: { type: "tool", name: "submit_quiz" },
        messages: [{
          role: "user",
          content:
            `Convert the quiz below into the submit_quiz tool. Copy every ` +
            `title, instruction, question stem, choice, and answer EXACTLY ` +
            `as written — do not rephrase, add, remove, reorder, or ` +
            `renumber anything. Map types: MCQ→"mcq", True/False→"tf", ` +
            `Short answer→"short", Essay→"essay". For mcq, correct_answer ` +
            `is the letter "A"|"B"|"C"|"D" and choices is the four option ` +
            `texts (no "A)" prefixes). For tf, correct_answer is boolean ` +
            `true/false and choices is ["True","False"]. For short/essay, ` +
            `correct_answer is the answer/rubric text and choices is null.\n\n` +
            `QUIZ:\n"""\n${markdown}\n"""`,
        }],
      });
      clearInterval(heartbeat);

      const toolBlock = (restructure.content || []).find(
        (b) => b.type === "tool_use" && b.name === "submit_quiz"
      );
      if (!toolBlock) {
        send({ type: "error", message: "Could not structure the quiz. Try again." });
        return res.end();
      }
      send({
        type: "done",
        kind: "quiz",
        quiz: toolBlock.input,
        stop_reason: message.stop_reason,
        usage: {
          input_tokens:
            (message.usage.input_tokens || 0) + (restructure.usage.input_tokens || 0),
          output_tokens:
            (message.usage.output_tokens || 0) + (restructure.usage.output_tokens || 0),
          cache_read_input_tokens:
            (message.usage.cache_read_input_tokens ?? 0) +
            (restructure.usage.cache_read_input_tokens ?? 0),
          cache_creation_input_tokens:
            (message.usage.cache_creation_input_tokens ?? 0) +
            (restructure.usage.cache_creation_input_tokens ?? 0),
        },
      });
    } catch (e) {
      clearInterval(heartbeat);
      send({ type: "error", message: e.message });
    }
    clearInterval(heartbeat);
    res.end();
  } catch (err) {
    handleErr(res, "POST /api/studio/quiz", err);
  }
});

// Single-question tool, used by /api/studio/quiz-tweak when the teacher
// scopes a tweak to one question. Same shape as one item of the QUIZ_TOOL
// questions array so the frontend can swap it in without further parsing.
const QUESTION_TOOL = {
  name: "submit_question",
  description:
    "Submit the rewritten quiz question with full structure. Call exactly once with every required field. Do not respond with prose.",
  input_schema: {
    type: "object",
    properties: {
      position: { type: "integer", minimum: 1 },
      type: {
        type: "string",
        enum: ["mcq", "tf", "short", "essay"],
        description:
          "Preserve the original type unless the teacher's guidance explicitly asks to change it.",
      },
      prompt: { type: "string", description: "The question stem. Plain text." },
      choices: {
        type: ["array", "null"],
        description:
          "For mcq: array of 4 strings (no letter prefix). For tf: ['True','False']. For short/essay: null.",
        items: { type: "string" },
      },
      correct_answer: {
        description:
          "For mcq: letter 'A'|'B'|'C'|'D'. For tf: true|false. For short: expected answer text. For essay: 1–2 sentence rubric.",
      },
      marks: { type: "integer", minimum: 1 },
    },
    required: ["position", "type", "prompt", "marks", "correct_answer"],
  },
};

// POST /api/studio/quiz-tweak — natural-language tweak of an existing
// structured quiz. Two scopes:
//   scope="question"  → rewrite quiz.questions[questionIndex] only.
//                        Returns { question: <updated question> }.
//   scope="quiz"      → rewrite the full quiz, honouring the hint.
//                        Returns { quiz: <updated full quiz> }.
// The current quiz JSON is passed as context so the model preserves the
// teacher's in-place edits unless the hint contradicts them.
router.post("/quiz-tweak", async (req, res) => {
  try {
    const flag = await pool.query(
      "SELECT enabled FROM feature_flags WHERE key = 'ai_studio'"
    );
    if (!flag.rows[0]?.enabled) {
      return res.status(403).json({
        error: "AI Studio is disabled. Toggle the ai_studio feature flag in the Dev console first.",
      });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: "ANTHROPIC_API_KEY isn't configured on the server.",
      });
    }

    const { quiz, hint, scope, questionIndex } = req.body || {};
    const hintText = String(hint || "").trim();
    if (!quiz || !hintText || !scope) {
      return res.status(400).json({ error: "quiz, hint and scope are required" });
    }
    if (scope !== "question" && scope !== "quiz") {
      return res.status(400).json({ error: "scope must be 'question' or 'quiz'" });
    }
    if (scope === "question") {
      const idx = Number(questionIndex);
      if (!Number.isInteger(idx) || idx < 0 || !Array.isArray(quiz.questions) || idx >= quiz.questions.length) {
        return res.status(400).json({ error: "questionIndex is out of range for the supplied quiz" });
      }
    }

    const client = new Anthropic();
    const isQuestionScope = scope === "question";
    const tool = isQuestionScope ? QUESTION_TOOL : QUIZ_TOOL;
    const toolName = tool.name;

    const target = isQuestionScope ? quiz.questions[Number(questionIndex)] : null;
    const userMessage = isQuestionScope
      ? `KIND: QUIZ_QUESTION_TWEAK\n\n` +
        `QUIZ CONTEXT (for tone, grade, and to avoid overlap with other questions — do NOT rewrite the others):\n` +
        `"""${JSON.stringify({
          title: quiz.title, subject: quiz.subject, grade: quiz.grade,
          language: quiz.language, difficulty: quiz.difficulty,
          instructions: quiz.instructions,
          questions: (quiz.questions || []).map((q, i) => ({
            position: q.position ?? i + 1,
            type: q.type,
            prompt: q.prompt,
          })),
        })}"""\n\n` +
        `QUESTION TO REWRITE (verbatim — keep position and ideally type, change everything else as the guidance asks):\n` +
        `"""${JSON.stringify(target)}"""\n\n` +
        `TEACHER GUIDANCE: ${hintText}\n\n` +
        `Call submit_question exactly once with the rewritten question. ` +
        `Preserve position. Preserve type unless the guidance explicitly asks otherwise. ` +
        `Match the quiz's language. Do not return prose.`
      : `KIND: QUIZ_TWEAK\n\n` +
        `CURRENT QUIZ (rewrite, honouring the teacher's existing edits unless the guidance contradicts them):\n` +
        `"""${JSON.stringify(quiz)}"""\n\n` +
        `TEACHER GUIDANCE: ${hintText}\n\n` +
        `Call submit_quiz exactly once with the rewritten quiz. ` +
        `Keep the same language, the same total question count unless the guidance says otherwise, ` +
        `and make sure total_marks equals Σ question.marks. Do not return prose.`;

    const stream = client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      thinking: { type: "disabled" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [tool],
      tool_choice: { type: "tool", name: toolName },
      messages: [{ role: "user", content: userMessage }],
    });

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    req.on("close", () => stream.abort?.());

    try {
      for await (const ev of stream) {
        if (
          ev.type === "content_block_delta" &&
          ev.delta?.type === "input_json_delta"
        ) {
          send({ type: "json_delta", partial: ev.delta.partial_json });
        }
      }
      const message = await stream.finalMessage();
      const toolBlock = (message.content || []).find(
        (b) => b.type === "tool_use" && b.name === toolName
      );
      if (!toolBlock) {
        send({ type: "error", message: `Model did not call ${toolName}.` });
        return res.end();
      }
      send({
        type: "done",
        scope,
        ...(isQuestionScope ? { question: toolBlock.input } : { quiz: toolBlock.input }),
        stop_reason: message.stop_reason,
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
        },
      });
    } catch (e) {
      send({ type: "error", message: e.message });
    }
    res.end();
  } catch (err) {
    handleErr(res, "POST /api/studio/quiz-tweak", err);
  }
});

// POST /api/studio/regenerate — replace a single section of an existing
// document. The frontend sends the full document for context and the exact
// markdown of the section it wants replaced. The model returns ONLY the new
// block in the same shape (heading level, numbering, etc.) so the frontend
// can swap it in without re-parsing the world.
router.post("/regenerate", async (req, res) => {
  try {
    const flag = await pool.query(
      "SELECT enabled FROM feature_flags WHERE key = 'ai_studio'"
    );
    if (!flag.rows[0]?.enabled) {
      return res.status(403).json({
        error: "AI Studio is disabled. Toggle the ai_studio feature flag in the Dev console first.",
      });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: "ANTHROPIC_API_KEY isn't configured on the server.",
      });
    }

    const { kind, fullDocument, sectionMarkdown, hint } = req.body || {};
    if (!kind || !fullDocument || !sectionMarkdown) {
      return res.status(400).json({ error: "kind, fullDocument and sectionMarkdown are required" });
    }

    const client = new Anthropic();

    const userMessage =
      `KIND: ${String(kind).toUpperCase()}\n\n` +
      `FULL DOCUMENT (for context — do not return any of this back):\n` +
      `"""${fullDocument}"""\n\n` +
      `SECTION TO REPLACE (verbatim — same shape and heading level should come back):\n` +
      `"""${sectionMarkdown}"""\n\n` +
      `TASK: Generate a fresh replacement for the section above. ` +
      (hint && String(hint).trim()
        ? `Guidance from the teacher: ${String(hint).trim()}\n\n`
        : `Keep the same purpose and shape, but vary the wording, examples, or specifics.\n\n`) +
      `Output ONLY the new replacement markdown for that section. ` +
      `Match the exact format: same heading level (## or none), same numbering if it's a numbered item, ` +
      `same internal structure. Do not include any other section, no preamble, no explanation.`;

    const stream = client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      thinking: { type: "disabled" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    req.on("close", () => stream.abort?.());

    try {
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          send({ type: "delta", text: ev.delta.text });
        }
      }
      const message = await stream.finalMessage();
      send({
        type: "done",
        stop_reason: message.stop_reason,
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
        },
      });
    } catch (e) {
      send({ type: "error", message: e.message });
    }
    res.end();
  } catch (err) {
    handleErr(res, "POST /api/studio/regenerate", err);
  }
});

export default router;
