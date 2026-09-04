import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClass } from "@/features/classes/mock-data";

export default async function ClassSettingsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const cls = getClass((await params).classId);

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Class details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="grade">Grade</Label>
              <Input id="grade" defaultValue={cls.grade} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="division">Division</Label>
              <Input id="division" defaultValue={cls.division} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" defaultValue={cls.subject} />
          </div>
          <Button size="sm">Save changes</Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Removing this class removes access for every enrolled student.
            </p>
            <Button variant="destructive" size="sm">
              Delete class
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
