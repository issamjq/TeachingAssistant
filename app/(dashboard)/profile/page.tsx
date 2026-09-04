import Link from "next/link";
import { Settings } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  return (
    <div>
      <PageHeader
        title="Profile"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/profile/settings">
              <Settings /> Settings
            </Link>
          </Button>
        }
      />
      <div className="max-w-xl p-6 md:p-8">
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="flex items-center gap-4">
              <Avatar className="size-14">
                <AvatarFallback className="text-lg">RA</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold">Rana Al Sayed</p>
                <p className="text-sm text-muted-foreground">
                  rana.alsayed@greenwood.edu
                </p>
              </div>
              <StatusPill status="pending" />
            </div>
            <Separator />
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium">Teacher</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Institution</dt>
                <dd className="font-medium">Greenwood International School</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Staff ID</dt>
                <dd className="font-medium">GIS-2291</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Syllabus</dt>
                <dd className="font-medium">CBSE</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Awaiting approval from Greenwood International School. You can
              browse the app, but can&apos;t add students until approved.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
