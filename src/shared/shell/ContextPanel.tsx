"use client";

// =====================================================================
// The context panel — the studio's second left column
//
// The problem it solves: two things both want the left edge. The nav is
// global (thirteen sections, present everywhere) and the conversation
// list is local (only /studio has one), and a teacher's muscle memory
// expects both on the left.
//
// The answer is the one VS Code, Slack, Linear and Notion all arrived at
// independently — two tiers on the left, not one column doing two jobs:
//
//     [ nav 256px ][ context panel 272px ][ the work ]
//
// The rule that makes it work is that NEITHER PANEL EVER MOVES THE
// OTHER. The nav's width does not depend on this panel's state, because
// the nav is on every screen and this panel is on one; a local control
// that silently resizes global chrome is the exact thing muscle memory
// punishes. Collapsing this panel gives its width to the work and leaves
// the nav where it was.
//
// Below 1152px the viewport genuinely cannot afford 528px of chrome, so
// the nav drops to an icon rail while the panel is open. That is
// responsive behaviour keyed to the viewport, not one control driving
// another — and it is expressed in CSS (globals.css, `[data-panel]`)
// rather than in state, so it cannot leak into wide layouts.
//
// This is a SLOT, not a conversation list. The shell owns the frame —
// header, count, collapse control, the spine when closed — and a section
// portals its own content in, keeping its state in its own tree. /studio
// fills it with conversations today; Lessons could fill it with folders
// tomorrow without touching this file.
// =====================================================================

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  useSyncExternalStore, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { readStorage, writeStorage } from "@/shared/lib/storage";
import s from "./ContextPanel.module.css";

const COLLAPSED_KEY = "murchid.contextpanel.collapsed";

// ── the collapsed flag, as an external store ─────────────────────────
// localStorage is not React state, and reading it in a lazy initializer
// makes the client's first render disagree with the server's. Reading it
// in an effect and calling setState is the same bug with a cascading
// render on top. useSyncExternalStore is the primitive for exactly this:
// the server and the hydrating client both see `false`, then React reads
// the real value once hydration is done. No mismatch, no flash of a
// panel the teacher had closed.
//
// The listener set is what makes the toggle reach every subscriber — the
// `storage` event only fires in OTHER tabs, so a same-tab toggle would
// otherwise change nothing on screen.

const listeners = new Set<() => void>();

function subscribeCollapsed(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

const readCollapsed = () => readStorage(COLLAPSED_KEY) === "1";
const readCollapsedOnServer = () => false;

function writeCollapsed(next: boolean) {
  writeStorage(COLLAPSED_KEY, next ? "1" : "0");
  listeners.forEach((l) => l());
}

type Meta = { title: string; count?: number };

type Ctx = {
  /** Where a section portals its panel content. Null until the region mounts. */
  mount: HTMLElement | null;
  meta: Meta | null;
  register: (meta: Meta | null) => void;
  collapsed: boolean;
  toggle: () => void;
  setMount: (el: HTMLElement | null) => void;
};

const PanelContext = createContext<Ctx | null>(null);

export function ContextPanelProvider({ children }: { children: ReactNode }) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    readCollapsedOnServer
  );

  const register = useCallback((next: Meta | null) => {
    // Compare by value. A section that re-registers an identical title on
    // every render would otherwise set state every render, forever.
    setMeta((prev) => {
      if (prev === next) return prev;
      if (prev && next && prev.title === next.title && prev.count === next.count) return prev;
      return next;
    });
  }, []);

  const toggle = useCallback(() => {
    writeCollapsed(!readCollapsed());
  }, []);

  const value = useMemo(
    () => ({ mount, meta, register, collapsed, toggle, setMount }),
    [mount, meta, register, collapsed, toggle]
  );

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

/**
 * Whether a section is currently filling the panel, and whether it is
 * open — the shell needs both to set `data-panel` on the app root.
 */
export function useContextPanelState() {
  const ctx = useContext(PanelContext);
  if (!ctx) return { present: false, collapsed: true };
  return { present: ctx.meta != null, collapsed: ctx.collapsed };
}

/**
 * Called by a section that wants the panel. Registers the header it
 * should carry and returns the element to portal content into — or null
 * when the panel is collapsed or the region has not mounted, in which
 * case the section renders nothing there.
 *
 * The section keeps its own state; only the DOM position moves.
 */
export function useContextPanelSlot(title: string, count?: number) {
  const ctx = useContext(PanelContext);
  const register = ctx?.register;

  useEffect(() => {
    if (!register) return;
    register({ title, count });
    return () => register(null);
  }, [register, title, count]);

  return {
    mount: ctx?.collapsed ? null : (ctx?.mount ?? null),
    collapsed: ctx?.collapsed ?? false,
    /** Portal helper, so callers do not import react-dom themselves. */
    render: (node: ReactNode) =>
      ctx && !ctx.collapsed && ctx.mount ? createPortal(node, ctx.mount) : null,
  };
}

/**
 * The panel itself. Rendered by StudioShell between the nav and the
 * content, and nothing at all until a section registers.
 */
export function ContextPanelRegion() {
  const ctx = useContext(PanelContext);
  if (!ctx || !ctx.meta) return null;

  const { meta, collapsed, toggle, setMount } = ctx;

  if (collapsed) {
    return (
      <aside className={s.spine} aria-label={meta.title}>
        <button
          type="button"
          className={s.spineBtn}
          onClick={toggle}
          title={`Show ${meta.title.toLowerCase()}`}
          aria-label={`Show ${meta.title.toLowerCase()}`}
          aria-expanded={false}
        >
          <PanelLeftOpen size={15} className={s.spineIcon} />
          <span className={s.spineLabel}>{meta.title}</span>
          {meta.count != null && <span className={s.spineCount}>{meta.count}</span>}
        </button>
      </aside>
    );
  }

  return (
    <aside className={s.panel} aria-label={meta.title}>
      <div className={s.pane}>
        <header className={s.head}>
          <h2 className={s.title}>{meta.title}</h2>
          {meta.count != null && <span className={s.count}>{meta.count}</span>}
          <button
            type="button"
            className={s.collapse}
            onClick={toggle}
            title={`Hide ${meta.title.toLowerCase()}`}
            aria-label={`Hide ${meta.title.toLowerCase()}`}
            aria-expanded
          >
            <PanelLeftClose size={15} />
          </button>
        </header>
        {/* The section portals into here. */}
        <div className={s.body} ref={setMount} />
      </div>
    </aside>
  );
}
