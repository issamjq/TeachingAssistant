"use client";

// =====================================================================
// The hero
//
// A full-bleed dark band the nav sits inside, product shots stacked at
// an angle on the right with callouts floating off them, and a torn edge
// where the band gives way to the cream page below.
//
// The reference for this layout ran on oxblood. We are not oxblood — the
// palette is cream paper, near-black ink and a teal accent — so the band
// is built from `--ink` with an accent wash rather than a borrowed
// colour. Same structure, our material.
//
// The headline deliberately mixes the two faces already in the type
// system: Inter Tight for the statement, Fraunces italic for the phrase
// it turns on. That contrast is what the reference is doing with its own
// pairing, and we get it without adding a font.
//
// The shots are REAL screens — /studio composing and the lesson library
// — not drawings of them. A hero that shows a product which does not
// look like that is a promise the first login breaks.
// =====================================================================
import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ArrowRight, Sparkles, CalendarCheck, FileCheck2, Layers } from "lucide-react";
import { useT } from "@/shared/i18n";
import { motionIsStopped } from "../useReveal";
import s from "../Landing.module.css";

/**
 * The callouts pinned to the shots.
 *
 * Each names something the product actually does, in the words a teacher
 * would use. Position is per-callout because they hang off specific
 * parts of the screenshots underneath — a generic corner placement would
 * float them over nothing.
 */
const CALLOUTS = [
  { key: "brief", icon: Sparkles, cls: "calloutOne" },
  { key: "materials", icon: Layers, cls: "calloutTwo" },
  { key: "scheduled", icon: CalendarCheck, cls: "calloutThree" },
  { key: "marked", icon: FileCheck2, cls: "calloutFour" },
] as const;

export default function Hero() {
  const t = useT();
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current || motionIsStopped()) return;
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from("[data-hero-eyebrow]", { y: 14, opacity: 0, duration: 0.5 })
          .from("[data-hero-title]", { y: 26, opacity: 0, duration: 0.72 }, "-=0.3")
          .from("[data-hero-lede]", { y: 18, opacity: 0, duration: 0.55 }, "-=0.45")
          .from("[data-hero-actions]", { y: 14, opacity: 0, duration: 0.5 }, "-=0.4")
          .from("[data-shot-back]", { y: 40, opacity: 0, duration: 0.8 }, "-=0.6")
          .from("[data-shot-front]", { y: 48, opacity: 0, duration: 0.8 }, "-=0.62")
          .from(
            "[data-callout]",
            { scale: 0.86, opacity: 0, duration: 0.5, stagger: 0.1, ease: "back.out(1.6)" },
            "-=0.4",
          );
      }, root);
      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return (
    <section className={s.hero} id="top" ref={root}>
      <div className={s.heroInner}>
        {/* ── Left: the claim ─────────────────────────────────────── */}
        <div className={s.heroCopy}>
          <p className={s.heroEyebrow} data-hero-eyebrow>
            <span className={s.heroEyebrowDot} aria-hidden="true" />
            {t("mk.hero.eyebrow")}
          </p>

          {/* Two faces, one sentence, set to WRAP rather than to break
              per phrase. Giving each phrase its own line staircased the
              block and made "of ideas." a line of its own; letting it
              flow is what the reference is actually doing. */}
          <h1 className={s.heroTitle} data-hero-title>
            {t("mk.hero.lineA")}{" "}
            <em className={s.heroTitleAccent}>{t("mk.hero.lineB")}</em>{" "}
            {t("mk.hero.lineC")}
          </h1>

          <p className={s.heroLede} data-hero-lede>
            {t("mk.hero.lede")}
          </p>

          <div className={s.heroActions} data-hero-actions>
            <Link href="/signup" className={s.heroCta}>
              <span>{t("mk.hero.cta.trial")}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <a href="#how" className={s.heroCtaGhost}>
              {t("mk.cta.secondary")}
            </a>
          </div>

          <p className={s.heroFinePrint}>{t("mk.hero.finePrint")}</p>
        </div>

        {/* ── Right: the product, at an angle ─────────────────────── */}
        <div className={s.heroStage}>
          {/* Behind: what came out of it. */}
          <div className={s.shotBack} data-shot-back>
            <Image
              src="/marketing/studio-library.jpg"
              alt={t("mk.hero.shot.library")}
              width={1400}
              height={663}
              sizes="(max-width: 1024px) 90vw, 46vw"
              className={s.shotImg}
            />
          </div>

          {/* In front: where a teacher starts. */}
          <div className={s.shotFront} data-shot-front>
            <Image
              src="/marketing/studio-compose.jpg"
              alt={t("mk.hero.shot.compose")}
              width={1400}
              height={663}
              priority
              sizes="(max-width: 1024px) 96vw, 50vw"
              className={s.shotImg}
            />
          </div>

          {CALLOUTS.map(({ key, icon: Icon, cls }) => (
            <span
              key={key}
              className={`${s.callout} ${s[cls]}`}
              data-callout
            >
              <Icon size={13} aria-hidden="true" />
              {t(`mk.hero.callout.${key}` as Parameters<typeof t>[0])}
            </span>
          ))}
        </div>
      </div>

      {/* The torn edge. Decorative — the band has to end somewhere and a
          ruled line would be the one straight thing on the page. */}
      <div className={s.heroTear} aria-hidden="true">
        <svg viewBox="0 0 1440 88" preserveAspectRatio="none" focusable="false">
          <path
            d="M0 63 C 42 47, 74 74, 118 62 C 163 50, 191 71, 236 66 C 284 60, 305 42, 352 51
               C 398 60, 421 79, 470 70 C 517 62, 540 44, 588 49 C 638 54, 660 76, 710 69
               C 757 62, 779 46, 828 52 C 876 58, 902 77, 951 70 C 998 63, 1020 45, 1068 50
               C 1117 55, 1141 75, 1190 68 C 1236 61, 1259 45, 1307 51
               C 1354 57, 1386 72, 1440 60 L 1440 88 L 0 88 Z"
          />
        </svg>
      </div>
    </section>
  );
}
