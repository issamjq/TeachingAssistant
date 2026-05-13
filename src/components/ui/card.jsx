import React from "react";

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`bg-paper-cool rounded-2xl border border-line ${className}`}
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
