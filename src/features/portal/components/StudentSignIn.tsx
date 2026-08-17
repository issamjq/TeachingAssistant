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

import { useEffect, useState } from "react";
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
  | { kind: "wrong_account"; role: string }
  | { kind: "unknown"; message: string };

export default function StudentSignIn() {
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

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
    replace(["student-dashboard"]);
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
      if (me.role === "student") { enter(me); return true; }
      setError({ kind: "wrong_account", role: me.role });
      return true;
    }
    // No profile yet — try to claim a roster row for this email.
    const res = await api<{ linked: boolean; reason?: string }>("/api/auth/link-student", { method: "POST" });
    if (res.linked) {
      const me2 = await api<MeRow>("/api/auth/me");
      if (me2.role === "student") { enter(me2); return true; }
    }
    setError({ kind: "no_match" });
    return true;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getCurrentUser } = await import("@/lib/supabaseAuth");
        const user = await getCurrentUser();
        if (cancelled) return;
        if (!user) return; // show the buttons
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
      await signInWithGoogle(); // full-page redirect; resolve() runs on return
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

  if (checking) return <BrandLoader />;

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
