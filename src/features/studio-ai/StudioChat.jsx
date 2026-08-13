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
  Plus, Trash2, MessageSquare, PanelLeftOpen, X as XIcon,
} from "lucide-react";
import { api } from "@/views/_shared";
import { supabase } from "@/lib/supabaseClient";
import { facultyId } from "@/lib/data/session";
import { parseSections, renderMarkdown } from "@/lib/markdown";
import {
  ArtifactCard, QuizViewer, SlideViewer, SlideFullscreen, DocViewer, KIND_META,
} from "./artifacts";
import { RewritableBody } from "./RewritableBody";
import { SkillsPicker } from "./SkillsPicker";
import {
  listSessions, createSession, appendMessage, loadSession, deleteSession, purgeOld, KEEP_DAYS,
} from "./history";
import { useContextPanelSlot } from "@/shared/shell/ContextPanel";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
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
  name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-80) || "file";

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
  // Multi-select: one prompt can come back as a lesson AND its quiz AND
  // the homework — the service plans the batch and streams each artifact
  // in canonical order. At least one kind stays on; the last one refuses
  // to toggle off rather than leaving the send button aimed at nothing.
  const [kinds, setKinds] = useState([initialKind]);
  const toggleKind = (v) =>
    setKinds((prev) => {
      if (prev.includes(v)) return prev.length > 1 ? prev.filter((x) => x !== v) : prev;
      const on = new Set([...prev, v]);
      return KINDS.map((k) => k.value).filter((x) => on.has(x)); // canonical order
    });
  // Which skill profiles ground generation. The picker reports here;
  // send() reads it. Saving a new approach bumps the version so the
  // picker refetches and the new skill appears selected.
  const skillSel = useRef(null);
  const [skillsVersion, setSkillsVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [presenting, setPresenting] = useState(null);

  // ── conversation history ───────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  // Desktop history lives in the shell's context panel — the second left
  // column — so its open/closed state and its width are the shell's, not
  // this screen's. What stays local is the phone drawer, which the shell
  // has no equivalent of.
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // The assistant's "make me a …" hand-off: seed the composer with the
  // action's payload so the teacher lands mid-thought rather than at a
  // blank box. Nothing is generated until they press send.
  useEffect(() => {
    import("@/shared/lib/assistantPrefill").then(({ takePrefill }) => {
      const pre = takePrefill("create_work");
      if (!pre) return;
      const text = [pre.prompt, pre.topic, pre.title, pre.description]
        .find((v) => typeof v === "string" && v.trim());
      if (text) setDraft(String(text).trim());
      if (typeof pre.kind === "string" && KIND_META[pre.kind]) setKinds([pre.kind]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A narrow window opens with the rail closed: the studio is already
  // tight there, and a list of last week's work is not what a teacher
  // came for.
  // Nothing to do on mount any more. The panel's width is the shell's
  // business and it persists the teacher's choice across sections; the
  // phone drawer starts closed. What used to live here force-closed the
  // rail below 1100px on every visit, overriding that choice.

  const openSession = async (id) => {
    if (id === sessionId) return;
    setLoadingThread(true);
    try {
      const turns_ = await loadSession(id);
      setSessionId(id);
      sessionRef.current = id;
      setTurns(turns_);
      setNotice(null);
      setDrawerOpen(false);
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
    setDrawerOpen(false);
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
    // A caller-supplied kind (starters, "ask for a change") targets one
    // format; otherwise the composer's whole selection goes as a batch.
    const ks = useKind ? [useKind] : kinds;
    const k = ks[0];
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
      // The shared SSE reader, not a hand-rolled one: it scans frames for
      // the `data:` line (a keep-alive comment or an `event:` line used
      // to make this parser drop the whole frame), separates a refusal
      // from a failure, and turns a code-less 404 into "not built yet".
      const { streamSSE } = await import("@/shared/lib/apiStream");

      // Generate is a batch protocol: `batch → status → scope →
      // artifact_start → delta(kind) → artifact → artifact_end → done`,
      // one start/end pair per requested kind. The composer's kind row
      // is a multi-select, so this is often a real batch — the handling
      // below rolls a new bubble per artifact, and each renders as its
      // own reply with its own viewer and Save.
      let acc = "", structured = null, savedId = null;
      let curKind = k;
      let open = true; // the placeholder bubble pushed at send time

      const patchLast = (fields) => setTurns((t) => {
        const n = [...t];
        n[n.length - 1] = { ...n[n.length - 1], ...fields };
        return n;
      });
      const finalizeTurn = () => {
        patchLast({ text: acc, structured, streaming: false, done: true, stage: null });
        appendMessage(sid, { role: "assistant", text: acc, kind: curKind, structured });
        open = false;
      };
      const startTurn = (kindNext) => {
        curKind = kindNext || curKind;
        acc = "";
        structured = null;
        setTurns((t) => [...t, { role: "assistant", kind: curKind, text: "", streaming: true }]);
        open = true;
      };

      await streamSSE("/api/studio/generate", {
        signal: controller.signal,
        refusalAsAnswer: true,
        body: {
          kinds: ks,
          prompt,
          materials: atts.map((a) => ({ id: a.id, name: a.name })),
          // Explicit only when the teacher narrowed the pick — "all
          // selected" omits the field so the service's assignment-aware
          // defaults decide. See todo/backend/08-skills-refinement.md.
          ...(skillSel.current && !skillSel.current.all ? { skill_ids: skillSel.current.ids } : {}),
        },
        onEvent: (ev) => {
          switch (ev.type) {
            case "batch":
            case "unread": {
              // Files the service could not read did not shape the
              // answer. Say so now, not after the teacher wonders why
              // the chapter was ignored.
              const names = (ev.unread_materials || []).join(", ");
              if (names) setNotice(`Couldn't read: ${names} — the reply was written without ${ev.unread_materials.length === 1 ? "it" : "them"}.`);
              break;
            }
            case "status":
              // The service says what it is doing before any prose
              // exists ("planning"). Shown in place of the empty bubble,
              // so a slow cold start reads as work rather than as a hang.
              patchLast({ stage: ev.stage || null });
              break;
            case "scope":
              // What the request resolved to (subject, grade, class).
              // Metadata rather than prose — kept on the turn so a
              // future header can show it; not rendered today.
              patchLast({ scope: ev.scope ?? ev });
              break;
            case "artifact_start":
              // Each artifact gets its own bubble; the first one reuses
              // the placeholder pushed at send time.
              if (!open) startTurn(ev.kind);
              else if (ev.kind && ev.kind !== curKind) { curKind = ev.kind; patchLast({ kind: ev.kind }); }
              break;
            case "delta":
              // Defensive rollover: a delta for a new kind with no
              // artifact_start between (older protocol variants).
              if (!open || (ev.kind && ev.kind !== curKind && !acc)) {
                if (!open) startTurn(ev.kind);
              }
              acc += ev.text || "";
              patchLast({ text: acc, stage: null });
              break;
            case "artifact":
              // The structured form of what was just written in prose —
              // a deck as slides, a quiz as questions. The viewers
              // prefer it over markdown when present.
              structured = normaliseArtifact(ev.content ?? ev.artifact ?? ev);
              break;
            case "artifact_end":
              finalizeTurn();
              break;
            case "done":
              // Normalise to ONE shape. The generator sends a quiz as
              // { quiz: { questions } } but a deck as { slides: [...] } —
              // storing whichever arrived raw meant the deck was an
              // array where the renderer looked for `.slides`, and every
              // deck silently fell through to plain markdown.
              structured = structured || normaliseArtifact(
                ev.quiz ? ev.quiz : ev.slides ? { slides: ev.slides } : ev.structured,
              );
              if (ev.id) savedId = ev.id;
              break;
            case "error":
              // Only refusals reach here (refusalAsAnswer) — the model
              // declining on purpose is a complete answer, not a failure
              // banner suggesting the teacher retry the same thing.
              acc = ev.message || "The studio can only make teaching material.";
              patchLast({ text: acc, stage: null });
              break;
          }
        },
      });

      // Close whatever is still open: the whole answer on the pre-batch
      // protocol (no artifact_end), a refusal, or a batch whose last end
      // frame never arrived.
      if (open) finalizeTurn();
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
  }, [draft, busy, kinds, attachments, refreshSessions]);

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

  // The teacher just kept something they liked — capture HOW it was made
  // as a reusable teaching skill. The service distils prompt + output
  // into a method profile; without it, a deterministic note (instruction
  // + reference excerpt) is still worth saving. Either way the row goes
  // browser→Supabase and future generations can be grounded in it.
  const captureSkill = async (turn, index) => {
    if (turn.skillSaving || turn.skillSaved) return;
    const promptText = (() => {
      for (let j = index - 1; j >= 0; j--) if (turns[j]?.role === "user") return turns[j].text;
      return "";
    })();
    const title = titleOf(turn.kind, turn.text, turn.structured);
    const label = (KIND_META[turn.kind]?.label || "material").toLowerCase();
    setTurns((t) => t.map((x, i) => (i === index ? { ...x, skillSaving: true } : x)));
    let name = `Approach: ${title}`.slice(0, 40);
    let profile = "";
    try {
      const { streamSSE } = await import("@/shared/lib/apiStream");
      let acc = "", done = null;
      await streamSSE("/api/studio/skill-profile", {
        body: {
          source: "artifact",
          artifact: { kind: turn.kind, prompt: promptText, content: (turn.text || "").slice(0, 8000) },
        },
        onEvent: (ev) => {
          if (ev.type === "delta" && typeof ev.text === "string") acc += ev.text;
          else if (ev.type === "done") done = ev;
        },
      });
      profile = String(done?.skill_profile || acc).trim();
      if (done?.name) name = String(done.name).slice(0, 60);
    } catch {
      /* distillation unavailable — fall through to the deterministic note */
    }
    if (!profile) {
      profile =
        `# Approach — ${title}\n\n` +
        `_Saved from an AI Studio ${label} the teacher wanted to reuse._\n\n` +
        `## The instruction that produced it\n\n${promptText || "(not recorded)"}\n\n` +
        `## How to reproduce it\n\nMatch the structure, difficulty and tone of the reference below when making similar ${label}s.\n\n` +
        `## Reference\n\n${(turn.text || "").slice(0, 2000)}`;
    }
    try {
      await api("/api/skills", {
        method: "POST",
        body: { name, source_type: "generation", skill_profile: profile },
      });
      setTurns((t) => t.map((x, i) => (i === index ? { ...x, skillSaving: false, skillSaved: true } : x)));
      setSkillsVersion((v) => v + 1); // the picker refetches; new skill arrives selected
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === index ? { ...x, skillSaving: false } : x)));
      setNotice(`Couldn't save the approach: ${e.message}`);
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

  // Which home the conversation list gets. Below md the shell's context
  // panel is not rendered at all, so the same list opens as a drawer.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const historySlot = useContextPanelSlot("Conversations", sessions.length);

  // ONE list, rendered into whichever home applies. Extracting it is what
  // lets the panel and the drawer stay honestly identical rather than two
  // copies that drift.
  const conversationList = (
    <>
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
            // Two sibling buttons in a plain row, not a button inside a
            // role="button". Nesting them made the row's accessible name
            // swallow the delete label, so a screen reader announced one
            // control offering both actions.
            <div
              key={x.session_id}
              className={s.railItem}
              data-on={x.session_id === sessionId}
            >
              <button
                type="button"
                className={s.railOpen}
                onClick={() => { openSession(x.session_id); setDrawerOpen(false); }}
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
    </>
  );

  return (
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
                  onClick={() => { setKinds([x.kind]); send(x.text, x.kind); }}
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
                        {turn.stage && (
                          <span className="text-[12px] text-muted ms-1">
                            {turn.stage === "planning" ? "planning the material" : turn.stage}
                          </span>
                        )}
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
                          // Prose artifacts can be rewritten a section at a
                          // time (/api/studio/regenerate). A rewrite makes
                          // the turn saveable again — the library copy
                          // would otherwise be the stale text.
                          <RewritableBody
                            markdown={turn.text}
                            kind={turn.kind}
                            onChange={(next) =>
                              setTurns((t) => t.map((x, j) => (j === i ? { ...x, text: next, saved: false } : x)))
                            }
                          />
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
                        {/* They kept it because they loved it — that is the
                            moment to keep the METHOD too. */}
                        {turn.saved && (
                          turn.skillSaved ? (
                            <span className={s.chipBtn} aria-disabled="true">
                              <Check size={13} /> Approach saved to Teaching skills
                            </span>
                          ) : (
                            <button
                              type="button"
                              className={s.chipBtn}
                              data-primary
                              disabled={turn.skillSaving}
                              onClick={() => captureSkill(turn, i)}
                            >
                              <GraduationCap size={13} />
                              {turn.skillSaving ? "Capturing the approach…" : "Loved it? Save this approach as a skill"}
                            </button>
                          )
                        )}
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
            placeholder={
              kinds.length === 1
                ? `Describe the ${KIND_META[kinds[0]]?.label.toLowerCase() || "thing"} you need…`
                : `Describe it once — you'll get ${kinds.map((v) => KIND_META[v]?.label.toLowerCase()).join(" + ")}…`
            }
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
                  data-on={kinds.includes(k.value)} onClick={() => toggleKind(k.value)}
                  aria-pressed={kinds.includes(k.value)}
                  title={kinds.includes(k.value) && kinds.length === 1 ? `${k.label} — at least one format stays on` : `Toggle ${k.label.toLowerCase()}`}
                >
                  <k.icon size={13} /> {k.label}
                </button>
              ))}
            </div>

            <SkillsPicker version={skillsVersion} onSelection={(sel) => { skillSel.current = sel; }} />

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

      {/* ── conversations ───────────────────────────────────────────
          One list, two homes. On a laptop it is portalled into the
          shell's context panel so it sits beside the nav, in the same
          place on every visit and at a width this screen does not
          control. On a phone there is no room for a second column, so the
          same component opens as a drawer over the thread. */}
      {isDesktop ? (
        historySlot.render(conversationList)
      ) : (
        <>
          <button
            type="button"
            className={s.drawerBtn}
            onClick={() => setDrawerOpen(true)}
            aria-label="Show conversations"
          >
            <PanelLeftOpen size={16} />
            <span>{sessions.length || ""}</span>
          </button>
          {drawerOpen && (
            <div className={s.drawerScrim} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          )}
          <aside className={s.drawer} data-open={drawerOpen} aria-label="Conversations" aria-hidden={!drawerOpen}>
            <div className={s.drawerHead}>
              <span className={s.drawerTitle}>Conversations</span>
              <button
                type="button"
                className={s.iconBtn}
                onClick={() => setDrawerOpen(false)}
                aria-label="Hide conversations"
              >
                <XIcon size={16} />
              </button>
            </div>
            {conversationList}
          </aside>
        </>
      )}

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
