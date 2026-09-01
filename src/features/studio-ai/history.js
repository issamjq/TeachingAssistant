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

const SESSION_COLS = "session_id, title, created_at, updated_at, pinned_at";

/** A short label from the teacher's own first sentence. */
export function titleFrom(text) {
  const line = String(text || "").trim().split(/\r?\n/)[0] || "New conversation";
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

/**
 * The teacher's studio threads: pinned first, then newest.
 *
 * Two keys, not one. `updated_at` alone is the right default and the
 * wrong permanent answer — the thread she returns to all week is the one
 * she has not touched today, so it sinks under the ones she has. Pinned
 * rows sort among THEMSELVES by when they were pinned, so a new pin goes
 * to the top of the pins rather than into the middle of them according
 * to when it was last edited.
 */
export async function listSessions(limit = 40) {
  const { data, error } = await supabase
    .from("chatbot_sessions")
    .select(SESSION_COLS)
    .eq("page_scope", "studio")
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/**
 * Keep it at the top, or stop.
 *
 * Pinning is not editing, and the rail's order is the teacher's memory
 * of when she last worked on something — so a pin must not rewrite it.
 * Writing only `pinned_at` is not enough to guarantee that: a BEFORE
 * UPDATE trigger stamps `updated_at` on every write to this table
 * whatever it touched, so unpinning flung a four-day-old thread to the
 * top of the unpinned list. The trigger now skips updates that change
 * only the pin (db/tune.sql §94); this function relies on that.
 */
export async function setPinned(id, pinned) {
  const { data, error } = await supabase
    .from("chatbot_sessions")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("session_id", id)
    .select(SESSION_COLS)
    .single();
  if (error) throw error;
  return data;
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
      /**
       * The batch id rides along inside `artifact`.
       *
       * A lesson is three documents that only belong together because they
       * share a batch. Reloading the page dropped that, so a restored thread
       * showed three unrelated documents: the per-document Save buttons came
       * back and the single "save & schedule" offer jumped to the first card
       * instead of sitting after the last.
       *
       * Stored in the existing jsonb rather than as a new column, because
       * this is the shape the row already carries and a migration for one
       * identifier is not worth the schema churn.
       */
      artifact:
        turn.structured || turn.batchId
          ? { ...(turn.structured ? { structured: turn.structured } : {}), batch_id: turn.batchId ?? null }
          : null,
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
    /**
     * A note is not a document.
     *
     * "Moved to Thursday, 13:00" is stored as an assistant turn because that
     * is what the column allows, but restoring it as one put a one-line
     * sentence inside an artifact card with a Save button under it. It goes
     * back to the plain note the chat renders it as.
     */
    /**
     * Three kinds of assistant turn, not one.
     *
     * A note ("Moved to Thursday, 13:00") and the agent's own speech are
     * both stored as assistant rows because that is what the column
     * allows, and restoring either as a document put a single sentence
     * inside an artifact card with a Save button under it.
     */
    role:
      m.role === "user"
        ? "user"
        : m.kind === "note"
          ? "note"
          : m.kind === "say"
            ? "say"
            : "assistant",
    text: m.content || "",
    kind: m.kind === "note" || m.kind === "say" ? undefined : m.kind || undefined,
    batchId: m.artifact?.batch_id ?? undefined,
    // The wrapper is storage, not content: a viewer looking for `.slides`
    // or `.questions` must not be handed the envelope they arrived in.
    structured: m.artifact?.structured ?? (m.artifact?.batch_id ? null : m.artifact) ?? null,
    // Reopened turns are finished by definition, so they render as
    // artifacts rather than as something mid-stream.
    done: m.role !== "user",
    /**
     * Loaded from history, not made just now.
     *
     * A restored turn cannot know whether it was ever kept — that lives on
     * the row in the library, not in the transcript. Offering "save &
     * schedule" on it again is how a lesson she filed yesterday grew a live
     * button today, and pressing it would have written a second copy.
     */
    restored: m.role !== "user",
  }));
}

/**
 * Her words, not the generator's.
 *
 * A thread is titled from its first sentence, which is a guess that is
 * usually good and sometimes not — "hello" is a real row in this table.
 * This is how she overrules it, so the text is taken AS TYPED rather
 * than through titleFrom(): that trims to the first line and clips at 60
 * for a sentence someone was writing to the studio, not naming a thread
 * with. Empty is refused instead of saved — a blank row in a list of
 * names is one she cannot find again.
 */
export async function renameSession(sessionId, title) {
  const clean = String(title || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (!clean) throw new Error("Give the conversation a name.");
  const { error } = await supabase
    .from("chatbot_sessions")
    .update({ title: clean })
    .eq("session_id", sessionId);
  if (error) throw error;
  return clean;
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
