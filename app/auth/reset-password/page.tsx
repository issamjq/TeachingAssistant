"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/features/auth/session-context";

type Stage = "verifying" | "ready" | "invalid" | "saving" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword } = useSession();
  const [stage, setStage] = useState<Stage>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setStage("invalid");
        return;
      }
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        window.location.href,
      );
      setStage(exchangeError ? "invalid" : "ready");
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setStage("saving");
    try {
      await updatePassword(password);
      setStage("done");
      router.replace("/signin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("ready");
    }
  }

  return (
    <div className="theme-marketing flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/murchid-logo-green.svg" alt="Murchid" className="h-7 w-auto" />

        {stage === "verifying" ? (
          <>
            <h1 className="mt-6 text-2xl font-black tracking-tight">One moment</h1>
            <p className="mt-1 text-sm text-muted-foreground">Verifying your reset link…</p>
          </>
        ) : null}

        {stage === "invalid" ? (
          <>
            <h1 className="mt-6 text-2xl font-black tracking-tight">Link expired</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This reset link is invalid or has already been used. Request a
              new one from the sign-in page.
            </p>
            <Button asChild className="mt-6 w-full">
              <a href="/signin">Back to sign in</a>
            </Button>
          </>
        ) : null}

        {stage === "ready" || stage === "saving" || stage === "done" ? (
          <>
            <h1 className="mt-6 text-2xl font-black tracking-tight">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose something you haven&apos;t used before.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  minLength={6}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {error ? (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={stage === "saving"}>
                {stage === "saving" ? "Saving…" : "Save new password"}
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}
