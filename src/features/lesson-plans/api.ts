import { api } from "@/shared/lib/apiClient";

// Network calls for lesson plans. Components never call fetch directly —
// this is the only place the feature touches the API.
//
// cloneTemplateToDraft was 40 lines inlined in App.jsx's render as an
// onUseTemplate callback. It is business logic, not routing, so it lives
// here where it can be read and changed on its own.

export interface TemplateStage {
  name: string;
  note?: string;
}

export interface Template {
  id: number;
  name: string;
  subject?: string;
  grade?: string;
  duration?: number;
  stages?: TemplateStage[];
  flow?: string;
  objectives?: string[];
  tags?: string[];
  used_count?: number;
}

export interface Draft {
  id: number;
  name: string;
}

// A template's stages collapse into the draft's three prose fields. The
// mapping depends on how many stages there are:
//   1 stage  → intro only
//   2 stages → intro + main
//   3+       → first is intro, last is conclusion, the rest join as main
// With no stages at all, the free-text `flow` becomes the main activity.
function stagesToDraftBody(t: Template) {
  const stages = Array.isArray(t.stages) ? t.stages : [];
  const line = (s: TemplateStage) => `${s.name}: ${s.note || ""}`.trim();

  let intro = "";
  let main_activity = "";
  let conclusion = "";

  if (stages.length === 1) {
    intro = line(stages[0]);
  } else if (stages.length === 2) {
    intro = line(stages[0]);
    main_activity = line(stages[1]);
  } else if (stages.length >= 3) {
    intro = line(stages[0]);
    conclusion = line(stages[stages.length - 1]);
    main_activity = stages.slice(1, -1).map(line).join("\n");
  } else if (t.flow) {
    main_activity = t.flow;
  }

  return { intro, main_activity, conclusion };
}

/**
 * Create a new draft from a template and return it.
 *
 * The usage-count bump is deliberately fire-and-forget: it's an analytics
 * nicety, and failing it should never block the teacher from opening the
 * draft that was just created for them.
 */
export async function cloneTemplateToDraft(t: Template): Promise<Draft> {
  const draft = await api<Draft>("/api/drafts", {
    method: "POST",
    body: {
      name: `${t.name} (from template)`,
      subject: t.subject,
      grade: t.grade,
      duration_minutes: t.duration,
      status: "In progress",
      progress: 25,
      objectives: Array.isArray(t.objectives) ? t.objectives : [],
      ...stagesToDraftBody(t),
      tags: t.tags || [],
    },
  });

  api(`/api/templates/${t.id}`, {
    method: "PATCH",
    body: { used_count: (t.used_count || 0) + 1 },
  }).catch(() => {});

  return draft;
}
