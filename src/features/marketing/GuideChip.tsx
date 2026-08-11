"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BadgeCheck,
  BookOpen,
  Calendar,
  CalendarRange,
  Languages,
  LayoutGrid,
  ListChecks,
  MessageCircleQuestion,
  Mic,
} from "lucide-react";
import { motionIsStopped } from "./useReveal";
import s from "./Landing.module.css";

// THE GUIDE — the scroll companion that threads the whole page.
//
// Murchid means "the guide", so the page has one: a single chip, born out
// of the hero screenshot as it condenses on the first scroll, that then
// rides fixed at the bottom centre and TRANSFORMS at every waypoint — its
// icon morphing to announce each section as you arrive (mic for "say it",
// book for the plans, checklist for quizzes, grid for the artefacts,
// calendar for the term, languages for the bilingual band, badge for
// pricing, question mark for the FAQ). At the closing call to action it
// bows out through the bottom edge: the guide has delivered you.
//
// Every transition is driven by ScrollTriggers, so scrolling back plays
// the chain in reverse — the same icon hands back to the previous one.
//
// It is pure decoration (aria-hidden, pointer-events: none) and is
// ADDITIVE ONLY: the chip is display:none in CSS and is switched on by
// this effect, so no-JS renders, phones, short viewports, reduced motion
// and the product's motion-stop toggle never see it at all.

const WAYPOINTS: { sel: string; idx: number }[] = [
  { sel: "[data-step-row='1']", idx: 1 },
  { sel: "[data-step-row='2']", idx: 2 },
  { sel: "[data-step-row='3']", idx: 3 },
  { sel: "#what", idx: 4 },
  { sel: "#term", idx: 5 },
  { sel: "#bilingual", idx: 6 },
  { sel: "#pricing", idx: 7 },
  { sel: "#questions", idx: 8 },
];

const ICONS = [
  Calendar,
  Mic,
  BookOpen,
  ListChecks,
  LayoutGrid,
  CalendarRange,
  Languages,
  BadgeCheck,
  MessageCircleQuestion,
];

export default function GuideChip() {
  const dock = useRef<HTMLDivElement>(null);
  const travel = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dock.current || !travel.current || !chip.current || motionIsStopped()) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add(
      "(min-width: 900px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)",
      () => {
        const ctx = gsap.context(() => {
          const faces = gsap.utils.toArray<HTMLElement>("[data-guide-face]", dock.current!);
          gsap.set(dock.current, { display: "grid" });
          // Stack the faces: only the current one sits in the window.
          faces.forEach((f, i) => gsap.set(f, { yPercent: i === 0 ? 0 : 130 }));

          let current = 0;
          const swap = (to: number) => {
            if (to === current || !faces[to]) return;
            const dir = to > current ? 1 : -1;
            gsap.to(faces[current], {
              yPercent: -130 * dir,
              rotation: -14 * dir,
              duration: 0.32,
              ease: "power2.in",
              overwrite: "auto",
            });
            gsap.fromTo(
              faces[to],
              { yPercent: 130 * dir, rotation: 14 * dir },
              { yPercent: 0, rotation: 0, duration: 0.38, ease: "back.out(1.7)", overwrite: "auto" }
            );
            // The chip itself acknowledges the handoff with a squash pulse.
            gsap.fromTo(
              chip.current,
              { scale: 0.88 },
              { scale: 1, duration: 0.4, ease: "back.out(2)" }
            );
            current = to;
          };

          // BIRTH: as the hero's takeover releases and the steps approach,
          // the chip condenses in from where the screenshot is heading —
          // scrubbed, so scrolling back feeds it back into the image.
          gsap.fromTo(
            travel.current,
            { y: 140, scale: 0.3 },
            {
              y: 0,
              scale: 1,
              ease: "power2.out",
              scrollTrigger: {
                // Resolved explicitly: selector STRINGS inside this
                // gsap.context are scoped to the dock, so "#how" found
                // nothing and the scrub silently bound to the viewport.
                trigger: document.querySelector("#how"),
                start: "top 95%",
                end: "top 55%",
                scrub: 0.6,
              },
            }
          );

          // WAYPOINTS: each section hands the guide its icon on entry, and
          // hands back to the previous one when you scroll up past it.
          WAYPOINTS.forEach(({ sel, idx }) => {
            const el = document.querySelector(sel);
            if (!el) return;
            ScrollTrigger.create({
              trigger: el,
              start: "top 60%",
              onEnter: () => swap(idx),
              onLeaveBack: () => swap(idx - 1),
            });
          });

          // EXIT: at the closing call to action the guide bows out through
          // the bottom edge — it has delivered you. Played on entry and
          // reversed on the way back up: a paused tween under explicit
          // control, because a scrubbed .to on this target kept rendering
          // its end state from page top regardless of trigger position.
          const exit = gsap.to(travel.current, {
            y: 150,
            scale: 0.4,
            duration: 0.55,
            ease: "power2.in",
            paused: true,
          });
          ScrollTrigger.create({
            trigger: document.querySelector("[data-closing]"),
            start: "top 70%",
            onEnter: () => exit.play(),
            onLeaveBack: () => exit.reverse(),
          });
        }, dock);
        return () => ctx.revert();
      }
    );

    return () => mm.revert();
  }, []);

  return (
    <div className={s.guideDock} ref={dock} aria-hidden="true">
      <div ref={travel} style={{ willChange: "transform" }}>
        <div className={s.guideChip} ref={chip}>
        {ICONS.map((Icon, i) => (
          <span key={i} className={s.guideFace} data-guide-face>
            <Icon size={19} strokeWidth={2} />
          </span>
        ))}
        </div>
      </div>
    </div>
  );
}
