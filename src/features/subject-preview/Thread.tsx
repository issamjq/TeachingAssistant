"use client";

// =====================================================================
// The planner's conversation, made of things that were actually said
//
// The reference design draws this surface as a chat, and the shape is
// worth keeping: a question, the teacher's own words opposite it, and
// what came out sitting under the reply as a card she can open. It reads
// as the record of a working session rather than as a list of files.
//
// So the transcript is real. `ai_studio.prompt_text` is the sentence she
// typed, stored beside what it produced — "what she asked for is part of
// the record", as artifacts.ts puts it — and `batch_id` groups the rows
// that came out of one request together, which is why a lesson plan
// arrives with its guide and its notes listed under it rather than as
// three separate cards for one thing she asked for once.
//
// A row with no prompt behind it — cloned from a template, seeded,
// written before prompt_text was stored — still gets its turn, but the
// user bubble is simply absent. Putting invented words in a teacher's
// mouth to complete the shape is the one thing this page must not do.
// =====================================================================

import { Printer, Sparkles } from "lucide-react";
import { KIND_BY_KEY, type Item } from "./types";
import { KIND_ICON } from "./Shell";
import type { Route } from "./route";
import { ago, classLine } from "./parts";
import { classKey } from "./model";
import s from "./Screens.module.css";
import g from "./GoalPlanner.module.css";

export type Turn = {
  id: string;
  /** The sentence she typed, when the row remembers one. */
  prompt: string | null;
  at: string | null;
  items: Item[];
};

/**
 * The last few real exchanges, oldest first.
 *
 * Oldest first because that is how a conversation is read and where the
 * composer sits — at the bottom, after the most recent thing said.
 */
export function turnsFrom(items: Item[], limit = 4): Turn[] {
  const byBatch = new Map<string, Turn>();
  for (const it of items) {
    const prompt = String(it.raw.prompt_text ?? "").trim();
    const key = String(it.raw.batch_id ?? it.id);
    const turn = byBatch.get(key);
    if (turn) {
      turn.items.push(it);
      if (!turn.prompt && prompt) turn.prompt = prompt;
    } else {
      byBatch.set(key, { id: key, prompt: prompt || null, at: it.updatedAt, items: [it] });
    }
  }
  // `items` arrives newest first, so the first `limit` batches are the
  // most recent ones; reversing puts the newest at the foot of the page.
  return [...byBatch.values()].slice(0, limit).reverse();
}

export function Bubble({
  mine, children, stamp,
}: { mine?: boolean; children: React.ReactNode; stamp?: string }) {
  return (
    <div className={mine ? `${g.turn} ${g.mine}` : g.turn}>
      <span className={g.face} aria-hidden="true">
        {mine ? "You" : <Sparkles size={14} />}
      </span>
      <div className={g.side}>
        <div className={mine ? `${g.bubble} ${g.bubbleMine}` : g.bubble}>{children}</div>
        {stamp && <span className={g.stamp}>{stamp}</span>}
      </div>
    </div>
  );
}

export function TurnView({
  turn, go,
}: { turn: Turn; go: (r: Route) => void }) {
  const [lead, ...rest] = turn.items;
  const def = KIND_BY_KEY[lead.kind];
  const Icon = KIND_ICON[lead.kind];
  const where = [lead.subject, classLine(lead.grade, lead.section)].filter(Boolean).join(" · ");

  return (
    <>
      {turn.prompt && <Bubble mine stamp={ago(turn.at)}>{turn.prompt}</Bubble>}

      <div className={g.turn}>
        <span className={g.face} aria-hidden="true"><Sparkles size={14} /></span>
        <div className={g.side}>
          <div className={g.bubble}>
            {rest.length
              ? `Made ${turn.items.length} documents${where ? ` for ${where}` : ""}.`
              : `Made a ${def.one}${where ? ` for ${where}` : ""}.`}
          </div>

          <article className={g.result}>
            <span className={g.resultKind}>
              <Icon size={13} strokeWidth={2} aria-hidden="true" />
              {def.one[0].toUpperCase() + def.one.slice(1)}
              {lead.raw.duration_minutes ? ` · ${lead.raw.duration_minutes} minutes` : ""}
            </span>
            <h3 className={g.resultTitle}>{lead.title}</h3>
            <p className={g.resultMeta}>{where || "No class set"}</p>

            {rest.length > 0 && (
              <div className={g.also}>
                {rest.map((it) => {
                  const RIcon = KIND_ICON[it.kind];
                  return (
                    <div key={it.id} className={g.alsoRow}>
                      <span className={g.alsoIcon}><RIcon size={13} strokeWidth={1.9} /></span>
                      <span className={g.alsoName}>{it.title}</span>
                      <span className={g.stamp}>{KIND_BY_KEY[it.kind].one}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={g.resultActions}>
              <button
                type="button"
                className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`}
                onClick={() => {
                  const key = classKey(lead.subject, lead.grade);
                  go(key ? { v: "item", s: key, k: lead.kind, id: lead.id } : { v: "library" });
                }}
              >
                Open {def.one}
              </button>
              <button type="button" className={`${s.btn} ${s.btnQuiet} ${s.btnSmall}`}>
                <Printer size={13} /> Print
              </button>
            </div>
          </article>
        </div>
      </div>
    </>
  );
}
