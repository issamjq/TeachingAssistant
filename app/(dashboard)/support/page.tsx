import { MessageCircle } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const FAQ = [
  { q: "How does a class get approved?", a: "A super_admin, sub_admin, or your organisation reviews your onboarding details and approves the account." },
  { q: "How do students join a class?", a: "You invite them by email from the class's Students tab — there's no self-registration." },
  { q: "What happens if the Goal Planner doesn't have enough to work with?", a: "It asks you for the missing curriculum, prompt detail, or reference material instead of guessing." },
];

export default function SupportPage() {
  return (
    <div>
      <PageHeader title="Support" description="Help, and the support assistant." />
      <div className="grid gap-4 p-6 md:grid-cols-2 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Ask the support assistant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Full access to your own data across the site — unlike the
              per-record Studio assistants in your lessons and exams.
            </p>
            <Textarea placeholder="Ask anything about your account, classes, or students…" rows={3} />
            <Button size="sm">
              <MessageCircle /> Send
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Frequently asked</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {FAQ.map((item) => (
              <div key={item.q}>
                <p className="text-sm font-medium">{item.q}</p>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
