// =====================================================================
// Pointed-arch geometry, shared by the three architectural variants
//
// Mihrab, Colonnade and Khatim all stand modules ON an arch. The arch is
// drawn as an SVG path and the modules are positioned in JS, and those
// two have to agree to the pixel — an icon floating a few pixels off the
// line is the difference between architecture and decoration.
//
// So the curve is defined ONCE, here, in normalised terms, and both the
// path and the positions are derived from it. The first version hand-set
// four positions to "look about right" against a path written
// separately; at one window width they sat on the line and at every
// other one they did not.
//
// Coordinates are normalised:
//   hf   half-width, 0 at the apex → 1 at the springing and below
//   f    height, 0 at the apex → 1 at the foot
//
// The profile is two quadratics meeting at a point. Not border-radius:
// rounded corners meet TANGENTIALLY, which gives a dome, and the whole
// identity of this shape is that they meet at an angle.
// =====================================================================

/** Height fraction at which the curve meets the straight jamb. */
export const SPRING = 0.4625;
/** Apex inset, so the point is not clipped by the box edge. */
const APEX = 0.0125;
// Control-point height, and the single number that decides whether this
// reads as an arch or as a dome. The tangent at the apex runs from the
// control point to the apex, so a control point close to the apex's own
// height gives an almost-flat meeting and the point disappears — at 0.075
// the shape was indistinguishable from a rounded arch. Dropping it well
// below the apex steepens both tangents and the two curves meet at a
// clear angle, which is the whole identity of the shape.
const CTRL = 0.28;

/**
 * A point on the arch's outline, right-hand side.
 * @param t 0 at the springing, 1 at the apex.
 */
export function curve(t) {
  const u = 1 - t;
  return {
    hf: 1 - t * t, // (1-t)²·1 + 2(1-t)t·1 + t²·0
    f: u * u * SPRING + 2 * u * t * CTRL + t * t * APEX,
  };
}

/**
 * Where the four modules of one side stand, apex-first.
 *
 * Two ride the curve and two the jamb: the curve spans less than half the
 * arch's height, so four points along it alone would crowd into the top
 * quarter and leave the jambs bare.
 */
export const NICHES = [
  curve(0.72), // near the apex
  curve(0.4),
  { hf: 1, f: SPRING + 0.02 }, // just under the springing
  { hf: 1, f: 0.79 }, // low on the jamb
];

/**
 * The outline as an SVG path, in a `0 0 100 160` viewBox.
 *
 * Written from the same constants as curve(), so the drawn arch and the
 * computed niches cannot drift apart. `inset` pulls a second, inner arch
 * in from the first.
 */
export function archPath(inset = 0) {
  const W = 100;
  const H = 160;
  const cx = W / 2;
  const halfW = cx - inset;
  const x0 = cx - halfW;
  const x1 = cx + halfW;
  const apexY = APEX * H + inset * 1.6;
  const ctrlY = CTRL * H + inset * 1.4;
  const springY = SPRING * H + inset * 0.3;
  return (
    `M${x0} ${H} L${x0} ${springY} ` +
    `Q${x0} ${ctrlY} ${cx} ${apexY} ` +
    `Q${x1} ${ctrlY} ${x1} ${springY} L${x1} ${H}`
  );
}
