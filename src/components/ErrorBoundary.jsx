import React from "react";
import { RotateCcw, RefreshCw } from "lucide-react";
import { useI18n } from "../lib/i18n.jsx";
import { Button } from "./ui/button.jsx";

// Error boundary — the app's containment wall.
//
// Before this existed, a single throwing component unmounted the entire
// React tree and left a white screen; the only recovery was a manual
// reload. React says it outright in the console ("Consider adding an error
// boundary") and we had none anywhere. That made every intermittent render
// error — an animation racing a `dir` flip, a bad shape from an API — read
// as a total product failure.
//
// Boundaries only catch errors thrown during render, in lifecycle methods,
// and in constructors of the tree BELOW them. They do NOT catch errors in
// event handlers, async callbacks, or timers — those need try/catch at the
// call site. So this is a safety net for render-time faults, not a general
// error handler.
//
// Placement is deliberate (see main.jsx / App.jsx): one per surface so a
// broken studio screen can't take down the landing page, plus one around
// the route body so navigating away from a broken screen recovers without
// a reload.

// Reporter hook. Day 12 wires Sentry in here once; no boundary needs to
// change. Kept module-level rather than a prop so every boundary in the
// tree reports through the same channel without prop-drilling.
let reportError = null;

/** Register a global error reporter (Sentry, etc.). Pass null to clear. */
export function setErrorReporter(fn) {
  reportError = typeof fn === "function" ? fn : null;
}

/**
 * Wrap a subtree so a render-time throw shows a recoverable card instead of
 * unmounting the app.
 *
 * @param {string}  name      identifies the boundary in logs / reports
 * @param {any}     resetKey  change this to clear a caught error (e.g. route)
 * @param {"page"|"section"|"silent"} variant  full-height, inline, or render
 *                            nothing at all (for ancillary chrome)
 *
 * Exported as the class itself rather than wrapped in a function component:
 * a wrapper would add one fiber node per boundary — six of them across the
 * app — purely to forward props.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const where = this.props.name || "unknown";
    // Always log — in dev this is the only signal; in prod it reaches
    // whatever collects console output.
    console.error(`[ErrorBoundary:${where}]`, error, info?.componentStack);
    // A throwing reporter must never escalate into a second failure while
    // we are already handling one.
    try {
      reportError?.(error, { boundary: where, componentStack: info?.componentStack });
    } catch {
      /* reporter is best-effort */
    }
  }

  componentDidUpdate(prevProps) {
    // Auto-clear when the caller's resetKey changes. App.jsx passes the
    // current route, so navigating away from a broken screen silently
    // recovers — without this the fallback would follow you around the app.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  retry() {
    this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    // Ancillary chrome (the a11y widget, a decorative panel) should fail
    // invisibly — an error card where a floating button used to be is
    // worse than the button simply being absent.
    if (this.props.variant === "silent") return null;
    return (
      <Fallback
        error={this.state.error}
        onRetry={this.retry}
        variant={this.props.variant || "page"}
      />
    );
  }
}

// Separate function component so the fallback can read i18n (a class
// cannot use hooks). Every lookup is guarded: this renders precisely when
// something is already broken, so it must not be able to throw. If the
// i18n provider is the thing that failed, useI18n() returns undefined and
// the English defaults below take over.
function Fallback({ error, onRetry, variant }) {
  const ctx = useI18n();
  const tr = (key, fallback) => {
    try {
      const v = ctx?.t?.(key);
      // t() returns the raw key when a translation is missing.
      return !v || v === key ? fallback : v;
    } catch {
      return fallback;
    }
  };

  const isSection = variant === "section";
  // Error text can carry file paths, query fragments and internal names.
  // Show it while developing; never ship it to a teacher's screen.
  const detail = import.meta.env.DEV ? String(error?.message || error) : null;

  return (
    // Carries its own paper ground and ink colour rather than inheriting.
    // A boundary can replace a whole surface — and `body.studio-open` sets a
    // dark background — so an inheriting fallback rendered near-black ink on
    // near-black and was effectively invisible exactly when it mattered most.
    // min-h-full keeps it from collapsing into a thin strip at surface level.
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center px-6 bg-paper-cool text-ink ${
        isSection ? "py-16" : "py-28 min-h-screen"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
        <span className="w-6 h-px bg-accent" />
        {tr("error.eyebrow", "Something broke")}
      </p>

      <h2
        className={`font-serif font-medium text-ink mb-3 ${
          isSection ? "text-3xl" : "text-5xl"
        }`}
      >
        {tr("error.title.lead", "This part didn't")}{" "}
        <em className="italic font-light text-accent">
          {tr("error.title.accent", "load")}
        </em>
      </h2>

      <p className="text-muted text-[15px] max-w-md mb-7 leading-relaxed">
        {tr(
          "error.body",
          "The rest of Murchid is still working. Try again, and if it keeps happening reload the page."
        )}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button variant="primary" size="md" onClick={onRetry}>
          <RotateCcw size={14} strokeWidth={2.25} />
          {tr("error.retry", "Try again")}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={14} strokeWidth={2.25} />
          {tr("error.reload", "Reload page")}
        </Button>
      </div>

      {detail && (
        <details className="mt-8 max-w-lg w-full text-start">
          <summary className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted cursor-pointer murchid-focus">
            {tr("error.details", "Developer detail")}
          </summary>
          <pre className="mt-2 p-3 rounded-sm border border-line bg-paper-cool text-[11px] text-ink-soft overflow-x-auto whitespace-pre-wrap break-words">
            {detail}
          </pre>
        </details>
      )}
    </div>
  );
}

