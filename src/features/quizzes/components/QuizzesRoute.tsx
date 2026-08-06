"use client";

import { navigate } from "@/lib/route";
import Quizzes from "@/views/Quizzes";
import QuizBuilder from "@/views/QuizBuilder";

// Sub-route dispatcher for /quizzes:
//   /quizzes            → list
//   /quizzes/new        → builder, empty
//   /quizzes/edit/:id   → builder, loading that quiz
//
// This is the per-section slice of the `if (section === …)` ladder that used
// to live in App.jsx. Keeping it in the feature means the route segment stays
// a thin server component and the branch sits next to the views it picks.

export default function QuizzesRoute({ slug = [] }: { slug?: string[] }) {
  const [sub, id] = slug;

  if (sub === "new" || sub === "edit") {
    return (
      <QuizBuilder
        quiz={sub === "edit" ? { id: Number(id) } : null}
        onClose={() => navigate(["quizzes"])}
      />
    );
  }

  return (
    <Quizzes
      onOpenQuiz={(quiz: { id?: number } | undefined) =>
        navigate(["quizzes", quiz?.id ? "edit" : "new", quiz?.id].filter(Boolean) as string[])
      }
    />
  );
}
