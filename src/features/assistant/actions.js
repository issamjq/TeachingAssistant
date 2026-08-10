"use client";

// =====================================================================
// What the studio assistant can DO without a model
//
// Two abilities, both deterministic and both honest:
//
//   matchNavigate  "open the goal planner" is a command, not a question.
//                  Commands parse with a phrase table; sending them to a
//                  language model would be paying to misunderstand them
//                  occasionally.
//
//   accountAnswer  "how many credits do I have" has exactly one right
//                  answer and it lives in the database. Read it live —
//                  a knowledge-base guess about someone's balance would
//                  be worse than useless.
//
// Each destination replies with what makes that feature ITSELF, so the
// assistant reinforces the differences instead of flattening them.
// =====================================================================
import { api } from "@/shared/lib/apiClient";

/**
 * Feature aliases → section key + a one-line identity.
 *
 * The reply is not filler: a teacher who says "open the scheduler" and
 * reads "put lessons on days" has just been told what the screen is FOR,
 * which is the differentiation the features need.
 */
const PLACES = [
  { section: "dashboard", reply: "Opening your **Dashboard** — the whole week at a glance.",
    words: ["dashboard", "home", "overview"] },
  { section: "studio", reply: "Opening **AI Studio** — the drafting room. Describe what you need; it writes the first version and you shape it.",
    words: ["ai studio", "studio"] },
  { section: "planner", reply: "Opening the **Scheduler** — your timetable. Put lessons on days and the dashboard follows.",
    words: ["scheduler", "planner", "timetable", "schedule"] },
  { section: "goals", reply: "Opening the **Goal planner** — hand over a whole unit or term and get a week-by-week plan built around how you teach.",
    words: ["goal planner", "goal", "goals"] },
  { section: "lesson-plans", reply: "Opening **Lessons** — every plan you've drafted, ready to reuse.",
    words: ["lessons", "lesson plans", "lesson"] },
  { section: "quizzes", reply: "Opening **Quizzes & exams** — question-by-question editing, with marks that flow into the gradebook.",
    words: ["quizzes", "quiz", "exams", "exam"] },
  { section: "homework", reply: "Opening **Homework** — set it, hand it out, see who's turned it in.",
    words: ["homework"] },
  { section: "presentations", reply: "Opening **Presentations** — slide decks grown out of your lesson plans.",
    words: ["presentations", "slides", "presentation", "deck"] },
  { section: "activities", reply: "Opening **Activities** — classroom work with materials and timings.",
    words: ["activities", "activity"] },
  { section: "bulletin-board", reply: "Opening the **Bulletin board**.",
    words: ["bulletin", "bulletin board", "board"] },
  { section: "database", reply: "Opening **My students** — the register: attendance, marks and the gradebook.",
    words: ["students", "my students", "register", "roster", "class list"] },
  { section: "reports", reply: "Opening **Reports**.",
    words: ["reports", "report"] },
  { section: "account", reply: "Opening **Settings**.",
    words: ["settings", "account", "profile"] },
];

const GO = /^\s*(?:please\s+)?(?:open|go to|goto|take me to|show me|show|navigate to|switch to)\s+(?:the\s+|my\s+)?(.+?)\s*[.!?]*\s*$/i;

/** A navigation command, or null if the message is not one. */
export function matchNavigate(message) {
  const m = GO.exec(message || "");
  if (!m) return null;
  const target = m[1].toLowerCase();
  for (const place of PLACES) {
    if (place.words.some((w) => target === w || target.startsWith(w + " ") || w.startsWith(target))) {
      return place;
    }
  }
  return null;
}

/**
 * The teacher's plan and credits, from the live profile. Returns null on
 * any failure so the caller falls back to the knowledge base instead of
 * inventing numbers.
 */
export async function accountAnswer() {
  try {
    const me = await api("/api/me");
    const lines = [];

    if (me.credits_balance != null) {
      lines.push(
        `You have **${me.credits_balance} of ${me.credits_allowance ?? me.credits_balance} credits** left. ` +
        `Each AI generation — a lesson, a quiz, a plan — spends one.`
      );
    }

    const ends = me.subscription_ends_at ? new Date(me.subscription_ends_at) : null;
    const days = ends ? Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 864e5)) : null;
    const lapsed = ["expired", "canceled", "suspended"].includes(me.subscription_status) ||
      (days === 0 && me.subscription_status !== "active");

    if (lapsed) {
      lines.push(
        `Your ${me.subscription_status === "trialing" ? "trial" : "plan"} has **ended**. ` +
        `Everything you made is still readable and exportable — creating new work is paused until you choose a plan in **Settings**.`
      );
    } else if (me.subscription_status === "trialing") {
      lines.push(
        `You're on the **free trial**${days != null ? ` with **${days} ${days === 1 ? "day" : "days"} left**` : ""}. ` +
        `The full studio is open during the trial — nothing is held back.`
      );
    } else if (me.subscription_plan) {
      lines.push(
        `You're on the **${me.subscription_plan} plan**${days != null ? `, renewing in ${days} ${days === 1 ? "day" : "days"}` : ""}.`
      );
    }

    return lines.length ? lines.join("\n\n") : null;
  } catch {
    return null;
  }
}
