// =====================================================================
// Product telemetry — what people use, and where they get stuck
//
// The super-admin console could always say how many accounts exist and
// how many lessons they hold. It could not say which screens teachers
// actually open, or where they try something and fail, because nothing
// in the product wrote that down. A lesson row proves a generation
// finished; it is silent about the four teachers who opened the studio,
// pressed Generate, got a 500 and left.
//
// This is the thing that writes it down. It ships events to
// record_app_events() (db/tune.sql §95), which stamps auth.uid() itself
// — so the browser cannot attribute an event to anyone else, and cannot
// read one back.
//
// ── What it will NOT record ──────────────────────────────────────────
//
// No page content. No form values. No lesson titles, student names, or
// prompts. No URLs — a URL carries ids, so the section KEY is recorded
// instead ("quizzes", never "/quizzes/8f2c…"). The label attached to a
// click is the element's own name, capped at 80 characters and taken
// only from a button, link, tab or nav item — never from an input, and
// never from anything a teacher typed.
//
// That is not caution for its own sake: a heatmap needs to know that
// "studio → generate" is where people rage-click. Whose lesson it was
// adds nothing to that answer and everything to the cost of holding it.
//
// ── Why it batches ───────────────────────────────────────────────────
//
// A teacher moving through the studio produces a click every second or
// two. One round trip each would be a self-inflicted load test, so
// events queue and flush on a timer, at a size cap, and on the way out
// of the tab — the last of which is the one that matters, because the
// session that ends in a rage-quit is precisely the session worth
// having.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";

export type EventKind =
  | "view"
  | "dwell"
  | "click"
  | "rage_click"
  | "dead_click"
  | "error"
  | "slow"
  | "action"
  | "milestone"
  | "abandon";

interface Event {
  kind: EventKind;
  session_id: string;
  section?: string | null;
  target?: string | null;
  x?: string;
  y?: string;
  vw?: string;
  vh?: string;
  value?: string;
  meta?: Record<string, unknown>;
}

const SESSION_KEY = "murchid_tm_session";
const FLUSH_MS = 12_000;
const FLUSH_AT = 25;
/** Past this the queue is dropping the oldest. A tab offline for an hour
 *  should not come back and post an hour of clicks. */
const QUEUE_MAX = 150;

let queue: Event[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let currentSection: string | null = null;
let sectionEnteredAt = 0;
/** Set once a flush is refused for a reason retrying will not fix — a
 *  signed-out tab, or a database without §95 applied. Telemetry is the
 *  first thing to give up when it is in the way. */
let disabled = false;

/** One id per browser tab. sessionStorage, not localStorage: two tabs are
 *  two sessions, and closing the tab ends this one — which is what makes
 *  "how long is a session" answerable at all. */
function sessionId(): string {
  // Not shared/lib/storage: that one is localStorage by definition, and
  // the distinction is the whole point here. Same defensive shape — the
  // accessor itself throws in Safari's private mode.
  let id: string | null = null;
  try {
    id = window.sessionStorage?.getItem(SESSION_KEY) ?? null;
  } catch {
    /* private mode */
  }
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    try {
      window.sessionStorage?.setItem(SESSION_KEY, id);
    } catch {
      /* a session that lives only in this module is still one session */
    }
  }
  return id;
}

function schedule(): void {
  if (timer || disabled) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_MS);
}

function push(e: Omit<Event, "session_id">): void {
  if (disabled || typeof window === "undefined") return;
  queue.push({ ...e, session_id: sessionId() });
  if (queue.length > QUEUE_MAX) queue = queue.slice(-QUEUE_MAX);
  if (queue.length >= FLUSH_AT) void flush();
  else schedule();
}

/**
 * Send what is queued. Never throws and never rejects: a teacher's
 * console must not fill with telemetry failures, and a failed flush must
 * not fail whatever called it.
 */
export async function flush(): Promise<void> {
  if (disabled || queue.length === 0) return;
  const batch = queue;
  queue = [];
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  try {
    const { error } = await supabase.rpc("record_app_events", { p_events: batch });
    // 42883 is "function does not exist" — a deploy that ran ahead of
    // db:tune. Retrying it every twelve seconds forever helps nobody.
    if (error && (error.code === "42883" || error.code === "PGRST202")) disabled = true;
  } catch {
    /* offline, signed out, blocked — all fine, the events are gone */
  }
}

// ── resolving what was clicked ───────────────────────────────────────
//
// Walk up from the clicked node looking for something with a name worth
// recording. `data-tm` wins when a component sets one deliberately;
// otherwise a button/link/tab is named by its aria-label or its own text.
// Anything else resolves to null, and a click with no target still counts
// toward the heatmap by position.
const INTERACTIVE = "button, a, [role='button'], [role='tab'], [role='menuitem'], summary, label";

function labelOf(el: Element): string | null {
  const explicit = el.getAttribute("data-tm");
  if (explicit) return explicit.slice(0, 80);

  const aria = el.getAttribute("aria-label");
  const text = (aria || (el as HTMLElement).innerText || el.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;

  const tag = el.tagName.toLowerCase();
  const kind = tag === "a" ? "link" : el.getAttribute("role") || tag;
  return `${kind}:${text}`.slice(0, 80);
}

function resolveTarget(node: EventTarget | null): string | null {
  let el = node instanceof Element ? node : null;
  for (let i = 0; el && i < 6; i++) {
    if (el.hasAttribute("data-tm")) return labelOf(el);
    if (el.matches(INTERACTIVE)) return labelOf(el);
    el = el.parentElement;
  }
  return null;
}

const isInteractive = (node: EventTarget | null): boolean => {
  let el = node instanceof Element ? node : null;
  for (let i = 0; el && i < 6; i++) {
    if (
      el.matches(INTERACTIVE) ||
      el.matches("input, select, textarea, [contenteditable='true']")
    )
      return true;
    el = el.parentElement;
  }
  return false;
};

// ── the public surface ───────────────────────────────────────────────

/** A section was opened. Emits the dwell for the one being left. */
export function trackView(section: string): void {
  if (section === currentSection) return;
  if (currentSection) {
    push({
      kind: "dwell",
      section: currentSection,
      value: String(Math.max(0, Date.now() - sectionEnteredAt)),
    });
  }
  currentSection = section;
  sectionEnteredAt = Date.now();
  push({ kind: "view", section });
}

/** A named feature was used — what the adoption table counts. */
export function trackAction(feature: string, meta?: Record<string, unknown>): void {
  push({ kind: "action", section: currentSection, target: feature, meta: { feature, ...meta } });
}

/** An activation step was reached. */
export function trackMilestone(step: string): void {
  push({ kind: "milestone", section: currentSection, target: step });
}

/**
 * Something failed. `message` must be a CLASS of failure — "HTTP 500",
 * "no_backend" — never a message containing a teacher's data.
 */
export function trackError(message: string, where?: string): void {
  push({
    kind: "error",
    section: currentSection,
    target: where || null,
    meta: { message: String(message).slice(0, 200) },
  });
}

/** An operation the teacher waited on. Only worth recording past a second. */
export function trackTiming(what: string, ms: number): void {
  if (ms < 1000) return;
  push({ kind: "slow", section: currentSection, target: what, value: String(Math.round(ms)) });
}

/** A flow was started and left unfinished — the studio closed mid-generation. */
export function trackAbandon(flow: string, meta?: Record<string, unknown>): void {
  push({ kind: "abandon", section: currentSection, target: flow, meta });
}

// ── the listeners ────────────────────────────────────────────────────

/**
 * Attach the global listeners. Idempotent, and returns a teardown so a
 * remount does not double-count every click.
 */
export function startTelemetry(): () => void {
  if (started || typeof window === "undefined") return () => {};
  started = true;

  // Rage clicks: the same spot, three times, inside a second. The state
  // is three numbers rather than a list because that is all the rule
  // needs, and the burst is reported ONCE — a teacher hammering a dead
  // button eleven times is one act of frustration, not nine.
  let lastX = -999;
  let lastY = -999;
  let lastAt = 0;
  let burst = 0;
  let burstReported = false;

  const onClick = (ev: MouseEvent) => {
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const x = Math.min(Math.max(ev.clientX / vw, 0), 1);
    const y = Math.min(Math.max(ev.clientY / vh, 0), 1);
    const target = resolveTarget(ev.target);
    const now = Date.now();

    const near = Math.abs(ev.clientX - lastX) < 32 && Math.abs(ev.clientY - lastY) < 32;
    if (near && now - lastAt < 900) {
      burst++;
    } else {
      burst = 1;
      burstReported = false;
    }
    lastX = ev.clientX;
    lastY = ev.clientY;
    lastAt = now;

    const common = {
      section: currentSection,
      target,
      x: x.toFixed(4),
      y: y.toFixed(4),
      vw: String(vw),
      vh: String(vh),
    };

    if (burst >= 3 && !burstReported) {
      burstReported = true;
      push({ kind: "rage_click", ...common, value: String(burst) });
      return;
    }
    if (burstReported) return; // still inside a burst already reported

    push({ kind: "click", ...common });

    // Dead click: a click on something that is not interactive AND that
    // changed nothing on the page. Both halves are needed — plenty of
    // clicks land on plain text harmlessly, and plenty of real controls
    // are divs. Watching the DOM for half a second is the cheapest
    // honest test of "did anything happen".
    if (!isInteractive(ev.target)) {
      let moved = false;
      const obs = new MutationObserver(() => {
        moved = true;
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
      window.setTimeout(() => {
        obs.disconnect();
        if (!moved) push({ kind: "dead_click", ...common });
      }, 500);
    }
  };

  const onError = (ev: ErrorEvent) => trackError(ev.message || "script error", "window");
  const onRejection = (ev: PromiseRejectionEvent) => {
    const r: any = ev.reason;
    trackError(r?.message || String(r || "unhandled rejection"), "promise");
  };

  // The flush that matters most. `pagehide` fires where `beforeunload`
  // does not — a phone switching apps, Safari's back-forward cache — and
  // the session that ends abruptly is the one worth keeping.
  const onHide = () => {
    if (currentSection) {
      push({
        kind: "dwell",
        section: currentSection,
        value: String(Math.max(0, Date.now() - sectionEnteredAt)),
      });
      sectionEnteredAt = Date.now();
    }
    void flush();
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") onHide();
  };

  window.addEventListener("click", onClick, true);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    started = false;
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("pagehide", onHide);
    document.removeEventListener("visibilitychange", onVisibility);
    void flush();
  };
}
