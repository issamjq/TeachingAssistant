"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Target,
  Layers,
  Sparkle,
  BookOpen,
  Presentation,
  ListChecks,
} from "lucide-react";
import { useT } from "@/shared/i18n";
import { motionIsStopped } from "../useReveal";
import s from "../Landing.module.css";

export default function Hero() {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const shot = useRef<HTMLDivElement>(null);

  // GSAP entrance choreography
  useEffect(() => {
    if (!root.current || motionIsStopped()) return;
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from("[data-hero-pill]", { y: 16, opacity: 0, duration: 0.5 })
          .from("[data-hero-title]", { y: 28, opacity: 0, duration: 0.7 }, "-=0.35")
          .from("[data-hero-lede]", { y: 20, opacity: 0, duration: 0.55 }, "-=0.45")
          .from("[data-hero-actions]", { y: 16, opacity: 0, duration: 0.5 }, "-=0.38")
          .from("[data-hero-trust]", { y: 12, opacity: 0, duration: 0.45 }, "-=0.35")
          .from(shot.current, { y: 36, scale: 0.97, opacity: 0, duration: 0.85 }, "-=0.55")
          .from("[data-floating-badge]", { scale: 0.85, opacity: 0, duration: 0.6, stagger: 0.12, ease: "back.out(1.7)" }, "-=0.4");
      }, root);
      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return (
    <section className={s.hero} id="top" ref={root}>
      {/* Left Column: Value Proposition, Master Headline, CTAs */}
      <div className={s.heroCopy} data-hero-copy>
        {/* Floating Eyebrow Pill */}
        <div className={s.heroEyebrowPill} data-hero-pill>
          <span className={s.pulsingDot} aria-hidden="true" />
          <Sparkles size={14} className={s.eyebrowIcon} aria-hidden="true" />
          <span>{t("mk.hero.eyebrow")}</span>
        </div>

        {/* Master Display Headline */}
        <h1 className={s.heroTitle} data-hero-title>
          <span className={s.heroTitleLead}>{t("mk.hero.headlineA")}</span>{" "}
          <em className={s.heroTitleAccent}>{t("mk.hero.headlineB")}</em>
        </h1>

        {/* Understandability Lede */}
        <p className={s.heroLede} data-hero-lede>
          {t("mk.hero.lede")}
        </p>

        {/* Main Actions */}
        <div className={s.heroActions} data-hero-actions>
          <Link href="/signup" className={s.btnPrimaryHero}>
            <span>{t("mk.hero.cta.trial")}</span>
            <ArrowRight size={17} className={s.btnArrow} aria-hidden="true" />
          </Link>
          <a href="#how" className={s.btnGhostHero}>
            <span>{t("mk.cta.secondary")}</span>
          </a>
        </div>

        {/* Value & Trust Badges Strip */}
        <div className={s.heroTrustStrip} data-hero-trust>
          <div className={s.trustItem}>
            <CheckCircle2 size={15} className={s.trustCheck} aria-hidden="true" />
            <span>{t("mk.hero.trust.nocard")}</span>
          </div>
          <span className={s.trustDot} aria-hidden="true">·</span>
          <div className={s.trustItem}>
            <CheckCircle2 size={15} className={s.trustCheck} aria-hidden="true" />
            <span>{t("mk.hero.trust.bilingual")}</span>
          </div>
          <span className={s.trustDot} aria-hidden="true">·</span>
          <div className={s.trustItem}>
            <CheckCircle2 size={15} className={s.trustCheck} aria-hidden="true" />
            <span>{t("mk.hero.trust.export")}</span>
          </div>
        </div>
      </div>

      {/* Right Column: Platform Visual Showcase & Floating Glass Cards */}
      <div
        className={s.heroShot}
        ref={shot}
        data-hero-shot
      >
        {/* Floating Highlight Badge: Prep Time Saved */}
        <div className={`${s.floatingBadge} ${s.badgeTopLeft}`} data-floating-badge>
          <div className={s.badgeIconWrap}>
            <Clock size={14} className={s.badgeIcon} />
          </div>
          <div className={s.badgeText}>
            <span className={s.badgeTitle}>{t("mk.hero.badge.time")}</span>
          </div>
        </div>

        {/* Floating Highlight Badge: Synced Materials */}
        <div className={`${s.floatingBadge} ${s.badgeTopRight}`} data-floating-badge>
          <div className={s.badgeIconWrap}>
            <Layers size={14} className={s.badgeIcon} />
          </div>
          <div className={s.badgeText}>
            <span className={s.badgeTitle}>{t("mk.hero.badge.synced")}</span>
          </div>
        </div>

        {/* Floating Highlight Badge: Curriculum Alignment */}
        <div className={`${s.floatingBadge} ${s.badgeBottomRight}`} data-floating-badge>
          <div className={s.badgeIconWrap}>
            <Target size={14} className={s.badgeIcon} />
          </div>
          <div className={s.badgeText}>
            <span className={s.badgeTitle}>{t("mk.hero.badge.aligned")}</span>
          </div>
        </div>

        {/* Main Visual Frame */}
        <div className={s.heroImgFrame}>
          <Image
            src="/marketing/hero-director.jpg"
            alt="Murchid AI Lesson Director for Teachers"
            width={1280}
            height={720}
            priority
            sizes="(max-width: 960px) 100vw, 55vw"
            className={s.heroDirectorImg}
          />

          {/* Frosted Glass Overlay Card */}
          <div className={s.heroGlassOverlay}>
            <div className={s.glassHeader}>
              <span className={s.glassPulseDot} aria-hidden="true" />
              <span className={s.glassPillText}>AI LESSON DIRECTOR · KG–G12</span>
              <Sparkle size={12} className={s.glassSparkle} aria-hidden="true" />
            </div>

            <p className={s.glassTitle}>
              One brief produces your entire term’s lesson plans, slides, quizzes & rubrics.
            </p>

            <div className={s.glassArtifactTags}>
              <span className={s.glassTag}>
                <BookOpen size={12} className={s.glassTagIcon} />
                <span>Plans</span>
              </span>
              <span className={s.glassTag}>
                <Presentation size={12} className={s.glassTagIcon} />
                <span>Decks</span>
              </span>
              <span className={s.glassTag}>
                <ListChecks size={12} className={s.glassTagIcon} />
                <span>Quizzes</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

