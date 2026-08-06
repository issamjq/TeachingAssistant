// Safe localStorage access.
//
// The obvious guard is wrong on modern Node:
//
//     if (typeof localStorage === "undefined") return fallback;   // ✗
//
// Node 22+ ships an experimental global `localStorage`, so during Next's
// server prerender `typeof localStorage` is "object" while `getItem` is
// undefined — the guard passes and the very next line throws
// "localStorage.getItem is not a function". That's invisible while everything
// renders with ssr:false and only appears the moment a route is server-
// rendered for real, which is exactly what peeling a route does.
//
// `typeof window === "undefined"` is the reliable server check. The try/catch
// additionally covers Safari private mode, where localStorage exists and
// throws on write.
//
// Every module that reads or writes browser storage should go through here.

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readStorage(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    store()?.setItem(key, value);
  } catch {
    /* quota exceeded, private mode, or no window — non-fatal */
  }
}

export function removeStorage(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Read and JSON.parse, returning `fallback` on absence or malformed data. */
export function readJSON<T>(key: string, fallback: T): T {
  const raw = readStorage(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    writeStorage(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
