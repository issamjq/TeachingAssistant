"use client";

// =====================================================================
// Studio conversations — saved, listed, reopened
//
// Threads live in chatbot_sessions / chatbot_messages with
// page_scope = 'studio', which keeps them clear of the site assistant's
// own conversations in the same tables.
//
// Everything here goes browser → Supabase under RLS. Unlike generation,
// history needs no model key and therefore no API service — so a teacher
// can lose their connection to the generator and still have every
// conversation they have had.
//
// Writes are fire-and-forget on purpose. A thread that fails to save is
// a thread the teacher cannot reopen later; a save that blocks the chat
// is a chat that stutters. The first is recoverable, the second is felt
// on every message.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";

/** How long a thread is kept. The artifacts themselves live in the
 *  library and are not affected — this is the conversation around them. */
const KEEP_DAYS = 30;

const SESSION_COLS = "session_id, title, created_at, updated_at";

/** A short label from the teacher's own first sentence. */
export function titleFrom(text) {
  const line = String(text || "").trim().split(/\r?\n/)[0] || "New conversation";
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

/** The teacher's studio threads, newest first. */
export async function listSessions(limit = 40) {
  const { data, error } = await supabase
    .from("chatbot_sessions")
    .select(SESSION_COLS)
    .eq("page_scope", "studio")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function createSession(title) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("You're not signed in.");
  const { data, error } = await supabase
    .from("chatbot_sessions")
    .insert({ user_id: uid, page_scope: "studio", title: titleFrom(title) })
    .select(SESSION_COLS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Append one turn.
 *
 * `updated_at` on the session is bumped separately so the history list
 * sorts by last activity rather than by when a thread was started — a
 * conversation returned to yesterday belongs at the top.
 */
export function appendMessage(sessionId, turn) {
  if (!sessionId) return;
  supabase
    .from("chatbot_messages")
    .insert({
      session_id: sessionId,
      role: turn.role === "user" ? "user" : "assistant",
      content: turn.text || "",
      kind: turn.kind || null,
      artifact: turn.structured ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn("[studio] turn not saved:", error.message);
    });

  supabase
    .from("chatbot_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .then(() => {});
}

/** Every turn in one thread, oldest first — the shape StudioChat renders. */
export async function loadSession(sessionId) {
  const { data, error } = await supabase
    .from("chatbot_messages")
    .select("id, role, content, kind, artifact, created_at")
    .eq("session_id", sessionId)
    .order("created_at")
    .limit(200);
  if (error) throw error;
  return (data || []).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    text: m.content || "",
    kind: m.kind || undefined,
    structured: m.artifact || null,
    // Reopened turns are finished by definition, so they render as
    // artifacts rather than as something mid-stream.
    done: m.role !== "user",
  }));
}

export async function renameSession(sessionId, title) {
  const { error } = await supabase
    .from("chatbot_sessions")
    .update({ title: titleFrom(title) })
    .eq("session_id", sessionId);
  if (error) throw error;
}

/** Messages cascade from the session, so one delete is enough. */
export async function deleteSession(sessionId) {
  const { error } = await supabase
    .from("chatbot_sessions").delete().eq("session_id", sessionId);
  if (error) throw error;
}

/**
 * Drop threads past the window.
 *
 * Opportunistic, on load, for the same reason the assistant's purge was:
 * a cron that has to be deployed and watched is a weaker guarantee than
 * a DELETE that runs whenever the feature is used.
 */
export function purgeOld() {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  supabase
    .from("chatbot_sessions")
    .delete()
    .eq("page_scope", "studio")
    .lt("updated_at", cutoff)
    .then(({ error }) => {
      if (error) console.warn("[studio] purge failed:", error.message);
    });
}

export { KEEP_DAYS };
