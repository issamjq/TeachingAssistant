// =====================================================================
// Server-sent events, for the endpoints that answer a token at a time
//
// api() reads a whole JSON body before it returns, which is exactly
// wrong for the two calls that matter most: generation and the
// assistant. Both are text/event-stream, and the entire point of them is
// that the first words arrive in under a second while the rest is still
// being written.
//
// The wire format is one JSON object per `data:` frame, frames separated
// by a blank line:
//
//   data: {"type":"session","sessionId":"…"}   chat only, always first
//   data: {"type":"tool","name":"get_schedule"} chat only, zero or more
//   data: {"type":"delta","text":"Here are "}   the answer, in pieces
//   data: {"type":"done", …}                    generation adds kind/usage
//   data: {"type":"error","message":"…"}        in-band; HTTP was 200
//
// The error case is the one worth being careful about: a stream that
// fails after the headers cannot change its status code, so failures
// arrive as an event inside a 200. Treating only !res.ok as failure
// would show a teacher a silent, empty, apparently-successful answer.
// =====================================================================
import { API_BASE } from "@/config/env";
import { ApiError } from "./apiClient";

export interface StreamEvent {
  type: "session" | "tool" | "delta" | "done" | "error" | string;
  text?: string;
  message?: string;
  name?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface StreamOptions {
  body?: unknown;
  signal?: AbortSignal;
  /** Called for every frame, in order. */
  onEvent: (event: StreamEvent) => void;
}

/**
 * POST and read the reply as it is written.
 *
 * Resolves when the stream ends. Throws ApiError for a refusal before
 * the stream opened, and for an in-band `error` event after it did.
 */
export async function streamSSE(path: string, { body, signal, onEvent }: StreamOptions): Promise<void> {
  const { getIdToken } = await import("@/lib/supabaseAuth");
  const token = await getIdToken().catch(() => null);

  const res = await fetch(API_BASE + path, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok || !res.body) throw await refusal(res, path);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamError: ApiError | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      // A frame may carry comment lines (": keep-alive") that keep an
      // idle proxy from closing the connection. Only `data:` is content.
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;

      let event: StreamEvent;
      try {
        event = JSON.parse(raw);
      } catch {
        continue; // a half-frame is not worth failing the whole answer over
      }
      if (event.type === "error") {
        streamError = new ApiError(event.message || "The generator stopped.", 502, "stream_error");
        continue;
      }
      onEvent(event);
    }
  }

  if (streamError) throw streamError;
}

/**
 * Why the stream never opened.
 *
 * The unimplemented-route case is worth separating: whether it arrives
 * as Next's own HTML 404 (no rewrite configured) or the service's own
 * `{"error":"Not found"}` (rewrite on, route absent), the teacher is
 * looking at a feature that is not built yet rather than one that broke.
 * "Not connected yet" and "broken" look identical unless it is said.
 */
async function refusal(res: Response, path: string): Promise<ApiError> {
  let payload: { error?: string; code?: string } | null = null;
  try {
    payload = await res.json();
  } catch {
    /* HTML, or empty */
  }

  // No `code` on a 404 means the route itself is absent, not that a
  // handler could not find a record — see the same test in apiClient.
  if (res.status === 404 && !payload?.code) {
    const { needsServer } = await import("@/lib/data");
    if (needsServer(path)) {
      return new ApiError(
        "This part of Murchid needs the API service, which isn't connected yet.",
        503,
        "no_backend",
      );
    }
  }
  return new ApiError(payload?.error || `HTTP ${res.status}`, res.status, payload?.code);
}

/**
 * The common case: collect the text, watch the tools go by.
 *
 * Returns everything the caller might want to keep — the prose, the
 * server's session id for the next turn, the tools it reached for, and
 * whatever the `done` frame carried.
 */
export interface StreamResult {
  text: string;
  sessionId: string | null;
  tools: string[];
  done: StreamEvent | null;
}

export async function streamText(
  path: string,
  body: unknown,
  opts: { signal?: AbortSignal; onText?: (full: string, delta: string) => void; onTool?: (name: string) => void } = {},
): Promise<StreamResult> {
  let text = "";
  let sessionId: string | null = null;
  const tools: string[] = [];
  let done: StreamEvent | null = null;

  await streamSSE(path, {
    body,
    signal: opts.signal,
    onEvent: (e) => {
      if (e.type === "delta" && typeof e.text === "string") {
        text += e.text;
        opts.onText?.(text, e.text);
      } else if (e.type === "session" && e.sessionId) {
        sessionId = e.sessionId;
      } else if (e.type === "tool" && e.name) {
        tools.push(e.name);
        opts.onTool?.(e.name);
      } else if (e.type === "done") {
        done = e;
      }
    },
  });

  return { text, sessionId, tools, done };
}
