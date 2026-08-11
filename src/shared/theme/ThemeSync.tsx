"use client";

import { useEffect } from "react";

// Re-applies the saved theme after hydration, and keeps "Auto" live.
//
// THEME_BOOTSTRAP in app/layout.tsx stamps data-theme="dark" on <html>
// before first paint when the visitor's choice calls for it. But the server
// never renders that attribute, so React REMOVES it while hydrating
// (measured: "dark" at commit, gone once hydrated; suppressHydrationWarning
// only silences the warning). This restores it. Two passes on purpose: the
// inline script prevents the flash, this one survives hydration.
//
// LIGHT IS THE DEFAULT. No stored choice means light, whatever the device
// prefers. "system" (the panel's "Auto") is the only state that consults
// the device, and it does so here in JS because there is deliberately no
// prefers-color-scheme block in the CSS.

const KEY = "murchid.theme";

function computeDark(stored: string | null, deviceDark: boolean): boolean {
  return stored === "dark" || (stored === "system" && deviceDark);
}

export default function ThemeSync() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      try {
        const stored = localStorage.getItem(KEY);
        const el = document.documentElement;
        if (computeDark(stored, mq.matches)) el.dataset.theme = "dark";
        else delete el.dataset.theme;
      } catch {
        /* unreadable storage means the default, which is light */
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return null;
}
