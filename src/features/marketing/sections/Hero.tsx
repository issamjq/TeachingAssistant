"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { Sparkles, CalendarCheck2, Languages } from "lucide-react";
import { useI18n } from "@/shared/i18n";
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
//
// ── The stage ───────────────────────────────────────────────────────
// The shot is now the DASHBOARD rather than the planner, because the
// dashboard is the screen that says "this is a product with your class
// in it" at a glance: a name, a roster count, a term rhythm, a calendar.
// The planner is the better picture of the work, and it is still what
// the ImageCourier flies into first on scroll.
//
// Around it float three pills naming what the platform actually does.
// They overlap the frame on purpose — a label sitting ON the interface
// reads as a caption of that interface, where the same words in a row
// underneath read as marketing. That means the frame can no longer clip
// its own children, so `.heroShot` keeps the rounding and the overflow
// and `.heroStage` — which the pills are positioned against — does not.
//
// `data-hero-shot` stays on the FRAME, not the stage: ImageCourier
// measures that rect to know where the travelling window starts, and it
// has to match the image, not the image plus its floating furniture.

/**
 * Three claims, each one a thing the product does, not an adjective.
 *
 * They replace a set that could not be checked — "4.5 hrs saved / week"
 * is a number nobody measured, and "MoE & Cambridge Aligned" is a badge
 * rather than a behaviour. These three each point at something the
 * visitor can see on the screen behind them or verify in the trial: the
 * trio it drafts, where that work lands, and the language it lands in.
 *
 * The middle one is the whole argument against a general chatbot. Any
 * model will write you a quiz; this one puts it on Tuesday's period 3
 * with the class already attached.
 */
const PILLS = [
  { key: "mk.hero.pill.brief", icon: Sparkles, where: "pillA" },
  { key: "mk.hero.pill.schedule", icon: CalendarCheck2, where: "pillB" },
  { key: "mk.hero.pill.lang", icon: Languages, where: "pillC" },
] as const;

export default function Hero() {
  const { t, lang } = useI18n();
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  // The entrance runs ONCE, on first mount, and never again.
  //
  // Rebuilding it per language was the obvious fix and the wrong one:
  // the new timeline is created while the previous matchMedia context is
  // being reverted, and it comes out stuck at time zero — the stage
  // frozen at translateY(44px), the words at 49%/67%/89% of their
  // travel, the pills at opacity 0 and therefore invisible for good.
  //
  // A first-load flourish does not need to replay when someone switches
  // to Arabic. So the timeline keeps its empty dependency array, and the
  // second effect below simply removes whatever inline styles it wrote
  // once the language changes. The resting state then comes from the
  // CSS, which is the only place that can be trusted to have it.
  useEffect(() => {
    if (!root.current || motionIsStopped()) return;
    const scope = root.current;
    const mm = gsap.matchMedia();

    /**
     * Hand every animated element back to the stylesheet.
     *
     * `transform` rather than `all`: opacity on the pills is the scroll
     * hand-off's, and clearing it here would undo a scrub mid-flight.
     */
    const settle = () =>
      gsap.set(
        scope.querySelectorAll("[data-hero-word], [data-hero-pill], [data-hero-stage]"),
        { clearProps: "transform" }
      );

    /**
     * The deadline.
     *
     * The entrance is about 1.5s of tweening, and if it has not finished
     * by 2.5s it is not going to: under some re-render and matchMedia
     * orderings the timeline is built but never advances, and it strands
     * whatever it was holding — the headline at a third of its travel,
     * the pills at opacity 0, which is a caption that is never coming.
     *
     * A flourish is allowed to be skipped. It is not allowed to leave
     * the page broken, so this fires regardless and the CSS resting
     * state wins. On a normal load the timeline has long since finished
     * and clearing is a no-op.
     */
    const deadline = window.setTimeout(settle, 2500);

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap
          .timeline({ defaults: { ease: "power3.out" }, onComplete: settle })
          .from("[data-hero-word]", { yPercent: 115, duration: 0.7, stagger: 0.045 })
          .from("[data-hero-lede]", { y: 24, duration: 0.55 }, "-=0.4")
          .from("[data-hero-actions]", { y: 16, duration: 0.5 }, "-=0.38")
          .from(stage.current, { y: 44, scale: 0.98, duration: 0.85 }, "-=0.5")
          // The pills arrive AFTER the screen they annotate, or they read
          // as chrome that was always there rather than as captions of it.
          //
          // Transform only, deliberately: OPACITY belongs to the scroll
          // hand-off below and nothing else may touch it. When both owned
          // it, the entrance's safety-clear could reset a pill to fully
          // visible in the middle of a scrub — a pill blinking back on
          // over the travelling window — and a stalled entrance could
          // strand one at zero. One property, one owner, no argument.
          .from(
            "[data-hero-pill]",
            { y: 10, scale: 0.94, duration: 0.45, stagger: 0.09 },
            "-=0.45"
          );
      }, root);
      return () => ctx.revert();
    });

    return () => {
      window.clearTimeout(deadline);
      mm.revert();
      settle();
    };
  }, []);

  // Language switched: hand the elements back to the stylesheet.
  //
  // The headline is keyed by index, so React REUSES the first spans and
  // only drops the surplus — eight English words become five Arabic ones
  // in the same first five nodes. Any tween still holding those nodes
  // carries straight over to the new text.
  //
  // Which is why the kill comes before the clear, and why clearing alone
  // was not enough: it ran, the words went clean, and the live timeline
  // wrote its next frame onto three of them a moment later — leaving
  // "سلِّم الفصل الدراسي" shoved two thirds of the way down while the two
  // words after it sat correctly, because their tweens had finished.
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const nodes = scope.querySelectorAll(
      "[data-hero-word], [data-hero-pill], [data-hero-stage]"
    );
    gsap.killTweensOf(nodes);
    gsap.set(nodes, { clearProps: "transform" });
  }, [lang]);

  // Split so the closing word can carry the accent. The title is one
  // translated string — splitting on spaces keeps Arabic working, where
  // the "last word" is the last one in reading order either way.
  const words = t("mk.hero.title").split(" ");

  return (
    <section className={s.hero} id="top" ref={root}>
      <div className={s.heroCopy} data-hero-copy>
        <h1 className={s.heroTitle}>
          {words.map((w, i) => (
            <span key={i} className={s.word}>
              <span
                data-hero-word
                className={`${s.wordInner} ${i === words.length - 1 ? s.wordAccent : ""}`}
              >
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

      <div className={s.heroStage} ref={stage} data-hero-stage>
        {/* A wash, not a panel: the blue belongs behind the product, and
            the page stays white. */}
        <div className={s.heroGlow} aria-hidden="true" />

        <div className={s.heroShot} data-hero-shot>
          <ThemedShot
            src="/marketing/dashboard.jpg"
            alt={t("mk.shot.dashboard")}
            width={1800}
            height={1125}
            priority
            sizes="(max-width: 900px) 100vw, 58vw"
            className={s.shotImg}
          />
        </div>

        {/* The second screen.

            The reference stacks two panels, and the reason it works is
            not decoration: one window is a picture of a screen, two
            overlapping windows are a picture of a PRODUCT — something
            with more than one room in it. The studio is the right second
            room, because the dashboard shows what a teacher HAS and the
            library shows what she can start from.

            Not the studio, which was the first choice and the wrong one:
            it is a deliberately generous, mostly-empty screen, and at
            46% width it shrank to a white rectangle that read as a
            broken image. The library is dense at any size.

            aria-hidden and no alt: it is the same claim the main shot
            already makes, and a screen reader does not need it twice. */}
        <div className={s.heroInset} aria-hidden="true">
          <ThemedShot
            src="/marketing/lesson-plans.jpg"
            alt=""
            width={1800}
            height={1125}
            sizes="30vw"
            className={s.insetImg}
          />
        </div>

        {PILLS.map(({ key, icon: Icon, where }) => (
          <span
            key={key}
            className={`${s.pill} ${s[where]}`}
            data-hero-pill
          >
            <Icon size={14} strokeWidth={2} aria-hidden="true" />
            {t(key)}
          </span>
        ))}
      </div>
    </section>
  );
}
