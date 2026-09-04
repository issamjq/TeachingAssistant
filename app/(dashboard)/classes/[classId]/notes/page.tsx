"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FileText, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/features/auth/session-context";
import { useStudio } from "@/features/studio-legacy/studio-context";
import { StudioComposerBar } from "@/features/studio-legacy/StudioComposerBar";
import { ChooseFromDeckPanel } from "@/features/classes/choose-from-deck-panel";
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 md:p-8">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Uploaded and AI-extracted, picked from the shared deck, or drafted below.
          </p>
          <Button size="sm">
            <Upload /> Upload
          </Button>
        </div>
        {user ? (
          <ChooseFromDeckPanel ownerId={user.id} classId={classId} onAttached={refresh} />
        ) : null}
        {items === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={FileText}
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
      </div>
      <div className="shrink-0 border-t border-border bg-background p-4 md:px-8">
        <StudioComposerBar
          placeholder="e.g. A one-page reading on the Silk Road for Grade 10…"
          buttonLabel="Create"
          onSubmit={handleCreate}
        />
      </div>
    </div>
  );
}
