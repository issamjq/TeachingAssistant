// =====================================================================
// Answering from knowledge.json, in the browser
//
// The landing assistant needs no server. Its whole job is to explain a
// product whose facts do not change between visitors, and that is a
// lookup, not a generation — so it is one: knowledge.json ships in the
// bundle and the match happens on the device.
//
// What that buys, and why it is the right shape here rather than a
// compromise:
//   - it works with no API, no key, and no quota to exhaust
//   - it cannot invent a feature or a price, which is the failure mode
//     that actually costs a sale
//   - it answers instantly and offline
//
// The matcher is deliberately simple: token overlap against each topic's
// example questions, with a bonus for tag hits. A visitor asks one short
// question about one of sixteen topics; anything cleverer would be
// tuning a ranking problem that does not exist.
// =====================================================================
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import data from "./knowledge.json";

type Topic = { id: string; tags: string[]; ask: string[]; answer: string };

const TOPICS = (data.topics ?? []) as Topic[];
const FALLBACK = data.fallback as { answer: string; suggest: string[] };

/**
 * Words carried by nearly every question, which therefore say nothing
 * about which topic it is. Left in the tag list they would make every
 * topic match every question equally.
 */
const STOP = new Set([
  "the", "a", "an", "is", "it", "of", "to", "for", "and", "or", "in", "on",
  "did", "i", "you", "my", "me", "we", "this", "that", "with",
  "will", "would", "should", "are", "am", "be", "been", "have", "has",
  "there", "your", "please", "get", "any", "some",
]);

const tokenise = (s: string): string[] =>
  s
    .toLowerCase()
    // Keep Arabic. Stripping to /a-z/ would reduce an Arabic question to
    // nothing and every visitor writing in Arabic would get the fallback.
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

/** Crude stem, enough to make "pricing" match "price" and "plans" match "plan". */
const stem = (w: string) =>
  w.replace(/(ing|ed|es|s)$/u, (m, _o) => (w.length - m.length >= 3 ? "" : m));

type Score = { total: number; tagHits: number; bestHits: number };

const score = (qTokens: string[], topic: Topic): Score => {
  const q = new Set(qTokens.map(stem));

  // A tag hit is worth more than an incidental word: tags are the words
  // that identify the topic, which is how "how much" reaches pricing
  // without sharing a word with "cost".
  let tagHits = 0;
  for (const tag of topic.tags) if (q.has(stem(tag))) tagHits++;

  // Best single example question, not the sum across all of them —
  // otherwise a topic with eight examples outranks a better-fitting one
  // with two purely by having more text.
  //
  // The denominator has a floor of 3. Without it a one-word example
  // scores a perfect ratio off a single shared word: "who is it for"
  // reduces to ["who"], so ANY question containing "who" matched it
  // outright — which is how "who won the world cup" became an answer
  // about what Murchid is.
  let best = 0;
  let bestHits = 0;
  for (const ex of topic.ask) {
    const ex_ = tokenise(ex).map(stem);
    if (!ex_.length) continue;
    const hits = ex_.filter((w) => q.has(w)).length;
    const ratio = (hits / Math.max(ex_.length, 3)) * 4;
    if (ratio > best) { best = ratio; bestHits = hits; }
  }
  return { total: tagHits * 3 + best, tagHits, bestHits };
};

/** Fill the placeholders from plans.js so a figure has exactly one home. */
function hydrate(text: string): string {
  if (!text.includes("{{")) return text;
  const pricing = PLANS.map((p: any) => {
    const per = p.cycle === "mo" ? "month" : p.cycle === "q" ? "quarter" : "year";
    const save = p.savePct ? `, ${p.savePct}% cheaper than monthly` : "";
    const best = p.best ? " — the one most teachers pick" : "";
    const name = p.id.charAt(0).toUpperCase() + p.id.slice(1);
    return `- **${name}** — $${p.total} per ${per} (works out at $${p.perMonth}/month${save})${best}`;
  }).join("\n");
  return text
    .replace(/\{\{PRICING\}\}/g, pricing)
    .replace(/\{\{TRIAL_DAYS\}\}/g, String(TRIAL_DAYS));
}

export type Answer = { text: string; topicId: string | null; confident: boolean };

/**
 * The best answer for a question.
 *
 * Below the threshold it returns the fallback rather than the
 * least-bad topic. Confidently answering the wrong question is worse
 * than admitting the gap — a visitor who is told something irrelevant
 * concludes the product does not understand them.
 */
export function answerFor(question: string): Answer {
  const q = tokenise(question);
  if (!q.length) return { text: hydrate(FALLBACK.answer), topicId: null, confident: false };

  let bestTopic: Topic | null = null;
  let best: Score = { total: 0, tagHits: 0, bestHits: 0 };
  for (const t of TOPICS) {
    const sc = score(q, t);
    if (sc.total > best.total) { best = sc; bestTopic = t; }
  }

  // Evidence, not just a number. A confident answer needs either a tag
  // hit — a word that identifies the topic — or two overlapping words in
  // one example. One incidental word in common is a coincidence, and
  // answering on a coincidence is how an assistant tells a visitor
  // something irrelevant with total assurance.
  const enough = best.total >= 2.5 && (best.tagHits > 0 || best.bestHits >= 2);
  if (!bestTopic || !enough) {
    return { text: hydrate(FALLBACK.answer), topicId: null, confident: false };
  }
  return { text: hydrate(bestTopic.answer), topicId: bestTopic.id, confident: true };
}

/** Follow-up chips: what to offer after an answer. */
export function suggestionsAfter(topicId: string | null): string[] {
  const ids = topicId
    ? ["how-it-works", "features", "pricing", "trial", "why-different"].filter((i) => i !== topicId)
    : FALLBACK.suggest;
  return ids
    .slice(0, 3)
    .map((id) => TOPICS.find((t) => t.id === id)?.ask[0])
    .filter(Boolean)
    .map((s) => (s as string).charAt(0).toUpperCase() + (s as string).slice(1) + "?");
}

export const topicCount = TOPICS.length;
