"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "./session-context";

export function EmailPasswordAuth() {
  const { signInWithPassword, signUpWithPassword } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
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
          setMode("signin");
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
    <form className="space-y-3" onSubmit={handleSubmit}>
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
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-success">{notice}</p> : null}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "…" : mode === "signin" ? "Sign in" : "Create account"}
      </Button>
      <button
        type="button"
        onClick={toggleMode}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        {mode === "signin"
          ? "Don't have an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
