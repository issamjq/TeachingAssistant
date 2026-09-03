"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useT } from "@/shared/i18n";
import ThemedShot from "../ThemedShot";
import { motionIsStopped } from "../useReveal";
import s from "../Landing.module.css";

// How it works: three alternating rows, each carrying a real screen.
//
// A hairline rail runs down the section's leading edge; as you scroll, an
// accent fill draws down it and a dot rides its tip — the reader's place
// in the three-step sequence, performed. The dot is the "component that
// follows the scroll": scrubbed, transform-only, and absent below 900px
// and under any motion-stop, where the rail is simply not rendered
// meaningfully (it is aria-hidden decoration either way).

const STEPS = [
  { k: "1", src: "/marketing/studio.jpg", shot: "mk.shot.studio" },
  { k: "2", src: "/marketing/lesson-plans.jpg", shot: "mk.shot.plans" },
  { k: "3", src: "/marketing/quizzes.jpg", shot: "mk.shot.quizzes" },
] as const;

export default function Steps() {
  const t = useT();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrap.current || motionIsStopped()) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        const fill = wrap.current!.querySelector("[data-rail-fill]");
        const dot = wrap.current!.querySelector("[data-rail-dot]");
        const trigger = {
          trigger: wrap.current,
          start: "top 70%",
          end: "bottom 55%",
          scrub: 0.8,
        };
        gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: trigger });
        gsap.fromTo(
          dot,
          { y: 0 },
          {
            y: () => (wrap.current?.offsetHeight ?? 0) - 12,
            ease: "none",
            scrollTrigger: { ...trigger, invalidateOnRefresh: true },
          }
        );
      }, wrap);
      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return (
    <section className={`${s.shell} ${s.section}`} id="how">
      <div className={s.sectionHead} data-reveal-stagger>
        <h2 className={s.sectionTitle} data-reveal-item>{t("mk.how.title")}</h2>
        <p className={s.body} data-reveal-item>{t("mk.how.lede")}</p>
      </div>

      <div className={s.stepsWrap} ref={wrap}>
        <div className={s.stepsRail} aria-hidden="true">
          <span className={s.stepsRailFill} data-rail-fill />
          <span className={s.stepsRailDot} data-rail-dot />
        </div>

        {STEPS.map((step, i) => (
          <div
            key={step.k}
            className={`${s.step} ${i % 2 === 1 ? s.stepReverse : ""}`}
            data-step-row={step.k}
          >
            <div data-reveal-stagger>
              <p className={s.stepIndex} data-reveal-item>
                {t(`mk.step${step.k}.index` as never)}
              </p>
              <h3 className={s.stepTitle} data-reveal-item>
                {t(`mk.step${step.k}.title` as never)}
              </h3>
              <p className={s.stepBody} data-reveal-item>
                {t(`mk.step${step.k}.body` as never)}
              </p>
            </div>

            <div className={s.frame} data-frame-target>
              <ThemedShot
                src={step.src}
                alt={t(step.shot as never)}
                width={1800}
                height={1125}
                sizes="(max-width: 860px) 100vw, 55vw"
                className={s.shotImg}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
