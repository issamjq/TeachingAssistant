import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../lib/theme";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle({ className = "" }) {
  const { mode, setMode } = useTheme();
  const idx = Math.max(0, OPTIONS.findIndex((o) => o.value === mode));

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={[
        "relative inline-flex items-center rounded-full p-1",
        "bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]",
        className,
      ].join(" ")}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 w-[32px] rounded-full bg-[var(--color-surface-card)] shadow-[var(--shadow-1)]"
        style={{
          left: 4,
          transform: `translateX(${idx * 32}px)`,
          transition: "transform 280ms var(--ease-out)",
        }}
      />
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            onClick={() => setMode(opt.value)}
            className={[
              "relative z-10 w-8 h-8 grid place-items-center rounded-full",
              "transition-colors duration-150",
              active ? "text-accent" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
