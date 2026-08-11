// Audience fields — grade / section — hold either one value or a
// comma-joined list ("Grade 9, Grade 11"). The columns stay text and
// every consumer renders them as text, so a list needs no schema change
// and old single-value rows read as a list of one. These helpers are the
// only place that knows the separator.

export const splitAudience = (v: string | null | undefined): string[] =>
  String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const joinAudience = (list: string[]): string => list.filter(Boolean).join(", ");

/**
 * Do two audiences share anyone? Empty means "everyone", so it overlaps
 * with anything — an entry with no grade holds the teacher's whole slot.
 */
export const audienceOverlaps = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean => {
  const A = splitAudience(a);
  const B = splitAudience(b);
  if (!A.length || !B.length) return true;
  return A.some((x) => B.includes(x));
};
