"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Scroll reveals for the marketing page, on GSAP.
//
// Two rules this obeys, both learned the hard way:
//
// 1. TRANSFORM ONLY. Nothing animates opacity. A reveal that starts at
//    opacity 0 leaves content invisible to anything that does not scroll:
//    print, a full-page screenshot, a crawler. Moving 26px is enough to
//    read as arrival, and the text is legible the entire time.
//
// 2. THE PRODUCT'S OWN MOTION-STOP WINS. The accessibility toolbar kills
//    animation with `#root.a11y-stop-anim { animation: none !important }`,
//    which stops CSS but NOT GSAP, because GSAP writes inline transforms
//    from JS. So the preference is read directly. Without this, a teacher
//    who switched motion off would still get a moving page.

const A11Y_KEY = "murchid.a11y";

export function motionIsStopped(): boolean {
  try {
    const raw = localStorage.getItem(A11Y_KEY);
    if (raw && JSON.parse(raw)?.stopAnim) return true;
  } catch {
    /* unreadable storage is not a reason to refuse motion */
  }
  return document.getElementById("root")?.classList.contains("a11y-stop-anim") ?? false;
}

/**
 * Reveals every `[data-reveal]` descendant as it enters the viewport.
 * Returns the ref to attach to the scope element.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const scope = useRef<T>(null);

  useEffect(() => {
    if (!scope.current || motionIsStopped()) return;

    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
          const delay = Number(el.dataset.revealDelay ?? 0);
          gsap.from(el, {
            y: 26,
            duration: 0.7,
            delay,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        });

        // Follow-up staggers: a parent marked data-reveal-stagger cascades
        // its data-reveal-item children after it arrives, so a block reads
        // in the order it is written instead of landing as one slab.
        gsap.utils.toArray<HTMLElement>("[data-reveal-stagger]").forEach((parent) => {
          const items = parent.querySelectorAll("[data-reveal-item]");
          if (!items.length) return;
          gsap.from(items, {
            y: 20,
            duration: 0.55,
            stagger: 0.09,
            ease: "power3.out",
            scrollTrigger: { trigger: parent, start: "top 85%", once: true },
          });
        });

        // Frames settle from a slight over-scale as they arrive — the
        // screenshot "lands" on the page instead of merely appearing.
        gsap.utils.toArray<HTMLElement>("[data-reveal-scale]").forEach((el) => {
          gsap.from(el, {
            scale: 1.045,
            transformOrigin: "50% 60%",
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          });
        });
      }, scope);

      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return scope;
}
