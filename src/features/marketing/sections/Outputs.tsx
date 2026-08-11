"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BookOpen,
  FileText,
  ListChecks,
  PencilLine,
  Presentation,
  Puzzle,
  StickyNote,
} from "lucide-react";
import { useT } from "@/shared/i18n";
import ThemedShot from "../ThemedShot";
import { motionIsStopped } from "../useReveal";
import s from "../Landing.module.css";

// What comes back: seven artefacts, seven cells — and the page's second
// pinned moment.
//
// THE MORPH, staged in two beats. Beat one is a clean scene: the heading
// and a tidy enlarged row of the seven artefact icons on empty ground —
// the cards are parked BELOW the pinned viewport, so nothing overlaps
// anything. Beat two: scrolling sends each icon travelling to its own
// card while the cards slide up from below to meet them, and their text
// cascades in last. "One brief becomes seven artefacts", performed by the
// scroll — and scrubbed, so scrolling back plays it in reverse.
//
// The mechanics are FLIP-style but hand-rolled: every icon is rendered in
// its FINAL home (inside its card), and the from-state is computed as a
// delta from a centered row. Both rectangles are measured in the same
// frame relative to the section, so the deltas are scroll-independent and
// survive resize via invalidateOnRefresh. Transform-only throughout.
//
// Degradation is total: below 900px, under short viewports, under
// prefers-reduced-motion, or with the product's motion-stop on, nothing
// pins and nothing transforms — the static bento IS the markup.

const TEXT_CELLS = [
  { key: "quizzes", Icon: ListChecks },
  { key: "exams", Icon: FileText },
  { key: "homework", Icon: PencilLine },
  { key: "activities", Icon: Puzzle },
  { key: "notes", Icon: StickyNote },
] as const;

export default function Outputs() {
  const t = useT();
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current || motionIsStopped()) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add(
      "(min-width: 900px) and (min-height: 720px) and (prefers-reduced-motion: no-preference)",
      () => {
        const ctx = gsap.context(() => {
          const icons = gsap.utils.toArray<HTMLElement>("[data-cell-icon]");
          const cells = gsap.utils.toArray<HTMLElement>("[data-cell]");
          const bodies = gsap.utils.toArray<HTMLElement>("[data-cell-body]");
          const chips = gsap.utils.toArray<HTMLElement>("[data-stage-chip]");
          const head = root.current!.querySelector("[data-out-head]");

          // Measure BEFORE any tween exists, so every position is the
          // natural layout: each real icon's home, section-relative, and a
          // tidy centred row for the chips to start from.
          const sr = root.current!.getBoundingClientRect();
          const homes = icons.map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 };
          });
          const gap = Math.min(112, sr.width / (chips.length + 1));
          const rowY = Math.min(window.innerHeight, sr.height) * 0.42;
          const slots = chips.map((_, i) => ({
            x: sr.width / 2 + (i - (chips.length - 1) / 2) * gap,
            y: rowY,
          }));

          // Opening state: chips enlarged in the row, real icons waiting
          // at scale 0 for the handoff. Both are JS-applied only — the
          // static markup ships the plain bento.
          chips.forEach((chip, i) =>
            gsap.set(chip, { x: slots[i].x - 17, y: slots[i].y - 17, scale: 2 })
          );
          gsap.set(icons, { scale: 0 });

          gsap
            .timeline({
              scrollTrigger: {
                trigger: root.current,
                start: "top top",
                end: "+=120%",
                pin: true,
                scrub: 1,
                invalidateOnRefresh: true,
              },
            })
            // Beat one holds: the first ~18% of the pin is a stable scene,
            // so arriving readers see a composition, not a mid-flight blur.
            .to(
              chips,
              {
                x: (i) => homes[i].x - 17,
                y: (i) => homes[i].y - 17,
                scale: 1,
                duration: 0.8,
                ease: "power2.inOut",
                stagger: 0.03,
              },
              0.18
            )
            // Cards start parked below the pinned viewport and rise to
            // meet their icons. Below the fold, not hidden: the no-opacity
            // rule holds and a non-scrolling render still shows the bento.
            .from(
              cells,
              {
                y: () => window.innerHeight * 0.62,
                duration: 0.8,
                ease: "power2.out",
                stagger: 0.05,
              },
              0.22
            )
            .from(bodies, { y: 26, duration: 0.4, stagger: 0.05 }, 0.74)
            // The handoff: each travelling chip collapses as the real icon
            // pops in its place, so the chip "becomes" the card's icon.
            .to(chips, { scale: 0, duration: 0.05, stagger: 0.015 }, 0.94)
            .to(icons, { scale: 1, duration: 0.07, stagger: 0.015, ease: "back.out(1.6)" }, 0.945)
            // The heading cedes the stage a little as the grid arrives.
            .to(head, { y: -26, duration: 0.7, ease: "none" }, 0.25);
        }, root);
        return () => ctx.revert();
      }
    );

    return () => mm.revert();
  }, []);

  return (
    <section className={`${s.shell} ${s.section} ${s.morphHost}`} id="what" ref={root}>
      {/* The travelling chips: an overlay the timeline owns outright, so
          card transforms can never drag them around. Hidden below 900px
          and for any static render. */}
      <div className={s.morphStage} aria-hidden="true">
        {[BookOpen, Presentation, ListChecks, FileText, PencilLine, Puzzle, StickyNote].map(
          (Icon, i) => (
            <span key={i} className={`${s.cellIcon} ${s.stageChip}`} data-stage-chip>
              <Icon size={16} strokeWidth={2} />
            </span>
          )
        )}
      </div>

      <div className={s.sectionHead} data-out-head>
        <h2 className={s.sectionTitle}>{t("mk.out.title")}</h2>
        <p className={s.body}>{t("mk.out.lede")}</p>
      </div>

      <div className={s.bento}>
        <div className={`${s.cell} ${s.cellWide}`} data-cell>
          <ThemedShot
            src="/marketing/lesson-plans.jpg"
            alt={t("mk.shot.plans")}
            width={1800}
            height={1125}
            sizes="(max-width: 860px) 100vw, 45vw"
            className={s.cellImg}
          />
          <span className={s.cellCaption}>
            <span className={s.cellIcon} data-cell-icon>
              <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            {t("mk.out.plans")}
          </span>
        </div>

        <div className={`${s.cell} ${s.cellTall}`} data-cell>
          <ThemedShot
            src="/marketing/dashboard.jpg"
            alt={t("mk.shot.dashboard")}
            width={1800}
            height={1125}
            sizes="(max-width: 860px) 100vw, 45vw"
            className={s.cellImg}
          />
          <span className={s.cellCaption}>
            <span className={s.cellIcon} data-cell-icon>
              <Presentation size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            {t("mk.out.decks")}
          </span>
        </div>

        {TEXT_CELLS.map(({ key, Icon }, i) => (
          <div key={key} className={`${s.cell} ${i < 3 ? s.cellSm : s.cellHalf}`} data-cell>
            <span className={s.cellIcon} data-cell-icon>
              <Icon size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <div data-cell-body>
              <p className={s.cellName}>{t(`mk.out.${key}` as never)}</p>
              <p className={s.cellText}>{t(`mk.out.${key}.desc` as never)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
