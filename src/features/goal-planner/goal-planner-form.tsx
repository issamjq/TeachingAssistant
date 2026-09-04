"use client";

import { useState } from "react";
import { Sparkles, Upload, LibraryBig, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CLASSES, classLabel } from "@/features/classes/mock-data";

const DRAFT_ITEMS = [
  { label: "Slide deck", detail: "18 slides" },
  { label: "Lesson notes", detail: "4 sections" },
  { label: "Quizzes", detail: "2 quizzes, 15 questions" },
  { label: "Exam", detail: "1 unit test" },
  { label: "Activities", detail: "3 in-class activities" },
  { label: "Homework", detail: "2 assignments" },
];

type Stage = "idle" | "generating" | "ready";

export function GoalPlannerForm() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);

  function generate() {
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
            <select
              id="class"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue={CLASSES[2]?.id}
            >
              {CLASSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                </option>
              ))}
            </select>
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

          <Button
            className="w-full"
            onClick={generate}
            disabled={stage === "generating"}
          >
            <Sparkles /> Generate term plan
          </Button>
          <p className="text-xs text-muted-foreground">
            Thin on detail? The planner will ask for the missing curriculum or
            reference material instead of inventing content.
          </p>
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
              <Button className="w-full" variant="default">
                <Check /> Approve &amp; schedule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
