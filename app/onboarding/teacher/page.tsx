import { Upload } from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SYLLABUS_TYPES, UAE_INSTITUTIONS } from "@/features/onboarding/uae-institutions";

export default function TeacherOnboardingPage() {
  return (
    <div>
      <SiteHeader homeHref="/" label="Teacher onboarding" />
      <div className="mx-auto max-w-lg p-6 md:p-10">
        <Card>
          <CardHeader>
            <CardTitle>A few details before you start</CardTitle>
            <CardDescription>
              Submitting puts your account into review — a super_admin,
              sub_admin, or your institution approves it before you can add
              students.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="institution">Institution name</Label>
              <Input
                id="institution"
                list="institution-options"
                placeholder="Start typing your school or institution"
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
                <Button variant="outline" size="sm">Choose file</Button>
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
            <Button className="w-full">Submit for approval</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
