// The password rules, in one place.
//
// They were written inside the sign-up funnel, which was the only screen
// that set a password. The reset screen sets one too — and a second copy
// of five regexes is a guarantee that one day the two disagree and a
// teacher is told her new password is fine here and too weak there.

export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
}

export function passwordChecks(password: string): PasswordChecks {
  const p = password || "";
  return {
    length: p.length >= 8,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    number: /[0-9]/.test(p),
    special: /[^A-Za-z0-9\s]/.test(p),
  };
}

/** 0..5 — count of passed rules. Drives the coloured strength bar. */
export function passwordScore(password: string): number {
  const c = passwordChecks(password);
  return [c.length, c.upper, c.lower, c.number, c.special].filter(Boolean).length;
}

/**
 * A human error string, or null when the password is valid.
 *
 * Sign-in mode skips the strength rules — existing accounts may predate
 * the tightening, and refusing them client-side would lock people out of
 * an account whose stored password is perfectly fine.
 */
export function validatePassword(
  password: string,
  { isSignin = false }: { isSignin?: boolean } = {},
): string | null {
  if (!password) return "Password is required.";
  if (isSignin) return null;
  if (/\s/.test(password)) return "Password can't contain spaces.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter (A–Z).";
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter (a–z).";
  if (!/[0-9]/.test(password)) return "Add at least one number (0–9).";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add at least one symbol (e.g. ! @ # ?).";
  return null;
}
