// Heat and funnel primitives — the shapes MiniCharts.jsx doesn't cover.
//
// Same rules as its neighbour: hand-rolled SVG, no library, one accent
// colour, fine rules, no axis furniture. A charting dependency would
// bring a second visual language into a product that has one, and none
// of these four shapes is hard enough to be worth it.
//
//   <HeatGrid rows cols cells max />   a matrix, ink density = value
//   <ClickMap cells bins />            where on the screen people click
//   <FunnelSteps steps />              a funnel, with the drop-off named
//   <HBar rows />                      ranked rows with an inline bar
//
// Colour: one hue, varied by opacity. A rainbow scale reads as more
// precise than the data is — these are counts over a window, and the
// honest thing for them to say is "more here than there".

import React from "react";

const ACCENT = "var(--color-accent, #c8472b)";
const INK = "var(--color-ink, #1a1814)";
const LINE = "var(--color-line, #d4c9b3)";

/**
 * Value → opacity. Square-rooted, not linear: one screen usually takes
 * ten times the traffic of the rest, and on a linear ramp that leaves
 * every other cell indistinguishable from empty. The sqrt keeps the
 * ordering while making the quiet end readable.
 */
const heat = (n, max) => (n <= 0 || max <= 0 ? 0 : 0.08 + 0.85 * Math.sqrt(n / max));

function Empty({ height = 160, message = "Nothing recorded yet" }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl border border-dashed border-line"
      style={{ height }}
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{message}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// HeatGrid — a labelled matrix.
//
// `cells` is a sparse list of {row, col, n, ...}; anything absent is
// zero, which is why it is sparse in the first place: a 7×24 grid where
// most hours are dead has no business being 168 rows over the wire.
// ────────────────────────────────────────────────────────────────────
export function HeatGrid({
  rows = [],
  cols = [],
  cells = [],
  max = 0,
  cellSize = 22,
  gap = 3,
  rowLabelWidth = 42,
  formatTitle,
}) {
  if (!rows.length || !cols.length) return <Empty message="No activity in this window" />;

  const lookup = new Map(cells.map((c) => [`${c.row}:${c.col}`, c]));
  const peak = max || Math.max(1, ...cells.map((c) => c.n || 0));
  const w = rowLabelWidth + cols.length * (cellSize + gap);
  const h = 18 + rows.length * (cellSize + gap);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="max-w-full h-auto">
        {/* Column headings. Every other one on a dense axis, so 24 hours
            don't collide into a grey smear. */}
        {cols.map((c, i) =>
          cols.length > 14 && i % 2 === 1 ? null : (
            <text
              key={`c${i}`}
              x={rowLabelWidth + i * (cellSize + gap) + cellSize / 2}
              y={11}
              textAnchor="middle"
              fontSize="8"
              fill={INK}
              opacity="0.5"
              fontFamily="ui-monospace, monospace"
            >
              {c}
            </text>
          )
        )}

        {rows.map((r, ri) => (
          <g key={`r${ri}`}>
            <text
              x={rowLabelWidth - 8}
              y={18 + ri * (cellSize + gap) + cellSize / 2 + 3}
              textAnchor="end"
              fontSize="9"
              fill={INK}
              opacity="0.6"
              fontFamily="ui-monospace, monospace"
            >
              {r}
            </text>
            {cols.map((c, ci) => {
              const cell = lookup.get(`${ri}:${ci}`);
              const n = cell?.n || 0;
              return (
                <rect
                  key={`${ri}-${ci}`}
                  x={rowLabelWidth + ci * (cellSize + gap)}
                  y={18 + ri * (cellSize + gap)}
                  width={cellSize}
                  height={cellSize}
                  rx="3"
                  fill={n > 0 ? ACCENT : "transparent"}
                  fillOpacity={heat(n, peak)}
                  stroke={n > 0 ? "none" : LINE}
                  strokeOpacity="0.5"
                >
                  <title>
                    {formatTitle ? formatTitle(r, c, cell) : `${r} ${c} — ${n}`}
                  </title>
                </rect>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// ClickMap — the literal heatmap.
//
// Coordinates arrive normalised to the viewport, so the grid overlays
// any screen size. Drawn as soft radial blobs rather than hard squares:
// a click at the edge of a button and one at its centre are the same
// intent, and a blocky grid implies a precision the data does not have.
//
// Rage clicks are drawn separately, in outline. They are a different
// KIND of event, not a bigger number of the same one, so shading them
// into the same ramp would hide the one thing worth finding.
// ────────────────────────────────────────────────────────────────────
export function ClickMap({ cells = [], bins = 24, aspect = 16 / 10, label }) {
  if (!cells.length) {
    return <Empty height={320} message={label ? `No clicks on ${label} yet` : "No clicks recorded"} />;
  }
  // The box is shaped like a screen, not like the bin grid. Coordinates
  // arrive normalised to the viewport, so a bin is a square FRACTION of
  // a rectangle — which on screen is a rectangle. Drawing circles into
  // it was the bug: at 1000×340 a radius large enough to cover a bin's
  // width overlapped six bins of height, and the map came out as
  // vertical stripes that looked like data and were an artefact.
  const W = 1000;
  const H = Math.round(W / aspect);
  const max = Math.max(1, ...cells.map((c) => c.n || 0));
  const cw = W / bins;
  const ch = H / bins;

  return (
    <div className="relative rounded-2xl border border-line bg-paper overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" style={{ aspectRatio: `${W} / ${H}` }}>
        <defs>
          {/* One blur over the whole field rather than a gradient per
              blob. Per-blob gradients fall to zero at their own edge, so
              a sparse grid rendered as separated dots — a polka pattern
              that reads as structure and is only the bin size showing
              through. Blurring the accumulated layer is what makes it a
              continuous surface, which is the entire claim of a heatmap. */}
          <filter id="heatblur" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation={Math.max(cw, ch) * 0.62} />
          </filter>
        </defs>

        {/* Thirds, as a reading aid. The screen being overlaid isn't
            drawn here — this is density, not a screenshot — so without
            some reference "upper left" is guesswork. */}
        {[1, 2].map((i) => (
          <g key={i} opacity="0.35">
            <line x1={(W / 3) * i} y1="0" x2={(W / 3) * i} y2={H} stroke={LINE} strokeDasharray="3 5" />
            <line x1="0" y1={(H / 3) * i} x2={W} y2={(H / 3) * i} stroke={LINE} strokeDasharray="3 5" />
          </g>
        ))}

        {/* Ellipses, not circles: rx and ry each scale with their own
            axis, so a blob covers the bin it belongs to and no more.
            Opacity carries the value, size carries it a second time —
            together they survive the blur, where either alone washes out. */}
        <g filter="url(#heatblur)">
          {cells.map((c, i) => {
            const t = Math.sqrt((c.n || 0) / max);
            return (
              <ellipse
                key={i}
                cx={(c.bx + 0.5) * cw}
                cy={(c.by + 0.5) * ch}
                rx={cw * (0.75 + 0.55 * t)}
                ry={ch * (0.75 + 0.55 * t)}
                fill={ACCENT}
                fillOpacity={0.1 + 0.62 * t}
              />
            );
          })}
        </g>

        {/* Invisible hit targets for the tooltips — the blurred layer is
            not something a pointer can land on precisely. */}
        {cells.map((c, i) => (
          <rect
            key={`hit${i}`}
            x={c.bx * cw}
            y={c.by * ch}
            width={cw}
            height={ch}
            fill="transparent"
          >
            <title>{`${c.n} click${c.n === 1 ? "" : "s"}${c.rage ? ` · ${c.rage} rage` : ""}`}</title>
          </rect>
        ))}

        {cells
          .filter((c) => c.rage > 0)
          .map((c, i) => (
            <ellipse
              key={`rage${i}`}
              cx={(c.bx + 0.5) * cw}
              cy={(c.by + 0.5) * ch}
              rx={cw * 0.9}
              ry={ch * 0.9}
              fill="none"
              // Ink, not accent. The rings sit on top of the hottest
              // blobs, which are accent — an accent ring there is
              // invisible exactly where it is most worth seeing.
              stroke={INK}
              strokeWidth="2"
              strokeDasharray="5 4"
              opacity="0.75"
            >
              <title>{`${c.rage} rage click${c.rage === 1 ? "" : "s"} here`}</title>
            </ellipse>
          ))}
      </svg>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// FunnelSteps — each step's width against the first, with the drop from
// the step above spelled out in words. A funnel drawn as a shape looks
// designed and answers nothing; the number that matters is where the
// people went, so that number is set in type, not implied by an angle.
// ────────────────────────────────────────────────────────────────────
export function FunnelSteps({ steps = [], total = 0 }) {
  const base = total || steps[0]?.n || 0;
  if (!base) return <Empty message="No accounts in this window" />;

  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const pct = base ? (s.n / base) * 100 : 0;
        const prev = i > 0 ? steps[i - 1].n : null;
        const lost = prev != null ? prev - s.n : 0;
        const lostPct = prev ? (lost / prev) * 100 : 0;
        return (
          <div key={s.key || i}>
            <div className="relative rounded-lg border border-line bg-paper overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-accent"
                style={{ width: `${Math.max(pct, 1.5)}%`, opacity: 0.13 + 0.05 * (steps.length - i) }}
              />
              <div className="relative flex items-baseline justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-ink font-medium truncate">{s.label}</p>
                  {s.hint && <p className="text-xs text-muted truncate">{s.hint}</p>}
                </div>
                <div className="flex items-baseline gap-3 flex-shrink-0">
                  <span className="font-serif text-2xl text-ink">{s.n}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted w-12 text-right">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
            {prev != null && lost > 0 && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-accent pl-4 py-1">
                ↓ {lost} dropped off here ({lostPct.toFixed(0)}%)
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// HBar — a ranked list where the bar is behind the text rather than
// beside it. Keeps the label readable at any width, which a two-column
// label/bar layout stops doing the moment a screen name gets long.
// ────────────────────────────────────────────────────────────────────
export function HBar({ rows = [], valueKey = "value", labelKey = "label", format = (v) => v, empty }) {
  if (!rows.length) return <Empty height={120} message={empty || "Nothing to show"} />;
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey]) || 0));

  return (
    <div className="space-y-1">
      {rows.map((r, i) => {
        const v = Number(r[valueKey]) || 0;
        return (
          <div key={r.key || r[labelKey] || i} className="relative rounded-md overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-accent/10"
              style={{ width: `${(v / max) * 100}%` }}
            />
            <div className="relative flex items-baseline justify-between gap-3 px-3 py-2">
              <span className="text-sm text-ink truncate">{r[labelKey]}</span>
              <span className="font-mono text-xs text-ink-soft flex-shrink-0">{format(v, r)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
