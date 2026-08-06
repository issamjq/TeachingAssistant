// Single-device sign-in — client side of the session-id handshake.
//
// On a successful sign-in the server hands back an `active_session_id`.
// We stash it here and echo it on every authed request via the
// X-Session-Id header (see shared/lib/apiClient.ts). When the same
// account signs in elsewhere, the server rotates the id; our stale id no
// longer matches and the next request comes back 401 `session_superseded`,
// which logs this device out. See backend/lib/auth.js.

const KEY = "murchid.session.id";

// Every access is wrapped: localStorage throws in Safari private mode and
// is absent during server rendering.
export function getSessionId(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function setSessionId(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function clearSessionId(): void {
  setSessionId(null);
}
