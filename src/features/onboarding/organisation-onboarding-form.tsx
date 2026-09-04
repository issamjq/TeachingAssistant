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
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="font-medium">Submitted for review</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            A super_admin or sub_admin will review {orgName}&apos;s
            documents. We&apos;ll email {email} once it&apos;s decided.
          </p>
          <StatusPill status="pending" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apply as an organisation</CardTitle>
        <CardDescription>
          Reviewed by a super_admin or sub_admin. Once approved, your
          organisation can approve its own teachers directly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
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
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
              <Upload className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Registration certificate, accreditation, or similar proof.
              </p>
              <Button type="button" variant="outline" size="sm">
                Choose file
              </Button>
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={stage === "submitting"}>
            {stage === "submitting" ? "Submitting…" : "Submit for review"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
