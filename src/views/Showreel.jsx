// =====================================================================
// Murchid — Showreel ("Watch it draft")
//
// A cinematic product film on a dark stage. The framed "studio screen"
// auto-plays a loop: a topic sits in the prompt, lines stream in, the six
// teaching artifacts check off one by one, then "Ready · 0:38" — like a
// screen recording of Murchid working. The frame + caption reveal on
// scroll (useViewportProgress); the demo loop itself is pure CSS, so it
// plays on its own. Bilingual via useT(); reduced-motion freezes it on a
// finished frame (see landing.css).
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const ART = ["lesson", "quiz", "deck", "presentation", "activity", "homework"];

// Reveal as the section passes through the viewport (motion tied to scroll).
function useViewportProgress(ref) {
  const [vp, setVp] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVp(1);
      return undefined;
    }
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        setVp(clamp01((vh - r.top) / (vh + r.height)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
  return vp;
}

export default function Showreel() {
  const t = useT();
  const ref = useRef(null);
  const vp = useViewportProgress(ref);
  const reveal = easeInOut(clamp01((vp - 0.04) / 0.3));

  return (
    <section ref={ref} className="film-stage">
      <div className="film-grain" aria-hidden="true" />
      <div
        className="film-shell"
        style={{ opacity: reveal, transform: `translateY(${lerp(48, 0, reveal)}px)` }}
      >
        <header className="film-head">
          <span className="film-eyebrow">{t("film.eyebrow")}</span>
          <h2 className="film-title">
            {t("film.title.a")} <em>{t("film.title.em")}</em>
          </h2>
          <p className="film-sub">{t("film.sub")}</p>
        </header>

        <div className="film-frame" style={{ transform: `scale(${lerp(0.965, 1, reveal)})` }}>
          <div className="film-bezel">
            <span className="film-rec" aria-hidden="true">
              <span className="film-rec-dot" />
              REC
            </span>
            <div className="film-screen" role="img" aria-label={t("film.sub")}>
              <div className="film-titlebar" aria-hidden="true">
                <span className="film-dot" />
                <span className="film-dot" />
                <span className="film-dot" />
                <span className="film-windowtitle">{t("film.windowTitle")}</span>
              </div>

              <div className="film-prompt">
                <span className="film-prompt-label">{t("film.prompt")}</span>
                <span className="film-caret" aria-hidden="true" />
              </div>

              <div className="film-status">{t("film.drafting")}</div>

              <div className="film-lines" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="film-line" style={{ "--i": i }} />
                ))}
              </div>

              <div className="film-chips" aria-hidden="true">
                {ART.map((k, i) => (
                  <span key={k} className="film-chip" style={{ "--i": i }}>
                    <span className="film-check" />
                    {t(`atl.art.${k}`)}
                  </span>
                ))}
              </div>

              <div className="film-ready">{t("film.ready")}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
