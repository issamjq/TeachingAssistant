// =====================================================================
// The skills interview — the questions, and the profile they compile to
//
// Ten questions, asked one at a time in a conversation, covering a
// teacher's practice end to end: what they teach, how a lesson runs,
// how they assess, and what their school context allows. The answers
// compile DETERMINISTICALLY into a Markdown document — a template over
// the teacher's own words, no model involved — which is stored in
// teaching_skills.skill_profile. The AI service reads those rows during
// generation, so the profile is what makes every teacher's output
// theirs: same prompt, different teacher, different lesson.
// =====================================================================

export interface InterviewQuestion {
  id: string;
  /** Markdown section heading in the compiled profile. */
  heading: string;
  /** The conversational form, asked in the chat. */
  ask: string;
  /** Placeholder nudging the shape of a useful answer. */
  hint: string;
  /**
   * Quick picks for a teacher who goes blank at the question. Tapping
   * one drops it into the composer as a STARTING POINT — it stays
   * editable there, and the whole profile is editable again at review.
   */
  options: string[];
}

export const QUESTIONS: InterviewQuestion[] = [
  {
    id: "subjects",
    heading: "Subjects & grades",
    ask: "Let's start simple — which subjects do you teach, and to which grades?",
    hint: "e.g. Physics and general science, grades 9–12, IB and MoE streams",
    options: [
      "Mathematics, grades 6–9, MoE curriculum",
      "English language and literature, grades 4–8",
      "Science (physics, chemistry, biology), grades 9–12",
      "Islamic studies and Arabic, KG–grade 5",
    ],
  },
  {
    id: "approach",
    heading: "Teaching approach",
    ask: "How would you describe the way you teach? Inquiry-led, direct instruction, discussion-heavy, hands-on — what actually happens in your classroom?",
    hint: "e.g. I open with a phenomenon or a question before any definitions…",
    options: [
      "Inquiry-led — I open with a question or phenomenon before any definitions",
      "Direct instruction — clear worked examples first, then guided practice",
      "Discussion-heavy — students talk through ideas before I formalise them",
      "Hands-on — activities and experiments carry the lesson, theory follows",
    ],
  },
  {
    id: "lesson-shape",
    heading: "How a lesson runs",
    ask: "Walk me through a typical lesson of yours, start to finish. How does it open, what fills the middle, how does it close?",
    hint: "e.g. 5-min starter, 15-min worked example, pair practice, exit ticket",
    options: [
      "Short starter, worked example, pair practice, exit ticket to close",
      "Recap of last lesson, new idea in small steps, independent practice",
      "Big question first, group investigation, whole-class debrief at the end",
      "Warm-up game, direct teaching, stations or rotations, quick reflection",
    ],
  },
  {
    id: "strengths",
    heading: "Strengths",
    ask: "What are you strongest at as a teacher — the things colleagues or students would say you do especially well?",
    hint: "e.g. turning data into an argument, exam-technique coaching, storytelling",
    options: [
      "Explaining hard ideas simply, with everyday analogies",
      "Exam technique — mark schemes, command words, method marks",
      "Building confidence in weaker students",
      "Storytelling and real-world hooks that make topics stick",
    ],
  },
  {
    id: "assessment",
    heading: "Assessment style",
    ask: "How do you check that learning happened? Quizzes, exit tickets, projects, oral questioning — and what does a good assessment look like to you?",
    hint: "e.g. explanation over recall; short frequent checks over big tests",
    options: [
      "Short, frequent quizzes over big tests — little and often",
      "Exit tickets every lesson; I reteach tomorrow from what they show",
      "Projects and presentations — applying it matters more than recalling it",
      "Oral questioning throughout, a written check at the end of each unit",
    ],
  },
  {
    id: "differentiation",
    heading: "Mixed abilities",
    ask: "When a class has very different levels in it, how do you support the ones who struggle and stretch the ones who are ahead?",
    hint: "e.g. tiered worksheets, choice of task, peer tutoring, extension problems",
    options: [
      "Tiered worksheets — same topic, three levels of challenge",
      "Peer tutoring — stronger students explain, which stretches them too",
      "Choice of task, so students pick their own level of challenge",
      "Extension problems ready for early finishers, small-group time for strugglers",
    ],
  },
  {
    id: "engagement",
    heading: "Engagement & classroom culture",
    ask: "How do you keep a class engaged — and what does your classroom culture feel like on a good day?",
    hint: "e.g. cold-calling with warmth, competition in small doses, real-world hooks",
    options: [
      "Real-world hooks — every topic starts with why it matters to them",
      "Friendly competition in small doses: teams, points, leaderboards",
      "Cold-calling with warmth — everyone expects to contribute, nobody fears it",
      "Calm and structured — clear routines, quiet focus, praise for effort",
    ],
  },
  {
    id: "materials",
    heading: "Materials & tools",
    ask: "What materials and tools do you lean on? Textbooks, slides, labs, manipulatives, any apps or platforms?",
    hint: "e.g. minimal slides, lots of whiteboard work, PhET simulations, past papers",
    options: [
      "Minimal slides — mostly whiteboard work and printed practice",
      "Slides plus short videos, with worksheets for practice",
      "Labs, manipulatives and physical models wherever possible",
      "Digital-first: online quizzes, simulations, shared docs",
    ],
  },
  {
    id: "language",
    heading: "Language & tone",
    ask: "What language do you teach in, and what tone should your materials take — formal, warm, playful, exam-serious?",
    hint: "e.g. English with Arabic support; warm but precise; simple sentences",
    options: [
      "English, warm but precise — simple sentences, no jargon",
      "English with Arabic support for key terms",
      "Arabic first, formal register",
      "Playful for younger grades, exam-serious for exam classes",
    ],
  },
  {
    id: "context",
    heading: "School context & constraints",
    ask: "Last one — anything about your school context the planner should respect? Period lengths, shared labs, curriculum requirements, class sizes…",
    hint: "e.g. 45-min periods, MoE curriculum pacing, lab shared with chemistry",
    options: [
      "45-minute periods, MoE curriculum pacing",
      "Large classes (28–32) — group work needs tight structure",
      "Shared lab access — practicals only on certain days",
      "Double periods available, IB requirements to respect",
    ],
  },
];

/**
 * Answers → the Markdown profile. Pure template over the teacher's own
 * words: skipped questions are omitted rather than padded, because an
 * invented sentence would be read by the generator as if the teacher
 * had said it.
 */
export function compileProfile(
  teacherName: string,
  answers: Record<string, string>,
  date: Date = new Date(),
): string {
  const day = date.toISOString().slice(0, 10);
  const lines: string[] = [
    `# How I teach${teacherName ? ` — ${teacherName}` : ""}`,
    "",
    // *stars*, not _underscores_ — the studio's tight markdown renderer
    // only parses the star form, and this line must not show literally.
    `*Compiled from the teaching-skills interview on ${day}. Written in the teacher's own words.*`,
  ];
  for (const q of QUESTIONS) {
    const a = answers[q.id]?.trim();
    if (!a) continue;
    lines.push("", `## ${q.heading}`, "", a);
  }
  return lines.join("\n");
}

/** How many of the questions actually got an answer. */
export function answeredCount(answers: Record<string, string>): number {
  return QUESTIONS.filter((q) => answers[q.id]?.trim()).length;
}
