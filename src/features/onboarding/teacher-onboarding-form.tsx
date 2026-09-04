"use client";

import { useState } from "react";
import { Upload, CheckCircle2 } from "lucide-react";

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
import { StatusPill } from "@/components/ui/status-pill";
import { SYLLABUS_TYPES, UAE_INSTITUTIONS } from "@/features/onboarding/uae-institutions";

type Stage = "form" | "submitting" | "submitted";

export function TeacherOnboardingForm() {
  const [stage, setStage] = useState<Stage>("form");
  const [institution, setInstitution] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!institution.trim()) {
      setError("Enter your institution name first.");
      return;
    }
    setError(null);
    setStage("submitting");
    // No backend to submit to yet (docs/00-concept.md) — this simulates
    // the round trip so the flow is honest about what happens next.
    setTimeout(() => setStage("submitted"), 700);
  }

  if (stage === "submitted") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="font-medium">Submitted for approval</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {institution} will review your details. You&apos;ll be notified
            once a super_admin, sub_admin, or your institution approves the
            account.
          </p>
          <StatusPill status="pending" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>A few details before you start</CardTitle>
        <CardDescription>
          Submitting puts your account into review — a super_admin,
          sub_admin, or your institution approves it before you can add
          students.
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
            <Input id="staff-id" placeholder="e.g. GIS-2291" />
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
            >
              {SYLLABUS_TYPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={stage === "submitting"}>
            {stage === "submitting" ? "Submitting…" : "Submit for approval"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
