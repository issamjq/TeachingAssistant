import React, { useId } from "react";

export function Field({
  label,
  helper,
  error,
  required = false,
  children,
  className = "",
}) {
  const id = useId();
  const helperId = helper || error ? `${id}-help` : undefined;

  const child = React.isValidElement(children)
    ? React.cloneElement(children, {
        id,
        "aria-describedby": helperId,
        invalid: Boolean(error),
      })
    : children;

  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-semibold tracking-[0.06em] uppercase text-ink-soft"
        >
          {label}
          {required && (
            <span className="text-[var(--color-danger)] ms-0.5" aria-hidden>*</span>
          )}
        </label>
      )}
      {child}
      {error ? (
        <p
          id={helperId}
          role="alert"
          className="text-[13px] text-[var(--color-danger)] mt-0.5"
        >
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="text-[13px] text-muted mt-0.5">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
