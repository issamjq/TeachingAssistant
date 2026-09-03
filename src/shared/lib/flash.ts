// A failure said in the product's own voice, not the browser's.
//
// window.alert() is a grey OS box with a URL in its title bar — it
// blocks the whole tab, carries no typography, and teaches the teacher
// nothing about whose message it is. There were 42 of them. This is the
// replacement: a quiet notice, bottom-centre, in the palette, that
// dismisses itself and never blocks her work.
//
// Imperative and React-free on purpose: every alert() call site is a
// one-line swap (`alert(msg)` → `flash(msg)`), which is what made
// sweeping all of them feasible. Appended to <body> — the same choice
// SchedulePopup made — so no ancestor transform can clip it. Styled
// with the --p-* palette variables, so it re-themes and follows dark
// mode like everything else.

const CONTAINER_ID = "murchid-flash";
const SHOW_MS = 6000;

function container(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = CONTAINER_ID;
    // A live region: screen readers announce the failure without focus
    // being stolen from whatever she was doing.
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    Object.assign(el.style, {
      position: "fixed",
      insetInlineStart: "0",
      insetInlineEnd: "0",
      bottom: "24px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
      zIndex: "2147482000",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Show a transient notice. `tone: "error"` (the default) carries a
 * critical tint on its rule; `"ok"` a calm one. Click dismisses early.
 */
export function flash(message: string, tone: "error" | "ok" = "error"): void {
  const host = container();
  if (!host) return;

  const note = document.createElement("div");
  Object.assign(note.style, {
    pointerEvents: "auto",
    maxWidth: "min(440px, calc(100vw - 32px))",
    background: "var(--p-surface, #f4f3ef)",
    color: "var(--p-ink, #101718)",
    border: "1px solid var(--p-line, #cdcdc6)",
    borderInlineStartWidth: "1px",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(16, 23, 24, 0.14)",
    padding: "10px 14px 10px 12px",
    font: "13.5px/1.45 var(--font-sans)",
    display: "flex",
    alignItems: "flex-start",
    gap: "9px",
    cursor: "pointer",
  });

  const mark = document.createElement("span");
  Object.assign(mark.style, {
    flex: "none",
    width: "7px",
    height: "7px",
    marginTop: "5.5px",
    borderRadius: "999px",
    background: tone === "ok" ? "var(--p-ok, #2f6e52)" : "var(--p-crit, #a0453c)",
  });
  const text = document.createElement("span");
  text.textContent = message;

  note.append(mark, text);

  const close = () => {
    note.remove();
    if (!host.childElementCount) host.remove();
  };
  note.addEventListener("click", close);
  window.setTimeout(close, SHOW_MS);

  // Newest at the bottom, oldest pushed up; never more than three.
  while (host.childElementCount >= 3) host.firstElementChild?.remove();
  host.appendChild(note);
}
