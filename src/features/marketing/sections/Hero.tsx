"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useT } from "@/shared/i18n";
import ThemedShot from "../ThemedShot";
import s from "../Landing.module.css";

// Asymmetric split hero.
//
// The image is a real screenshot of the planner holding a seeded term,
// captured from the running app in both themes (see ThemedShot).
//
// MOTION, two authored moments:
//
// 1. ENTRANCE (plays once): the headline arrives word by word out of a
//    masked line, then lede, actions, and the screenshot settling last —
//    hierarchy performed in reading order.
//
// 2. THE TAKEOVER (scrubbed): the hero pins briefly, and the very first
//    wheel tick starts the planner growing toward centre stage while the
//    copy cedes ground — the product literally takes over the viewport,
//    which is the page's whole argument. Scrubbed, so it plays in reverse
//    when you scroll back up; the invitation works in both directions.
//
// Transform-only, desktop-only for the pin, and skipped entirely under
// prefers-reduced-motion and the product's own motion-stop toggle.

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

export default function Hero() {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const shot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current || motionIsStopped()) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from("[data-hero-word]", { yPercent: 115, duration: 0.7, stagger: 0.045 })
          .from("[data-hero-lede]", { y: 24, duration: 0.55 }, "-=0.4")
          .from("[data-hero-actions]", { y: 16, duration: 0.5 }, "-=0.38")
          .from(shot.current, { y: 44, scale: 0.98, duration: 0.85 }, "-=0.5");

        // The takeover. transformOrigin follows the writing direction so
        // the shot grows toward the copy it is displacing in RTL too.
        mm.add("(min-width: 900px)", () => {
          const rtl = document.documentElement.dir === "rtl";
          const tl = gsap
            .timeline({
              scrollTrigger: {
                trigger: root.current,
                start: "top top",
                end: "+=60%",
                pin: true,
                scrub: 0.8,
                invalidateOnRefresh: true,
              },
            })
            .to("[data-hero-copy]", { y: -52, ease: "none" }, 0)
            .to(
              shot.current,
              {
                scale: 1.13,
                y: -26,
                transformOrigin: rtl ? "right center" : "left center",
                ease: "none",
              },
              0
            );
          return () => {
            tl.scrollTrigger?.kill();
            tl.kill();
          };
        });
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

      <div className={s.heroShot} ref={shot}>
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
