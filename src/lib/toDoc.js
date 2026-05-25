// Pure mappers: a teaching item → the normalized doc model consumed by
// src/lib/export.js (printDoc / exportDocx). No I/O here — callers pass
// the fully-loaded item and a `t` translator so generated headings stay
// bilingual (EN/AR). Keys live under "export.*" in src/lib/i18n.jsx; a
// missing key falls back to the English label passed inline.

const labeler = (t) => (key, fallback) => {
  const v = t ? t(`export.${key}`) : null;
  return !v || v === `export.${key}` ? fallback : v;
};

// "Math · Grade 5 · 30 min" — joins the truthy parts with a middot.
const dotJoin = (...parts) => parts.filter((p) => p != null && String(p).trim() !== "").join(" · ");

const marksLabel = (L, n) => (n == 1 ? L("mark", "mark") : L("marks", "marks"));

export function lessonPlanToDoc(d = {}, t) {
  const L = labeler(t);
  const blocks = [];
  if (Array.isArray(d.objectives) && d.objectives.some((o) => String(o).trim())) {
    blocks.push({ type: "heading", text: L("lp.objectives", "Learning objectives") });
    blocks.push({ type: "list", ordered: true, items: d.objectives });
  }
  if (d.intro && String(d.intro).trim()) {
    blocks.push({ type: "heading", text: L("lp.intro", "Introduction / warm-up") });
    blocks.push({ type: "paragraph", text: d.intro });
  }
  if (d.main_activity && String(d.main_activity).trim()) {
    blocks.push({ type: "heading", text: L("lp.main", "Main activity") });
    blocks.push({ type: "paragraph", text: d.main_activity });
  }
  if (d.conclusion && String(d.conclusion).trim()) {
    blocks.push({ type: "heading", text: L("lp.conclusion", "Conclusion / wrap-up") });
    blocks.push({ type: "paragraph", text: d.conclusion });
  }
  if (d.assessment_method && String(d.assessment_method).trim()) {
    blocks.push({ type: "heading", text: L("lp.assessment", "Assessment") });
    blocks.push({ type: "paragraph", text: d.assessment_method });
  }
  if (Array.isArray(d.materials) && d.materials.some((m) => String(m).trim())) {
    blocks.push({ type: "heading", text: L("lp.materials", "Materials") });
    blocks.push({ type: "list", items: d.materials });
  }
  return {
    title: d.name || L("lp.untitled", "Untitled lesson"),
    subtitle: dotJoin(d.subject, d.grade && `${L("grade", "Grade")} ${d.grade}`, d.section, d.duration_minutes && `${d.duration_minutes} ${L("min", "min")}`),
    meta: [{ label: L("date", "Date"), value: d.planned_date || "" }],
    blocks,
  };
}

const TF_CHOICES = (L) => [L("true", "True"), L("false", "False")];

export function quizToDoc(quiz = {}, questions = [], t) {
  const L = labeler(t);
  const blocks = [];
  if (quiz.instructions && String(quiz.instructions).trim()) {
    blocks.push({ type: "note", text: quiz.instructions });
  }
  const sorted = [...(questions || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  sorted.forEach((q, i) => {
    let choices;
    if (q.type === "mcq") choices = Array.isArray(q.choices) ? q.choices : [];
    else if (q.type === "tf") choices = TF_CHOICES(L);
    // short / essay → no choices → blank ruled answer space
    blocks.push({
      type: "qa",
      n: q.position ?? i + 1,
      prompt: q.prompt || "",
      choices,
      marks: q.marks != null ? q.marks : undefined,
      marksLabel: q.marks != null ? marksLabel(L, q.marks) : undefined,
    });
  });
  return {
    title: quiz.title || L("quiz.untitled", "Untitled quiz"),
    subtitle: dotJoin(
      L("quiz.word", "Quiz"),
      quiz.subject,
      quiz.grade && `${L("grade", "Grade")} ${quiz.grade}`,
      quiz.section
    ),
    meta: [
      { label: L("totalMarks", "Total marks"), value: quiz.total_marks || "" },
      { label: L("duration", "Duration"), value: quiz.duration_minutes ? `${quiz.duration_minutes} ${L("min", "min")}` : "" },
      { label: L("date", "Date"), value: quiz.scheduled_for ? String(quiz.scheduled_for).slice(0, 10) : "" },
    ],
    blocks,
  };
}

export function homeworkToDoc(h = {}, t) {
  const L = labeler(t);
  const blocks = [];
  if (h.instructions && String(h.instructions).trim()) {
    blocks.push({ type: "heading", text: L("hw.instructions", "Instructions") });
    blocks.push({ type: "paragraph", text: h.instructions });
  }
  const links = (Array.isArray(h.attachments) ? h.attachments : [])
    .map((a) => (typeof a === "string" ? a : a?.url || a?.name))
    .filter(Boolean);
  if (links.length) {
    blocks.push({ type: "heading", text: L("hw.attachments", "Attachments") });
    blocks.push({ type: "list", items: links });
  }
  return {
    title: h.title || L("hw.untitled", "Untitled homework"),
    subtitle: dotJoin(
      L("hw.word", "Homework"),
      h.subject,
      h.grade && `${L("grade", "Grade")} ${h.grade}`,
      h.section
    ),
    meta: [{ label: L("hw.due", "Due"), value: h.due_date ? String(h.due_date).slice(0, 10) : "" }],
    blocks,
  };
}

// deck: { deckTitle, slides: [{ title, bullets[], notes }] }, meta: { subject, grade, section }
export function presentationToDoc(deck = {}, meta = {}, t) {
  const L = labeler(t);
  const blocks = [];
  (deck.slides || []).forEach((s, i) => {
    blocks.push({ type: "heading", text: `${i + 1}. ${s.title || L("slide", "Slide")} ${i + 1}`.trim() });
    const bullets = (s.bullets || []).filter((b) => String(b).trim());
    if (bullets.length) blocks.push({ type: "list", items: bullets });
    if (s.notes && String(s.notes).trim()) {
      blocks.push({ type: "note", text: `${L("notes", "Speaker notes")}: ${s.notes}` });
    }
    if (i < (deck.slides || []).length - 1) blocks.push({ type: "divider" });
  });
  return {
    title: deck.deckTitle || L("pres.untitled", "Untitled presentation"),
    subtitle: dotJoin(
      L("pres.word", "Presentation"),
      meta.subject,
      meta.grade && `${L("grade", "Grade")} ${meta.grade}`,
      meta.section
    ),
    meta: [{ label: L("slides", "Slides"), value: (deck.slides || []).length || "" }],
    blocks,
  };
}

export function activityToDoc(a = {}, t) {
  const L = labeler(t);
  const blocks = [];
  if (a.instructions && String(a.instructions).trim()) {
    blocks.push({ type: "heading", text: L("ac.instructions", "Instructions") });
    blocks.push({ type: "paragraph", text: a.instructions });
  }
  const materials = (Array.isArray(a.materials) ? a.materials : []).filter((m) => String(m).trim());
  if (materials.length) {
    blocks.push({ type: "heading", text: L("ac.materials", "Materials") });
    blocks.push({ type: "list", items: materials });
  }
  return {
    title: a.title || L("ac.untitled", "Untitled activity"),
    subtitle: dotJoin(
      L("ac.word", "Activity"),
      a.type,
      a.subject,
      a.duration_minutes && `${a.duration_minutes} ${L("min", "min")}`
    ),
    meta: [{ label: L("date", "Date"), value: a.scheduled_for ? String(a.scheduled_for).slice(0, 10) : "" }],
    blocks,
  };
}
