import { Upload } from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMIRATES, UAE_INSTITUTIONS } from "@/features/onboarding/uae-institutions";

export default function OrganisationOnboardingPage() {
  return (
    <div>
      <SiteHeader homeHref="/" label="Organisation application" />
      <div className="mx-auto max-w-lg p-6 md:p-10">
        <Card>
          <CardHeader>
            <CardTitle>Apply as an organisation</CardTitle>
            <CardDescription>
              Reviewed by a super_admin or sub_admin. Once approved, your
              organisation can approve its own teachers directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Organisation name</Label>
              <Input
                id="org-name"
                list="org-name-options"
                placeholder="Start typing your school or institution"
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
              <Input id="contact-email" type="email" placeholder="admin@greenwood.edu" />
            </div>
            <div className="space-y-1.5">
              <Label>Identity / proof documents</Label>
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
                <Upload className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Registration certificate, accreditation, or similar proof.
                </p>
                <Button variant="outline" size="sm">Choose file</Button>
              </div>
            </div>
            <Button className="w-full">Submit for review</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
