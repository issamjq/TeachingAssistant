import React from "react";

const base =
  "inline-flex items-center justify-center text-sm font-medium px-5 py-2.5 rounded-lg transition disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary: "bg-ink text-paper-cool hover:bg-accent",
  secondary: "bg-paper-cool text-ink border border-line hover:bg-paper-warm",
  outline: "bg-paper-cool text-accent border border-accent hover:bg-paper-warm",
  danger: "bg-paper-cool text-accent border border-accent hover:bg-accent hover:text-paper-cool",
};

export function Button({ className = "", variant = "primary", children, ...props }) {
  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
