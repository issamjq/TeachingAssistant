import React, { forwardRef } from "react";

export const Input = forwardRef(function Input(
  { className = "", invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={[
        "w-full rounded-[8px] bg-paper-cool text-ink",
        "border border-[var(--color-border-subtle)]",
        "px-3 py-2.5 text-[15px] leading-[1.4]",
        "placeholder:text-[var(--color-text-muted)]",
        "transition-[border-color,box-shadow] duration-150",
        "focus:outline-none focus:border-[var(--color-accent)]",
        invalid
          ? "border-[var(--color-danger)] focus:border-[var(--color-danger)]"
          : "",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
      {...props}
    />
  );
});
