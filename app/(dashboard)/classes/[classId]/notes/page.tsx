"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Upload, LibraryBig } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/features/auth/session-context";
import { useStudio } from "@/features/studio-legacy/studio-context";
import { StudioComposerBar } from "@/features/studio-legacy/StudioComposerBar";
import {
  listMaterialsForClass,
  createMaterialFromPrompt,
  type MaterialRow,
} from "@/lib/data/classes";

export default function ClassNotesPage() {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useSession();
  const { open } = useStudio();
  const [items, setItems] = useState<MaterialRow[] | null>(null);

  const refresh = useCallback(() => {
    listMaterialsForClass(classId).then(setItems);
  }, [classId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(prompt: string) {
    if (!user) return;
    await createMaterialFromPrompt(user.id, classId, prompt);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Uploaded and AI-extracted, picked from the shared deck, or drafted below.
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
      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Upload a document, choose from the shared deck, or prompt the studio below."
        />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-center justify-between p-4">
                <p className="text-sm font-medium">{n.title}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => open({ title: n.title, kind: "Note" })}
                >
                  Open
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <StudioComposerBar
        placeholder="e.g. A one-page reading on the Silk Road for Grade 10…"
        buttonLabel="Create"
        onSubmit={handleCreate}
      />
    </div>
  );
}
