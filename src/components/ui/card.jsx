import React from "react";

export function Card({
  className = "",
  variant = "default",
  children,
  ...props
}) {
  const base = "rounded-[16px] bg-paper-cool";
  const styles = {
    default:
      "border border-[var(--color-border-subtle)]",
    hoverable:
      "border border-[var(--color-border-subtle)] transition-[transform,box-shadow] duration-200 " +
      "hover:-translate-y-[0.5px] hover:shadow-[var(--shadow-2)] cursor-pointer",
    elevated:
      "bg-[var(--color-surface-elevated)] shadow-[var(--shadow-3)]",
    sunken:
      "bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]",
  };
  return (
    <div className={[base, styles[variant] || styles.default, className].join(" ")} {...props}>
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
