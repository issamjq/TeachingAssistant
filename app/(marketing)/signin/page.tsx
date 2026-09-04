"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/features/auth/session-context";
import { isOnboarded } from "@/features/auth/types";
import { GoogleButton } from "@/features/auth/google-button";
import { EmailPasswordAuth } from "@/features/auth/email-password-auth";

export default function SignInPage() {
  const { user, loading, configured, signInWithGoogle } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(isOnboarded(user) ? "/overview" : "/onboarding/teacher");
    }
  }, [loading, user, router]);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Murchid
          </Link>
          <CardTitle className="mt-2">Sign in</CardTitle>
          <CardDescription>For teachers, organisations, and admins.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleButton onClick={signInWithGoogle} disabled={!configured} />
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <EmailPasswordAuth />
          {!configured ? (
            <p className="text-center text-xs text-destructive">
              Sign-in isn&apos;t configured yet — NEXT_PUBLIC_SUPABASE_URL /
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are missing.
            </p>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            New teachers and organisations go through a short approval step
            after signing in.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
