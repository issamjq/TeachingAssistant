// The assistant's hand-off to a form.
//
// /api/chat can answer with an `action` frame — "add a student named
// Omar", "put a quiz on Thursday" — but its write-tools never save;
// they pre-fill a form the teacher confirms. The widget parks the
// action's payload here and navigates; the target screen collects it on
// mount. sessionStorage, because the hand-off is one navigation long —
// it should not survive the tab.
export const PREFILL_KEY = "murchid.assistant.prefill";

/** Payloads older than this are stale — don't ambush a teacher later. */
const MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Collect (and consume) a parked payload for `action`, or null.
 *
 * Always removes what it matched — a prefill applies once. A payload
 * for a DIFFERENT action is left in place for its own screen.
 */
export function takePrefill(action: string): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.action !== action) return null;
    sessionStorage.removeItem(PREFILL_KEY);
    if (data.at && Date.now() - data.at > MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}
