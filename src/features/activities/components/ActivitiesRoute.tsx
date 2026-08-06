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
        activity={sub === "edit" ? { id: Number(id) } : null}
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
