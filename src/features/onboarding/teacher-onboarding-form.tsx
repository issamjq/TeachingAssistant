"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/features/auth/session-context";
import { isOnboarded } from "@/features/auth/types";
import { GoogleButton } from "@/features/auth/google-button";
import { EmailPasswordAuth } from "@/features/auth/email-password-auth";
import { SYLLABUS_TYPES, UAE_INSTITUTIONS } from "@/features/onboarding/uae-institutions";

export function TeacherOnboardingForm() {
  const { user, loading, configured, signInWithGoogle, completeOnboarding } =
    useSession();
  const router = useRouter();
  const [institution, setInstitution] = useState("");
  const [syllabus, setSyllabus] = useState<string>(SYLLABUS_TYPES[0]);
  const [staffId, setStaffId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isOnboarded(user)) {
      router.replace("/overview");
    }
  }, [loading, user, router]);

  if (loading || (user && isOnboarded(user))) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in to apply</CardTitle>
          <CardDescription>
            Applying as a teacher starts with an account — the details below
            come right after.
          </CardDescription>
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
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!institution.trim()) {
      setError("Enter your institution name first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    await completeOnboarding({ institution, staffId: staffId || undefined, syllabus });
    setSubmitting(false);
    router.push("/overview");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>A few details before you start</CardTitle>
        <CardDescription>
          Signed in as {user.email}. Submitting puts your account into
          review — a super_admin, sub_admin, or your institution approves it
          before you can add students.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="institution">Institution name</Label>
            <Input
              id="institution"
              list="institution-options"
              placeholder="Start typing your school or institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
            <datalist id="institution-options">
              {UAE_INSTITUTIONS.map((i) => (
                <option key={i.name} value={i.name}>
                  {i.emirate}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Not listed? Type the full name — it goes to review either way.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-id">Staff ID (number)</Label>
            <Input
              id="staff-id"
              placeholder="e.g. GIS-2291"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Or a photo of your staff ID</Label>
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
              <Upload className="size-5 text-muted-foreground" />
              <Button type="button" variant="outline" size="sm">
                Choose file
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="syllabus">Syllabus type</Label>
            <select
              id="syllabus"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
            >
              {SYLLABUS_TYPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit for approval"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
