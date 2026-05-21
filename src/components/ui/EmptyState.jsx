import React from "react";
import { Button } from "./button";

export function EmptyState({ icon: Icon, title, body, action, secondaryAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 px-6">
      {Icon && (
        <div
          aria-hidden
          className="w-16 h-16 rounded-2xl grid place-items-center mb-5"
          style={{ background: "color-mix(in oklab, var(--color-accent) 12%, transparent)" }}
        >
          <Icon className="w-7 h-7 text-accent" strokeWidth={1.5} />
        </div>
      )}
      {title && (
        <h3 className="font-serif italic text-[24px] leading-[1.2] text-ink mb-2">
          {title}
        </h3>
      )}
      {body && (
        <p className="text-[15px] text-ink-soft leading-[1.6] mb-5">
          {body}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
