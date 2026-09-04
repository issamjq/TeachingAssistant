"use client";

import { useEffect, useState } from "react";
import { Sparkles, Upload, LibraryBig, Check, Lock, FileWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSession } from "@/features/auth/session-context";
import {
  listHierarchy,
  hasReferenceMaterial,
  type BatchRow,
} from "@/lib/data/classes";

const DRAFT_ITEMS = [
  { label: "Slide deck", detail: "18 slides" },
  { label: "Lesson notes", detail: "4 sections" },
  { label: "Quizzes", detail: "2 quizzes, 15 questions" },
  { label: "Exam", detail: "1 unit test" },
  { label: "Activities", detail: "3 in-class activities" },
  { label: "Homework", detail: "2 assignments" },
];

// A detailed enough prompt counts as grounding on its own, per the
// concept: "curriculum, or proper detailed prompts, and textbooks or
// documents, or choose from the materials." Anything real and attached
// to the class (Notes & text) also counts, checked separately below.
const MIN_GROUNDED_PROMPT_LENGTH = 40;

type Stage = "idle" | "generating" | "ready";

interface ClassOption {
  id: string;
  label: string;
}

function flattenClasses(batches: BatchRow[]): ClassOption[] {
  return batches
    .slice()
    .sort((a, b) => b.start_year - a.start_year)
    .flatMap((b) =>
      b.grades
        .slice()
        .sort((g1, g2) => g1.level - g2.level)
        .flatMap((g) =>
          g.divisions.flatMap((d) =>
            d.classes.map((c) => ({
              id: c.id,
              label: `${b.label} · Grade ${g.level} · ${d.label} · ${c.subject}`,
            })),
          ),
        ),
    );
}

export function GoalPlannerForm() {
  const { user } = useSession();
  const approved = user?.status === "active";
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [classes, setClasses] = useState<ClassOption[] | null>(null);
  const [classId, setClassId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [hasReference, setHasReference] = useState<boolean | null>(null);

  useEffect(() => {
    listHierarchy().then((data) => {
      const options = flattenClasses(data);
      setClasses(options);
      if (options.length > 0) setClassId(options[0].id);
    });
  }, []);

  useEffect(() => {
    if (!classId) {
      setHasReference(null);
      return;
    }
    hasReferenceMaterial(classId).then(setHasReference);
  }, [classId]);

  const grounded = hasReference || prompt.trim().length >= MIN_GROUNDED_PROMPT_LENGTH;
  const canGenerate = Boolean(classId) && grounded && stage !== "generating";

  function generate() {
    if (!canGenerate) return;
    setStage("generating");
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          setStage("ready");
          return 100;
        }
        return p + 20;
      });
    }, 250);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>What are we planning?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="class">Class</Label>
            {classes === null ? (
              <p className="text-sm text-muted-foreground">Loading your classes…</p>
            ) : classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No classes yet — add one in My Classes first.
              </p>
            ) : (
              <select
                id="class"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <Tabs defaultValue="prompt">
            <TabsList>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="upload">Upload documents</TabsTrigger>
              <TabsTrigger value="library">Shared library</TabsTrigger>
            </TabsList>
            <TabsContent value="prompt">
              <Textarea
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Term 2, Unit 3: Trade routes of the ancient world. Cover the Silk Road, maritime trade, and the spread of ideas. Reference the Grade 10 CBSE Social Studies syllabus."
              />
            </TabsContent>
            <TabsContent value="upload">
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-8 text-center">
                <Upload className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop a textbook chapter, syllabus, or notes — extracted and
                  used as reference material.
                </p>
                <Button variant="outline" size="sm">
                  Choose file
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="library">
              <div className="space-y-2 rounded-md border border-border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked className="size-4" />
                  CBSE Grade 10 Social Studies — Unit 3 pack
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4" />
                  Shared: Silk Road primary sources (contributed by 3 schools)
                </label>
              </div>
            </TabsContent>
          </Tabs>

          {classId && !grounded ? (
            <div className="flex items-start gap-2 rounded-md border border-dashed border-warning/40 bg-warning/5 p-3">
              <FileWarning className="size-4 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">
                This class has no syllabus, curriculum, or reference attached,
                and the prompt is too thin to draft from reliably. Add a
                reference in Notes & text, choose from the shared library
                above, or write more detail here first — otherwise the draft
                would be guessing.
              </p>
            </div>
          ) : null}

          <Button
            className="w-full"
            onClick={generate}
            disabled={!canGenerate}
          >
            <Sparkles /> Generate term plan
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Draft</CardTitle>
        </CardHeader>
        <CardContent>
          {stage === "idle" && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Generate a plan to see the draft here.
            </p>
          )}
          {stage === "generating" && (
            <div className="space-y-3 py-10">
              <p className="text-center text-sm text-muted-foreground">
                Drafting slides, notes, quizzes, exam, activities, homework…
              </p>
              <Progress value={progress} />
            </div>
          )}
          {stage === "ready" && (
            <div className="space-y-4">
              <div className="space-y-2">
                {DRAFT_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status="draft" />
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {approved ? (
                <Button className="w-full" variant="default">
                  <Check /> Approve &amp; schedule
                </Button>
              ) : (
                <div className="space-y-1.5">
                  <Button className="w-full" variant="default" disabled>
                    <Lock /> Approve &amp; schedule
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Drafting is open now — scheduling to students needs your
                    account approved first.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
