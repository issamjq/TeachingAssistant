import React from "react";
import { Loader2 } from "lucide-react";

const sizes = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
  lg: "h-12 px-5 text-[15px] gap-2.5",
};

const variants = {
  primary:
    "bg-accent text-paper-cool hover:brightness-105 active:scale-[0.98]",
  secondary:
    "bg-paper-cool text-ink border border-[var(--color-border-strong)] hover:border-[var(--color-accent)]",
  ghost:
    "bg-transparent text-ink-soft hover:bg-[var(--color-surface-sunken)] hover:text-ink",
  destructive:
    "bg-paper-cool text-[var(--color-danger)] border border-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)]",
  // Legacy aliases — preserved so v1.1 callers don't break.
  outline:
    "bg-paper-cool text-accent border border-[var(--color-accent)] hover:bg-paper-warm",
  danger:
    "bg-paper-cool text-accent border border-[var(--color-accent)] hover:bg-accent hover:text-paper-cool",
};

const base =
  "inline-flex items-center justify-center font-medium rounded-[8px] " +
  "transition-[transform,background-color,border-color,color,filter] duration-150 " +
  "disabled:opacity-50 disabled:pointer-events-none " +
  "select-none whitespace-nowrap";

function Dots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className="dot-a w-1 h-1 rounded-full bg-current opacity-70" />
      <span className="dot-b w-1 h-1 rounded-full bg-current opacity-70" />
      <span className="dot-c w-1 h-1 rounded-full bg-current opacity-70" />
      <style>{`
        .dot-a, .dot-b, .dot-c { animation: dot-pulse 1100ms ease-in-out infinite; }
        .dot-b { animation-delay: 140ms; }
        .dot-c { animation-delay: 280ms; }
        @keyframes dot-pulse {
          0%, 60%, 100% { opacity: 0.4; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.2); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dot-a, .dot-b, .dot-c { animation: none; opacity: 0.7; }
        }
      `}</style>
    </span>
  );
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}) {
  return (
    <button
      className={[
        base,
        sizes[size] || sizes.md,
        variants[variant] || variants.primary,
        className,
      ].join(" ")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Dots /> : children}
    </button>
  );
}
