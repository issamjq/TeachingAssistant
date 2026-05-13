// Mudir mascot — the AI co-pilot character. Renders the looping
// animation in /public/mudir-mascot.gif at the given size. Stays in
// one place so a licensed replacement (Lottie file, SVG, custom
// commission) can be swapped in by editing this component only.
//
// Usage:
//   <MudirMascot size={120} />                — default loop, no label
//   <MudirMascot size={96} label="Thinking" /> — with a caption beneath
//   <MudirMascot size={180} state="thinking"/> — same loop today, hook
//                                                point for state-specific
//                                                variants later.
import React from "react";

const SRC = "/mudir-mascot.gif";

export default function MudirMascot({
  size = 120,
  label,
  state = "idle", // reserved — same loop for now, room to swap per-state
  className = "",
}) {
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <img
        src={SRC}
        alt={label || "Mudir mascot"}
        width={size}
        height={size}
        data-state={state}
        className="mudir-mascot select-none"
        draggable={false}
        style={{ width: size, height: size }}
      />
      {label && (
        <p className="font-serif italic text-sm text-muted leading-tight">
          {label}
        </p>
      )}
    </div>
  );
}
