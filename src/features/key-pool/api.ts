// The OpenRouter key pool, as the super-admin console sees it.
//
// Five endpoints on the separate backend (`/api/superadmin/keys*`). They
// are NOT answered by Supabase: the pool holds live credentials, so the
// key values live behind the service that dials them and never reach a
// browser. src/lib/data/index.ts lists these two paths as SERVER_ONLY,
// which is also what turns a cold backend into "needs the API service"
// instead of a bare 404.
//
// The rule the whole thing is built on: UNPROVEN MEANS KEEP. A key at
// its daily allowance and a revoked credential fail identically in a
// log and are opposites in fact, so a spent key rests, a refused key
// goes to probation, and nothing is ever deleted without a human. This
// module's job is to make that distinction visible — see keyState().
import { api } from "@/shared/lib/apiClient";

/** What the server stores. Not what the screen shows — see KeyState. */
export type KeyStatus = "active" | "probation" | "disabled";

export interface PoolKey {
  id: number;
  /** Stable for ever: never renumbered, never reused, outlives the key. */
  label: string;
  provider: string;
  status: KeyStatus;
  /** First 8 and last 4 characters. There is no endpoint that reveals more. */
  masked: string;
  /** Non-null and in the future = resting, not broken. */
  cooldown_until: string | null;
  last_ok_at: string | null;
  last_err_at: string | null;
  note: string | null;
  added_at: string;
}

export interface PoolSettings {
  /** 0–50. The floor a removal cannot cross. */
  min_active_keys: number;
  /** 5–2880. How long a key that hit its allowance rests. */
  cooldown_minutes: number;
}

export interface PoolEvent {
  label: string;
  event: string;
  detail: string | null;
  created_at: string;
}

export interface PoolSnapshot {
  /** What the rotation would reach for right now: active and not resting. */
  usable: number;
  keys: PoolKey[];
  settings: PoolSettings;
  events: PoolEvent[];
}

export interface RejectedKey {
  /** Already masked by the server — a rejected key is never stored or echoed. */
  key: string;
  reason: string;
}

export interface AddResult {
  added: number;
  labels: string[];
  rejected: RejectedKey[];
}

/** Everything the screen needs, in one call. */
export const getPool = (signal?: AbortSignal) =>
  api<PoolSnapshot>("/api/superadmin/keys", { signal });

/**
 * Add a paste. Slow by design: every key is probed with one tiny
 * completion through that key alone before it is stored, sequentially,
 * up to ~20s each. Deliberately passed no AbortSignal — a timeout here
 * would abandon a probe run that is still writing keys.
 */
export const addKeys = (keys: string, note?: string) =>
  api<AddResult, { keys: string; note?: string }>("/api/superadmin/keys", {
    method: "POST",
    body: note?.trim() ? { keys, note: note.trim() } : { keys },
  });

/** Change a key's state, or put a rested one back to work immediately. */
export const patchKey = (id: number, body: { status?: KeyStatus; clear_cooldown?: boolean }) =>
  api<{ label: string; status: KeyStatus }>(`/api/superadmin/keys/${id}`, {
    method: "PATCH",
    body,
  });

/** The only thing in the system that deletes a key. 409 at the floor. */
export const removeKey = (id: number) =>
  api<void>(`/api/superadmin/keys/${id}`, { method: "DELETE" });

export const saveSettings = (body: Partial<PoolSettings>) =>
  api<PoolSettings>("/api/superadmin/keys-settings", { method: "PATCH", body });

// ── Derived state ─────────────────────────────────────────────────────

/**
 * What a key IS right now, which is not the same as its `status`.
 *
 * `active` covers two opposite situations — in rotation, and resting
 * out a spent allowance — and resting is the most common state in a
 * healthy pool. A screen that paints it red has an admin deleting
 * working keys by Thursday, so the two are separated here rather than
 * at each render site.
 */
export type KeyState = "in_use" | "resting" | "refused" | "off";

export function keyState(k: PoolKey, now: number = Date.now()): KeyState {
  if (k.status === "disabled") return "off";
  if (k.status === "probation") return "refused";
  const until = k.cooldown_until ? Date.parse(k.cooldown_until) : NaN;
  return Number.isFinite(until) && until > now ? "resting" : "in_use";
}

export const STATE_LABEL: Record<KeyState, string> = {
  in_use: "In use",
  resting: "Resting",
  refused: "Refused",
  off: "Off",
};

/** The server splits on any whitespace or comma and drops duplicates. */
export const MAX_KEYS_PER_PASTE = 200;

export function splitKeys(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,]+/)) {
    const k = part.trim();
    if (k) seen.add(k);
  }
  return [...seen];
}
