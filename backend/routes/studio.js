import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

const router = Router();

// Single, stable system prompt across every generation kind. Stable bytes →
// the Anthropic prompt-cache prefix matches across calls (subject to the
// model's minimum-prefix size). The user message carries the variable parts
// (kind, teacher context, the user's free-text prompt).
const SYSTEM_PROMPT = `You are Mudir's AI teaching co-pilot. You help individual school teachers (KG through Grade 12) draft lesson plans, quizzes, homework, classroom activities, presentation outlines, and student feedback.

Voice and style:
- Warm, professional, practical. Write like a senior teaching coach giving a colleague a focused starting draft they can refine.
- Be concrete: name materials, time-box stages, write actual question stems, give example student answers when illustrative.
- Match the grade level. KG–Grade 3: simple language, hands-on tasks, short attention spans. Grade 4–8: scaffolded explanations, structured group work. Grade 9–12: deeper analysis, independent inquiry, real-world application.
- Use neutral, inclusive examples. Avoid politically loaded scenarios or culturally specific assumptions unless the teacher explicitly asks for them.
- No filler. No "Of course!" or "Here is your lesson plan:" preamble. Start the artifact directly.

Output format — VERY IMPORTANT:
- Return Markdown only. No HTML, no code fences around the whole document.
- Use headings (\`##\`, \`###\`), bullet lists, and numbered lists. Use a table only when comparing items side-by-side; otherwise prefer lists.
- Keep total length appropriate for the kind: lesson plans ~400–800 words; quizzes vary by question count; homework ~150–300 words; activities ~150–250 words; presentations ~5–10 slides; feedback ~80–150 words per student.

Per-kind structure:

LESSON_PLAN — produce sections in this exact order:
  ## Title
  Subject · Grade · Duration

  ## Learning objectives
  3–5 bullet points, each phrased as "Students will be able to…".

  ## Materials
  Bullet list of physical / digital items needed.

  ## Intro (warm-up)
  One paragraph. Hook + connection to prior knowledge.

  ## Main activity
  Numbered steps with time estimates in minutes (e.g. "(15 min) …"). Show what the teacher does AND what students do.

  ## Conclusion
  Brief wrap-up + exit-ticket prompt.

  ## Assessment
  How the teacher will know objectives were met. One or two concrete strategies.

QUIZ — produce:
  ## Title
  Subject · Grade · Total marks

  ## Instructions to students
  2–3 sentences.

  ## Questions
  Numbered list. For each: question stem, then sub-bullet with type (MCQ / TF / Short / Essay), marks, and (for MCQ) the four choices labelled A–D plus the correct letter on a separate line. For Short/Essay, give the expected answer or rubric outline.

HOMEWORK — produce:
  ## Title
  Subject · Grade · Estimated time

  ## What to do
  Numbered steps the student follows at home.

  ## How it will be graded
  2–3 bullet points: criteria + weight if relevant.

  ## Submission
  One sentence: format and where to submit.

ACTIVITY — produce:
  ## Title
  Type (individual / pair / group) · Grade · Duration

  ## Setup
  What the teacher prepares in advance.

  ## Run-of-show
  Numbered steps with time estimates.

  ## Materials
  Bullet list.

  ## Differentiation
  One paragraph. How to scale up for fast finishers and scaffold for struggling students.

PRESENTATION — produce a slide outline:
  ## Slide 1 — <Title>
  - Body bullet 1
  - Body bullet 2
  ## Slide 2 — <Title>
  - …

  After the last slide, add a short ## Speaker notes section with one or two sentences per slide.

FEEDBACK — produce per-student paragraphs in this shape:
  ## <Student name>
  One paragraph. Lead with a specific strength, then a specific area to improve, then a concrete suggested next step. Avoid vague praise like "great job".

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

    const { prompt, kind } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    const allowedKinds = new Set([
      "lesson_plan", "quiz", "homework", "activity", "presentation", "feedback",
    ]);
    const k = allowedKinds.has(kind) ? kind : "lesson_plan";

    const cur = await loadCurrentTeacher();
    // Pass teacher context inside the user message so the system prompt stays
    // byte-stable across calls (and therefore cache-eligible).
    const userMessage =
      `KIND: ${k.toUpperCase()}\n` +
      `TEACHER CONTEXT: ${cur ? `id=${cur.id}, grades=${(cur.grade_levels || []).join(", ")}` : "none"}\n` +
      `\nPROMPT:\n${String(prompt).trim()}`;

    const client = new Anthropic();

    // Streaming with .finalMessage() — defends against SDK HTTP timeouts on
    // larger generations and lets us add a token-by-token UI later without
    // changing the server.
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const message = await stream.finalMessage();
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    res.json({
      text,
      kind: k,
      stop_reason: message.stop_reason,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
        cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
      },
    });
  } catch (err) {
    handleErr(res, "POST /api/studio/generate", err);
  }
});

export default router;
