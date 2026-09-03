"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ThemedShot from "./ThemedShot";
import { motionIsStopped } from "./useReveal";
import s from "./Landing.module.css";

// THE COURIER, v2 — the images themselves make the journey.
//
// v1 flew a small constant-size chip between frames. The owner's note:
// the FIRST image should shrink down to a small window, travel, and
// ENLARGE back up into the next image's full size — then shrink again,
// and again, a breathing chain down the page. So the courier now starts
// as a pixel-perfect cover of the hero screenshot, shrinks into a small
// window on the first scroll (carrying the DASHBOARD with it), swaps to
// the next screen at its smallest point — the cut hidden at minimum
// size — and grows until it exactly covers the first step's frame.
// Repeat to frames two and three, where it comes to rest.
//
// Exactness is what sells it: every capture is 16:10, so one uniform
// scale maps the 200px base onto any frame's true rect, and the border
// and radius are counter-scaled every frame so the docked courier is
// indistinguishable from the real image beneath it. All scrubbed: scroll
// back and the images are carried home. Hidden below 900px, under
// reduced motion, under motion-stop, and in any static render.

// FACE 0 MUST BE WHATEVER THE HERO IS SHOWING.
//
// Leg 0 begins as a pixel-perfect cover of the hero shot, so if this
// first entry is a different screen the visitor watches the hero image
// swap for another one the instant they scroll — the flight is smooth,
// but it sets off carrying the wrong picture. That is exactly what
// happened when the hero moved from the planner to the dashboard and
// this list stayed behind. The planner is not lost: it is the screen
// the first step's frame holds, so the courier still flies into it.
const FACES = [
  "/marketing/dashboard.jpg",
  "/marketing/studio.jpg",
  "/marketing/lesson-plans.jpg",
  "/marketing/quizzes.jpg",
];

const BASE = 200; // px; height follows the shared 16:10 aspect
const S_MIN = 0.95; // the "small window" between deliveries

export default function ImageCourier() {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current || motionIsStopped()) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add(
      "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
      () => {
        const ctx = gsap.context(() => {
          // Closed over as a plain node: ctx.revert() renders each
          // timeline one final time during cleanup, and by then React has
          // already nulled the ref — el.current!.style inside onUpdate
          // was throwing into the error boundary and killing the page.
          const node = el.current!;
          const hero = document.querySelector<HTMLElement>("[data-hero-shot]");
          const frames = gsap.utils.toArray<HTMLElement>(
            document.querySelectorAll("[data-frame-target]")
          );
          if (!hero || frames.length < 3) return;
          const faces = gsap.utils.toArray<HTMLElement>("[data-courier-face]", node);
          gsap.set(node, { display: "block", visibility: "hidden" });
          faces.forEach((f, i) => gsap.set(f, { yPercent: i === 0 ? 0 : 120 }));

          // A waypoint is a document-space rect: centre plus the uniform
          // scale that maps the BASE onto its true width.
          const spot = (node: HTMLElement) => () => {
            const r = node.getBoundingClientRect();
            return {
              x: r.left + window.scrollX + r.width / 2 - BASE / 2,
              y: r.top + window.scrollY + (r.width * 0.625) / 2 - (BASE * 0.625) / 2,
              k: r.width / BASE,
            };
          };
          const stops = [spot(hero), ...frames.map((f) => spot(f))];

          // Counter-scale the chrome so the docked courier matches the
          // frame it covers: a 1px border at scale 3.5 would read as 3.5px.
          const dress = () => {
            const k = Number(gsap.getProperty(node, "scaleX")) || 1;
            node.style.borderRadius = `${14 / k}px`;
            node.style.borderWidth = `${1 / k}px`;
          };

          // One leg per frame: shrink from the previous image's full size
          // to the small window, swap at the smallest point, grow into the
          // next image's full size. Ranges are DISJOINT (one writer), and
          // legs are created in reverse so leg 0's load state — an exact
          // cover of the hero image — wins the initial render.
          const leg = (i: number) => {
            const from = stops[i];
            const to = stops[i + 1];
            const row = frames[i].closest("[data-step-row]") ?? frames[i];
            const tl = gsap
              .timeline({
                // On the TIMELINE, not the ScrollTrigger: the scrubbed
                // tween keeps easing for a beat after the last scroll
                // event, and a trigger-level callback stops with the
                // scroll — which left the counter-scaled border frozen
                // at its mid-flight value once the courier settled.
                onUpdate: () => {
                  const pr = tl.progress();
                  if (i === 0) {
                    node.style.visibility = pr > 0.005 ? "visible" : "hidden";
                  }
                  // The cut, hidden at the smallest size: a pure function
                  // of this leg's progress, written with gsap.set every
                  // frame. Tweened faces kept desynchronising under load
                  // renders and reverts; a recomputed value cannot.
                  const c = gsap.utils.clamp(0, 1, (pr - 0.4) / 0.2);
                  gsap.set(faces[i], { yPercent: -130 * c });
                  gsap.set(faces[i + 1], { yPercent: 130 * (1 - c) });
                  dress();
                },
                scrollTrigger: {
                  // LEG 0 IS ANCHORED TO THE HERO, NOT TO THE ROW.
                  //
                  // It used to start at the row's "top bottom" — the
                  // moment the first step row enters the viewport — which
                  // is only in the future if the row starts BELOW the
                  // fold. On a tall viewport (2560x1440 is the everyday
                  // case) the row is already on screen at scroll 0, so
                  // leg 0 loaded at a progress above zero, unhid the
                  // courier, and parked a second, slightly misaligned
                  // copy of the dashboard directly on top of the hero.
                  // It read as a rendering fault, and it got easier to
                  // hit as the hero got shorter.
                  //
                  // Anchoring the start to the hero at "top top" pins
                  // leg 0's zero to scroll position zero, at every
                  // viewport height. endTrigger keeps the leg finishing
                  // where it always did, against the row.
                  trigger: i === 0 ? hero : row,
                  start: i === 0 ? "top top" : "top 78%",
                  endTrigger: i === 0 ? row : undefined,
                  end: i === 0 ? "top 58%" : "top 45%",
                  scrub: 0.7,
                  invalidateOnRefresh: true,
                },
              })
              .fromTo(
                node,
                { x: () => from().x, y: () => from().y, immediateRender: false },
                { x: () => to().x, ease: "none", duration: 1 },
                0
              )
              .to(node, { y: () => to().y, ease: "power1.inOut", duration: 1 }, 0)
              .fromTo(
                node,
                { scale: () => from().k, immediateRender: false },
                { scale: S_MIN, ease: "power1.in", duration: 0.5 },
                0
              )
              .to(node, { scale: () => to().k, ease: "power1.out", duration: 0.5 }, 0.5)
              .fromTo(
                node,
                { rotation: 0, immediateRender: false },
                { rotation: i % 2 ? -2.5 : 2.5, ease: "sine.in", duration: 0.5 },
                0
              )
              .to(node, { rotation: 0, ease: "sine.out", duration: 0.5 }, 0.5);
          };

          leg(2);
          leg(1);
          leg(0);
        }, el);
        return () => ctx.revert();
      }
    );

    return () => mm.revert();
  }, []);

  return (
    <div className={s.courier} ref={el} aria-hidden="true">
      {FACES.map((src, i) => (
        <span key={src} className={s.courierFace} data-courier-face>
          <ThemedShot src={src} alt="" width={400} height={250} sizes="300px" className={s.courierImg} />
        </span>
      ))}
    </div>
  );
}
