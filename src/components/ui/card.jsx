import React from "react";

// Shared card frame. Two elevation levels (`flat` for inline tiles,
// `raised` for hero/feature cards) and an optional `interactive` prop
// that adds the .murchid-lift hover affordance + a focus ring so the
// whole card behaves as a single pressable surface.
//
// Tokens (--shadow-1/2, --ease-out-quint, etc.) live in src/index.css.
const ELEVATIONS = {
  flat:
    "bg-paper-cool rounded-2xl border border-[color:var(--color-line)] " +
    "shadow-[var(--shadow-1)]",
  raised:
    "bg-paper-cool rounded-2xl border border-[color:var(--color-line)] " +
    "shadow-[var(--shadow-2)]",
};

export function Card({
  className = "",
  elevation = "flat",
  interactive = false,
  children,
  ...props
}) {
  const cls = [
    ELEVATIONS[elevation] || ELEVATIONS.flat,
    interactive ? "murchid-lift murchid-focus cursor-pointer" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
