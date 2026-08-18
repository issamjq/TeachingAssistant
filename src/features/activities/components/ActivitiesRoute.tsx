"use client";

import { navigate } from "@/lib/route";
import Activities from "@/views/Activities";
import ActivityBuilder from "@/views/ActivityBuilder";

// Sub-route dispatcher for /activities:
//   /activities            → list
//   /activities/new        → builder, empty
//   /activities/edit/:id   → builder, loading that activity
//
// The per-section slice of the `if (section === …)` ladder that used to live
// in App.jsx, moved next to the views it selects.

export default function ActivitiesRoute({ slug = [] }: { slug?: string[] }) {
  const [sub, id] = slug;

  if (sub === "new" || sub === "edit") {
    return (
      <ActivityBuilder
        /* The key is a uuid since these became `ai_studio` rows; Number()
           on one is NaN, which opens an empty builder instead of the saved
           work. See QuizzesRoute for the whole story. */
        activity={sub === "edit" && id ? { id } : null}
        onClose={() => navigate(["activities"])}
      />
    );
  }

  return (
    <Activities
      onOpenActivity={(row: { id?: number } | undefined) =>
        navigate(
          ["activities", row?.id ? "edit" : "new", row?.id].filter(Boolean) as string[]
        )
      }
    />
  );
}
