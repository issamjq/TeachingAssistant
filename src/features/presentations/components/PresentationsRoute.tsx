"use client";

import { navigate } from "@/lib/route";
import Presentations from "@/views/Presentations";
import PresentationBuilder from "@/views/PresentationBuilder";

// Sub-route dispatcher for /presentations:
//   /presentations            → list
//   /presentations/new        → builder, empty
//   /presentations/edit/:id   → builder, loading that presentation
//
// The per-section slice of the `if (section === …)` ladder that used to live
// in App.jsx, moved next to the views it selects.

export default function PresentationsRoute({ slug = [] }: { slug?: string[] }) {
  const [sub, id] = slug;

  if (sub === "new" || sub === "edit") {
    return (
      <PresentationBuilder
        presentation={sub === "edit" ? { id: Number(id) } : null}
        onClose={() => navigate(["presentations"])}
      />
    );
  }

  return (
    <Presentations
      onOpenPresentation={(row: { id?: number } | undefined) =>
        navigate(
          ["presentations", row?.id ? "edit" : "new", row?.id].filter(Boolean) as string[]
        )
      }
    />
  );
}
