"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useT } from "@/shared/i18n";
import s from "../Landing.module.css";

// The term, panned horizontally as you scroll down.
//
// WHY THIS ANIMATION EXISTS (the one-sentence test): the product's claim is
// that it returns a whole term laid out week by week, and a vertical list of
// four cards asserts that where a horizontal track that physically travels
// through the weeks demonstrates it. The scroll IS the term passing.
//
// Canonical horizontal-pan shape: pin the wrapper at `top top`, translate the
// inner track by exactly (scrollWidth - innerWidth), scrub, and set the
// scroll length to that same distance so the pan finishes as the pin releases.
//
// Degradation is total, not partial. Under reduced motion, under the
// product's own motion-stop toggle, or below 900px, no pin and no transform
// happen at all: the track is a plain vertical stack in CSS, which is why
// the markup carries no inline transforms of its own.

const WEEKS = ["w1", "w2", "w3", "w4"] as const;
const A11Y_KEY = "murchid.a11y";

function motionIsStopped(): boolean {
  try {
    const raw = localStorage.getItem(A11Y_KEY);
    if (raw && JSON.parse(raw)?.stopAnim) return true;
  } catch {
    /* ignore */
  }
  return document.getElementById("root")?.classList.contains("a11y-stop-anim") ?? false;
}

export default function TermTimeline() {
  const t = useT();
  const wrap = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrap.current || !track.current || motionIsStopped()) return;

    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add(
      "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
      () => {
        const ctx = gsap.context(() => {
          const distance = () =>
            Math.max(0, track.current!.scrollWidth - window.innerWidth + 96);

          const pan = gsap.to(track.current, {
            x: () => -distance(),
            ease: "none",
            scrollTrigger: {
              trigger: wrap.current,
              start: "top top",
              end: () => `+=${distance()}`,
              pin: true,
              scrub: 1,
              invalidateOnRefresh: true,
            },
          });

          // Each week rises and straightens as it travels into view. The
          // trigger positions are measured inside the moving track, which
          // is what containerAnimation exists for — a plain ScrollTrigger
          // would measure against the page and fire everything at once.
          gsap.utils.toArray<HTMLElement>("[data-week]").forEach((card) => {
            gsap.from(card, {
              y: 48,
              rotation: 1.4,
              duration: 0.6,
              ease: "power2.out",
              scrollTrigger: {
                trigger: card,
                containerAnimation: pan,
                start: "left 92%",
                once: true,
              },
            });
          });
        }, wrap);

        return () => ctx.revert();
      }
    );

    return () => mm.revert();
  }, []);

  return (
    <section className={s.termWrap} ref={wrap} id="term">
      <div className={s.termTrack} ref={track}>
        <div className={s.termIntro}>
          <h2 className={s.sectionTitle}>{t("mk.term.title")}</h2>
          <p className={s.body} style={{ marginTop: 16 }}>
            {t("mk.term.lede")}
          </p>
          <p className={s.small} style={{ marginTop: 18 }}>
            {t("mk.term.demo")}
          </p>
        </div>

        {WEEKS.map((k) => (
          <article className={s.week} key={k} data-week>
            <p className={s.weekRange}>{t(`mk.term.${k}.range` as never)}</p>
            <h3 className={s.weekTitle}>{t(`mk.term.${k}.title` as never)}</h3>
            <p className={s.weekBody}>{t(`mk.term.${k}.body` as never)}</p>
            <p className={s.weekMeta}>{t(`mk.term.${k}.meta` as never)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
