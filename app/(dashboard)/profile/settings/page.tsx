import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function ProfileSettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Account and notifications." />
      <div className="max-w-xl space-y-6 p-6 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="Rana Al Sayed" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>Signed in with Google</span>
              <span className="text-muted-foreground">
                rana.alsayed@gmail.com
              </span>
            </div>
            <Button size="sm">Save changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <label className="flex items-center justify-between">
              Deadline reminders
              <input type="checkbox" defaultChecked className="size-4" />
            </label>
            <label className="flex items-center justify-between">
              New doubts raised by students
              <input type="checkbox" defaultChecked className="size-4" />
            </label>
            <label className="flex items-center justify-between">
              Approval status changes
              <input type="checkbox" defaultChecked className="size-4" />
            </label>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
