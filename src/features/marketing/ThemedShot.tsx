"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// A product screenshot that follows the page's theme.
//
// The captures are REAL screens of the running studio, which itself has
// light and dark modes now — so in dark mode the page shows the dark
// product, not a dimmed light screenshot glaring on a dark ground. The
// dark files sit beside the light ones as `<name>-dark.jpg`.
//
// Theme is read from <html data-theme> via a MutationObserver rather than
// from a media query: light is the product default and dark is a stored
// choice, so the attribute is the only source of truth. Exactly one
// <Image> renders at a time — a hidden second image would still download
// its ~200KB for every visitor.
//
// The server always renders the light src (light is the default, and the
// server cannot read storage). A returning dark-mode visitor sees the
// light image for the first paint moments until the observer fires; that
// brief swap costs less than double-shipping every screenshot.

function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.dataset.theme === "dark");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

type Props = {
  /** Path of the light capture, e.g. "/marketing/planner.jpg". */
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
};

export default function ThemedShot({ src, ...rest }: Props) {
  const dark = useIsDark();
  const themed = dark ? src.replace(/\.jpg$/, "-dark.jpg") : src;
  // eslint-disable-next-line jsx-a11y/alt-text -- alt arrives via ...rest
  return <Image src={themed} {...rest} />;
}
