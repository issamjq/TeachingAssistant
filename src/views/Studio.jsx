import React from "react";
import { Sparkles, FileText, ClipboardList, GraduationCap, Layers, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// AI Studio — central place to generate teaching artifacts. Right now it's a
// placeholder grid of "what AI will draft for you" cards plus a text prompt
// area. Wire to a real model later (likely via Anthropic API).
const TILES = [
  { key: "lesson-plans",  icon: FileText,        title: "Draft a lesson plan",     copy: "Topic + grade + duration → full lesson plan with objectives, flow, and an exit ticket." },
  { key: "quizzes",       icon: GraduationCap,   title: "Generate a quiz",         copy: "Pick a topic and difficulty — get MCQs, T/F, or short-answer questions." },
  { key: "homework",      icon: ClipboardList,   title: "Build a homework task",   copy: "Practice problems or reading + comprehension prompts." },
  { key: "activities",    icon: Sparkles,        title: "Create an activity",      copy: "Pair-work, group tasks, or hands-on practice." },
  { key: "presentations", icon: Layers,          title: "Outline a presentation",  copy: "Get a slide-by-slide outline ready for refinement." },
  { key: "feedback",      icon: Users,           title: "Suggest student feedback",copy: "Write personalised, kind feedback for individual students." },
];

export default function Studio({ onJump }) {
  return (
    <div>
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Studio
        </p>
        <h2 className="font-serif text-4xl font-medium text-ink">
          AI <em className="italic font-light text-accent">studio</em>
        </h2>
        <p className="text-muted mt-2 max-w-2xl">
          Tell Mudir what you need — a lesson plan, quiz, homework, activity. Refine in the editor afterward.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Prompt</p>
          <textarea
            rows={3}
            placeholder="e.g. A 45-minute Grade 7 science lesson on photosynthesis with a starter, two activities, and a quick exit ticket."
            className="w-full rounded-md border border-line bg-paper focus:border-ink focus:outline-none px-3 py-2.5 text-sm"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              AI generation isn&rsquo;t connected yet — feature flag <span className="text-ink">ai_studio</span> gates the rollout.
            </p>
            <Button disabled title="Will use Anthropic / Claude API once configured">
              <Sparkles size={14} className="mr-2" /> Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        {TILES.map(({ key, icon: Icon, title, copy }) => (
          <button
            key={key}
            onClick={() => onJump?.(key)}
            className="text-left bg-paper-cool border border-line rounded-xl p-5 hover:border-ink transition group"
          >
            <div className="h-10 w-10 rounded-lg bg-paper border border-line flex items-center justify-center mb-3 group-hover:border-ink transition">
              <Icon size={16} className="text-ink-soft" />
            </div>
            <p className="font-serif text-lg text-ink mb-1.5">{title}</p>
            <p className="text-xs text-ink-soft leading-relaxed">{copy}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent mt-3">
              Open the section →
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
