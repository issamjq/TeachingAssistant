"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "./session-context";
import type { AuthMode } from "./auth-mode";

export function EmailPasswordAuth({
  mode,
  onModeChange,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}) {
  const { signInWithPassword, signUpWithPassword, requestPasswordReset } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: AuthMode) {
    setError(null);
    setNotice(null);
    onModeChange(next);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "forgot") {
      if (!email.trim()) {
        setError("Enter your email.");
        return;
      }
      setSubmitting(true);
      try {
        await requestPasswordReset(email.trim());
        setNotice("If an account exists for that email, a reset link is on its way.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError("Enter an email and password.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signInWithPassword(email.trim(), password);
      } else {
        const { needsEmailConfirmation } = await signUpWithPassword(
          email.trim(),
          password,
        );
        if (needsEmailConfirmation) {
          setNotice("Check your email to confirm your account, then sign in.");
          switchMode("signin");
          setPassword("");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {mode !== "forgot" ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "signin" ? (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </button>
            ) : null}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
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
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          {notice}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting
          ? "…"
          : mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : "Send reset link"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "signin" ? (
          <button type="button" onClick={() => switchMode("signup")} className="hover:text-foreground">
            Don&apos;t have an account? <span className="font-medium text-primary">Sign up</span>
          </button>
        ) : mode === "signup" ? (
          <button type="button" onClick={() => switchMode("signin")} className="hover:text-foreground">
            Already have an account? <span className="font-medium text-primary">Sign in</span>
          </button>
        ) : (
          <button type="button" onClick={() => switchMode("signin")} className="hover:text-foreground">
            <span className="font-medium text-primary">Back to sign in</span>
          </button>
        )}
      </p>
    </form>
  );
}
