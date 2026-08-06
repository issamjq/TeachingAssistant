"use client";

import { navigate } from "@/lib/route";
import Homework from "@/views/Homework";
import HomeworkBuilder from "@/views/HomeworkBuilder";

// Sub-route dispatcher for /homework:
//   /homework            → list
//   /homework/new        → builder, empty
//   /homework/edit/:id   → builder, loading that homework item
//
// The per-section slice of the `if (section === …)` ladder that used to live
// in App.jsx, moved next to the views it selects.

export default function HomeworkRoute({ slug = [] }: { slug?: string[] }) {
  const [sub, id] = slug;

  if (sub === "new" || sub === "edit") {
    return (
      <HomeworkBuilder
        homework={sub === "edit" ? { id: Number(id) } : null}
        onClose={() => navigate(["homework"])}
      />
    );
  }

  return (
    <Homework
      onOpenHomework={(row: { id?: number } | undefined) =>
        navigate(
          ["homework", row?.id ? "edit" : "new", row?.id].filter(Boolean) as string[]
        )
      }
    />
  );
}
