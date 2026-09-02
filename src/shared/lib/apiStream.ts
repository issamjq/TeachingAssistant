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
//   data: {"type":"action","action":"navigate","where":"quizzes"}
//                                               chat only — something the
//                                               BROWSER must carry out
//   data: {"type":"delta","text":"Here are "}   the answer, in pieces
//   data: {"type":"done", …}                    generation adds kind/usage
//   data: {"type":"error","message":"…"}        in-band; HTTP was 200
//
// The error case is the one worth being careful about: a stream that
// fails after the headers cannot change its status code, so failures
// arrive as an event inside a 200. Treating only !res.ok as failure
// would show a teacher a silent, empty, apparently-successful answer.
// =====================================================================
import { apiBase } from "./apiBase";
import { ApiError } from "./apiClient";

export interface StreamEvent {
  type: "session" | "tool" | "action" | "delta" | "done" | "error" | string;
  text?: string;
  message?: string;
  name?: string;
  sessionId?: string;
  /** On `action` frames: what the browser is asked to do. */
  action?: string;
  [key: string]: unknown;
}

export interface StreamOptions {
  body?: unknown;
  signal?: AbortSignal;
  /** Called for every frame, in order. */
  onEvent: (event: StreamEvent) => void;
  /**
   * Forward `error` frames carrying `refusal: true` to onEvent instead of
   * failing the stream. A refusal is the model declining on purpose ("not
   * educational", "wrong tool") — for the studio that is a complete
   * answer to show, not an error banner inviting a retry.
   */
  refusalAsAnswer?: boolean;
  /**
   * Give up if the service has not answered AT ALL within this window.
   * Without it, a Render cold start that hangs (or a proxy that
   * blackholes the request) left the teacher watching a spinner forever.
   * Generous by design: a cold instance needs several seconds to wake,
   * and a false timeout costs a whole regeneration.
   */
  firstByteMs?: number;
  /**
   * Give up if the stream goes silent for this long MID-WRITE. The
   * generator emits keep-alive comments while thinking, so a long dead
   * silence means the connection is gone, not that the model is slow.
   */
  idleMs?: number;
}

/**
 * POST and read the reply as it is written.
 *
 * Resolves when the stream ends. Throws ApiError for a refusal before
 * the stream opened, and for an in-band `error` event after it did.
 */
export async function streamSSE(
  path: string,
  { body, signal, onEvent, refusalAsAnswer, firstByteMs, idleMs }: StreamOptions,
): Promise<void> {
  const { getIdToken } = await import("@/lib/supabaseAuth");
  const token = await getIdToken().catch(() => null);

  /**
   * The timeout aborts through its own controller, chained to the
   * caller's signal — so Stop still works, and a timeout is
   * distinguishable from the teacher pressing it.
   */
  const ctrl = new AbortController();
  const onCallerAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onCallerAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut: "first" | "idle" | null = null;
  const arm = (ms: number | undefined, why: "first" | "idle") => {
    clearTimeout(timer);
    if (!ms) return;
    timer = setTimeout(() => {
      timedOut = why;
      ctrl.abort();
    }, ms);
  };
  const timeoutError = () =>
    new ApiError(
      timedOut === "first"
        ? "The AI service took too long to answer. It may just be waking up — try again in a few seconds."
        : "The connection went quiet while the answer was being written.",
      504,
      "stream_timeout",
    );

  try {
    arm(firstByteMs, "first");
    let res: Response;
    try {
      res = await fetch(apiBase() + path, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body ?? {}),
      });
    } catch (e) {
      if (timedOut) throw timeoutError();
      // fetch's own vocabulary ("Failed to fetch") is browser-speak; a
      // network failure deserves a sentence a teacher can act on.
      if (e instanceof TypeError) {
        throw new ApiError(
          "Couldn't reach the AI service. Check your connection and try again.",
          0,
          "network",
        );
      }
      throw e;
    }

    if (!res.ok || !res.body) throw await refusal(res, path);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamError: ApiError | null = null;

    // Credit metering, collected as the stream runs. `generate` is a batch,
    // so it is charged per artifact (one per artifact_end, keyed on the kind
    // from its artifact_start); single-output endpoints charge once on `done`.
    // A refusal produces neither, so a declined request costs nothing.
    const meterKinds: string[] = [];
    let lastKind = "";
    let sawDone = false;

    // Headers are not an answer — a cold service returns them and then
    // thinks. The first-byte window covers up to the first actual chunk;
    // after that the idle window takes over, reset on every read.
    while (true) {
      let step: ReadableStreamReadResult<Uint8Array>;
      try {
        step = await reader.read();
      } catch (e) {
        if (timedOut) throw timeoutError();
        throw e;
      }
      arm(idleMs, "idle");
      const { done, value } = step;
      if (done) break;
      if (value) buffer += decoder.decode(value, { stream: true });

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
        if (refusalAsAnswer && event.refusal) {
          onEvent(event);
          continue;
        }
        streamError = new ApiError(event.message || "The generator stopped.", 502, "stream_error");
        continue;
      }
      if (event.type === "artifact_start" && typeof event.kind === "string") lastKind = event.kind;
      else if (event.type === "artifact_end") meterKinds.push(lastKind);
      else if (event.type === "done") sawDone = true;
      onEvent(event);
    }
  }

  /**
   * The browser does not bill.
   *
   * It used to charge here, once per artifact, from the price table —
   * back when the service charged a flat 1 credit and this was the only
   * meter with any idea what a thing cost. The service meters properly
   * now, from the tokens it actually spent, so this was charging a second
   * time on top: a lesson took 7 credits from the service and another 10
   * from here, and the teacher paid 17 for one lesson.
   *
   * It also should never have lived here. A meter in the browser is a
   * meter the person being charged can decline to run — and only the
   * service ever sees the token counts that decide the real price.
   */

    if (streamError) throw streamError;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
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
  /** `action` frames, in arrival order — things the browser must carry out. */
  actions: StreamEvent[];
  done: StreamEvent | null;
}

export async function streamText(
  path: string,
  body: unknown,
  opts: {
    signal?: AbortSignal;
    onText?: (full: string, delta: string) => void;
    onTool?: (name: string) => void;
    /**
     * An `action` frame is not part of the prose — it is the assistant
     * asking the BROWSER to do something (navigate, pre-fill a form,
     * change an accessibility setting). Dropping one silently makes the
     * assistant claim it did a thing that never happened.
     */
    onAction?: (event: StreamEvent) => void;
  } = {},
): Promise<StreamResult> {
  let text = "";
  let sessionId: string | null = null;
  const tools: string[] = [];
  const actions: StreamEvent[] = [];
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
      } else if (e.type === "action" && e.action) {
        actions.push(e);
        opts.onAction?.(e);
      } else if (e.type === "done") {
        done = e;
      }
    },
  });

  return { text, sessionId, tools, actions, done };
}
