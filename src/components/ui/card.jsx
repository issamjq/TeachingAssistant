import React from "react";

// Shared card frame — matches the Studio AI hero / Planner calendar
// look: warm-gray hairline border + a soft drop shadow. Used across
// the whole app so every "card" reads as the same object.
export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`bg-paper-cool rounded-2xl border border-[#e6dccb] shadow-[0_18px_44px_-22px_rgba(15,20,16,0.14)] ${className}`}
      {...props}
    >
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
