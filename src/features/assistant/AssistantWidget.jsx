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
// Two personalities, chosen by where it is mounted:
//
//   landing  explains the product to a visitor with no account
//   studio   a working assistant that can read and change the teacher's
//            own lesson plans, register and timetable
//
// The server decides which by whether the request is authenticated, so
// the `scope` here only picks the greeting and the suggestions. It is
// not a permission.
// =====================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Send, Mic, Volume2, VolumeX, Accessibility, Sparkles } from "lucide-react";
import AccessibilityWidget from "@/views/AccessibilityWidget";
import { useI18n } from "@/lib/i18n";
import { useVoice } from "./useVoice";
import { sendMessage, loadSessionId, saveSessionId } from "./chatClient";
import s from "./Assistant.module.css";

const STARTERS = {
  landing: [
    "What is Murchid?",
    "How does it work?",
    "What does it cost?",
    "Is it right for my subject?",
  ],
  studio: [
    "What's on today?",
    "Draft a lesson plan",
    "How many students do I have?",
    "Show me my quizzes",
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

export default function AssistantWidget({ scope = "landing", onNavigate }) {
  const { t, dir } = useI18n?.() || { t: (k) => k, dir: "ltr" };
  const [portalRoot, setPortalRoot] = useState(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [doing, setDoing] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  const logRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  // The streaming reply is appended token by token; holding it in a ref
  // as well means the voice can read the finished text without waiting
  // for another render.
  const streamRef = useRef("");

  const lang = dir === "rtl" ? "ar" : "en";
  const voice = useVoice({
    lang,
    onFinal: (text) => setDraft((d) => (d ? `${d} ${text}` : text)),
  });

  useEffect(() => { setPortalRoot(document.body); }, []);
  useEffect(() => { setSessionId(loadSessionId(scope)); }, [scope]);

  // Follow the conversation as it grows, but only while it is growing —
  // yanking the view back down while a teacher is reading an earlier
  // answer is worse than a scrollbar left where they put it.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages, doing]);

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

  useEffect(() => () => abortRef.current?.(), []);

  const send = useCallback((text) => {
    const message = (text ?? draft).trim();
    if (!message || busy) return;
    voice.stop();
    voice.hush();
    setDraft("");
    setBusy(true);
    setDoing("thinking");
    streamRef.current = "";
    setMessages((m) => [...m, { role: "user", text: message }, { role: "assistant", text: "" }]);

    abortRef.current = sendMessage({
      scope, message, sessionId,
      onEvent: (ev) => {
        if (ev.type === "session") {
          setSessionId(ev.sessionId);
          saveSessionId(scope, ev.sessionId);
        } else if (ev.type === "delta") {
          streamRef.current += ev.text;
          setDoing(null);
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "assistant", text: streamRef.current };
            return next;
          });
        } else if (ev.type === "tool") {
          setDoing(ev.name.replace(/_/g, " "));
        } else if (ev.type === "action") {
          // Things only the browser can do. The model asked; the widget
          // carries it out.
          if (ev.action === "navigate") onNavigate?.(ev.where);
          if (ev.action === "set_accessibility") applyA11y(ev.settings);
        } else if (ev.type === "error") {
          setMessages((m) => {
            const next = [...m];
            // Replace the empty placeholder rather than adding a bubble
            // under it, or an error looks like a reply that failed twice.
            if (next[next.length - 1]?.role === "assistant" && !next[next.length - 1].text) next.pop();
            return [...next, { role: "error", text: ev.message }];
          });
        } else if (ev.type === "done") {
          setBusy(false);
          setDoing(null);
          voice.say(streamRef.current);
        }
      },
    });
  }, [draft, busy, scope, sessionId, onNavigate, voice]);

  const starters = STARTERS[scope] || STARTERS.landing;
  const greeting = scope === "studio"
    ? "Ask me anything, or tell me what to make. I can draft a lesson, look something up, or open a screen for you."
    : "Ask me anything about Murchid — what it does, how it works, or whether it fits how you teach.";

  const side = dir === "rtl" ? { left: 20, right: "auto" } : { right: 20, left: "auto" };

  if (!portalRoot) return null;

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
                <span>
                  {scope === "studio"
                    ? "I can make things for you — check them before you use them."
                    : "Answers come from Murchid's own documentation."}
                </span>
                <span>{voice.canListen ? "Mic works" : ""}</span>
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );

  return createPortal(<>{launcher}{panel}</>, portalRoot);
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
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
  } catch {
    /* private browsing: the change just doesn't stick */
  }
}
