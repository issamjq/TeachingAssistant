"use client";

// The standalone curriculum screen.
//
// class-settings' "Curriculum · units and pacing" link used to land
// inside "+ New goal" — the board/grade/subject picker and the
// syllabus-derive action only existed as a step toward creating a
// goal, so a teacher who wanted to browse what a unit covers was
// handed a goal-creation form instead. This screen is that browsing,
// on its own: pick a board, grade and subject; read the sequence, its
// outcomes and its pacing; or read one off your own syllabus. Starting
// a goal from a unit is one click from here, not the whole point of
// being here.

import { BookMarked } from "lucide-react";
import { navigate } from "@/lib/route";
import { useClassScope } from "@/shared/lib/classScope";
import { CURRICULUM_SEED_KEY, type CurriculumSeed } from "@/shared/lib/curriculumHandoff";
import CurriculumPicker from "./CurriculumPicker";

export default function CurriculumView() {
  const scope = useClassScope();

  const handlePick = (u: CurriculumSeed) => {
    try {
      sessionStorage.setItem(CURRICULUM_SEED_KEY, JSON.stringify(u));
    } catch {
      // Storage can be unavailable (private mode, quota) — the goal
      // composer still opens, just without the unit pre-filled, which
      // is exactly what it does when reached with no seed at all.
    }
    navigate(["goals"], { curriculum: "1" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Curriculum</p>
        <h1 className="mt-1 font-serif text-[clamp(26px,3.2vw,34px)] leading-[1.1] tracking-[-0.012em] text-ink">
          {scope ? `${scope.subject} · units and pacing` : "Units and pacing"}
        </h1>
        <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-muted">
          Pick a board, grade and subject to read the sequence a curriculum expects — its
          units, outcomes and typical pacing — or read one off your own syllabus. Starting a
          goal from a unit hands it straight to the planner.
        </p>
      </header>

      <CurriculumPicker
        // useClassScope() reports `null` on the very first client render
        // regardless of what localStorage holds — required so hydration
        // matches the server's scope-free render — and only resolves to
        // the real value a tick later. CurriculumPicker reads
        // defaultGrade/defaultSubject through useState(), which only
        // consults its argument on mount, so without the key that first
        // "null" render would be the one that sticks: the selects would
        // sit empty even once the header above correctly says "Physics".
        // Keying on the scope forces a fresh mount — and a fresh
        // useState() read — the moment it resolves.
        key={`${scope?.grade || ""}|${scope?.subject || ""}`}
        startOpen
        collapsible={false}
        showEmptyState
        defaultGrade={scope?.grade || ""}
        defaultSubject={scope?.subject || ""}
        onPick={handlePick}
      />

      <p className="mt-6 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
        <BookMarked size={14} className="mt-0.5 flex-none" aria-hidden />
        Picking a unit opens the goal planner with its title, outcomes and pacing already
        filled in — you still choose the timeline and how it is taught.
      </p>
    </div>
  );
}
