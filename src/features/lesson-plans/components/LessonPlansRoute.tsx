"use client";

import { useEffect } from "react";
import { navigate, replace } from "@/lib/route";
import TemplatesLibrary from "@/views/TemplatesLibrary";
import NewTemplate from "@/views/NewTemplate";
import EditDraft from "@/views/EditDraft";
import { cloneTemplateToDraft, type Template } from "../api";

// Sub-route dispatcher for /lesson-plans:
//   /lesson-plans/templates      → library (also the default)
//   /lesson-plans/newTemplate    → template editor
//   /lesson-plans/new            → draft editor, empty
//   /lesson-plans/edit/:id       → draft editor for that draft
//
// Anything else redirects to the templates library — this includes the old
// "drafts" tab, which was removed but may still be bookmarked.

const goTemplates = () => navigate(["lesson-plans", "templates"]);

export default function LessonPlansRoute({ slug = [] }: { slug?: string[] }) {
  const [sub, id] = slug;
  const view = sub || "templates";
  const isKnownView =
    view === "templates" ||
    view === "newTemplate" ||
    view === "new" ||
    view === "edit";

  // Redirect from an effect, not during render — navigating while rendering
  // is a React no-no and App.jsx's version ran on every render pass.
  useEffect(() => {
    if (!isKnownView) replace(["lesson-plans", "templates"]);
  }, [isKnownView]);

  if (!isKnownView) return null;

  if (view === "newTemplate") {
    return <NewTemplate onCancel={goTemplates} onSave={goTemplates} />;
  }

  if (view === "new" || view === "edit") {
    return (
      <EditDraft
        // EditDraft fetches the latest from /api/drafts/:id on mount, so the
        // id alone is enough and the view survives a refresh. With no id it
        // POSTs a fresh draft on first save (same as QuizBuilder).
        draft={view === "edit" && id ? { id: Number(id) } : null}
        onClose={goTemplates}
        onMarkReady={goTemplates}
      />
    );
  }

  return (
    <TemplatesLibrary
      onNewTemplate={() => navigate(["lesson-plans", "newTemplate"])}
      onUseTemplate={async (t: Template) => {
        try {
          const draft = await cloneTemplateToDraft(t);
          navigate(["lesson-plans", "edit", draft.id]);
        } catch (e) {
          alert(`Could not clone template: ${(e as Error).message}`);
        }
      }}
    />
  );
}
