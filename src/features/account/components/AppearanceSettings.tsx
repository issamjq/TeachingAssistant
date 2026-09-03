"use client";

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import {
  PALETTES,
  PALETTE_META,
  DEFAULT_PALETTE,
  getPalette,
  setPalette,
  onPaletteChange,
  type Palette,
} from "@/config/palette";
import styles from "./AppearanceSettings.module.css";

// Account → Appearance.
//
// The palette is a device preference, not an account field: it applies
// immediately and everywhere, including the logged-out landing page, so a
// returning teacher never sees it change under them at login. That is why
// there is no Save button — picking IS the change, and reverting is one
// click away.

export default function AppearanceSettings() {
  // The palette lives outside React — localStorage plus a listener set — so
  // it is read with the hook built for exactly that. getServerSnapshot hands
  // the server the default, the client subscribes and reads the stored value,
  // and the two reconcile without the state-in-effect cascade the previous
  // mount-and-correct version needed. Same hydration safety, one render less,
  // and the subscription replaces the manual unsubscribe.
  const active = useSyncExternalStore(
    onPaletteChange,
    getPalette,
    () => DEFAULT_PALETTE
  );

  return (
    <section>
      <header className={styles.head}>
        <h3 className={styles.title}>
          Colour <em>theme</em>
        </h3>
        <p className={styles.lede}>
          Applies to everything you see — the studio and the public site. Saved
          on this device, so choose per screen if you work across a laptop and a
          classroom display.
        </p>
      </header>

      <div className={styles.grid} role="radiogroup" aria-label="Colour theme">
        {PALETTES.map((id) => {
          const meta = PALETTE_META[id];
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPalette(id)}
              className={`${styles.card} ${on ? styles.cardOn : ""}`}
            >
              {/* Real paper/line/accent from the palette, so the preview is
                  the thing itself rather than an approximation. */}
              <span className={styles.preview} aria-hidden="true">
                {meta.swatches.map((c, i) => (
                  <span
                    key={i}
                    className={styles.swatch}
                    style={{ background: c }}
                  />
                ))}
              </span>

              <span className={styles.body}>
                <span className={styles.name}>
                  {meta.name}
                  {on && (
                    <span className={styles.check}>
                      <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                      <span className={styles.srOnly}>Selected</span>
                    </span>
                  )}
                </span>
                <span className={styles.origin}>{meta.origin}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
