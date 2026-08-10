# 06 · Studio assistant — `/api/chat` *(optional)*

The landing-page bot needs nothing from you: it answers from
`src/features/assistant/knowledge.json` in the browser, so it works
offline, cannot invent a price, and has no quota. Leave it alone.

The **studio** assistant is the one that needs a server — tool calling
that reads a teacher's work and creates real lesson plans. It existed and
worked; it was removed with the API. Recover it from git history in the
frontend repo:

```bash
git show <commit>:backend/routes/chat.js       > src/routes/chat.js
git show <commit>:backend/lib/chatTools.js     > src/lib/chatTools.js
git show <commit>:backend/lib/chatKnowledge.js > src/lib/chatKnowledge.js
git log --diff-filter=D --name-only -- backend/routes/chat.js   # find the commit
```

Requires [00 · Setup](00-setup.md).

## What it did

`POST /api/chat` with `{ message, sessionId? }`, streaming SSE:

```
{"type":"session","sessionId":"…"}
{"type":"delta","text":"…"}
{"type":"tool","name":"get_overview"}      while a tool runs
{"type":"action","action":"navigate","where":"quizzes"}
{"type":"done"}
```

Tools: `get_overview`, `list_work`, `list_students`, `get_schedule`,
`create_work`, `add_student`, `add_schedule_entry`, plus two the browser
carries out — `navigate` and `set_accessibility`.

## The four things that matter

**Scope is derived from authentication, never from the body.** A visitor
must not be able to ask for the tools by sending `scope: "studio"`.

**No delete tool.** A chatbot that can be argued into removing a term's
lesson plans is not worth the convenience, and the UI has delete with an
undo.

**Every query scoped to `req.account.id`, never to a tool argument.** A
model can be talked into passing another teacher's id; it cannot be
talked into changing `req.account`.

**Gemini's `thoughtSignature` must be echoed back verbatim.** It is
attached to a `functionCall` part, and the next turn is rejected with 400
without it. Rebuilding the part from its `functionCall` alone drops it —
which showed up as every tool running correctly and the assistant then
failing to say what it had done. Push the whole part.

```js
// wrong — drops the signature
contents.push({ role: "model", parts: calls.map(c => ({ functionCall: c })) });
// right
contents.push({ role: "model", parts: calls.map(c => c.part) });
```

## Retention

Seven days, and only turns worth keeping — "hi" and "thanks" are not a
record. The purge runs whenever anyone uses the assistant rather than on
a timer: a cron that has to be deployed and watched is a weaker guarantee
than a DELETE on every use.

```js
const worthKeeping = (text, usedTool) =>
  usedTool || (typeof text === "string" && text.trim().length > 24);

await pool.query(
  `DELETE FROM chatbot_sessions WHERE created_at < now() - interval '7 days'`);
```

`chatbot_messages` cascades from `chatbot_sessions`.

## Rate limiting

Reachable without an account if you also serve the landing scope, and
every message costs a model call. 40 per 5 minutes per IP was the
setting — loose enough for a real conversation, tight enough that a
script pointed at it does not spend your money.

## Checklist

- [ ] Scope from authentication, not the body
- [ ] No delete tool
- [ ] Tools scoped to `req.account.id`
- [ ] `thoughtSignature` echoed verbatim
- [ ] 7-day retention, relevant turns only
- [ ] Rate limited
- [ ] `usage_logs` written, as in [01](01-ai-studio.md)

## Subscription and credit gating

The assistant acts *as* the teacher, so it obeys the same limits:

- **Reads** (counts, lists, navigation, account questions) are always
  allowed — RLS already scopes them, and a lapsed teacher must still be
  able to ask "what happened to my account".
- **Creating work through a tool** costs credits exactly as the studio
  does: check `subscription_active()` semantics and the `credits`
  balance BEFORE the model call, decline in prose when the plan has
  lapsed ("your plan has ended — everything you made is still here"),
  and meter with `recordUsage` after. The browser-side assistant already
  answers plan/credit questions from live data; do not contradict it.
