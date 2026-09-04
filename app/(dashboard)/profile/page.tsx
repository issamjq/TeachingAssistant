"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/features/auth/session-context";

export default function ProfilePage() {
  const { user } = useSession();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

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
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <StatusPill status={user?.status ?? "pending"} />
            </div>
            <Separator />
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium capitalize">{user?.role}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Institution</dt>
                <dd className="font-medium">{user?.institution}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Staff ID</dt>
                <dd className="font-medium">{user?.staffId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Syllabus</dt>
                <dd className="font-medium">{user?.syllabus}</dd>
              </div>
            </dl>
            {user?.status === "pending" ? (
              <p className="text-xs text-muted-foreground">
                Awaiting approval from {user.institution}. You can browse the
                app and prepare material, but can&apos;t add students until
                approved.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
