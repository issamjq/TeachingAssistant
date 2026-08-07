"use client";

// =====================================================================
// Pointer-reactive layer for the landing.
//
// The landing had no cursor awareness at all — every effect was driven by
// scroll. This adds the three that read as "expensive" without adding a
// motion library, and it does it by writing CSS custom properties rather
// than by owning any element's style outright, so the existing hover and
// scroll rules keep working and nothing here has to be kept in sync with
// them.
//
//   :root --mx/--my    normalised cursor position, -1 → 1. Drives the slow
//                      parallax on the hero's ambient orbs.
//   .lp-magnetic       --mgx/--mgy, a capped pull toward the cursor once it
//                      is within FIELD px of the element's box.
//   .lp-spotlight      --sx/--sy, cursor position in element-local %, for
//                      the radial sheen on the plan cards.
//
// Mounted once, near the root of the landing. Inert for touch/coarse
// pointers and for prefers-reduced-motion — in both cases it installs no
// listeners at all rather than installing and no-oping, so there is no
// scroll-adjacent work on phones.
// =====================================================================
import { useEffect } from "react";

/** How far outside its own box an element still feels the cursor. */
const FIELD = 90;
/** Maximum displacement of a magnetic element, px. */
const PULL = 7;

export default function PointerFx() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    // A coarse pointer has no hover to react to, and reduced-motion asks us
    // not to. Either way: do nothing, install nothing.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const root = document.documentElement;
    let raf = 0;
    let px = 0;
    let py = 0;

    const apply = () => {
      raf = 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      root.style.setProperty("--mx", ((px / vw) * 2 - 1).toFixed(4));
      root.style.setProperty("--my", ((py / vh) * 2 - 1).toFixed(4));

      // Magnetic elements. Re-queried each frame on purpose: the landing
      // mounts and unmounts CTAs as the funnel changes pages, and a cached
      // list would hold detached nodes.
      const magnets = document.querySelectorAll<HTMLElement>(".lp-magnetic");
      for (const el of magnets) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // Distance from the *box*, not the centre, so wide pills don't have
        // a weaker field at their ends than at their middle.
        const dx = Math.max(r.left - px, 0, px - r.right);
        const dy = Math.max(r.top - py, 0, py - r.bottom);
        const gap = Math.hypot(dx, dy);
        if (gap > FIELD) {
          el.style.setProperty("--mgx", "0px");
          el.style.setProperty("--mgy", "0px");
          continue;
        }
        const strength = (1 - gap / FIELD) * PULL;
        const vx = px - cx;
        const vy = py - cy;
        const len = Math.hypot(vx, vy) || 1;
        el.style.setProperty("--mgx", `${((vx / len) * strength).toFixed(2)}px`);
        el.style.setProperty("--mgy", `${((vy / len) * strength).toFixed(2)}px`);
      }

      // Spotlight surfaces — local coordinates for the radial sheen.
      const lit = document.querySelectorAll<HTMLElement>(".lp-spotlight");
      for (const el of lit) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        el.style.setProperty("--sx", `${(((px - r.left) / r.width) * 100).toFixed(2)}%`);
        el.style.setProperty("--sy", `${(((py - r.top) / r.height) * 100).toFixed(2)}%`);
      }
    };

    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
