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
import { useSession } from "@/features/auth/session-context";
import { isOnboarded } from "@/features/auth/types";
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
            Applying as a teacher starts with your Google account — the
            details below come right after.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            variant="outline"
            disabled={!configured}
            onClick={signInWithGoogle}
          >
            <svg viewBox="0 0 24 24" className="size-4">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3a7.46 7.46 0 0 1-11.1-3.93H.9v3.09A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M4.96 14.16a7.2 7.2 0 0 1 0-4.32V6.75H.9a12 12 0 0 0 0 10.5z" />
              <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 .9 6.75l4.06 3.09A7.16 7.16 0 0 1 12 4.77z" />
            </svg>
            Continue with Google
          </Button>
          {!configured ? (
            <p className="mt-3 text-center text-xs text-destructive">
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
