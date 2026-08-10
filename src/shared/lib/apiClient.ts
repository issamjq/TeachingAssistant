// The typed HTTP client. Every network call in the app goes through here.
//
// Extracted from views/_shared.jsx, which still re-exports `api` so the
// legacy views keep working unchanged. Behaviour is identical — this adds
// types, a typed error, and a single place to reason about auth headers.
//
// Most paths no longer make a request at all. Data lives in Supabase and
// the browser reads and writes it directly, with RLS doing the
// authorisation the API used to do in middleware — see lib/data/index.ts
// for what moved and what did not.
//
// What still goes over HTTP is what needs a secret or a privilege the
// browser must never hold: AI generation, CV parsing, the auth
// bootstrap, and the privileged consoles. Those keep the same behaviour
// they always had, including the single-device session header.

import { API_BASE } from "@/config/env";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  signal?: AbortSignal;
}

// Carries the server's status and error code so callers can branch on them
// without string-matching a message. The old code bolted these onto a plain
// Error, which meant every call site needed a cast to read them.
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// Fired once when the server reports this device was superseded. Signs out
// of Supabase, drops local state, and returns to landing with a one-time
// notice. Guarded so a burst of in-flight requests all 401-ing only triggers
// a single logout.
let _supersedeHandled = false;

async function handleSessionSuperseded(): Promise<void> {
  if (_supersedeHandled) return;
  _supersedeHandled = true;
  try {
    const [{ clearSessionId }, { clearAccount }, { clearRoute }, fb] =
      await Promise.all([
        import("@/lib/session"),
        import("@/lib/account"),
        import("@/lib/route"),
        import("@/lib/supabaseAuth"),
      ]);
    clearSessionId();
    try {
      await fb.signOut();
    } catch {
      /* ignore */
    }
    clearAccount();
    clearRoute();
    if (typeof window !== "undefined") {
      window.alert(
        "Signed out — your Murchid account was just opened on another device. " +
          "For security, an account stays active on only one device at a time."
      );
    }
  } catch {
    /* best-effort cleanup */
  }
}

/**
 * Call the Murchid API. Returns parsed JSON; throws {@link ApiError} on a
 * non-2xx response.
 *
 * @example
 *   const me = await api<Account>("/api/me");
 *   await api<Student, StudentInput>("/api/students", { method: "POST", body });
 */
/**
 * Normalise anything thrown by the data layer into the ApiError every
 * call site already handles.
 *
 * Supabase reports a policy refusal as PostgREST code 42501, which is
 * semantically a 403 — without this translation a screen that branches
 * on `status === 403` would see `undefined` and show its generic error.
 */
/**
 * Turn a bare policy refusal into something a teacher can act on.
 *
 * Postgres answers every RLS refusal with one code, 42501, whatever the
 * reason — so "you were signed out on another device" and "your plan
 * ended" are indistinguishable at the point of failure. The cause is
 * worked out afterwards, and only on a refusal, so the extra queries
 * cost nothing on the normal path.
 */
async function explainIfRefused(err: any): Promise<ApiError> {
  const base = asApiError(err);
  if (base.status !== 403 && err?.code !== "42501") return base;
  try {
    const { explainRefusal } = await import("@/lib/data/device");
    const { reason, message } = await explainRefusal();
    if (reason === "superseded") return new ApiError(message, 401, "session_superseded");
    if (reason === "subscription") return new ApiError(message, 402, "subscription_expired");
  } catch {
    /* diagnosis is a nicety; the refusal itself still stands */
  }
  return base;
}

function asApiError(err: any): ApiError {
  if (err instanceof ApiError) return err;
  const pg = err?.code;
  const status =
    err?.status ??
    (pg === "42501" ? 403 : pg === "PGRST116" ? 404 : pg === "23505" ? 409 : 500);
  const message =
    pg === "42501"
      ? "You don't have permission to do that."
      : err?.message || "Something went wrong.";
  return new ApiError(message, status, err?.code);
}

export async function api<TResponse = unknown, TBody = unknown>(
  path: string,
  { method = "GET", body, signal }: ApiOptions<TBody> = {}
): Promise<TResponse> {
  // Supabase first. A path it owns never reaches the network as HTTP —
  // it becomes a PostgREST call inside the client instead.
  //
  // `handled: false` rather than a throw is what let this be done a
  // surface at a time: anything unrecognised falls through to the API
  // exactly as before, so a typo still produces a 404 from the server
  // instead of a silent empty result.
  const { resolve } = await import("@/lib/data");
  try {
    const hit = await resolve(path, method, body);
    if (hit.handled) return hit.data as TResponse;
  } catch (err) {
    const apiErr = await explainIfRefused(err);
    if (apiErr.code === "session_superseded") await handleSessionSuperseded();
    throw apiErr;
  }

  // Lazy-loaded so modules importing `api` from a non-React context (init
  // scripts, tests) don't pull Supabase into their bundle.
  const { getIdToken } = await import("@/lib/supabaseAuth");
  const { getSessionId } = await import("@/lib/session");
  const token = await getIdToken().catch(() => null);
  const sessionId = getSessionId();

  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Single-device sign-in: prove this is the session the server last handed
  // out. A mismatch means the account signed in elsewhere.
  if (sessionId) headers["X-Session-Id"] = sessionId;

  const res = await fetch(API_BASE + path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty response */
  }

  if (!res.ok) {
    const payload = (data ?? {}) as { error?: string; code?: string };
    // The account was claimed by a newer sign-in on another device. Tear
    // this device's session down and bounce to the landing page.
    if (payload.code === "session_superseded") {
      await handleSessionSuperseded();
    }
    throw new ApiError(
      payload.error || `HTTP ${res.status}`,
      res.status,
      payload.code
    );
  }

  return data as TResponse;
}
