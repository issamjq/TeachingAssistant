"use client";

// =====================================================================
// The wire to /api/chat
//
// One streaming POST. The reply arrives as SSE frames and is handed to
// the caller a token at a time, because the widget renders it as it
// lands — buffering the whole answer first would waste the only thing
// streaming buys.
//
// The session id is kept in sessionStorage rather than localStorage: a
// conversation belongs to a tab and to a sitting. The server drops it
// after seven days regardless, so persisting it beyond the tab would
// only resurrect a conversation the teacher had already walked away
// from.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";

const KEY = (scope) => `murchid.chat.${scope}`;

export const loadSessionId = (scope) => {
  try { return sessionStorage.getItem(KEY(scope)) || null; } catch { return null; }
};
export const saveSessionId = (scope, id) => {
  try { id ? sessionStorage.setItem(KEY(scope), id) : sessionStorage.removeItem(KEY(scope)); }
  catch { /* private browsing — the conversation just won't resume */ }
};

/**
 * Send one message and stream the answer.
 *
 * @param onEvent called for each frame: {type:"delta"|"tool"|"action"|"session"|"error"|"done"}
 * @returns an abort function, so closing the panel stops the stream
 */
export function sendMessage({ scope, message, sessionId, onEvent }) {
  const controller = new AbortController();

  (async () => {
    try {
      const headers = { "Content-Type": "application/json" };
      // Attach the session if there is one. Its presence is what makes
      // the server choose the studio personality — the scope is never
      // taken from the body, so a signed-out visitor cannot ask for the
      // tools by sending one.
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (token) {
          headers.Authorization = `Bearer ${token}`;
          const sid = localStorage.getItem("murchid.sessionId");
          if (sid) headers["X-Session-Id"] = sid;
        }
      } catch { /* signed out: the landing bot needs no token */ }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ message, sessionId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let msg = "The assistant isn't available right now.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch { /* non-JSON error body — the default says enough */ }
        onEvent({ type: "error", message: msg });
        return onEvent({ type: "done" });
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        // Frames end on a blank line and a single read can carry a
        // partial one, so the buffer is only consumed up to the last
        // complete frame.
        let i;
        while ((i = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!frame.startsWith("data:")) continue;
          try { onEvent(JSON.parse(frame.slice(5))); } catch { /* skip a torn frame */ }
        }
      }
      onEvent({ type: "done" });
    } catch (e) {
      if (e.name === "AbortError") return;
      onEvent({ type: "error", message: "Lost connection. Try again." });
      onEvent({ type: "done" });
    }
  })();

  return () => controller.abort();
}
