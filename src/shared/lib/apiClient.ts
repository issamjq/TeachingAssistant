// The typed HTTP client. Every network call in the app goes through here.
//
// Extracted from views/_shared.jsx, which still re-exports `api` so the
// legacy views keep working unchanged. Behaviour is identical — this adds
// types, a typed error, and a single place to reason about auth headers.
//
// Requests always go to the SAME ORIGIN: next.config.ts rewrites /api/* to
// the Express server, so there is no cross-origin preflight. API_BASE is
// empty except when deliberately pointing at a remote API (config/env.ts).

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
export async function api<TResponse = unknown, TBody = unknown>(
  path: string,
  { method = "GET", body, signal }: ApiOptions<TBody> = {}
): Promise<TResponse> {
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
