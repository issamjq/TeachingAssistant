"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
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

// Each week carries an editorial photograph of the teaching it
// describes, not another product screenshot — the captures already carry
// the hero, the steps, the bento and the bilingual band, and repeating
// them here read as redundancy rather than proof. Photos are Unsplash
// (license requires no attribution), fetched once and self-hosted in
// public/marketing/photos/ so the page never depends on a hotlink:
//   week1 photo-1456513080510-7bf3a84b82f8   open books + notes
//   week2 photo-1503676260728-1c00da094a0b   the teacher's desk, stacked
//   week3 photo-1522202176988-66273c2fd55f   a study group, laughing
//   week4 photo-1434030216411-0b793f4b4173   working through papers
const WEEKS = [
  { k: "w1", img: "/marketing/photos/week1.jpg" },
  { k: "w2", img: "/marketing/photos/week2.jpg" },
  { k: "w3", img: "/marketing/photos/week3.jpg" },
  { k: "w4", img: "/marketing/photos/week4.jpg" },
] as const;
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
      <div className={s.termBack} aria-hidden="true" />
      <div className={s.termTrack} ref={track}>
        <div className={s.termIntro}>
          <h2 className={s.sectionTitle}>{t("mk.term.title")}</h2>
          <p className={s.body} style={{ marginTop: 16 }}>
            {t("mk.term.lede")}
          </p>
          {/* The whole term in one line, so the section's claim is
              checkable at a glance before a single card is read. */}
          <p className={s.termSum}>{t("mk.term.sum")}</p>
          <p className={s.small} style={{ marginTop: 14 }}>
            {t("mk.term.demo")}
          </p>
        </div>

        {WEEKS.map(({ k, img }) => (
          <article className={s.week} key={k} data-week data-tilt>
            <div className={s.weekTop}>
              <p className={s.weekRange}>
                <span className={s.weekNode} aria-hidden="true" />
                {t(`mk.term.${k}.range` as never)}
              </p>
            </div>
            <div className={s.weekMedia}>
              <Image
                src={img}
                alt={t(`mk.term.${k}.alt` as never)}
                width={900}
                height={600}
                sizes="(max-width: 900px) 100vw, 380px"
                className={s.weekImg}
              />
            </div>
            <div className={s.weekText}>
              <h3 className={s.weekTitle}>{t(`mk.term.${k}.title` as never)}</h3>
              <p className={s.weekBody}>{t(`mk.term.${k}.body` as never)}</p>
              <p className={s.weekMeta}>{t(`mk.term.${k}.meta` as never)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
