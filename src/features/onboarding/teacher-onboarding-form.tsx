"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/features/auth/session-context";
import { isOnboarded } from "@/features/auth/types";
import { AuthCard } from "@/features/auth/auth-card";
import { SYLLABUS_TYPES, UAE_INSTITUTIONS } from "@/features/onboarding/uae-institutions";

export function TeacherOnboardingForm() {
  const { user, loading, completeOnboarding } = useSession();
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
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  if (!user) {
    return <AuthCard />;
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
    <div className="rounded-3xl border border-border bg-card p-8 shadow-xl">
      <h1 className="text-2xl font-black tracking-tight">A few details before you start</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Signed in as {user.email}. Submitting puts your account into review
        — a super admin, sub admin, or your institution approves it before
        you can add students.
      </p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
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
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/30 p-7 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
              <Upload className="size-5" />
            </div>
            <Button type="button" variant="outline" size="sm">
              Choose file
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="syllabus">Syllabus type</Label>
          <select
            id="syllabus"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
          >
            {SYLLABUS_TYPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit for approval"}
        </Button>
      </form>
    </div>
  );
}
