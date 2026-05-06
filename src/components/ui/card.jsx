import React from "react";

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`bg-paper-cool rounded-xl border border-line ${className}`}
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
