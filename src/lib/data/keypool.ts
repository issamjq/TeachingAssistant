import { backendFetch } from "./backend";

export type KeyStatus = "active" | "probation" | "disabled";

export interface LlmKeyRow {
  id: number;
  label: string;
  provider: string;
  status: KeyStatus;
  masked: string;
  cooldown_until: string | null;
  last_ok_at: string | null;
  last_err_at: string | null;
  note: string | null;
  added_at: string;
}

export interface LlmKeyEvent {
  label: string;
  event: string;
  detail: string | null;
  created_at: string;
}

export interface KeyPoolSettings {
  min_active_keys: number;
  cooldown_minutes: number;
}

export interface KeyPoolSnapshot {
  usable: number;
  keys: LlmKeyRow[];
  settings: KeyPoolSettings;
  events: LlmKeyEvent[];
}

export function getKeyPool(): Promise<KeyPoolSnapshot> {
  return backendFetch<KeyPoolSnapshot>("/superadmin/keys");
}

export interface AddKeysResult {
  added: number;
  labels: string[];
  rejected: { key: string; reason: string }[];
}

export function addKeys(keysBlob: string, note?: string): Promise<AddKeysResult> {
  // Every key is probed (up to ~20s each) before being stored, sequentially
  // — a batch of ten can take a couple of minutes.
  return backendFetch<AddKeysResult>("/superadmin/keys", {
    method: "POST",
    body: { keys: keysBlob, note },
    timeoutMs: 5 * 60_000,
  });
}

export function updateKey(
  id: number,
  patch: { status?: KeyStatus; clear_cooldown?: boolean },
): Promise<{ label: string; status: KeyStatus }> {
  return backendFetch(`/superadmin/keys/${id}`, { method: "PATCH", body: patch });
}

export function removeKey(id: number): Promise<void> {
  return backendFetch(`/superadmin/keys/${id}`, { method: "DELETE" });
}

export function updateKeyPoolSettings(
  patch: Partial<KeyPoolSettings>,
): Promise<KeyPoolSettings> {
  return backendFetch("/superadmin/keys-settings", { method: "PATCH", body: patch });
}
