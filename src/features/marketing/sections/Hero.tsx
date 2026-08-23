"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useT } from "@/shared/i18n";
import ThemedShot from "../ThemedShot";
import { motionIsStopped } from "../useReveal";
import s from "../Landing.module.css";

// Asymmetric split hero.
//
// One authored entrance, and NO pin: the earlier versions held the
// visitor here — first for a takeover, then for a scrubbed film — and
// the owner's verdict was that being stuck watching media change is
// boring. So the hero now releases immediately, and its screenshot's
// job continues in the ImageCourier: on the first scroll the image
// SHRINKS INTO the travelling window and carries itself down the page,
// enlarging into each step's image in turn. The motion story starts
// here but never detains anyone.

export default function Hero() {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const shot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current || motionIsStopped()) return;
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from("[data-hero-word]", { yPercent: 115, duration: 0.7, stagger: 0.045 })
          .from("[data-hero-lede]", { y: 24, duration: 0.55 }, "-=0.4")
          .from("[data-hero-actions]", { y: 16, duration: 0.5 }, "-=0.38")
          .from(shot.current, { y: 44, scale: 0.98, duration: 0.85 }, "-=0.5");
      }, root);
      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  const words = t("mk.hero.title").split(" ");

  return (
    <section className={s.hero} id="top" ref={root}>
      <div className={s.heroCopy} data-hero-copy>
        <h1 className={s.heroTitle}>
          {words.map((w, i) => (
            <span key={i} className={s.word}>
              <span data-hero-word className={s.wordInner}>
                {w}
              </span>
            </span>
          ))}
        </h1>

        <p className={s.heroLede} data-hero-lede>
          {t("mk.hero.lede")}
        </p>

        <div className={s.heroActions} data-hero-actions>
          <Link href="/signup" className={s.btnPrimary}>
            {t("mk.cta.primary")}
          </Link>
          <a href="#how" className={s.btnGhost}>
            {t("mk.cta.secondary")}
          </a>
        </div>
      </div>

      <div className={s.heroShot} ref={shot} data-hero-shot>
        <ThemedShot
          src="/marketing/planner.jpg"
          alt={t("mk.shot.planner")}
          width={1800}
          height={1125}
          priority
          sizes="(max-width: 900px) 100vw, 58vw"
          className={s.shotImg}
        />
      </div>
    </section>
  );
}
