"use client";

import { useState } from "react";
import { Upload, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/ui/status-pill";
import { EMIRATES, UAE_INSTITUTIONS } from "@/features/onboarding/uae-institutions";

type Stage = "form" | "submitting" | "submitted";

export function OrganisationOnboardingForm() {
  const [stage, setStage] = useState<Stage>("form");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgName.trim() || !email.trim()) {
      setError("Organisation name and contact email are both required.");
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
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-10 text-center shadow-xl">
        <div className="flex size-14 items-center justify-center rounded-full bg-success/12 text-success">
          <CheckCircle2 className="size-7" />
        </div>
        <p className="text-lg font-bold">Submitted for review</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          A super admin or sub admin will review {orgName}&apos;s documents.
          We&apos;ll email {email} once it&apos;s decided.
        </p>
        <StatusPill status="pending" />
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-8 shadow-xl">
      <h1 className="text-2xl font-black tracking-tight">Apply as an organisation</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reviewed by a super admin or sub admin. Once approved, your
        organisation can approve its own teachers directly.
      </p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Organisation name</Label>
          <Input
            id="org-name"
            list="org-name-options"
            placeholder="Start typing your school or institution"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          <datalist id="org-name-options">
            {UAE_INSTITUTIONS.map((i) => (
              <option key={i.name} value={i.name}>
                {i.emirate}
              </option>
            ))}
          </datalist>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="emirate">Emirate</Label>
          <select
            id="emirate"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {EMIRATES.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-email">Contact email</Label>
          <Input
            id="contact-email"
            type="email"
            placeholder="admin@greenwood.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Identity / proof documents</Label>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/30 p-7 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
              <Upload className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              Registration certificate, accreditation, or similar proof.
            </p>
            <Button type="button" variant="outline" size="sm">
              Choose file
            </Button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={stage === "submitting"}>
          {stage === "submitting" ? "Submitting…" : "Submit for review"}
        </Button>
      </form>
    </div>
  );
}
