# 01 · AI Studio — `/api/studio/*`

> **Status (2026-08-11): ✅ built and deployed, EXCEPT §1.1b.**
> `generate`, `quiz`, `quiz-tweak` and `regenerate` are live and documented
> at [murchid-api-reference.vercel.app](https://murchid-api-reference.vercel.app/)
> (`/api/studio/quiz` now returns the structured `quiz` on its done frame,
> which the frontend already reads). **`POST /api/studio/goal-plan` (§1.1b)
> is still missing** — absent from the API reference; the Goal planner
> button still dead-ends. That section is the remaining work in this file.

The generation endpoints. This is the product's headline feature and the
only reason a teacher needs this service at all for day-to-day work.

Requires [00 · Setup](00-setup.md).

## Contract

| Method | Path | Body |
|---|---|---|
| POST | `/api/studio/generate` | `{ kind, prompt, materials?, context? }` |
| POST | `/api/studio/quiz` | `{ prompt, subject, grade, count?, materials? }` |
| POST | `/api/studio/quiz-tweak` | `{ quiz, instruction }` |
| POST | `/api/studio/regenerate` | `{ kind, section, current, prompt }` |

All four stream **Server-Sent Events**. `kind` is one of `lesson_plan`,
`quiz`, `homework`, `presentation`, `activity`.

### Frames the frontend expects

```
data: {"type":"delta","text":"…"}          repeatedly
data: {"type":"done","kind":"lesson_plan","stop_reason":"end_turn","usage":{…}}
data: {"type":"error","message":"…"}       instead of done, on failure
```

Streaming is not decoration. A teacher watching an empty box for six
seconds concludes it is broken; the same six seconds with words arriving
reads as work being done.

**You do not save the result.** The browser writes it to `ai_studio`
itself, through Supabase. Two writers would mean two ideas of the shape.

---

## The route

```js
import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr, bad } from "../lib/errors.js";
import { recordUsage } from "../lib/usage.js";

const router = Router();
const MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-latest";

const KINDS = new Set(["lesson_plan", "quiz", "homework", "presentation", "activity"]);

/** Open an SSE stream. Order matters: headers, then flush, then write. */
function openStream(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Without this, nginx and most platform proxies buffer the whole
  // response and the teacher gets everything at once after 20 seconds —
  // which is the exact failure streaming exists to avoid.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  return (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
}

/** The flag the dev console toggles. Off by default. */
async function studioEnabled() {
  const { rows } = await pool.query(
    `SELECT enabled FROM feature_flags WHERE key = 'ai_studio'`
  );
  return rows[0]?.enabled === true;
}

router.post("/generate", async (req, res) => {
  try {
    const { kind, prompt, materials = [], context = {} } = req.body || {};
    if (!KINDS.has(kind)) throw bad(`kind must be one of ${[...KINDS].join(", ")}`);
    if (!prompt?.trim()) throw bad("prompt is required");
    if (!(await studioEnabled())) {
      return res.status(503).json({
        error: "AI Studio is switched off. Turn on the ai_studio flag in the Dev console.",
        code: "feature_off",
      });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "Generation isn't configured on this server.", code: "NO_AI_KEY" });
    }

    const send = openStream(res);
    // A client that navigates away should stop costing money.
    const abort = new AbortController();
    req.on("close", () => abort.abort());

    let text = "", tin = 0, tout = 0;
    try {
      for await (const ev of streamGemini({
        system: systemFor(kind, req.account, context),
        user: buildPrompt(prompt, materials),
        signal: abort.signal,
      })) {
        if (ev.text) { text += ev.text; send({ type: "delta", text: ev.text }); }
        if (ev.usage) { tin = ev.usage.promptTokenCount || tin; tout = ev.usage.candidatesTokenCount || tout; }
      }
      send({ type: "done", kind, stop_reason: "end_turn",
             usage: { input_tokens: tin, output_tokens: tout } });
    } catch (e) {
      if (!abort.signal.aborted) send({ type: "error", message: friendly(e) });
    }
    res.end();

    // After the response — the teacher never waits for the meter.
    recordUsage({
      userId: req.account.user_id, facultyId: req.account.id,
      model: MODEL(), operation: `generate.${kind}`,
      tokensIn: tin, tokensOut: tout, credits: 1,
    });
  } catch (err) {
    handleErr(res, "POST /api/studio/generate", err);
  }
});

/** Provider errors are facts about the provider, not stack traces to show. */
function friendly(e) {
  if (e.status === 429) return "The assistant has hit its usage limit. Try again in a minute.";
  if (e.status === 503 || e.status === 500) return "The model is busy. Give it a few seconds and try again.";
  return "Something went wrong generating that. Try again.";
}

export default router;
```

---

## Talking to Gemini

Plain REST. One call does not justify an SDK, and the SDK's streaming
shape changes more often than this does.

```js
async function* streamGemini({ system, user, signal }) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: user }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  );
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw Object.assign(new Error(`Gemini ${r.status}: ${detail.slice(0, 200)}`), { status: r.status });
  }

  // SSE frames split across chunks, so buffer to the last complete line.
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let j; try { j = JSON.parse(payload); } catch { continue; }
      for (const p of j.candidates?.[0]?.content?.parts || []) if (p.text) yield { text: p.text };
      if (j.usageMetadata) yield { usage: j.usageMetadata };
    }
  }
}
```

> **Use the rolling alias.** `gemini-flash-latest`, not a pinned version.
> A pinned name 404'd here within an hour of being written —
> *"no longer available to new users"*. Keep `GEMINI_MODEL` overridable so
> the fix is an env change rather than a deploy.

---

## Prompts

Ground the model in the teacher's own profile. It is the difference
between a generic plan and one that fits the class they actually teach.

```js
function systemFor(kind, account, context) {
  const who = [
    account.first_name && `You are drafting for ${account.first_name}`,
    account.majors?.length && `who teaches ${account.majors.join(", ")}`,
    account.grade_levels?.length && `to ${account.grade_levels.join(", ")}`,
  ].filter(Boolean).join(", ");

  const shape = {
    lesson_plan: `Return a lesson plan with: objectives (3–5, each an observable
outcome), a short intro that hooks the class, a main activity written in
enough detail to teach from, a conclusion, and an assessment method.`,
    quiz: `Return questions with a clear answer key. Mix recall and application.`,
    homework: `Return instructions a student can follow without the teacher present.`,
    presentation: `Return slides: a title and 3–5 bullets each. No walls of text.`,
    activity: `Return a classroom activity with materials, timings and group size.`,
  }[kind];

  return `${who}. Today is ${new Date().toISOString().slice(0, 10)}.

${shape}

Write for the UAE — MoE and IB curricula, and a class that may be
learning in its second language. Be specific and usable: a teacher should
be able to take this into a room without rewriting it. Never invent a
statistic or cite a source you are not certain of. If the request is too
vague to be useful, say what one detail would fix it rather than
producing something generic.`;
}

function buildPrompt(prompt, materials) {
  if (!materials?.length) return prompt;
  // The teacher's own material comes FENCED. It is a file someone
  // uploaded, and text inside it saying "ignore the above" must read as a
  // document that says something odd, not as an instruction.
  const docs = materials
    .map((m, i) => `<material index="${i + 1}" name="${String(m.name || "").replace(/[<>"]/g, "")}">\n${String(m.text || "").slice(0, 20000)}\n</material>`)
    .join("\n\n");
  return `${docs}\n\nUse the material above where it is relevant.\n\n${prompt}`;
}
```

---

## `/quiz` — two model calls, one quiz

The draft is prose; a second pass turns it into structured questions.
That is deliberate — asking for JSON up front produces flatter questions.

```js
router.post("/quiz", async (req, res) => {
  // 1. draft the quiz as prose, streaming deltas so the teacher sees progress
  // 2. re-send it with responseSchema to get { questions: [...] }
  // 3. send { type: "done", kind: "quiz", quiz: <structured> }
});
```

Second pass config:

```js
generationConfig: {
  responseMimeType: "application/json",
  temperature: 0,
  responseSchema: {
    type: "OBJECT",
    properties: {
      questions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            position:       { type: "INTEGER" },
            type:           { type: "STRING", description: "mcq | true_false | short | essay" },
            prompt:         { type: "STRING" },
            choices:        { type: "ARRAY", items: { type: "STRING" } },
            correct_answer: { type: "STRING" },
            marks:          { type: "INTEGER" },
          },
        },
      },
    },
  },
}
```

Gemini's schema uses proto enum names — `OBJECT`, `ARRAY`, `STRING` —
not JSON Schema's lowercase ones.

**Bill both calls.** Charging one under-reports by roughly half.

---

## Metering — `src/lib/usage.js`

`usage_logs` and `credits` exist for this and nothing else writes them.
Without it there is no answering "why is the bill this size", and the
balance on the teacher's dashboard never moves.

```js
import { pool } from "./db.js";

// Approximate, per million tokens. For spotting a runaway loop, not for
// invoicing. A model with no price logs tokens and a null cost, which is
// honest — a guessed number is worse than an admitted gap.
const PRICES = {
  "gemini-flash-latest": { in: 0.30, out: 2.50 },
  "claude-haiku-4-5":    { in: 1.00, out: 5.00 },
  "claude-sonnet-5":     { in: 3.00, out: 15.00 },
};

const costOf = (model, tin, tout) => {
  const key = Object.keys(PRICES)
    .filter((k) => String(model || "").startsWith(k))
    .sort((a, b) => b.length - a.length)[0];        // longest prefix wins
  if (!key) return null;
  const p = PRICES[key];
  return Number((((tin || 0) * p.in + (tout || 0) * p.out) / 1e6).toFixed(6));
};

/** Fire-and-forget: a lesson plan must never fail because the meter did. */
export function recordUsage({ userId, facultyId, model, operation, tokensIn = 0, tokensOut = 0, credits = 0 }) {
  (async () => {
    try {
      await pool.query(
        `INSERT INTO usage_logs (user_id, model, operation, tokens_in, tokens_out, cost_usd)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [userId, model, operation, tokensIn, tokensOut, costOf(model, tokensIn, tokensOut)]
      );
      if (facultyId && credits > 0) {
        // GREATEST(0, …): a teacher who runs out mid-generation finishes
        // the one they are in rather than ending up owing the system.
        await pool.query(
          `UPDATE credits SET balance = GREATEST(0, balance - $2), updated_at = now()
            WHERE faculty_id = $1`,
          [facultyId, credits]
        );
      }
    } catch (e) {
      console.error("[usage]", e.message);
    }
  })();
}
```

---

## Checklist

- [ ] All four routes stream, with `X-Accel-Buffering: no`
- [ ] Gated on the `ai_studio` feature flag
- [ ] Missing key returns 503 `NO_AI_KEY`, not a 500 from inside a fetch
- [ ] `usage_logs` written on every call; the quiz path bills both
- [ ] `credits` decremented with `GREATEST(0, …)`
- [ ] Uploaded material fenced in `<material>` tags
- [ ] Client disconnect aborts the upstream request
- [ ] 429 and 503 reported as transient, not as stack traces
- [ ] Nothing writes `ai_studio` — the browser saves its own work

---

## 1.1b · The goal planner — `POST /api/studio/goal-plan`

The biggest generation in the product. A teacher hands over a whole
portion of a subject — a term, a unit, a book — and gets a week-by-week
teaching plan built the way an expert with THEIR profile would plan it.

The frontend is already live: goals are created browser-side into the
`goals` table (title, `timeline_days`, `material_ids`, and the teacher's
own description in `plan.brief`), attached files are in Storage with
`materials` rows pointing at them, and the screen calls this endpoint
and currently shows "not connected yet".

| Method | Path | Body |
|---|---|---|
| POST | `/api/studio/goal-plan` | `{ goal_id }` |

### What to do

1. Load the goal, check `faculty_id` is the caller's. 404 otherwise —
   not 403, which would confirm the id exists.
2. Ground the prompt in the teacher, not just the goal:
   - `faculty.expertise`, `eligible_grades`, `qualification`,
     `years_experience`, `bio`
   - their `teaching_skills` rows, when present
   - `plan.brief` — the teacher's own words about the class
3. Read the attached materials. `materials.extracted_text` when set;
   otherwise pull the file from Storage and extract (bytes path, as in
   [02](02-document-parsing.md)). Fence every document — same rule as
   always: an uploaded file that says "ignore the above" is a document
   saying something odd, not an instruction.
4. One structured call (`responseSchema`), asking for:

```jsonc
{
  "verdict": "One honest sentence: is this timeline realistic for this scope?",
  "weeks": [{
    "week": 1,
    "focus": "What this week is about",
    "lessons": [{ "title": "...", "objectives": ["..."], "outline": "..." }],
    "assets": [{ "kind": "quiz|homework|presentation|activity", "title": "..." }]
  }]
}
```

5. Write back: `goals.plan = { brief, weeks }` (keep the brief — it is
   the teacher's input, not yours to discard), `ai_verdict = verdict`,
   `status = 'active'`.
6. Return the updated goal row. The frontend swaps it in place.
7. Meter it (`operation: "goal.plan"`). This is the most expensive call
   in the product — charge more than one credit if credits are to mean
   anything.

### The verdict is not decoration

If six weeks of material is squeezed into two, say so in `verdict`
rather than emitting a plan that pretends. The teacher can change the
timeline and re-plan; a plan that silently overpacks weeks fails them in
front of a class.

### Assets are drafted lazily

Do NOT generate every week's lessons and quizzes up front — that is
dozens of model calls for material the teacher may reshape after week
one. The plan lists the assets; each is drafted on demand through the
normal `/api/studio/generate` path when the teacher reaches that week.
`goals.status` moves to `achieved` by the teacher's hand, not yours.
