"use client";

import { useEffect } from "react";
import { navigate, replace } from "@/lib/route";
import ReusableDrafts from "@/views/ReusableDrafts";
import TemplatesLibrary from "@/views/TemplatesLibrary";
import NewTemplate from "@/views/NewTemplate";
import EditDraft from "@/views/EditDraft";
import { cloneTemplateToDraft, type Template } from "../api";

// Sub-route dispatcher for /lesson-plans:
//   /lesson-plans                → the teacher's own saved lessons (default)
//   /lesson-plans/new            → draft editor, empty
//   /lesson-plans/edit/:id       → draft editor for that lesson
//   /lesson-plans/templates      → the in-section starter-template library
//   /lesson-plans/newTemplate    → template editor
//
// The default landed on the template library before, which is why a
// just-saved or just-imported lesson seemed to vanish — the list that
// holds it was never wired in. The teacher's lessons are the default now;
// the broader curated shelf lives in the Template library section.

const goList = () => navigate(["lesson-plans"]);
const goTemplates = () => navigate(["lesson-plans", "templates"]);

export default function LessonPlansRoute({ slug = [] }: { slug?: string[] }) {
  const [sub, id] = slug;
  const view = sub || "list";
  const isKnownView =
    view === "list" ||
    view === "templates" ||
    view === "newTemplate" ||
    view === "new" ||
    view === "edit";

  // Redirect from an effect, not during render.
  useEffect(() => {
    if (!isKnownView) replace(["lesson-plans"]);
  }, [isKnownView]);

  if (!isKnownView) return null;

  if (view === "new" || view === "edit") {
    return (
      <EditDraft
        // EditDraft fetches the latest from /api/drafts/:id on mount, so the
        // id alone is enough and the view survives a refresh. With no id it
        // POSTs a fresh draft on first save (same as QuizBuilder).
        //
        // Pass the id through as-is: rows are Supabase UUIDs now, so the old
        // Number() coercion turned every id into NaN — breaking both this
        // editor and the "Use template" clone that navigates straight here.
        draft={view === "edit" && id ? { id } : null}
        // Close and Mark-ready both return to the lessons list, so the
        // teacher lands where their saved lesson actually shows.
        onClose={goList}
        onMarkReady={goList}
      />
    );
  }

  if (view === "newTemplate") {
    return <NewTemplate onCancel={goTemplates} onSave={goTemplates} />;
  }

  if (view === "templates") {
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

  // Default: the teacher's saved lessons.
  return (
    <ReusableDrafts
      onEditDraft={(d: { id: string | number }) => navigate(["lesson-plans", "edit", d.id])}
      onNewLesson={() => navigate(["lesson-plans", "new"])}
    />
  );
}
