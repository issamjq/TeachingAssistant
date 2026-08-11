"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import gsap from "gsap";
import { motionIsStopped } from "./useReveal";

// Pointer-tracked card tilt — the "cards that lean toward your cursor"
// feel. Every [data-tilt] inside the scope leans up to ±5deg toward the
// pointer and rises 4px, springing flat when the pointer leaves.
//
// Built on gsap.quickTo, so pointer moves never touch React state and
// each axis is one pre-compiled tween updated per event. rotationX/Y are
// separate transform channels from the y/scale the scroll timelines use
// on the same cards, so the two systems compose instead of fighting.
//
// Gated to fine pointers (a phone cannot hover), desktop, reduced-motion
// and the product's motion-stop toggle.

export function useTilt(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!scope.current || motionIsStopped()) return;
    const mm = gsap.matchMedia();

    mm.add(
      "(min-width: 900px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      () => {
        const cleanups: (() => void)[] = [];
        scope.current!.querySelectorAll<HTMLElement>("[data-tilt]").forEach((card) => {
          gsap.set(card, { transformPerspective: 900 });
          const rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
          const ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
          const lift = gsap.quickTo(card, "y", { duration: 0.45, ease: "power3.out" });

          const move = (e: PointerEvent) => {
            const r = card.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width - 0.5;
            const py = (e.clientY - r.top) / r.height - 0.5;
            rx(py * -5);
            ry(px * 5);
            lift(-4);
          };
          const leave = () => {
            rx(0);
            ry(0);
            lift(0);
          };
          card.addEventListener("pointermove", move);
          card.addEventListener("pointerleave", leave);
          cleanups.push(() => {
            card.removeEventListener("pointermove", move);
            card.removeEventListener("pointerleave", leave);
            gsap.set(card, { rotationX: 0, rotationY: 0 });
          });
        });
        return () => cleanups.forEach((fn) => fn());
      }
    );

    return () => mm.revert();
  }, [scope]);
}
