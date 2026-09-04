import { Upload, LibraryBig, MessageCircleQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NOTES = [
  { id: "n1", title: "Ancient Trade Routes — reading", pages: 6, doubts: 3 },
  { id: "n2", title: "Map Skills worksheet", pages: 2, doubts: 0 },
  { id: "n3", title: "Primary source: treaty excerpt", pages: 1, doubts: 1 },
];

export default function ClassNotesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Uploaded and AI-extracted, or picked from the shared deck.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <LibraryBig /> Choose from deck
          </Button>
          <Button size="sm">
            <Upload /> Upload
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {NOTES.map((n) => (
          <Card key={n.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">
                  {n.pages} page{n.pages === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {n.doubts > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-warning">
                    <MessageCircleQuestion className="size-3.5" />
                    {n.doubts} doubt{n.doubts === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No doubts raised
                  </span>
                )}
                <Button variant="outline" size="sm">
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
