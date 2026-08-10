"use client";

// =====================================================================
// AI Studio — the chat
//
// The shape every teacher already knows: a thread, a composer, and what
// the model made rendered inside the conversation. What replaced a
// six-field wizard whose result landed on a separate screen.
//
// Three things are deliberate:
//
//   The KIND is a control, not a guess. "Make me something about
//   photosynthesis" could be a lesson, a quiz or a deck, and the shape
//   of the answer is the whole difference — so it is picked before
//   sending rather than inferred and got wrong.
//
//   Artifacts are viewers, not markdown. A deck gets slides with
//   prev/next, a quiz gets options with the answer marked, an attached
//   PDF gets a PDF viewer. Printing all three as text would be simpler
//   and would waste what each one is.
//
//   Saving is real TODAY. Generation needs the model key and therefore
//   the API service, but writing to the library goes browser → Supabase,
//   so anything on screen can be kept. When generation is unavailable
//   the studio says exactly that instead of failing quietly.
// =====================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send, Paperclip, X, Sparkles, Square, RotateCcw, Save, Check,
  FileText, GraduationCap, ClipboardList, Layers, Puzzle,
  PanelRightOpen, PanelRightClose, Plus, Trash2, MessageSquare,
} from "lucide-react";
import { api } from "@/views/_shared";
import { supabase } from "@/lib/supabaseClient";
import { facultyId } from "@/lib/data/session";
import { parseSections, renderMarkdown } from "@/lib/markdown";
import {
  ArtifactCard, MarkdownBody, QuizViewer, SlideViewer, SlideFullscreen, DocViewer, KIND_META,
} from "./artifacts";
import {
  listSessions, createSession, appendMessage, loadSession, deleteSession, purgeOld, KEEP_DAYS,
} from "./history";
import s from "./Studio.module.css";

const KINDS = [
  { value: "lesson_plan",  label: "Lesson",       icon: FileText },
  { value: "quiz",         label: "Quiz",         icon: GraduationCap },
  { value: "homework",     label: "Homework",     icon: ClipboardList },
  { value: "presentation", label: "Presentation", icon: Layers },
  { value: "activity",     label: "Activity",     icon: Puzzle },
];

const STARTERS = [
  { kind: "lesson_plan",  text: "A 45-minute Grade 7 lesson on photosynthesis, with a hands-on starter and an exit ticket." },
  { kind: "quiz",         text: "Ten questions on linear equations — word problems, not plug-and-chug." },
  { kind: "presentation", text: "An 8-slide intro deck on the water cycle for Grade 4." },
  { kind: "homework",     text: "Reading-comprehension homework on a short story for Grade 6 English." },
];

const safeName = (name) =>
  name.normalize("NFKD").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").slice(-80) || "file";

/** Pull a usable title out of whatever came back. */
/**
 * One shape for the structured half of a generation, whatever arrived.
 *
 * The viewers look for `.slides` and `.questions` at the top level. A
 * deck that arrives as a bare array, or wrapped as `{quiz:{questions}}`,
 * renders as nothing at all unless it is flattened first — which is
 * exactly how every generated deck once fell through to plain markdown.
 */
function normaliseArtifact(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) return { slides: raw };
  if (raw.quiz) return raw.quiz;
  if (raw.content && typeof raw.content === "object") return normaliseArtifact(raw.content);
  if (raw.slides || raw.questions) return raw;
  return null;
}

function titleOf(kind, text, structured) {
  if (structured?.title) return structured.title;
  const heading = (text || "").split(/\r?\n/).find((l) => /^#{1,3}\s+/.test(l));
  if (heading) return heading.replace(/^#+\s*/, "").trim();
  const first = (text || "").trim().split(/\r?\n/)[0];
  return first?.slice(0, 80) || KIND_META[kind]?.label || "Untitled";
}

export default function StudioChat({ initialKind = "lesson_plan" }) {
  const [turns, setTurns] = useState([]);
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState(initialKind);
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [presenting, setPresenting] = useState(null);

  // ── conversation history ───────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [railOpen, setRailOpen] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  // The id the CURRENT send belongs to. State would be a render behind:
  // a thread is created and its first two turns saved inside one call,
  // and setSessionId has not committed by the time they are written.
  const sessionRef = useRef(null);

  const refreshSessions = useCallback(() => {
    listSessions().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    refreshSessions();
    purgeOld();
  }, [refreshSessions]);

  // A narrow window opens with the rail closed: the studio is already
  // tight there, and a list of last week's work is not what a teacher
  // came for.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1100) setRailOpen(false);
  }, []);

  const openSession = async (id) => {
    if (id === sessionId) return;
    setLoadingThread(true);
    try {
      const turns_ = await loadSession(id);
      setSessionId(id);
      sessionRef.current = id;
      setTurns(turns_);
      setNotice(null);
      if (window.innerWidth <= 720) setRailOpen(false);
    } catch (e) {
      setNotice(`Couldn't open that conversation: ${e.message}`);
    } finally {
      setLoadingThread(false);
    }
  };

  const newChat = () => {
    abortRef.current?.abort();
    setSessionId(null);
    sessionRef.current = null;
    setTurns([]);
    setDraft("");
    setAttachments([]);
    setNotice(null);
    if (window.innerWidth <= 720) setRailOpen(false);
  };

  const removeSession = async (id, e) => {
    e.stopPropagation();
    const prev = sessions;
    setSessions((x) => x.filter((y) => y.session_id !== id));
    if (id === sessionId) newChat();
    try {
      await deleteSession(id);
    } catch (err) {
      setSessions(prev);                       // the delete failed; put it back
      setNotice(`Couldn't delete that: ${err.message}`);
    }
  };

  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const abortRef = useRef(null);

  // Two different rules, because sending and streaming are different
  // acts. Pressing send ALWAYS scrolls — the teacher just spoke and
  // should see it land, however far up they had scrolled. Streaming
  // only follows if they are already near the bottom: yanking the view
  // down while they read an earlier answer is the most irritating thing
  // a chat can do.
  const forceScroll = useRef(false);
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    // Nothing said yet means the opening screen, and on a phone that is
    // just tall enough to land inside the "near the bottom" window — so
    // the studio opened already scrolled past its own heading.
    if (!turns.length) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (forceScroll.current || near) {
      el.scrollTop = el.scrollHeight;
      forceScroll.current = false;
    }
  }, [turns]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const attach = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setNotice(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      const fid = await facultyId();
      for (const f of files) {
        if (f.size > 25 * 1024 * 1024) throw new Error(`"${f.name}" is over 25 MB.`);
        // Browser → Storage under the teacher's own session. A
        // server-side upload would need a service-role key, and nothing
        // in this system holds one.
        const path = `${uid}/studio/${Date.now()}-${safeName(f.name)}`;
        const { error } = await supabase.storage.from("imports").upload(path, f, {
          contentType: f.type || "application/octet-stream", upsert: false,
        });
        if (error) throw error;
        const { data: row } = await supabase
          .from("materials")
          .insert({ faculty_id: fid, file_name: f.name, file_path: path, mime_type: f.type, status: "uploaded" })
          .select("id").single();
        setAttachments((a) => [...a, { id: row?.id, name: f.name, path, mime: f.type }]);
      }
    } catch (err) {
      setNotice(err.message);
    } finally {
      setUploading(false);
    }
  };

  const send = useCallback(async (text, useKind) => {
    const prompt = (text ?? draft).trim();
    if (!prompt || busy) return;
    const k = useKind || kind;
    const atts = attachments;

    setDraft("");
    setAttachments([]);
    setNotice(null);
    setBusy(true);
    forceScroll.current = true;
    setTurns((t) => [
      ...t,
      { role: "user", text: prompt, attachments: atts },
      { role: "assistant", kind: k, text: "", streaming: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    // Open a thread on the first message and save the teacher's words
    // straight away — before the generator is even called, so a prompt
    // survives a failure, a refresh or a closed tab.
    let sid = sessionRef.current;
    try {
      if (!sid) {
        const row = await createSession(prompt);
        sid = row.session_id;
        sessionRef.current = sid;
        setSessionId(sid);
        setSessions((x) => [row, ...x]);
      }
      appendMessage(sid, { role: "user", text: prompt });
    } catch (e) {
      // History is a convenience; losing it must never stop the work.
      console.warn("[studio] history unavailable:", e.message);
    }

    try {
      const { getIdToken } = await import("@/lib/supabaseAuth");
      const token = await getIdToken().catch(() => null);
      // Raw fetch, not api(): this is a stream, and the helper parses a
      // whole JSON body before returning.
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ kind: k, prompt, materials: atts.map((a) => ({ id: a.id, name: a.name })) }),
      });

      if (!res.ok || !res.body) {
        // With no API service configured the rewrite is absent and this
        // is Next's own 404 in HTML. Say which it is; a teacher should
        // not have to tell "not built" from "broken".
        let msg = "The studio couldn't reach the generator.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          if (res.status === 404) {
            msg = "Generation needs the Murchid API service, which isn't connected yet. " +
                  "Everything else here works — you can still attach materials and save what you write.";
          }
        }
        throw Object.assign(new Error(msg), { soft: true });
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", acc = "", structured = null, savedId = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!frame.startsWith("data:")) continue;
          let ev; try { ev = JSON.parse(frame.slice(5)); } catch { continue; }
          if (ev.type === "delta") {
            acc += ev.text;
            setTurns((t) => {
              const n = [...t];
              n[n.length - 1] = { ...n[n.length - 1], text: acc };
              return n;
            });
          } else if (ev.type === "artifact") {
            // The structured form of what was just written in prose: a
            // deck as slides, a quiz as questions. The service does not
            // send this yet (see todo/backend-integration.md, gap 5a) and
            // everything still works without it — the reply renders as
            // markdown. When it does arrive the deck and quiz viewers
            // light up with no further change here.
            structured = normaliseArtifact(ev.content ?? ev.artifact ?? ev);
          } else if (ev.type === "done") {
            // Normalise to ONE shape. The generator sends a quiz as
            // { quiz: { questions } } but a deck as { slides: [...] } —
            // storing whichever arrived raw meant the deck was an array
            // where the renderer looked for `.slides`, and every deck
            // silently fell through to plain markdown.
            structured = structured || normaliseArtifact(
              ev.quiz ? ev.quiz : ev.slides ? { slides: ev.slides } : ev.structured,
            );
            if (ev.id) savedId = ev.id;
          } else if (ev.type === "error") {
            throw Object.assign(new Error(ev.message), { soft: true });
          }
        }
      }

      setTurns((t) => {
        const n = [...t];
        n[n.length - 1] = { ...n[n.length - 1], text: acc, structured, streaming: false, done: true };
        return n;
      });
      appendMessage(sid, { role: "assistant", text: acc, kind: k, structured });
      // A row the service saved itself needs no second copy from here.
      if (savedId) setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, saved: true, artifactId: savedId } : x)));
      refreshSessions();
    } catch (err) {
      if (err.name === "AbortError") {
        setTurns((t) => {
          const n = [...t];
          const last = n[n.length - 1];
          if (last?.role === "assistant") n[n.length - 1] = { ...last, streaming: false, stopped: true };
          return n;
        });
      } else {
        setTurns((t) => {
          const n = [...t];
          // Drop the empty placeholder rather than leaving a blank reply
          // above the error.
          if (n[n.length - 1]?.role === "assistant" && !n[n.length - 1].text) n.pop();
          return [...n, { role: "error", text: err.message }];
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }, [draft, busy, kind, attachments, refreshSessions]);

  /** Keep an artifact. Goes browser → Supabase, so it works today. */
  const saveArtifact = async (turn, index) => {
    const body = { name: titleOf(turn.kind, turn.text, turn.structured), title: titleOf(turn.kind, turn.text, turn.structured) };
    const path = {
      lesson_plan: "/api/drafts", quiz: "/api/quizzes", homework: "/api/homework",
      presentation: "/api/presentations", activity: "/api/activities",
    }[turn.kind] || "/api/drafts";

    try {
      if (turn.kind === "quiz" && turn.structured?.questions) {
        await api("/api/quizzes/bulk", { method: "POST", body: { ...body, questions: turn.structured.questions } });
      } else {
        await api(path, {
          method: "POST",
          body: {
            ...body,
            main_activity: turn.text,
            instructions: turn.text,
            slides: turn.structured?.slides ?? undefined,
          },
        });
      }
      setTurns((t) => t.map((x, i) => (i === index ? { ...x, saved: true } : x)));
    } catch (e) {
      setNotice(`Couldn't save that: ${e.message}`);
    }
  };

  const empty = turns.length === 0;

  const when = (iso) => {
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 864e5);
    if (days === 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };

  return (
    <div className={s.withRail}>

      <div className={s.chatSide}>
        {!railOpen && (
          <button
            type="button" className={s.railToggle} onClick={() => setRailOpen(true)}
            aria-label="Show conversation history" title="Recent conversations"
          >
            <PanelRightOpen size={17} />
          </button>
        )}
        <div className={s.shell}>
      <div className={s.thread} ref={threadRef}>
        {empty ? (
          <div className={s.hero}>
            <h1 className={s.heroTitle}>
              What are we making, <em>today?</em>
            </h1>
            <p className="text-sm text-ink-soft mt-3">
              Describe it in your own words. Attach a chapter or a syllabus and it will be used.
            </p>
            <div className={s.starters}>
              {STARTERS.map((x) => (
                <button
                  key={x.text}
                  type="button"
                  className={s.starter}
                  onClick={() => { setKind(x.kind); send(x.text, x.kind); }}
                >
                  <span className={s.starterKind}>{KIND_META[x.kind].label}</span>
                  <span className={s.starterText}>{x.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={s.threadInner}>
            {turns.map((turn, i) => {
              if (turn.role === "user") {
                return (
                  <div key={i} className={s.turn} data-role="user">
                    <div>
                      {turn.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 justify-end mb-1.5">
                          {turn.attachments.map((a) => (
                            <span key={a.path} className={s.attach}>
                              <FileText size={12} className="text-accent flex-shrink-0" />
                              <span className="truncate">{a.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className={s.userBubble}>{turn.text}</div>
                    </div>
                  </div>
                );
              }

              if (turn.role === "error") {
                return (
                  <div key={i} className={s.turn}>
                    <span className={s.avatar}><Sparkles size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <div className={s.notice}>{turn.text}</div>
                    </div>
                  </div>
                );
              }

              const meta = KIND_META[turn.kind] || {};
              const slides = turn.structured?.slides;
              const questions = turn.structured?.questions;
              const showArtifact = turn.done && (slides || questions || turn.text);

              return (
                <div key={i} className={s.turn}>
                  <span className={s.avatar}><Sparkles size={15} /></span>
                  <div className="flex-1 min-w-0">
                    {turn.streaming && !turn.text && (
                      <div className={s.thinking} aria-label="Working">
                        <span className={s.thinkDot} /><span className={s.thinkDot} /><span className={s.thinkDot} />
                      </div>
                    )}

                    {/* While streaming, the text IS the answer. Once it
                        finishes, it becomes an artifact with the viewer
                        its kind deserves. */}
                    {turn.streaming && turn.text && (
                      <div className={s.reply}>
                        {renderMarkdown(turn.text)}
                        <span className={s.caret} aria-hidden="true" />
                      </div>
                    )}

                    {showArtifact && (
                      <ArtifactCard
                        kind={turn.kind}
                        title={titleOf(turn.kind, turn.text, turn.structured)}
                        actions={
                          <button
                            type="button"
                            className={s.chipBtn}
                            data-primary={!turn.saved}
                            disabled={turn.saved}
                            onClick={() => saveArtifact(turn, i)}
                          >
                            {turn.saved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save</>}
                          </button>
                        }
                      >
                        {slides ? (
                          <SlideViewer slides={slides} onFullscreen={(at) => setPresenting({ slides, at })} />
                        ) : questions ? (
                          <QuizViewer questions={questions} />
                        ) : (
                          <MarkdownBody markdown={turn.text} />
                        )}
                      </ArtifactCard>
                    )}

                    {turn.stopped && (
                      <p className="text-[12px] text-muted mt-2">Stopped.</p>
                    )}

                    {turn.done && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        <button
                          type="button" className={s.chipBtn}
                          onClick={() => send(`Rework that: `, turn.kind)}
                        >
                          <RotateCcw size={13} /> Ask for a change
                        </button>
                        {meta.section && (
                          <button
                            type="button" className={s.chipBtn}
                            onClick={() => { window.location.href = `/${meta.section}`; }}
                          >
                            Open {meta.label.toLowerCase()}s
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={s.composerWrap}>
        <div className={s.composer}>
          {notice && (
            <p className="text-[12.5px] text-crit px-4 pt-3">{notice}</p>
          )}

          {attachments.length > 0 && (
            <div className={s.attachRow}>
              {attachments.map((a) => (
                <span key={a.path} className={s.attach}>
                  <FileText size={12} className="text-accent flex-shrink-0" />
                  <span className="truncate flex-1">{a.name}</span>
                  <button type="button" aria-label={`Remove ${a.name}`}
                          onClick={() => setAttachments((x) => x.filter((y) => y.path !== a.path))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <textarea
            ref={inputRef}
            className={s.input}
            rows={1}
            value={draft}
            placeholder={`Describe the ${KIND_META[kind]?.label.toLowerCase() || "thing"} you need…`}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks — on a desktop. On a
              // phone Enter is a newline, because there is a send button
              // and no keyboard-shortcut habit.
              if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 640) {
                e.preventDefault();
                send();
              }
            }}
          />

          <div className={s.composerBar}>
            <button
              type="button" className={s.iconBtn} onClick={() => fileRef.current?.click()}
              disabled={uploading} aria-label="Attach a syllabus or chapter" title="Attach"
            >
              <Paperclip size={17} />
            </button>
            <input ref={fileRef} type="file" multiple accept="application/pdf,image/*"
                   className="hidden" onChange={attach} />

            <div className={s.kindRow}>
              {KINDS.map((k) => (
                <button
                  key={k.value} type="button" className={s.kindBtn}
                  data-on={kind === k.value} onClick={() => setKind(k.value)}
                  aria-pressed={kind === k.value}
                >
                  <k.icon size={13} /> {k.label}
                </button>
              ))}
            </div>

            <span className="flex-1" />

            {busy ? (
              <button type="button" className={s.send} onClick={() => abortRef.current?.abort()} aria-label="Stop">
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button type="button" className={s.send} disabled={!draft.trim()} onClick={() => send()} aria-label="Send">
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-muted text-center mt-2 max-w-[760px] mx-auto">
          Murchid drafts; you decide. Check anything before it reaches a class.
        </p>
      </div>

        </div>
      </div>

      {railOpen && <div className={s.railScrim} onClick={() => setRailOpen(false)} aria-hidden="true" />}

      {/* ── history ─────────────────────────────────────────────── */}
      <aside className={s.rail} data-open={railOpen} aria-label="Recent conversations" aria-hidden={!railOpen}>
        <div className={s.railPane}>
          <div className={s.railHead}>
            <span className={s.railTitle}>Recent</span>
            <button
              type="button" className={s.iconBtn} onClick={() => setRailOpen(false)}
              aria-label="Hide conversation history" title="Hide history"
            >
              <PanelRightClose size={16} />
            </button>
          </div>
          <button type="button" className={s.newChat} onClick={newChat}>
            <Plus size={15} className="text-accent flex-shrink-0" /> New conversation
          </button>
          <div className={s.railList}>
            {sessions.length === 0 ? (
              <p className={s.railEmpty}>
                Nothing yet. Conversations you have here are kept for {KEEP_DAYS} days — anything
                you save goes to your library and stays.
              </p>
            ) : (
              sessions.map((x) => (
                // Two sibling buttons in a plain row, not a button inside
                // a role="button". Nesting them made the row's accessible
                // name swallow the delete label, so a screen reader
                // announced one control offering both actions.
                <div
                  key={x.session_id}
                  className={s.railItem}
                  data-on={x.session_id === sessionId}
                >
                  <button
                    type="button"
                    className={s.railOpen}
                    onClick={() => openSession(x.session_id)}
                    aria-current={x.session_id === sessionId ? "true" : undefined}
                  >
                    <MessageSquare size={13} className="text-muted flex-shrink-0 mt-0.5 self-start" />
                    <span className={s.railItemText}>
                      <span className={s.railItemTitle}>{x.title || "Untitled"}</span>
                      <span className={s.railItemWhen}>{when(x.updated_at || x.created_at)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={s.railDel}
                    onClick={(e) => removeSession(x.session_id, e)}
                    aria-label={`Delete conversation: ${x.title || "Untitled"}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {presenting && (
        <SlideFullscreen
          slides={presenting.slides}
          start={presenting.at}
          onClose={() => setPresenting(null)}
        />
      )}
    </div>
  );
}
