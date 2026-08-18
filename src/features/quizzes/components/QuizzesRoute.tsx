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
        /**
         * The id goes through as it is.
         *
         * Quizzes lived in their own table with an integer key; they are rows
         * in `ai_studio` now and the key is a uuid. `Number(id)` on a uuid is
         * NaN, so opening a saved quiz asked the service for quiz NaN, got
         * nothing, and rendered the empty "Build a quiz" form — every quiz in
         * the library looked like it had lost its questions.
         */
        quiz={sub === "edit" && id ? { id } : null}
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
