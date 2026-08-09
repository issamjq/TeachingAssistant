// =====================================================================
// /api/chat — the assistant, on the landing page and in the studio
//
// One endpoint, two personalities, decided by scope:
//
//   landing  no account, no tools. Explains the product.
//   studio   signed in, with tools that read and change the teacher's
//            own work.
//
// The reply streams as SSE for the same reason the studio's generator
// does: a teacher watching a blank box for six seconds assumes it is
// broken.
//
// Retention is deliberately short. Chat history is a convenience, not a
// record — so a session is kept for 7 DAYS and only turns worth keeping
// are written at all (see `worthKeeping`). The purge runs opportunistically
// rather than on a timer, because a cron that has to be deployed and
// watched is a worse guarantee than a DELETE that runs whenever anyone
// talks to the assistant.
// =====================================================================
import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { LANDING_PROMPT, STUDIO_PROMPT } from "../lib/chatKnowledge.js";
import { TOOL_DECLARATIONS, runTool } from "../lib/chatTools.js";
import { recordUsage } from "../lib/usage.js";

const router = Router();

const MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-latest";
const RETENTION_DAYS = 7;
/** How much of a conversation the model is given back. */
const HISTORY_TURNS = 16;
/** Stop a runaway tool loop. Four is enough for "find it, then act on it". */
const MAX_TOOL_HOPS = 4;

const hasKey = () => !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);

/**
 * Is this turn worth storing?
 *
 * The instruction was to keep only what is relevant, and the honest
 * reading is that "hi", "thanks" and "ok" are not worth a row. Anything
 * substantive, and anything that caused an action, is.
 */
const worthKeeping = (text, usedTool) =>
  usedTool || (typeof text === "string" && text.trim().length > 24);

/** Delete anything past the window. Cheap, indexed, and safe to over-call. */
async function purgeOld() {
  try {
    await pool.query(
      `DELETE FROM chatbot_sessions
        WHERE created_at < now() - ($1 || ' days')::interval`,
      [String(RETENTION_DAYS)]
    );
  } catch (e) {
    console.error("[chat] purge failed:", e.message);
  }
}

/** Find or start a session. Returns null if the id is not the caller's. */
async function resolveSession(sessionId, { userId, scope }) {
  if (sessionId) {
    const r = await pool.query(
      `SELECT session_id, user_id FROM chatbot_sessions WHERE session_id = $1::uuid`,
      [sessionId]
    );
    const row = r.rows[0];
    // A landing session has no owner and anyone holding the id may
    // continue it; a signed-in session must belong to the caller, or a
    // guessed uuid would read someone else's conversation.
    if (row && (row.user_id === null || row.user_id === userId)) return row.session_id;
  }
  const r = await pool.query(
    `INSERT INTO chatbot_sessions (user_id, page_scope) VALUES ($1, $2) RETURNING session_id`,
    [userId || null, scope]
  );
  return r.rows[0].session_id;
}

async function loadHistory(sessionId) {
  const r = await pool.query(
    `SELECT role, content FROM chatbot_messages
      WHERE session_id = $1::uuid ORDER BY created_at DESC LIMIT $2`,
    [sessionId, HISTORY_TURNS]
  );
  return r.rows.reverse().map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content || "" }],
  }));
}

function save(sessionId, role, content) {
  pool
    .query(
      `INSERT INTO chatbot_messages (session_id, role, content) VALUES ($1::uuid, $2, $3)`,
      [sessionId, role, content]
    )
    .catch((e) => console.error("[chat] message not saved:", e.message));
}

/** One streaming call to Gemini. Yields text chunks and function calls. */
async function* streamTurn({ contents, system, tools }) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: system }] },
        ...(tools ? { tools: [{ functionDeclarations: tools }] } : {}),
        generationConfig: { temperature: 0.6, maxOutputTokens: 1600 },
      }),
    }
  );
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    // Quota and capacity are facts about the provider, not bugs here,
    // and the teacher should be told something true and actionable
    // instead of a stack trace from someone else's API. Both are
    // genuinely transient, so both say "try again" and mean it.
    if (r.status === 429) {
      throw Object.assign(
        new Error("The assistant has hit its usage limit for now. Try again in a minute."),
        { soft: true }
      );
    }
    if (r.status === 503 || r.status === 500) {
      throw Object.assign(
        new Error("The assistant is busy right now. Give it a few seconds and ask again."),
        { soft: true }
      );
    }
    throw Object.assign(new Error(`Gemini ${r.status}: ${detail.slice(0, 200)}`), { detail });
  }

  // SSE frames can split across chunks, so buffer until a blank line.
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
      let j;
      try { j = JSON.parse(payload); } catch { continue; }
      const cand = j.candidates?.[0];
      for (const part of cand?.content?.parts || []) {
        if (part.text) yield { text: part.text };
        // The WHOLE part, not just part.functionCall. Gemini attaches a
        // thoughtSignature alongside the call and rejects the next turn
        // with 400 if it is not echoed back verbatim — so the part has to
        // travel as one piece rather than being rebuilt from its call.
        if (part.functionCall) yield { call: part.functionCall, part };
      }
      if (j.usageMetadata) yield { usage: j.usageMetadata };
    }
  }
}

router.post("/", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ error: "message is required" });
    if (message.length > 4000) {
      return res.status(400).json({ error: "That message is too long." });
    }
    if (!hasKey() || !process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "The assistant isn't configured on this server.",
        code: "NO_AI_KEY",
      });
    }

    // The scope is derived from whether the request is authenticated, not
    // taken from the body. A visitor cannot ask for the studio tools by
    // sending scope: "studio".
    const studio = !!req.account;
    const scope = studio ? "studio" : "landing";

    const sessionId = await resolveSession(req.body?.sessionId, {
      userId: req.account?.user_id || null,
      scope,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    send({ type: "session", sessionId });

    let system = studio ? STUDIO_PROMPT : LANDING_PROMPT;
    if (studio) {
      const t = req.account;
      system += `\n\nAbout this teacher: ${[
        t.first_name && `name ${t.first_name}`,
        t.majors?.length && `teaches ${t.majors.join(", ")}`,
        t.grade_levels?.length && `grades ${t.grade_levels.join(", ")}`,
        t.organization && `at ${t.organization}`,
      ].filter(Boolean).join("; ") || "no profile details yet"}. Today is ${new Date().toISOString().slice(0, 10)}.`;
    }

    const contents = [...(await loadHistory(sessionId)), { role: "user", parts: [{ text: message }] }];
    const ctx = { fid: req.account?.id, userId: req.account?.user_id };

    let full = "";
    let usedTool = false;
    let tin = 0, tout = 0;

    for (let hop = 0; hop <= MAX_TOOL_HOPS; hop++) {
      const calls = [];
      let turnText = "";
      for await (const ev of streamTurn({
        contents,
        system,
        tools: studio ? TOOL_DECLARATIONS : null,
      })) {
        if (ev.text) { turnText += ev.text; full += ev.text; send({ type: "delta", text: ev.text }); }
        if (ev.call) calls.push({ call: ev.call, part: ev.part });
        if (ev.usage) {
          tin = ev.usage.promptTokenCount || tin;
          tout = ev.usage.candidatesTokenCount || tout;
        }
      }
      if (!calls.length) break;

      usedTool = true;
      // The model's own turn must go back in before its results, or the
      // next hop sees answers to questions it never asked.
      contents.push({
        role: "model",
        parts: [
          ...(turnText ? [{ text: turnText }] : []),
          // Verbatim, signature included.
          ...calls.map((c) => c.part),
        ],
      });

      const responses = [];
      for (const { call: c } of calls) {
        send({ type: "tool", name: c.name });
        const result = await runTool(c.name, c.args, ctx);
        // A client directive is forwarded to the browser AND handed back
        // to the model, so it can say "opened your quizzes" truthfully.
        if (result?.client) send({ type: "action", ...result.client });
        responses.push({
          functionResponse: { name: c.name, response: { result: result ?? { ok: true } } },
        });
      }
      contents.push({ role: "user", parts: responses });

      if (hop === MAX_TOOL_HOPS) {
        send({ type: "delta", text: "\n\n(I stopped there — that took more steps than expected.)" });
      }
    }

    send({ type: "done" });
    res.end();

    // ---- after the response, none of which the teacher waits for -----
    if (worthKeeping(message, usedTool)) {
      save(sessionId, "user", message);
      if (full.trim()) save(sessionId, "assistant", full);
    }
    if (studio) {
      recordUsage({
        userId: req.account.user_id,
        facultyId: req.account.id,
        model: MODEL(),
        operation: "chat.studio",
        tokensIn: tin,
        tokensOut: tout,
        // Chat is cheap and constant; charging a credit per message would
        // make the assistant feel expensive to use, which defeats it.
        credits: 0,
      });
    }
    purgeOld();
  } catch (err) {
    if (res.headersSent) {
      // Mid-stream: the teacher already has part of an answer, so the
      // error goes down the same channel rather than killing the socket.
      console.error("[chat]", err.message);
      res.write(`data: ${JSON.stringify({
        type: "error",
        message: err.soft ? err.message : "Something went wrong answering that. Try again.",
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      return res.end();
    }
    handleErr(res, "POST /api/chat", err);
  }
});

/** The conversation so far, for a widget that was reopened. */
router.get("/:sessionId", async (req, res) => {
  try {
    const own = await pool.query(
      `SELECT user_id FROM chatbot_sessions WHERE session_id = $1::uuid`,
      [req.params.sessionId]
    );
    if (!own.rowCount) return res.status(404).json({ error: "Not found" });
    const owner = own.rows[0].user_id;
    if (owner && owner !== req.account?.user_id) {
      return res.status(404).json({ error: "Not found" });
    }
    const r = await pool.query(
      `SELECT role, content, created_at FROM chatbot_messages
        WHERE session_id = $1::uuid ORDER BY created_at LIMIT 100`,
      [req.params.sessionId]
    );
    res.json({ sessionId: req.params.sessionId, messages: r.rows });
  } catch (err) {
    handleErr(res, "GET /api/chat/:sessionId", err);
  }
});

export default router;
