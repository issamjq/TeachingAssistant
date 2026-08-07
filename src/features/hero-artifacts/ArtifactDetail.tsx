"use client";

// =====================================================================
// Expanded detail for one hero artifact.
//
// Rendered into a portal so it escapes the hero's pinned/transformed
// ancestors — a `position: fixed` child of a transformed element is
// positioned against that element, not the viewport, which would have
// pinned this panel to the scrubbing card row instead of the screen.
//
// Behaves as a modal dialog: focus moves in on open and returns to the
// invoking card on close, Escape dismisses, the background is inert to
// screen readers, and body scroll is locked while it is up.
// =====================================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import HeroArtifact, { type ArtifactKind } from "./HeroArtifact";
import s from "./ArtifactDetail.module.css";

export interface ArtifactDetailProps {
  kind: ArtifactKind;
  /** 1-based position in the contents index, for the "01" label. */
  index: number;
  variant?: "a" | "b";
  onClose: () => void;
  onEnter?: () => void;
}

export default function ArtifactDetail({
  kind,
  index,
  variant = "b",
  onClose,
  onEnter,
}: ArtifactDetailProps) {
  const t = useT();
  const tk = (k: string): string => t(k as TranslationKey);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Portals need a DOM target, which does not exist during the server
  // render — mount on the client only.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Returning focus is what makes this usable by keyboard: without it
      // the next Tab starts from the top of the document.
      restoreTo?.focus?.();
    };
  }, [onClose]);

  const onScrimClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!mounted) return null;

  const bullets = [1, 2, 3].map((n) => tk(`atl.more.${kind}.b${n}`));

  return createPortal(
    <div className={s.scrim} onClick={onScrimClick}>
      <div
        ref={panelRef}
        className={s.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`atl-more-${kind}`}
        tabIndex={-1}
      >
        <button type="button" className={s.close} onClick={onClose} aria-label={tk("atl.more.close")}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M1 1 L12 12 M12 1 L1 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <div className={s.specimen}>
          <HeroArtifact kind={kind} variant={variant} />
        </div>

        <div className={s.copy}>
          <span className={s.num}>{String(index).padStart(2, "0")}</span>
          <h3 id={`atl-more-${kind}`} className={s.name}>
            {tk(`atl.art.${kind}`)}
          </h3>
          <p className={s.body}>{tk(`atl.more.${kind}.body`)}</p>

          <ul className={s.list}>
            {bullets.map((b, i) => (
              <li key={b} className={s.item} style={{ ["--i" as string]: i }}>
                <span className={s.check} aria-hidden="true">
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path
                      d="M1.6 4.7 L3.6 6.7 L7.4 2.5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {onEnter && (
            <div className={s.actions}>
              <button type="button" className="atl-pill lp-magnetic" onClick={onEnter}>
                {tk("atl.more.cta")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
