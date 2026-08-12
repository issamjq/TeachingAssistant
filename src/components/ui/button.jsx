import React from "react";

// Murchid button — pressable, fluid, polished.
// Composes Tailwind utilities with the .murchid-pressable / .murchid-focus
// classes (see src/index.css) so every button gets the same press feedback
// and accessible focus ring without per-call boilerplate.
//
// Variants are PRODUCT-register (the Studio is a working tool, not a
// brand surface): ink primary, paper secondary, ghost tertiary, danger
// for destructive actions, and a drenched "clay" variant for the
// occasional brand moment (the Dashboard's now-playing CTA, the Planner
// schedule button).

// rounded-full → the landing's signature pill shape (the hero "Open the
// planner" CTA). Echoing it here makes every studio action read as part
// of the same family. Square icon sizes become clean circles.
const base =
  "murchid-pressable murchid-focus inline-flex items-center justify-center gap-1.5 " +
  "font-medium leading-none rounded-full whitespace-nowrap select-none " +
  "disabled:opacity-50 disabled:pointer-events-none";

// Sizes shape padding + font-size, not visual style.
const sizes = {
  xs: "px-2.5 py-1.5 text-xs",
  sm: "px-3   py-1.5 text-[13px]",
  md: "px-4   py-2   text-sm",
  lg: "px-5   py-2.5 text-[15px]",
  // Square icon-only buttons. Pair with an aria-label and a single icon.
  icon: "h-9 w-9 p-0 text-sm",
  "icon-sm": "h-7 w-7 p-0 text-xs",
};

const variants = {
  primary:
    "bg-ink text-paper-cool hover:bg-ink-soft active:bg-ink " +
    "shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-3)]",
  secondary:
    "bg-paper-cool text-ink border border-line hover:border-ink/40 hover:bg-paper-warm",
  // Subtle tertiary action — fades into the surface, comes alive on hover.
  ghost:
    "bg-transparent text-ink-soft hover:bg-ink/5 active:bg-ink/10",
  outline:
    "bg-transparent text-accent border border-accent/30 hover:border-accent hover:bg-accent/[0.06]",
  danger:
    "bg-transparent text-accent border border-accent/40 hover:bg-accent hover:text-paper-cool",
  // For the accent-drenched "loud" intro cards: paper against the red
  // ground, so the one action on the card is also its brightest thing.
  onAccent:
    "bg-paper-cool text-ink hover:bg-paper-warm active:bg-paper-cool " +
    "shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-3)]",
  // Drenched clay — for moments that should feel like an extension of
  // the landing hero. Use sparingly so it keeps its weight.
  clay:
    "text-cream border-0 hover:brightness-105 active:brightness-100 shadow-[0_1px_2px_rgba(20,18,12,0.18),0_12px_28px_rgba(20,18,12,0.18)]",
};

// Background for the drenched variant is too rich to express in a
// Tailwind class — keep it as inline style. Same shape every render so
// no re-paint thrash.
const VARIANT_STYLE = {
  clay: {
    background:
      "radial-gradient(ellipse at 0% 0%, oklch(0.62 0.13 40), transparent 65%), oklch(0.48 0.13 32)",
    color: "var(--color-cream)",
  },
};

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  fullWidth = false,
  children,
  // Default so TS consumers (.tsx features) see the prop as optional.
  style = undefined,
  ...props
}) {
  const cls = [
    base,
    sizes[size] || sizes.md,
    variants[variant] || variants.primary,
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const merged = VARIANT_STYLE[variant] ? { ...VARIANT_STYLE[variant], ...(style || {}) } : style;
  return (
    <button className={cls} style={merged} {...props}>
      {children}
    </button>
  );
}
