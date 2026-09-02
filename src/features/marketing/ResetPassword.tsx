"use client";

// The screen the reset email has always promised.
//
// sendPasswordReset() pointed at "/?resetPassword=1", nothing ever read
// that parameter, and updatePassword() had no call site anywhere — so a
// teacher who clicked the link landed on the marketing page (or, with a
// stored session, was bounced to the dashboard) and never got to type a
// new password. The funnel meanwhile told her to "pick a new password".
// This is that page.
//
// Supabase is on the PKCE flow with detectSessionInUrl, so the recovery
// link arrives as ?code=… and the client exchanges it for a session on
// load. There is no token to parse here — only a session to wait for,
// and the honest failure when it never comes (an expired or reused link).

import { useEffect, useState } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import MurchidLogo from "@/components/MurchidLogo";
import { supabase } from "@/lib/supabaseClient";
import { updatePassword } from "@/lib/supabaseAuth";
import { passwordChecks, passwordScore, validatePassword } from "@/shared/lib/password";

type Phase = "checking" | "ready" | "saving" | "done" | "invalid";

const BAR = ["bg-crit", "bg-crit", "bg-warn", "bg-warn", "bg-ok"];
const WORD = ["Weak", "Weak", "Fair", "Good", "Strong"];

export default function ResetPassword() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wait for the recovery session. The client may still be exchanging
  // the code when this mounts, so a single getSession() can race it —
  // the auth listener is what actually settles this.
  useEffect(() => {
    let live = true;
    const settle = (hasSession: boolean) => {
      if (!live) return;
      setPhase((p) => (p === "checking" ? (hasSession ? "ready" : "invalid") : p));
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) settle(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) settle(true);
    });

    // If neither has produced a session by now the link is spent. Six
    // seconds is long enough for a slow exchange and short enough that a
    // dead link does not read as a hung page.
    const timer = setTimeout(() => settle(false), 6000);

    return () => {
      live = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const checks = passwordChecks(password);
  const score = passwordScore(password);
  const problem = validatePassword(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) {
      setError(problem);
      return;
    }
    setPhase("saving");
    setError(null);
    try {
      await updatePassword(password);
      setPhase("done");
    } catch (err: any) {
      setPhase("ready");
      setError(err?.message || "That didn't save. Try again in a moment.");
    }
  };

  return (
    <main className="min-h-[100dvh] bg-paper text-ink flex flex-col items-center justify-center px-5 py-14">
      <div className="w-full max-w-[26rem]">
        <a href="/" className="inline-flex mb-9" aria-label="Murchid — home">
          <MurchidLogo />
        </a>

        {phase === "checking" && (
          <p className="text-sm text-ink-soft">Checking your link…</p>
        )}

        {phase === "invalid" && (
          <>
            <h1 className="font-serif text-[1.75rem] leading-tight mb-2">
              This link has <em className="text-accent not-italic italic">expired</em>.
            </h1>
            <p className="text-sm text-ink-soft leading-relaxed mb-6">
              Reset links can only be used once, and they stop working after a
              while. Ask for a fresh one and it will arrive in a moment.
            </p>
            <a
              href="/signin"
              className="inline-flex items-center justify-center h-11 px-5 rounded-lg bg-ink text-paper text-sm font-medium"
            >
              Back to sign in
            </a>
          </>
        )}

        {phase === "done" && (
          <>
            <h1 className="font-serif text-[1.75rem] leading-tight mb-2">
              Password <em className="text-accent">changed</em>.
            </h1>
            <p className="text-sm text-ink-soft leading-relaxed mb-6">
              You're signed in on this device. Use the new password next time
              you sign in anywhere else.
            </p>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center h-11 px-5 rounded-lg bg-ink text-paper text-sm font-medium"
            >
              Open Murchid
            </a>
          </>
        )}

        {(phase === "ready" || phase === "saving") && (
          <>
            <h1 className="font-serif text-[1.75rem] leading-tight mb-2">
              Pick a new <em className="text-accent">password</em>.
            </h1>
            <p className="text-sm text-ink-soft leading-relaxed mb-7">
              Choose something you have not used on Murchid before.
            </p>

            <form onSubmit={submit} noValidate>
              <label htmlFor="new-password" className="block text-[13px] font-medium mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="new-password"
                  autoFocus
                  dir="ltr"
                  className="w-full h-11 rounded-lg border border-line bg-paper-warm px-3.5 pr-11 text-sm outline-none focus:border-ink"
                  placeholder="Your new password"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Same five-segment bar as sign-up, from the same rules. */}
              <div className="mt-3 flex gap-1.5" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i < score ? BAR[score - 1] : "bg-line"}`}
                  />
                ))}
              </div>
              {password && (
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  {WORD[Math.max(0, score - 1)]}
                </p>
              )}

              <ul className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {([
                  ["length", "8+ characters"],
                  ["upper", "Uppercase (A–Z)"],
                  ["lower", "Lowercase (a–z)"],
                  ["number", "Number (0–9)"],
                  ["special", "Symbol (! @ # ?)"],
                ] as const).map(([key, label]) => (
                  <li key={key} className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                    {checks[key] ? (
                      <Check size={12} className="text-ok flex-none" aria-hidden />
                    ) : (
                      <X size={12} className="text-line flex-none" aria-hidden />
                    )}
                    <span>{label}</span>
                  </li>
                ))}
              </ul>

              {error && (
                <p role="alert" className="mt-4 text-[13px] text-accent leading-relaxed">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={phase === "saving" || !!problem}
                className="mt-6 w-full h-11 rounded-lg bg-ink text-paper text-sm font-medium disabled:opacity-40"
              >
                {phase === "saving" ? "Saving…" : "Save new password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
