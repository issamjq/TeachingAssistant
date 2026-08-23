"use client";

// Student sign-in — the /student portal.
//
// A student is a roster row a teacher typed in. They become a signed-in
// user here, by authenticating with the email that row carries: on return
// this page calls link_student_account(), which claims the row and marks
// the user a student. Deliberately NOT the teacher PortalSignIn — that one
// provisions a faculty row, which would turn a student into a teacher.
//
// Flow: sign in → /api/auth/me. If already a student, route straight to the
// dashboard. If there's no profile yet (no_teacher_row), try to link by
// email; on success route, otherwise explain that no roster row matched.

import { useEffect, useState, useRef} from "react";
import { ArrowRight } from "lucide-react";
import { api, ApiError } from "@/shared/lib/apiClient";
import { replace } from "@/lib/route";
import { setAccount } from "@/lib/account";
import { setRole } from "@/lib/role";
import MurchidLogo from "@/components/MurchidLogo";
import BrandLoader from "@/components/BrandLoader";
import { GoogleMark } from "./ProviderMarks";

interface MeRow {
  role: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

type SignInError =
  | { kind: "no_match" }
  | { kind: "not_invited" }
  | { kind: "is_teacher" }
  | { kind: "wrong_account"; role: string }
  | { kind: "unknown"; message: string };

/**
 * Why the claim failed, in the student's words.
 *
 * link_student_account() names its reason and every one of them used to
 * arrive here as "no_match" — so a teacher signing in with their own
 * address was told their teacher had never added them, which is both
 * wrong and unfixable by the person reading it.
 */
function errorFor(reason?: string): SignInError {
  if (reason === "is_teacher") return { kind: "is_teacher" };
  if (reason === "not_invited") return { kind: "not_invited" };
  return { kind: "no_match" };
}

/** Is an OAuth or magic-link exchange in flight in this page load? */
function returningFromAuth(): boolean {
  if (typeof window === "undefined") return false;
  const q = window.location.search + window.location.hash;
  return /[?&#](code|token_hash|access_token|refresh_token)=/.test(q);
}

/**
 * Give the exchange a moment to land.
 *
 * Polled rather than awaited on an event because the client resolves it
 * internally; six tries at 250ms is comfortably longer than it takes and
 * short enough that a genuine failure still shows the buttons quickly.
 */
async function waitForSession(read: () => Promise<unknown>): Promise<any> {
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
    // eslint-disable-next-line no-await-in-loop
    const u = await read();
    if (u) return u;
  }
  return null;
}

export default function StudentSignIn() {
  const [checking, setChecking] = useState(true);
  /**
   * We are on our way to the dashboard — keep the loader up.
   *
   * The check ended in a `finally` that cleared `checking` whether the
   * resolve had succeeded or not, and replace() is asynchronous. So a
   * student who HAD just signed in got one frame of the sign-in form
   * before the route changed: the flash of "please sign in" at the exact
   * moment they had.
   *
   * Navigation is not the end of the wait, so the loader has to outlive
   * the check that started it.
   */
  const [entering, setEntering] = useState(false);
  /** Set when the link was followed and the class did not join. */
  const [joinFailed, setJoinFailed] = useState<string | null>(null);
  // enter() runs in the same tick as the setState above, so it reads the
  // ref rather than the state it would not yet see.
  const joinFailedRef = useRef<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  /**
   * The class this link is for.
   *
   * An invitation is one email per subject, and the link carries the
   * roster row it belongs to — so following it joins THAT class and
   * nothing else. Read once, before any navigation clears it.
   */
  const joinTarget =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("join")
      : null;

  function enter(me: MeRow) {
    setAccount({
      provider: "google",
      // The account mirror requires a plan; a student has none, and nothing
      // on their surface reads it. "trial" is an inert placeholder.
      plan: "trial",
      role: "student",
      profile: {
        firstName: me.first_name || "",
        lastName: me.last_name || "",
        email: me.email || "",
        avatarUrl: "",
      },
    });
    setRole("student");
    setEntering(true);
    // Carried across the navigation, because this component is leaving.
    if (typeof window !== "undefined" && joinFailedRef.current) {
      try {
        sessionStorage.setItem("murchid.joinError", joinFailedRef.current);
      } catch { /* private mode — the console warning still stands */ }
    }
    replace(["student-dashboard"]);
  }

  /**
   * Follow the invitation.
   *
   * A failure here must not block the sign-in — the link may be for a
   * class they joined last week, or one the teacher has since removed —
   * but it must not be silent either. Swallowing it entirely is how a
   * class that failed to join looked exactly like a class that was never
   * invited: the student landed in the portal, saw one subject, and had
   * no way to know the second had gone wrong.
   */
  async function acceptIfInvited() {
    if (!joinTarget) return null;
    try {
      await api(`/api/student/join/${joinTarget}`, { method: "POST" });
      return joinTarget;
    } catch (e: any) {
      console.warn("[student] could not join from the invitation link:", e?.message || e);
      joinFailedRef.current = e?.message || "That invitation could not be opened.";
      setJoinFailed(joinFailedRef.current);
      return null;
    }
  }

  // Resolve a live session into a student, linking by email if needed.
  async function resolve(): Promise<boolean> {
    let me: MeRow | null = null;
    try {
      me = await api<MeRow>("/api/auth/me");
    } catch (e) {
      if (!(e instanceof ApiError && e.code === "no_teacher_row")) throw e;
    }
    if (me) {
      // Including a student with no classes right now — see getProfile().
      // The dashboard says so; being between teachers is not a sign-in
      // failure and must not be reported as one.
      if (me.role === "student") { await acceptIfInvited(); enter(me); return true; }
      setError({ kind: "wrong_account", role: me.role });
      return true;
    }
    // No profile yet — try to claim a roster row for this email.
    const res = await api<{ linked: boolean; reason?: string }>("/api/auth/link-student", { method: "POST" });
    if (res.linked) {
      /**
       * The re-read is allowed to fail without losing the student.
       *
       * It was unguarded, so anything that stopped the profile loading
       * after a SUCCESSFUL claim threw out of resolve() and landed as an
       * "unknown" error — which is how a student whose row was already
       * claimed got sent back to sign in, linked again, and bounced round
       * once more. The claim is the thing that matters and it has already
       * happened by here; a profile that will not load is worth naming
       * rather than retrying forever.
       */
      let me2: MeRow | null = null;
      try {
        me2 = await api<MeRow>("/api/auth/me");
      } catch {
        me2 = null;
      }
      if (me2?.role === "student") { await acceptIfInvited(); enter(me2); return true; }
      setError({
        kind: "unknown",
        message:
          "You're signed in and your teacher's invitation was accepted, but your student profile didn't load. Please refresh the page.",
      });
      return true;
    }
    setError(errorFor(res.reason));
    return true;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getCurrentUser, completeTokenHashSignIn } = await import("@/lib/supabaseAuth");
        // An invite link clicked on the student's own device carries
        // ?token_hash=…&type=… rather than the ?code=… this client's PKCE
        // flow produces, because the verifier for a code lives in the
        // browser that ASKED for the link — the teacher's. A token hash
        // holds no device state, so it is verified here instead.
        // detectSessionInUrl has already handled the same-device case by
        // the time this runs, and this returns null when there is no hash.
        await completeTokenHashSignIn().catch(() => null);
        let user = await getCurrentUser();

        /**
         * Coming back from Google, the session may not be readable yet.
         *
         * detectSessionInUrl exchanges the code asynchronously, so the
         * first getCurrentUser() after the redirect can answer null —
         * and the finally below then cleared `checking` and rendered the
         * sign-in form. A student who had just picked their account
         * watched it ask them to sign in for a second or two before the
         * dashboard appeared, which reads as a failed login.
         *
         * The URL says whether a sign-in is in flight. If one is, wait
         * for it rather than concluding there is nobody here.
         */
        if (!user && returningFromAuth()) {
          user = await waitForSession(getCurrentUser);
          if (cancelled) return;
        }

        if (cancelled) return;
        if (!user) return; // genuinely signed out — show the buttons
        await resolve();
      } catch (e) {
        if (!cancelled) setError({ kind: "unknown", message: e instanceof Error ? e.message : String(e) });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    setError(null);
    setSigningIn(true);
    try {
      const { signInWithGoogle } = await import("@/lib/supabaseAuth");
      /**
       * Come back HERE, carrying the class they were invited to.
       *
       * Without this the provider returned everyone to /signin — the
       * teacher door — so a student signed in with Google and was asked
       * to sign in again, and the ?join= that made the link an
       * invitation was lost in the round trip.
       */
      const back = `/student${joinTarget ? `?join=${encodeURIComponent(joinTarget)}` : ""}`;
      await signInWithGoogle(back); // full-page redirect; resolve() runs on return
    } catch (e) {
      setError({ kind: "unknown", message: e instanceof Error ? e.message : String(e) });
      setSigningIn(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setEmailBusy(true);
    try {
      const { signInWithEmail } = await import("@/lib/supabaseAuth");
      await signInWithEmail(email.trim(), password);
      await resolve();
    } catch (e) {
      setError({ kind: "unknown", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setEmailBusy(false);
    }
  };

  if (checking || entering) return <BrandLoader />;

  return (
    <div className="min-h-screen bg-paper" dir="auto">
      <header className="px-6 md:px-12 py-6 flex items-center justify-between">
        <a href="/" className="inline-flex items-center gap-2.5 text-ink hover:opacity-80 transition">
          <MurchidLogo className="h-7 w-auto" />
        </a>
      </header>

      <main className="px-6 md:px-12 pb-16 pt-12 md:pt-24">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted mb-3 inline-flex items-center gap-2.5">
              <span className="w-6 h-px bg-accent" /> Student
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-medium text-ink leading-tight mb-3">
              Your <em className="italic font-light text-accent">work</em>
            </h1>
            <p className="text-muted text-sm md:text-base max-w-sm mx-auto">
              Sign in with the email your teacher added you with to see your assigned work, scores and attendance.
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium transition border bg-paper text-ink border-line hover:border-ink hover:-translate-y-px disabled:opacity-50"
            >
              <span className="flex-shrink-0 inline-flex"><GoogleMark /></span>
              <span>{signingIn ? "Opening…" : "Continue with Google"}</span>
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">or with a password</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <form onSubmit={handleEmail} className="space-y-3">
              <input
                type="email" autoComplete="username" placeholder="Email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-line bg-paper text-ink text-sm placeholder:text-muted focus:border-ink outline-none transition"
              />
              <input
                type="password" autoComplete="current-password" placeholder="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-line bg-paper text-ink text-sm placeholder:text-muted focus:border-ink outline-none transition"
              />
              <button
                type="submit" disabled={emailBusy || !email.trim() || !password}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-medium transition bg-ink text-paper hover:opacity-90 disabled:opacity-50"
              >
                {emailBusy ? "Opening…" : "Sign in"}
                {!emailBusy && <ArrowRight size={14} />}
              </button>
            </form>
          </div>

          {error && (
            <div className="bg-paper border border-accent rounded-lg p-4 mb-6">
              <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1.5">Can’t sign in</p>
              <p className="text-sm text-ink">
                {error.kind === "no_match"
                  ? "We couldn’t find a student added with this email. Ask your teacher to add you with the email you’re signing in with."
                  : error.kind === "not_invited"
                    ? "Your teacher has added you, but hasn’t sent the invitation yet. Ask them to press Invite next to your name."
                    : error.kind === "is_teacher"
                      ? "This email already has a teacher account on Murchid, so it can’t also be a student. Ask your teacher to invite you with a different email."
                      : error.kind === "wrong_account"
                        ? "This is a staff account, not a student one. Use the teacher sign-in instead."
                        : error.message || "Something went wrong."}
              </p>
            </div>
          )}

          <div className="text-center mt-12 pt-8 border-t border-line">
            <a href="/" className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink hover:text-accent transition">
              Back to Murchid <ArrowRight size={12} />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
