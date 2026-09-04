"use client";

import { useState } from "react";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { useSession } from "./session-context";
import { GoogleButton } from "./google-button";
import { EmailPasswordAuth } from "./email-password-auth";
import type { AuthMode } from "./auth-mode";

const COPY: Record<AuthMode, { title: string; subtitle: string }> = {
  signin: {
    title: "Welcome back",
    subtitle: "Sign in to plan your next term.",
  },
  signup: {
    title: "Create your account",
    subtitle: "For teachers, organisations, and admins.",
  },
  forgot: {
    title: "Reset your password",
    subtitle: "Enter your email and we'll send you a reset link.",
  },
};

export function AuthCard() {
  const { configured, signInWithGoogle, supersededMessage, clearSupersededMessage } = useSession();
  const [mode, setMode] = useState<AuthMode>("signin");
  const { title, subtitle } = COPY[mode];

  return (
    <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-xl">
      <Link href="/" aria-label="Murchid home" className="inline-flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/murchid-logo-green.svg" alt="Murchid" className="h-7 w-auto" />
      </Link>

      <h1 className="mt-6 text-2xl font-black tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

      {supersededMessage ? (
        <p className="mt-5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-center text-xs text-warning">
          {supersededMessage}
          <button
            type="button"
            onClick={clearSupersededMessage}
            className="ml-2 font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        {mode !== "forgot" ? (
          <>
            <GoogleButton onClick={signInWithGoogle} disabled={!configured} />
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
          </>
        ) : null}

        <EmailPasswordAuth mode={mode} onModeChange={setMode} />

        {!configured ? (
          <p className="text-center text-xs text-destructive">
            Sign-in isn&apos;t configured yet — NEXT_PUBLIC_SUPABASE_URL /
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are missing.
          </p>
        ) : null}

        {mode !== "forgot" ? (
          <p className="text-center text-xs text-muted-foreground">
            New teachers and organisations go through a short approval step
            after signing in.
          </p>
        ) : null}
      </div>
    </div>
  );
}
