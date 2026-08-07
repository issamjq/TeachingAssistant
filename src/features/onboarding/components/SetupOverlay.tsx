"use client";

import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useMounted } from "@/shared/hooks/useMounted";
import { useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import MurchidLogo from "@/components/MurchidLogo";
import styles from "./SetupOverlay.module.css";

// First-launch setup overlay.
//
// Replaces a bare BrandLoader that was shown for the whole provisioning
// sequence. Two problems with that:
//
//   1. It rendered in `fullscreen` mode INSIDE an already-fullscreen portal.
//      BrandLoader's fullscreen variant wraps itself in an opaque bg-paper
//      block, and as a flex child that shrinks to its content width — so it
//      painted a narrow opaque column down the middle of the blurred
//      backdrop instead of covering it.
//
//   2. It said "Starting your free trial…" for the entire wait while three
//      separate network calls ran. A single unchanging line during a
//      multi-second wait reads as a hang.
//
// The stages below are the real ones — each maps to a call in
// handleChoosePlan — so the progress shown is honest rather than a timed
// animation pretending to be work.

export const SETUP_STAGES = ["account", "profile", "schools", "studio"] as const;
export type SetupStage = (typeof SETUP_STAGES)[number];

const STAGE_LABEL: Record<SetupStage, TranslationKey> = {
  account: "setup.step.account",
  profile: "setup.step.profile",
  schools: "setup.step.schools",
  studio: "setup.step.studio",
};

export default function SetupOverlay({ stage }: { stage: SetupStage }) {
  const t = useT();
  const mounted = useMounted();

  // Portals cannot be server-rendered; see useMounted.
  if (!mounted) return null;

  const index = SETUP_STAGES.indexOf(stage);
  // Fill reflects stages *completed*, plus a little for the one in flight,
  // so the bar always moves when the label changes.
  const pct = ((index + 0.5) / SETUP_STAGES.length) * 100;

  return createPortal(
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-label={t(STAGE_LABEL[stage])}
    >
      <div className={styles.panel}>
        <MurchidLogo
          className={styles.mark}
          style={{ "--murchid-logo-accent": "var(--color-accent)" } as React.CSSProperties}
        />

        <div className={styles.track}>
          <div className={styles.fill} style={{ inlineSize: `${pct}%` }} />
        </div>

        <ol className={styles.steps}>
          {SETUP_STAGES.map((s, i) => {
            const done = i < index;
            const active = i === index;
            return (
              <li
                key={s}
                className={`${styles.step} ${done ? styles.stepDone : ""} ${
                  active ? styles.stepActive : ""
                }`}
              >
                <span className={styles.marker} aria-hidden="true">
                  {done && <Check size={11} strokeWidth={3} />}
                  {active && <span className={styles.pulse} />}
                </span>
                {t(STAGE_LABEL[s])}
              </li>
            );
          })}
        </ol>

        <p className={styles.reassure}>{t("setup.reassure")}</p>
      </div>
    </div>,
    document.body
  );
}
