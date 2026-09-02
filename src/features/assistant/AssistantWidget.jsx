"use client";

// =====================================================================
// The floating assistant — what the accessibility button became
//
// The corner button used to open a settings tray. It now opens a
// conversation, with those settings kept as a tab inside it: the
// accessibility controls were the one thing already living in that
// corner, and a teacher who has learned to look there for "make the text
// bigger" must still find it.
//
// It answers from knowledge.json, in the browser. There is no API call
// and no key: the facts about a product do not vary between visitors, so
// answering "what does this cost" is a lookup rather than a generation.
//
// That is not a reduced version of a server-backed bot — for this job it
// is the better one. It cannot invent a feature or a price, it cannot
// run out of quota, it answers instantly, and it works with the backend
// down. The failure mode that actually costs a sale is a confident wrong
// answer, and a lookup cannot produce one.
//
// Replies are still revealed a word at a time. Not theatre: a wall of
// text appearing whole is harder to start reading than one that arrives
// at the speed you read it, and it keeps the shape of the component the
// same for when the studio assistant is wired to the new backend.
// =====================================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Send, Mic, Volume2, VolumeX, Accessibility, Sparkles } from "lucide-react";
import AccessibilityWidget from "@/views/AccessibilityWidget";
import { useI18n } from "@/lib/i18n";
import { useVoice } from "@/shared/hooks/useVoice";
import { answerFor, suggestionsAfter } from "./answer";
import { matchNavigate, accountAnswer } from "./actions";
import { PREFILL_KEY } from "@/shared/lib/assistantPrefill";
import { useMounted } from "@/shared/hooks/useMounted";
import s from "./Assistant.module.css";

/**
 * What the assistant is doing while it is quiet.
 *
 * The API service announces each record it opens before it answers. Two
 * or three seconds of "Thinking" says nothing; "Checking your timetable"
 * tells a teacher the number about to appear came from their own
 * schedule rather than from a model's imagination — which is the whole
 * difference between an answer they act on and one they go and verify.
 *
 * Unmapped names fall back to a neutral phrase rather than leaking an
 * internal identifier into the conversation.
 */
const TOOL_LABEL = {
  get_overview: "Reading your dashboard",
  get_schedule: "Checking your timetable",
  list_students: "Opening your roster",
  get_students: "Opening your roster",
  list_artifacts: "Searching your library",
  get_library: "Searching your library",
  list_quizzes: "Looking through your quizzes",
  list_homework: "Checking homework",
  get_attendance: "Reading the register",
  get_grades: "Reading the gradebook",
  get_account: "Checking your plan",
};

const STARTERS = {
  landing: [
    "What is Murchid?",
    "How does it work?",
    "What does it cost?",
    "Is it right for my subject?",
  ],
  // Things the assistant genuinely does in the studio TODAY: it moves
  // the teacher anywhere, and it reads their live plan and credits.
  // Drafting on request still needs the API service.
  studio: [
    "How many credits do I have?",
    "Open the Goal planner",
    "What's the difference between Scheduler and Goal planner?",
    "Take me to my students",
  ],
};

/**
 * The smallest markdown that matters here: bold, italic, inline code and
 * bullets. A full parser would be a dependency and an XSS surface for
 * four constructs — and the text is rendered as React children, never as
 * HTML, so nothing the model returns can become markup.
 */
function Rich({ text }) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const lines = block.split("\n");
    const bullets = lines.every((l) => /^\s*[-*•]\s+/.test(l)) && lines.length > 0;
    if (bullets) {
      return (
        <ul key={bi}>
          {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>)}
        </ul>
      );
    }
    return <p key={bi} style={{ margin: bi ? "8px 0 0" : 0 }}>{inline(block)}</p>;
  });
}

function inline(str) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k++}>{t.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

/**
 * @param scope      picks the greeting and the suggestions, nothing more
 * @param onNavigate reserved. The assistant will be able to move the
 *   teacher around once the studio side is wired to the new backend;
 *   answering from a JSON file cannot decide to navigate.
 */
export default function AssistantWidget({ scope = "landing", onNavigate }) {
  const { t, dir } = useI18n?.() || { t: (k) => k, dir: "ltr" };
  // Portals cannot be server-rendered — see useMounted.
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [doing, setDoing] = useState(null);
  const [followUps, setFollowUps] = useState([]);

  const logRef = useRef(null);
  const inputRef = useRef(null);

  const lang = dir === "rtl" ? "ar" : "en";
  const voice = useVoice({
    lang,
    onFinal: (text) => setDraft((d) => (d ? `${d} ${text}` : text)),
  });

  // Follow the conversation as it grows, but only while it is growing —
  // yanking the view back down while a teacher is reading an earlier
  // answer is worse than a scrollbar left where they put it.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages, doing, followUps]);

  useEffect(() => {
    if (open && tab === "chat") {
      // Not on a phone: focusing a text field raises the keyboard and
      // swallows most of a panel that is already the whole screen.
      if (window.matchMedia("(min-width: 561px)").matches) {
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    }
  }, [open, tab]);

  // Escape closes; the launcher takes focus back so a keyboard user is
  // not dropped at the top of the document.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); voice.stop(); voice.hush(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, voice]);


  // Reveal an answer a word at a time, then stop. Held in a ref so a
  // second question can cancel the first mid-sentence.
  const typerRef = useRef(null);
  const stopTyping = useCallback(() => {
    if (typerRef.current) { clearInterval(typerRef.current); typerRef.current = null; }
  }, []);
  useEffect(() => stopTyping, [stopTyping]);

  // The server's own thread id for this conversation, so the assistant
  // remembers the previous turn. It comes back in the first frame of the
  // first reply; every later turn hands it back.
  const chatSessionRef = useRef(null);

  const send = useCallback((text) => {
    const message = (text ?? draft).trim();
    if (!message || busy) return;
    voice.stop();
    voice.hush();
    stopTyping();
    setDraft("");
    setBusy(true);
    setDoing("thinking");
    setMessages((m) => [...m, { role: "user", text: message }, { role: "assistant", text: "" }]);


    // Resolve the answer. In the studio two things outrank the knowledge
    // lookup: a request to GO somewhere (handled without any model — a
    // command is not a question), and a question about the teacher's own
    // plan or credits, which is answered from live data rather than
    // prose. Everything else falls through to the knowledge base.
    const resolveAnswer = async () => {
      if (scope === "studio") {
        const nav = matchNavigate(message);
        if (nav) {
          onNavigate?.(nav.section);
          return { full: nav.reply, topicId: null };
        }
        if (/credit|token|plan\b|trial|subscri|renew|expire|days left/i.test(message)) {
          const live = await accountAnswer();
          if (live) return { full: live, topicId: "pricing" };
        }

        // Inside the studio the assistant can answer about the teacher's
        // OWN term — how many students, what is on Thursday, which
        // homework is outstanding — because the API service can read it
        // and reason over it. knowledge.json cannot: it knows the
        // product, not the person.
        //
        // It streams, so this returns the finished text and skips the
        // typewriter below; re-typing prose that already arrived a word
        // at a time would only make it slower.
        try {
          const { streamText, AI_FIRST_BYTE_MS, AI_IDLE_MS } = await import("@/shared/lib/apiStream");
          let printed = "";
          const { text: full, sessionId } = await streamText(
            "/api/chat",
            { message, scope: "studio", sessionId: chatSessionRef.current || undefined },
            {
              firstByteMs: AI_FIRST_BYTE_MS,
              idleMs: AI_IDLE_MS,
              onText: (all) => {
                printed = all;
                setDoing(null);
                setMessages((m) => {
                  const next = [...m];
                  next[next.length - 1] = { role: "assistant", text: all };
                  return next;
                });
              },
              // Saying which record it opened is the difference between
              // a number a teacher trusts and one they have to go and
              // check for themselves.
              onTool: (name) => setDoing(TOOL_LABEL[name] || "Looking that up"),
              // The service asks; the browser acts. An unhandled action
              // is the assistant saying "I've opened that for you" while
              // nothing moves.
              onAction: (ev) => performAction(ev, onNavigate),
            },
          );
          if (sessionId) chatSessionRef.current = sessionId;
          if (full.trim()) return { full, topicId: null, alreadyShown: true };
          if (printed.trim()) return { full: printed, topicId: null, alreadyShown: true };
        } catch (err) {
          // The service being down must not take the assistant with it.
          // knowledge.json still answers everything about the product,
          // which is most of what is asked of it.
          console.warn("[assistant] falling back to local knowledge:", err.message);
        }
      }
      const { text, topicId } = answerFor(message);
      return { full: text, topicId };
    };

    // A beat before it starts. Instant is unsettling — it reads as a
    // canned response rather than an answer, which is precisely the
    // impression to avoid even when it IS a lookup.
    const begin = setTimeout(async () => {
      const { full, topicId, alreadyShown } = await resolveAnswer();
      setDoing(null);

      // A streamed answer is already on screen and already complete.
      if (alreadyShown) {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", text: full };
          return next;
        });
        setBusy(false);
        setFollowUps(suggestionsAfter(topicId));
        voice.say(full);
        return;
      }

      const words = full.split(/(\s+)/);
      let i = 0;
      typerRef.current = setInterval(() => {
        // Several tokens per tick: one word at a time is slower than
        // reading, which is worse than showing it all at once.
        i = Math.min(i + 3, words.length);
        const shown = words.slice(0, i).join("");
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", text: shown };
          return next;
        });
        if (i >= words.length) {
          stopTyping();
          setBusy(false);
          setFollowUps(suggestionsAfter(topicId));
          voice.say(full);
        }
      }, 16);
    }, 260);

    return () => clearTimeout(begin);
  }, [draft, busy, voice, stopTyping, scope, onNavigate]);

  const starters = STARTERS[scope] || STARTERS.landing;
  const greeting = scope === "studio"
    ? "Ask me how anything here works — planning a lesson, the register, the gradebook, uploading your own material."
    : "Ask me anything about Murchid — what it does, how it works, or whether it fits how you teach.";

  const side = dir === "rtl" ? { left: 20, right: "auto" } : { right: 20, left: "auto" };

  if (!mounted) return null;

  const launcher = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-label="Open the assistant"
      aria-expanded={open}
      title="Assistant"
      className={s.launcher}
      style={side}
    >
      {!open && <span className={s.pulse} aria-hidden="true" />}
      {open ? <X size={24} strokeWidth={2.2} /> : <MessageCircle size={26} strokeWidth={2} />}
    </button>
  );

  const panel = open && (
    <>
      <div className={s.scrim} onClick={() => setOpen(false)} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Murchid assistant"
        dir={dir}
        className={s.panel}
        style={side}
      >
        <header className={s.head}>
          <span className={s.mark}>
            <Sparkles size={19} strokeWidth={2.1} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className={s.title}>
              Ask <em>Murchid</em>
            </h2>
            <p className={s.sub}>
              {scope === "studio" ? "Your studio assistant" : "Here to explain how this works"}
            </p>
          </div>
          {voice.canSpeak && (
            <button
              type="button"
              className={s.iconBtn}
              data-on={voice.speechOn}
              onClick={() => { voice.setSpeechOn((v) => !v); voice.hush(); }}
              aria-pressed={voice.speechOn}
              aria-label={voice.speechOn ? "Turn off spoken replies" : "Read replies aloud"}
              title={voice.speechOn ? "Spoken replies on" : "Read replies aloud"}
            >
              {voice.speechOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          )}
          <button
            type="button"
            className={s.iconBtn}
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </header>

        <div className={s.tabs} role="tablist">
          <button
            type="button" role="tab" className={s.tab}
            aria-selected={tab === "chat"} onClick={() => setTab("chat")}
          >
            Chat
          </button>
          <button
            type="button" role="tab" className={s.tab}
            aria-selected={tab === "access"} onClick={() => setTab("access")}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Accessibility size={13} strokeWidth={2.4} />
              Accessibility
            </span>
          </button>
        </div>

        {tab === "access" ? (
          <div className={s.settings}>
            <AccessibilityWidget embedded />
          </div>
        ) : (
          <>
            <div className={s.log} ref={logRef}>
              {messages.length === 0 && (
                <>
                  <div className={s.row} data-role="assistant">
                    <div className={s.bubble}>{greeting}</div>
                  </div>
                  <div className={s.starters}>
                    {starters.map((q) => (
                      <button key={q} type="button" className={s.starter} onClick={() => send(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {messages.map((m, i) =>
                m.role === "error" ? (
                  <div key={i} className={s.error}>{m.text}</div>
                ) : (
                  <div key={i} className={s.row} data-role={m.role}>
                    <div className={s.bubble}>
                      {m.text ? <Rich text={m.text} /> : null}
                    </div>
                  </div>
                )
              )}

              {!busy && followUps.length > 0 && messages.length > 0 && (
                <div className={s.starters}>
                  {followUps.map((q) => (
                    <button key={q} type="button" className={s.starter} onClick={() => send(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {doing && (
                <div className={s.doing}>
                  <span className={s.dot} />
                  {doing === "thinking" ? "Thinking" : doing}
                </div>
              )}
            </div>

            <div className={s.composer}>
              <div className={s.inputRow}>
                <textarea
                  ref={inputRef}
                  className={s.input}
                  rows={1}
                  value={voice.listening && voice.interim ? `${draft} ${voice.interim}`.trim() : draft}
                  placeholder={voice.listening ? "Listening…" : "Ask anything…"}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    // Grow with the text, up to the CSS max-height.
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 116)}px`;
                  }}
                  onKeyDown={(e) => {
                    // Enter sends; Shift+Enter breaks the line. On a phone
                    // Enter should be a newline, because there is a send
                    // button right there and no keyboard shortcut culture.
                    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 560) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                {voice.canListen && (
                  <button
                    type="button"
                    className={s.mic}
                    data-on={voice.listening}
                    style={{ position: "relative" }}
                    onClick={() => (voice.listening ? voice.stop() : voice.listen())}
                    aria-pressed={voice.listening}
                    aria-label={voice.listening ? "Stop listening" : "Speak instead of typing"}
                    title={voice.listening ? "Stop listening" : "Speak"}
                  >
                    <Mic size={17} />
                  </button>
                )}
                <button
                  type="button"
                  className={s.send}
                  disabled={busy || !draft.trim()}
                  onClick={() => send()}
                  aria-label="Send"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className={s.hint}>
                {/* Two different assistants wearing one face. On the
                    landing page it is a lookup over knowledge.json, and
                    saying so is the honest claim. Signed in it can read
                    the teacher's own term, and telling them it is quoting
                    documentation would undersell the answer they just got. */}
                <span>
                  {scope === "studio"
                    ? "Answers use your own students, timetable and library."
                    : "Answers come from Murchid\u2019s own documentation."}
                </span>
                <span>{voice.canListen ? "Mic works" : ""}</span>
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );

  return createPortal(<>{launcher}{panel}</>, document.body);
}


/**
 * Carry out an `action` frame from /api/chat.
 *
 * The service's write-tools never save — they hand the teacher a
 * pre-filled form to confirm (see todo/backend/06-assistant.md). So every
 * action here resolves to at most: park the payload, move the teacher.
 * `navigate` and `set_accessibility` are the two the browser completes
 * by itself.
 */
function performAction(ev, onNavigate) {
  switch (ev.action) {
    case "navigate": {
      const where = ev.where || ev.section;
      if (where) onNavigate?.(String(where));
      return;
    }
    case "set_accessibility": {
      // Settings may arrive nested or flat; strip the frame's own keys.
      const { type: _t, action: _a, ...flat } = ev;
      applyA11y(ev.settings && typeof ev.settings === "object" ? ev.settings : flat);
      return;
    }
    case "create_work":
    case "add_student":
    case "add_schedule_entry": {
      try {
        sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ ...ev, at: Date.now() }));
      } catch { /* private browsing: the teacher just fills the form */ }
      const section =
        ev.action === "add_student" ? "database"
        : ev.action === "add_schedule_entry" ? "planner"
        : "studio"; // the studio composer reads the payload and drafts from it
      onNavigate?.(section);
      return;
    }
    default:
      // A new action this build doesn't know. Doing nothing visible is
      // correct; logging it is how the gap gets noticed.
      console.warn("[assistant] unhandled action frame:", ev.action);
  }
}

/**
 * Apply an accessibility change the assistant asked for.
 *
 * Writes the same localStorage key the settings panel owns and fires a
 * storage-like event, so the panel and the page pick it up without this
 * module having to reach into the widget's internals.
 */
function applyA11y(settings = {}) {
  const KEY = "murchid.a11y";
  try {
    const cur = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (String(settings.reset) === "true") {
      localStorage.removeItem(KEY);
    } else {
      const next = { ...cur };
      // Everything crosses the wire as text, because the tool schema is
      // strings — so "true"/"3" have to become true/3 here or the panel
      // stores a string where it expects a boolean and every check
      // silently passes.
      for (const [k, v] of Object.entries(settings)) {
        if (v === undefined || v === null || v === "") continue;
        if (v === "true" || v === "false") next[k] = v === "true";
        else if (/^\d+$/.test(String(v))) next[k] = Number(v);
        else next[k] = v;
      }
      localStorage.setItem(KEY, JSON.stringify(next));
    }
    window.dispatchEvent(new window.StorageEvent("storage", { key: KEY }));
  } catch {
    /* private browsing: the change just doesn't stick */
  }
}
