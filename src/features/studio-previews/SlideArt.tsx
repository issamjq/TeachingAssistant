// =====================================================================
// The pictures on the slides
//
// Every deck the studio makes needs artwork, and a grey placeholder box
// tells you nothing about whether a design handles images well. So the
// eight slides in the fixture carry eight real, hand-drawn compositions
// — inline SVG, no network, no dependency, identical in all seven
// variants.
//
// Each one paints from four CSS variables rather than literal colours:
//
//     --art-bg      the ground
//     --art-ink     line work
//     --art-accent  the one thing that carries colour
//     --art-soft    fills and washes
//
// That is the whole trick. A variant sets those four and the same
// drawing arrives as a warm printed plate, a luminous glass panel or a
// hard two-colour blueprint — so the comparison is between designs, not
// between eight different pictures.
// =====================================================================

type Props = { seed: string; className?: string };

const VB = "0 0 400 260";

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    // `meet`, not `slice`. Every plate is composed out to its own edges —
    // the reactant labels on `equation` sit at x=40 and x=390 — and a
    // container with a different aspect ratio (16:9 here, 4:3 there,
    // half-width in the split layout) crops exactly those away under
    // `slice`. Letterboxing instead is invisible, because the svg paints
    // the same --art-bg behind the box that the plate paints inside it.
    <svg
      viewBox={VB}
      className={className}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
      style={{ background: "var(--art-bg, var(--p-ambient-pale))" }}
    >
      <rect width="400" height="260" fill="var(--art-bg, var(--p-ambient-pale))" />
      {children}
    </svg>
  );
}

const INK = "var(--art-ink, var(--p-ink))";
const ACC = "var(--art-accent, var(--p-accent))";
const SOFT = "var(--art-soft, var(--p-accent-soft))";

/* ── the eight plates ─────────────────────────────────────────────── */

const PLATES: Record<string, React.ReactNode> = {
  // A single leaf, filling the frame, veined.
  "cover-leaf": (
    <>
      <circle cx="300" cy="60" r="120" fill={SOFT} opacity="0.55" />
      <path d="M60 220 C60 120 140 40 250 34 C258 140 180 218 60 220 Z" fill={ACC} opacity="0.9" />
      <path d="M60 220 C120 160 190 96 250 34" stroke="var(--art-bg, var(--p-ambient-pale))" strokeWidth="3" fill="none" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M${92 + i * 32} ${188 - i * 32} q 30 -6 ${44 - i * 4} -${34 - i * 3}`}
          stroke="var(--art-bg, var(--p-ambient-pale))"
          strokeWidth="2"
          fill="none"
          opacity="0.75"
        />
      ))}
      <circle cx="330" cy="196" r="26" fill="none" stroke={INK} strokeWidth="1.5" opacity="0.5" />
      <circle cx="330" cy="196" r="9" fill={INK} opacity="0.35" />
    </>
  ),

  // The jar that has been shut for a year.
  "sealed-jar": (
    <>
      <rect x="150" y="30" width="100" height="20" rx="6" fill={INK} opacity="0.85" />
      <path d="M158 50 h84 v150 a14 14 0 0 1 -14 14 h-56 a14 14 0 0 1 -14 -14 Z" fill={SOFT} stroke={INK} strokeWidth="2" />
      <path d="M200 200 v-56" stroke={ACC} strokeWidth="3" />
      <path d="M200 168 q -26 -10 -30 -34 q 26 2 30 34 Z" fill={ACC} />
      <path d="M200 152 q 26 -12 32 -36 q -28 4 -32 36 Z" fill={ACC} opacity="0.75" />
      <ellipse cx="200" cy="204" rx="30" ry="7" fill={INK} opacity="0.25" />
      {[70, 110, 300, 340].map((x, i) => (
        <path key={x} d={`M${x} ${60 + i * 12} v34`} stroke={INK} strokeWidth="1.5" opacity="0.3" />
      ))}
      <text x="200" y="240" textAnchor="middle" fontSize="13" fill={INK} opacity="0.55" fontFamily="ui-sans-serif, sans-serif">
        365 days · sealed
      </text>
    </>
  ),

  // Three arrows in, two out.
  equation: (
    <>
      <circle cx="200" cy="128" r="66" fill={ACC} opacity="0.16" />
      <circle cx="200" cy="128" r="46" fill={ACC} />
      <path d="M186 118 q 14 -16 28 0 q -14 22 -28 0 Z" fill="var(--art-bg, var(--p-ambient-pale))" />
      <path d="M200 128 v22" stroke="var(--art-bg, var(--p-ambient-pale))" strokeWidth="3" />
      {["CO₂", "H₂O", "light"].map((t, i) => (
        <g key={t}>
          <text x="40" y={70 + i * 46} fontSize="15" fill={INK} fontFamily="ui-sans-serif, sans-serif" fontWeight="600">{t}</text>
          <path d={`M84 ${65 + i * 46} L142 ${112 + (i - 1) * 8}`} stroke={INK} strokeWidth="2" opacity="0.7" />
          <circle cx="142" cy={112 + (i - 1) * 8} r="3.5" fill={INK} />
        </g>
      ))}
      {["glucose", "O₂"].map((t, i) => (
        <g key={t}>
          <path d={`M256 ${122 + (i - 0.5) * 14} L318 ${94 + i * 66}`} stroke={ACC} strokeWidth="2.5" />
          <circle cx="318" cy={94 + i * 66} r="4" fill={ACC} />
          <text x="330" y={99 + i * 66} fontSize="15" fill={ACC} fontFamily="ui-sans-serif, sans-serif" fontWeight="600">{t}</text>
        </g>
      ))}
    </>
  ),

  // A leaf in cross-section.
  "cell-cross": (
    <>
      <rect x="34" y="52" width="332" height="156" rx="16" fill={SOFT} stroke={INK} strokeWidth="1.5" />
      <path d="M34 92 h332 M34 176 h332" stroke={INK} strokeWidth="1.2" opacity="0.5" />
      {[0, 1, 2, 3, 4, 5].map((c) =>
        [0, 1].map((r) => (
          <g key={`${c}-${r}`}>
            <rect x={56 + c * 50} y={104 + r * 34} width="40" height="26" rx="9" fill="var(--art-bg, var(--p-ambient-pale))" stroke={INK} strokeWidth="1.2" />
            <ellipse cx={70 + c * 50} cy={117 + r * 34} rx="6" ry="4.5" fill={ACC} />
            <ellipse cx={84 + c * 50} cy={122 + r * 34} rx="5" ry="4" fill={ACC} opacity="0.7" />
          </g>
        ))
      )}
      <path d="M180 208 v22 M220 208 v22" stroke={INK} strokeWidth="2" />
      <path d="M172 230 q 28 14 56 0" stroke={ACC} strokeWidth="2.5" fill="none" />
      <text x="200" y="76" textAnchor="middle" fontSize="12" fill={INK} opacity="0.6" fontFamily="ui-sans-serif, sans-serif" letterSpacing="2">
        CUTICLE
      </text>
    </>
  ),

  // Beaker, lamp, rising bubbles.
  bubbles: (
    <>
      <path d="M120 60 h96 v130 a18 18 0 0 1 -18 18 h-60 a18 18 0 0 1 -18 -18 Z" fill={SOFT} stroke={INK} strokeWidth="2" />
      <path d="M120 104 h96" stroke={ACC} strokeWidth="2" opacity="0.6" />
      <path d="M168 200 v-58 M168 168 q -20 -8 -24 -28 q 20 2 24 28 Z M168 152 q 20 -10 26 -30 q -22 4 -26 30 Z" fill={ACC} stroke={ACC} strokeWidth="2" />
      {[[142, 150, 5], [156, 122, 4], [176, 136, 6], [190, 108, 4.5], [162, 92, 3.5], [184, 80, 5]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={ACC} strokeWidth="1.6" opacity="0.85" />
      ))}
      <circle cx="300" cy="88" r="30" fill={ACC} opacity="0.22" />
      <circle cx="300" cy="88" r="17" fill={ACC} />
      <path d="M300 118 v66 h-16 M300 118 v66 h16" stroke={INK} strokeWidth="2.5" fill="none" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${272 - i * 4} ${104 + i * 12} L${252 - i * 10} ${112 + i * 14}`} stroke={ACC} strokeWidth="1.6" opacity="0.6" />
      ))}
      <text x="300" y="212" textAnchor="middle" fontSize="12" fill={INK} opacity="0.55" fontFamily="ui-sans-serif, sans-serif">10 cm</text>
    </>
  ),

  // The saturation curve, with their points on it.
  "rate-curve": (
    <>
      <path d="M56 208 h296 M56 208 V44" stroke={INK} strokeWidth="2" />
      {[1, 2, 3].map((i) => (
        <path key={i} d={`M56 ${208 - i * 42} h296`} stroke={INK} strokeWidth="1" opacity="0.16" />
      ))}
      <path d="M56 208 C 120 208 150 96 220 84 C 280 74 320 76 352 76" fill="none" stroke={ACC} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M56 208 C 120 208 150 96 220 84 C 280 74 320 76 352 76 L352 208 Z" fill={ACC} opacity="0.14" />
      {[[104, 186], [148, 132], [196, 94], [252, 80], [312, 77]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5.5" fill="var(--art-bg, var(--p-ambient-pale))" stroke={ACC} strokeWidth="2.5" />
      ))}
      <path d="M232 84 v-26 h64" stroke={INK} strokeWidth="1.4" strokeDasharray="4 4" opacity="0.6" fill="none" />
      <text x="300" y="54" fontSize="12" fill={INK} opacity="0.7" fontFamily="ui-sans-serif, sans-serif">plateau</text>
      <text x="200" y="236" textAnchor="middle" fontSize="12" fill={INK} opacity="0.6" fontFamily="ui-sans-serif, sans-serif">light intensity →</text>
    </>
  ),

  // A greenhouse under a low sun.
  greenhouse: (
    <>
      <circle cx="326" cy="62" r="34" fill={ACC} opacity="0.25" />
      <circle cx="326" cy="62" r="19" fill={ACC} />
      <path d="M48 200 h304" stroke={INK} strokeWidth="2" />
      <path d="M70 200 V116 L176 56 L282 116 V200" fill={SOFT} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M176 56 V200 M70 116 h212 M123 88 V200 M229 88 V200 M70 158 h212" stroke={INK} strokeWidth="1.2" opacity="0.55" />
      {[92, 146, 200, 254].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 200 v-22`} stroke={ACC} strokeWidth="2.5" />
          <circle cx={x} cy={172} r={7 - i * 0.4} fill={ACC} opacity="0.85" />
        </g>
      ))}
      <path d="M300 172 q 14 -18 28 0 q -14 18 -28 0" fill={ACC} opacity="0.5" />
      <text x="326" y="212" textAnchor="middle" fontSize="12" fill={INK} opacity="0.55" fontFamily="ui-sans-serif, sans-serif">+CO₂ ?</text>
    </>
  ),


  /* ── session two · states of matter ─────────────────────────────── */

  // Three boxes of particles, packed to free.
  "particles-three": (
    <>
      {[0, 1, 2].map((b) => (
        <rect key={b} x={26 + b * 122} y="58" width="106" height="130" rx="10" fill={b === 0 ? SOFT : "none"} stroke={INK} strokeWidth="1.8" />
      ))}
      {/* solid — a locked lattice */}
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <circle key={`s${r}${c}`} cx={46 + c * 22} cy={78 + r * 30} r="7.5" fill={ACC} />
        ))
      )}
      {/* liquid — touching but offset */}
      {[[0, 0], [1, 0], [2, 0], [3, 0], [0.5, 1], [1.5, 1], [2.5, 1], [0, 2], [1, 2], [2, 2], [3, 2], [0.5, 3], [1.5, 3]].map(
        ([c, r], i) => (
          <circle key={`l${i}`} cx={168 + c * 22} cy={80 + r * 30} r="7.5" fill={ACC} opacity="0.82" />
        )
      )}
      {/* gas — far apart */}
      {[[10, 20], [62, 44], [30, 82], [76, 96], [16, 116], [66, 132]].map(([x, y], i) => (
        <circle key={`g${i}`} cx={274 + x} cy={70 + y} r="7.5" fill={ACC} opacity="0.62" />
      ))}
      {["packed", "sliding", "free"].map((t, i) => (
        <text key={t} x={79 + i * 122} y="212" textAnchor="middle" fontSize="12" fill={INK} opacity="0.6" fontFamily="ui-sans-serif, sans-serif">
          {t}
        </text>
      ))}
      <text x="200" y="40" textAnchor="middle" fontSize="11" fill={INK} opacity="0.5" letterSpacing="2.4" fontFamily="ui-sans-serif, sans-serif">
        SAME STUFF
      </text>
    </>
  ),

  // The cards on the table, mid-sort.
  "card-sort": (
    <>
      {[
        [40, 60, -6], [118, 48, 3], [196, 58, -2], [274, 44, 5],
        [56, 132, 4], [134, 144, -5], [212, 136, 2], [290, 128, -3],
      ].map(([x, y, rot], i) => (
        <g key={i} transform={`rotate(${rot} ${x + 34} ${y + 24})`}>
          <rect x={x} y={y} width="68" height="48" rx="5" fill="var(--art-bg, var(--p-ambient-pale))" stroke={INK} strokeWidth="1.5" />
          {[0, 1, 2, 3].map((d) => (
            <circle
              key={d}
              cx={x + 16 + (d % 2) * (i % 3 === 0 ? 14 : i % 3 === 1 ? 22 : 34)}
              cy={y + 18 + Math.floor(d / 2) * (i % 3 === 0 ? 14 : 18)}
              r="4.5"
              fill={ACC}
              opacity={i % 3 === 2 ? 0.6 : 0.9}
            />
          ))}
        </g>
      ))}
      <path d="M20 108 h360" stroke={INK} strokeWidth="1.2" strokeDasharray="5 6" opacity="0.35" />
      <circle cx="352" cy="196" r="20" fill={ACC} opacity="0.2" />
      <text x="352" y="201" textAnchor="middle" fontSize="14" fill={ACC} fontFamily="ui-sans-serif, sans-serif" fontWeight="700">?</text>
    </>
  ),

  // One substance, three states, left to right.
  "ice-water-steam": (
    <>
      <path d="M20 176 h360" stroke={INK} strokeWidth="1.5" opacity="0.5" />
      {/* ice */}
      <path d="M52 176 v-56 h64 v56 Z" fill={SOFT} stroke={INK} strokeWidth="2" />
      <path d="M52 148 h64 M84 120 v56" stroke={INK} strokeWidth="1" opacity="0.45" />
      {/* water */}
      <path d="M168 176 v-30 q 32 -16 64 0 v30 Z" fill={ACC} opacity="0.55" />
      <path d="M168 146 q 32 -16 64 0" stroke={ACC} strokeWidth="2.5" fill="none" />
      <path d="M168 176 v-30 M232 176 v-30" stroke={INK} strokeWidth="1.5" opacity="0.5" />
      {/* steam */}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${292 + i * 22} 176 c -12 -22 12 -30 0 -52 c -10 -18 8 -26 2 -40`}
          stroke={ACC}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity={0.9 - i * 0.22}
        />
      ))}
      {["ice", "water", "steam"].map((t, i) => (
        <text key={t} x={84 + i * 116} y="200" textAnchor="middle" fontSize="13" fill={INK} opacity="0.65" fontFamily="ui-sans-serif, sans-serif">
          {t}
        </text>
      ))}
      <path d="M126 154 h30 M244 154 h30" stroke={ACC} strokeWidth="2" markerEnd="" />
      <path d="M150 149 l7 5 l-7 5 M268 149 l7 5 l-7 5" stroke={ACC} strokeWidth="2" fill="none" />
    </>
  ),

  // Heat as movement.
  thermometer: (
    <>
      <rect x="176" y="34" width="30" height="150" rx="15" fill="var(--art-bg, var(--p-ambient-pale))" stroke={INK} strokeWidth="2" />
      <circle cx="191" cy="196" r="26" fill={ACC} stroke={INK} strokeWidth="2" />
      <rect x="184" y="88" width="14" height="98" rx="7" fill={ACC} />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M206 ${58 + i * 26} h14`} stroke={INK} strokeWidth="1.4" opacity="0.5" />
      ))}
      {[[70, 66], [104, 108], [62, 146], [110, 172]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="8" fill={ACC} opacity="0.85" />
          <path d={`M${x + 12} ${y - 6} q 8 6 0 12`} stroke={ACC} strokeWidth="1.6" fill="none" opacity="0.6" />
        </g>
      ))}
      {[[288, 58], [340, 92], [272, 122], [330, 154], [296, 190]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="8" fill={ACC} />
          <path d={`M${x - 16} ${y - 10} l 10 6 M${x + 16} ${y + 10} l -10 -6`} stroke={ACC} strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      <text x="86" y="216" textAnchor="middle" fontSize="12" fill={INK} opacity="0.6" fontFamily="ui-sans-serif, sans-serif">slow</text>
      <text x="308" y="222" textAnchor="middle" fontSize="12" fill={INK} opacity="0.6" fontFamily="ui-sans-serif, sans-serif">fast</text>
    </>
  ),

  // The trap: same particles, wider apart — not bigger.
  "spacing-trap": (
    <>
      {[0, 1].map((b) => (
        <rect key={b} x={30 + b * 194} y="52" width="146" height="146" rx="10" fill={b ? "none" : SOFT} stroke={INK} strokeWidth="1.8" />
      ))}
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <circle key={`a${r}${c}`} cx={58 + c * 45} cy={80 + r * 45} r="11" fill={ACC} />
        ))
      )}
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <circle key={`b${r}${c}`} cx={252 + c * 45} cy={80 + r * 45} r="11" fill={ACC} opacity="0.72" />
        ))
      )}
      {/* the same radius, measured, on both sides */}
      <path d="M47 80 h22 M241 80 h22" stroke={INK} strokeWidth="1.4" />
      <path d="M47 74 v12 M69 74 v12 M241 74 v12 M263 74 v12" stroke={INK} strokeWidth="1.4" />
      <path d="M186 125 h32" stroke={INK} strokeWidth="2" />
      <path d="M210 118 l9 7 l-9 7" stroke={INK} strokeWidth="2" fill="none" />
      <text x="103" y="220" textAnchor="middle" fontSize="12" fill={INK} opacity="0.62" fontFamily="ui-sans-serif, sans-serif">before</text>
      <text x="297" y="220" textAnchor="middle" fontSize="12" fill={INK} opacity="0.62" fontFamily="ui-sans-serif, sans-serif">heated</text>
      <text x="200" y="42" textAnchor="middle" fontSize="12" fill={ACC} fontFamily="ui-sans-serif, sans-serif" fontWeight="600">same size?</text>
    </>
  ),

  // Explain it to someone at home.
  "homework-slip": (
    <>
      <circle cx="126" cy="104" r="30" fill={ACC} />
      <path d="M126 134 c -30 0 -46 20 -50 46 h100 c -4 -26 -20 -46 -50 -46 Z" fill={ACC} opacity="0.7" />
      <circle cx="272" cy="118" r="24" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M272 142 c -24 0 -37 16 -41 38 h82 c -4 -22 -17 -38 -41 -38 Z" fill="none" stroke={INK} strokeWidth="2" />
      <path d="M166 92 q 30 -18 62 -2" stroke={ACC} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M222 84 l8 6 l-9 5" stroke={ACC} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <rect x="152" y="26" width="120" height="42" rx="9" fill="var(--art-bg, var(--p-ambient-pale))" stroke={INK} strokeWidth="1.6" />
      <path d="M168 40 h88 M168 54 h58" stroke={INK} strokeWidth="1.6" opacity="0.45" />
      <path d="M200 68 l8 12 l10 -12 Z" fill="var(--art-bg, var(--p-ambient-pale))" stroke={INK} strokeWidth="1.6" />
    </>
  ),

  // The slip they hand back at the door.
  "exit-ticket": (
    <>
      <rect x="70" y="52" width="260" height="150" rx="8" fill="var(--art-bg, var(--p-ambient-pale))" stroke={INK} strokeWidth="2" transform="rotate(-3 200 128)" />
      <rect x="82" y="42" width="260" height="150" rx="8" fill={SOFT} stroke={INK} strokeWidth="2" transform="rotate(2.5 200 128)" />
      <path d="M104 92 h206 M104 118 h206 M104 144 h140" stroke={INK} strokeWidth="1.4" opacity="0.4" transform="rotate(2.5 200 128)" />
      <path d="M108 86 q 42 -14 76 2 q 34 16 74 -6" stroke={ACC} strokeWidth="3" fill="none" strokeLinecap="round" transform="rotate(2.5 200 128)" />
      <path d="M108 112 q 56 -12 104 4" stroke={ACC} strokeWidth="3" fill="none" strokeLinecap="round" transform="rotate(2.5 200 128)" />
      <circle cx="300" cy="180" r="22" fill={ACC} />
      <path d="M290 180 l7 8 l14 -16" stroke="var(--art-bg, var(--p-ambient-pale))" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export default function SlideArt({ seed, className }: Props) {
  return <Frame className={className}>{PLATES[seed] ?? PLATES["cover-leaf"]}</Frame>;
}
