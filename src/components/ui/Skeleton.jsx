import React from "react";

export function Skeleton({ className = "", style }) {
  return (
    <div
      aria-hidden
      className={["rounded-md bg-[var(--color-surface-sunken)] skel-pulse", className].join(" ")}
      style={style}
    />
  );
}

// CSS for the pulse lives here so the component is self-contained.
const styleId = "murchid-skel-style";
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const s = document.createElement("style");
  s.id = styleId;
  s.textContent = `
    .skel-pulse { animation: skel-pulse 1400ms ease-in-out infinite; }
    @keyframes skel-pulse {
      0%, 100% { opacity: 0.6; }
      50%      { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skel-pulse { animation: none; opacity: 0.8; }
    }
  `;
  document.head.appendChild(s);
}
