// Tiny SVG charts — no library. Built specifically for the super admin
// dashboard's editorial aesthetic: single accent color, fine rules,
// no axis decoration. Three primitives:
//
//   <LineChart data={[{day, n}, ...]} />
//   <DonutChart segments={[{label, value, color?}]} />
//   <BarChart data={[{label, value}]} />
//
// All three are responsive — they fill the parent's width/height and
// scale text via viewBox.

import React from "react";

const ACCENT = "var(--color-accent, #c8472b)";
const INK   = "var(--color-ink, #1a1814)";
const MUTED = "var(--color-muted, #6b6354)";
const LINE  = "var(--color-line, #d4c9b3)";

// ────────────────────────────────────────────────────────────────────
// Line chart — series of {day, n}. The day axis is dense (one tick per
// week), values are scaled to fit. Area under the curve is filled with
// a low-opacity accent for that "data viz but editorial" feel.
// ────────────────────────────────────────────────────────────────────
export function LineChart({ data = [], height = 180, label }) {
  if (data.length === 0) {
    return <EmptyChart height={height} message={label ? `No ${label.toLowerCase()} yet` : "No data yet"} />;
  }
  const w = 800, h = height, pad = 24, padBottom = 28;
  const innerW = w - pad * 2;
  const innerH = h - pad - padBottom;
  const max = Math.max(1, ...data.map((d) => d.n));
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;

  // Path through every point
  const pts = data.map((d, i) => {
    const x = pad + i * step;
    const y = pad + innerH * (1 - d.n / max);
    return [x, y];
  });
  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1][0].toFixed(1)} ${pad + innerH} L ${pts[0][0].toFixed(1)} ${pad + innerH} Z`;

  // Show ~5 axis labels: first, last, and three evenly between.
  const labelIndices = [
    0,
    Math.floor(data.length * 0.25),
    Math.floor(data.length * 0.5),
    Math.floor(data.length * 0.75),
    data.length - 1,
  ].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none">
      {/* Baseline */}
      <line x1={pad} y1={pad + innerH} x2={pad + innerW} y2={pad + innerH} stroke={LINE} strokeWidth="1" />
      {/* Area fill */}
      <path d={areaPath} fill={ACCENT} opacity="0.08" />
      {/* Line */}
      <path d={linePath} fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* End-point dot */}
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={ACCENT} />
      {/* Max-value indicator */}
      <text x={pad} y={pad - 6} fontSize="10" fill={MUTED} fontFamily="ui-monospace, monospace">
        max {max}
      </text>
      {/* X-axis labels */}
      {labelIndices.map((i) => {
        const x = pad + i * step;
        const day = data[i]?.day || "";
        const short = day.slice(5); // "MM-DD"
        return (
          <text
            key={i}
            x={x}
            y={h - 8}
            textAnchor="middle"
            fontSize="10"
            fill={MUTED}
            fontFamily="ui-monospace, monospace"
          >
            {short}
          </text>
        );
      })}
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────
// Donut chart — segments of {label, value, color}. Segments smaller
// than 3% are omitted from the legend but still contribute to the arc.
// ────────────────────────────────────────────────────────────────────
const DONUT_COLORS = [
  "var(--color-accent, #c8472b)",
  "var(--color-gold, #b8893d)",
  "var(--color-sage, #6b7f5a)",
  "var(--color-ink, #1a1814)",
  "var(--color-clay-deep, #6b4633)",
  "var(--color-muted, #6b6354)",
];

export function DonutChart({ segments = [], height = 200, centerLabel, centerValue }) {
  const total = segments.reduce((a, s) => a + (s.value || 0), 0);
  if (total === 0) {
    return <EmptyChart height={height} message="No data yet" />;
  }
  const r = 70, ir = 48, cx = 100, cy = 100;
  let acc = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s, idx) => {
      const startAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
      acc += s.value;
      const endAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
      const large = endAngle - startAngle > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle);
      const x3 = cx + ir * Math.cos(endAngle),  y3 = cy + ir * Math.sin(endAngle);
      const x4 = cx + ir * Math.cos(startAngle), y4 = cy + ir * Math.sin(startAngle);
      const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${ir} ${ir} 0 ${large} 0 ${x4} ${y4} Z`;
      return { d, color: s.color || DONUT_COLORS[idx % DONUT_COLORS.length], label: s.label, value: s.value };
    });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
      <svg
        viewBox="0 0 200 200"
        style={{ width: height, height, maxWidth: "100%" }}
        className="flex-shrink-0 mx-auto sm:mx-0"
      >
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke="var(--color-paper, #f4ede0)" strokeWidth="1" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fill={INK} fontFamily="var(--font-serif)">
          {centerValue ?? total}
        </text>
        {centerLabel && (
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill={MUTED}
            fontFamily="ui-monospace, monospace" letterSpacing="1">
            {centerLabel.toUpperCase()}
          </text>
        )}
      </svg>
      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-0 flex-1 w-full">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: a.color }} />
            <span className="text-ink-soft truncate min-w-0 flex-1">{a.label}</span>
            <span className="text-muted font-mono text-[10px] flex-shrink-0">
              {a.value} · {Math.round((a.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Bar chart — horizontal bars, {label, value}. Good for revenue-by-plan
// or counts-by-category at a glance.
// ────────────────────────────────────────────────────────────────────
export function BarChart({ data = [], height = 180, formatValue = (v) => v }) {
  if (data.length === 0) return <EmptyChart height={height} message="No data yet" />;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-3" style={{ minHeight: height }}>
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 sm:gap-3 text-xs min-w-0">
          <span className="w-16 sm:w-20 text-ink-soft truncate flex-shrink-0">{d.label}</span>
          <div className="flex-1 h-5 bg-paper-warm rounded-sm overflow-hidden relative min-w-0">
            <div
              className="h-full"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: ACCENT,
                opacity: 0.85,
              }}
            />
          </div>
          <span className="font-mono text-[10px] text-ink-soft w-16 sm:w-20 text-right flex-shrink-0">
            {formatValue(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Empty state — used when a chart has no data to render. Matches the
// editorial system rather than the standard "No data" muted text.
// ────────────────────────────────────────────────────────────────────
function EmptyChart({ height, message }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ height, minHeight: height }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {message}
      </p>
    </div>
  );
}
