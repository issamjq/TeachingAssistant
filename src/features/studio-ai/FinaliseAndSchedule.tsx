"use client";

// =====================================================================
// Finalising generated work, and putting it on the timetable
//
// A lesson comes out of the studio as three documents. Until now the only
// thing a teacher could do with them was press Save three times and then
// go and retype the title into the scheduler by hand — the work knew what
// it was and roughly when it was for, and none of that reached her
// calendar.
//
// This is the step between. It keeps everything the batch produced, then
// asks the service when the thing is taught. The service reads her own
// words for a day — "next Monday 9am", "Thursday first period" — and
// schedules it when it finds one.
//
// When it does not find one, nothing is asked. Murchid never guesses a
// day: putting a class on her calendar she did not agree to is worse than
// leaving it off. But it does not chase her for one either — the work
// saves with no date and she places it from the Scheduler if and when she
// decides. Generating and timetabling are separate jobs, and only she
// knows whether the second one is due yet.
// =====================================================================
import { useEffect, useRef, useState } from "react";
import { Calendar, Check, CircleAlert, Loader2, Users } from "lucide-react";

import { api } from "@/views/_shared";
import { useRoster } from "@/features/delivery";
import { classLabel, matchRoster, type Audience } from "@/shared/lib/classMatch";
import { PREFILL_KEY } from "@/shared/lib/assistantPrefill";
import { navigate } from "@/lib/route";
import s from "./Studio.module.css";

/** One generated document, as StudioChat holds it in a turn. */
export interface StudioTurn {
  kind: string;
  text: string;
  structured?: unknown;
  saved?: boolean;
  artifactId?: string;
  batchId?: string | null;
}

interface Proposed {
  title: string;
  subject: string | null;
  grade: string | null;
  section: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
}

interface Clash {
  id: string;
  title: string;
}

/** A deliverable saved alongside the lesson, waiting for a slot of its own. */
interface SavedExtra {
  kind: string;
  id: string;
  title: string;
}

type Phase = "idle" | "working" | "asking" | "confirming" | "scheduled" | "kept";

/** "2026-08-20" + "11:00" → "Thursday 20 August, 11:00". */
function readableWhen(date: string, start: string | null) {
  const day = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // Times arrive from Postgres as "11:00:00"; the seconds are noise on a
  // timetable and read as a precision the booking does not have.
  //
  // Homework has no hour at all — it is due on a day — and interpolating the
  // missing value left the confirmation reading "Friday 21 August, ".
  return start ? `${day}, ${String(start).slice(0, 5)}` : day;
}

export function FinaliseAndSchedule({
  turns,
  primaryKind,
  label,
  section,
  save,
  onScheduled,
  replaces,
  onKept,
  planned = null,
}: {
  /**
   * The documents finalised together. A lesson is three; a quiz is one.
   * Whichever of them is `primaryKind` is the one that takes the slot.
   */
  turns: StudioTurn[];
  primaryKind: string;
  /** What the button calls it — "lesson", "quiz". */
  label: string;
  /**
   * The section it lands in — "Lessons", "Quizzes". Passed in rather than
   * built from `label`, which produced "Quizs".
   */
  section?: string;
  /**
   * Write one document and return the stored row.
   *
   * Supplied by the chat rather than reimplemented here: a second copy of
   * the save would mean a second copy of the title rule, and the two would
   * disagree the first time either changed.
   */
  save: (
    turns: StudioTurn[],
    replaceId?: string,
  ) => Promise<
    | ({ id: string; also?: SavedExtra[] } & {
        /** The stored row is flattened, so the audience the AI decided on
            rides back with it — the widget shows it instead of hiding it. */
        grade?: string | null;
        subject?: string | null;
        section?: string | null;
      })
    | null
  >;
  /** The slot, once written, so the library card can carry it too. */
  onScheduled?: (artifactId: string, entry: Proposed) => void;
  /**
   * The batch she last finalised in this conversation, when this one looks
   * like a rework of it. Present means the primary action UPDATES those rows
   * instead of writing new ones — same card in the library, same row on the
   * timetable, moved if the time changed.
   */
  replaces?: { title: string; id: string } | null;
  /** Called once the batch is kept, so the chat can remember it. */
  onKept?: (info: { primaryId: string }) => void;
  /**
   * The class this batch was written for — the teacher's composer pick,
   * or the scope the service/document stated. Shown BEFORE saving, so
   * "she made something — for whom?" is answered while the decision to
   * keep it is still being made.
   */
  planned?: Audience | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [proposed, setProposed] = useState<Proposed | null>(null);
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [error, setError] = useState("");
  /**
   * The class the saved work is labelled for — the decision that alone
   * determines whether any student ever sees it, read back off the stored
   * row so it can be SHOWN rather than left to a code comment.
   */
  const [audience, setAudience] = useState<Audience | null>(null);
  /** Saved-row audience once it exists, else the pre-save plan. */
  const knownAudience = audience ?? planned;
  const { roster, ready: rosterReady } = useRoster();
  /** "reaches 24 students" / "reaches nobody" for an audience, or "" while unknown. */
  const reachText = (a: Audience | null | undefined): string => {
    if (!a || !rosterReady || !roster.length) return "";
    if (!String(a.grade ?? "").trim() && !String(a.subject ?? "").trim()) return "";
    const n = matchRoster(a, roster).length;
    return n
      ? ` — reaches ${n} student${n === 1 ? "" : "s"}`
      : " — but it matches nobody on your roster";
  };
  /** True when this run rewrote the work but left its timetable slot alone. */
  const [keptSlot, setKeptSlot] = useState(false);
  /**
   * Whether this batch replaces the previous one. Seeded from the guess and
   * then hers — "Save as a new lesson" flips it, and the guess never
   * overrides a choice she has made.
   */
  const [asUpdate, setAsUpdate] = useState<boolean>(!!replaces);
  /**
   * Saved in the same batch, each still needing its own timetable row.
   *
   * A ref rather than state: `storeAll` and the scheduling call happen
   * inside ONE async run, so a state variable read there would still hold
   * the value from before this render and place nothing. Nothing renders
   * from it either, so state would only add a needless re-render.
   */
  const extrasRef = useRef<SavedExtra[]>([]);

  const primary = turns.find((t) => t.kind === primaryKind);

  /**
   * Keep everything in the batch, and report where the primary one landed.
   *
   * Remembered, so pressing finalise twice cannot write a second copy of
   * work she has already kept.
   */
  const storeAll = async (): Promise<string | null> => {
    if (primaryId) return primaryId;
    /**
     * One row for the whole generation.
     *
     * A lesson's three documents are one lesson, and the library stores them
     * as one merged document — so this hands the batch over in a single call
     * rather than writing a row per part and leaving her list with three
     * near-identical entries.
     */
    const existing = asUpdate && replaces ? replaces.id : undefined;
    const stored = await save(turns, existing);
    if (!stored) throw new Error(`The ${label} could not be saved.`);
    extrasRef.current = stored.also ?? [];
    setPrimaryId(stored.id);
    setAudience({
      grade: stored.grade ?? null,
      subject: stored.subject ?? null,
      section: stored.section ?? null,
    });
    onKept?.({ primaryId: stored.id });
    return stored.id;
  };

  /**
   * A deck is shown during a lesson, not booked as one.
   *
   * Slides have no start of their own and no length of their own, so the
   * timetable is offered here rather than required: she keeps the deck with
   * one press, and puts it on a day only if she wants it there.
   */
  const optionalSlot = primaryKind === "presentation";

  /**
   * Give the quiz and the homework a day too.
   *
   * A student sees work by matching their grade and subject against a
   * timetable row — `schedule_entries` IS the assignment mechanism, and the
   * `assignments` table is empty and unused. Only the lesson was ever
   * placed, so a quiz generated in the same breath reached the teacher's
   * Quizzes list and no child at all.
   *
   * They land on the LESSON'S day with no hours: homework and a quiz have a
   * deadline, not a period, and the route already writes a null start_time
   * as exactly that. Reusing the day the teacher already agreed to avoids
   * asking her a second date question she has effectively answered.
   *
   * Failures are reported and swallowed: the lesson is on the calendar by
   * this point and losing that because a quiz clashed would be a worse
   * trade than a quiz she has to place by hand.
   */
  const placeExtras = async (entry: Proposed) => {
    if (!extrasRef.current.length) return;
    const failed: string[] = [];
    for (const extra of extrasRef.current) {
      try {
        await api("/api/studio/schedule", {
          method: "POST",
          body: {
            draft_id: extra.id,
            confirm: true,
            proposed: {
              title: extra.title,
              subject: entry.subject ?? null,
              grade: entry.grade ?? null,
              section: entry.section ?? null,
              date: entry.date,
              start_time: null,
              end_time: null,
            },
          },
        });
      } catch {
        failed.push(extra.kind.replace(/_/g, " "));
      }
    }
    if (failed.length) {
      setError(
        `Saved, but the ${failed.join(" and ")} could not be put on your timetable. ` +
          "You can place it from its own section.",
      );
    }
  };

  const run = async (body: Record<string, unknown>) => {
    setError("");
    setPhase("working");
    try {
      const id = await storeAll();
      if (!id) throw new Error(`The ${label} could not be saved.`);

      const reply = await api<{
        status: "needs_input" | "ready" | "scheduled" | "unchanged";
        question?: string;
        proposed?: Proposed;
        entry?: Proposed;
        clashes?: Clash[];
      }>("/api/studio/schedule", { method: "POST", body: { draft_id: id, ...body } });

      setClashes(reply.clashes || []);

      /**
       * She never said when, so nothing is asked.
       *
       * This used to stop and put a question in front of her — "When is this
       * lesson?" — with "Not yet" as the way out. Removed on the owner's
       * call: a teacher who wanted a slot said so in the brief, and one who
       * did not was being made to dismiss a form to get back to work. The
       * Scheduler has always been there for placing it later, and that is
       * where someone who has not decided yet is going to do it anyway.
       *
       * The work is already saved by this point — storeAll() ran before the
       * call — so finishing here keeps everything and simply leaves it with
       * no date, which is exactly what "Not yet" did.
       */
      if (reply.status === "needs_input") {
        setPhase("kept");
        return;
      }
      /**
       * "Ready" only comes back when this call did not ask to write.
       *
       * It used to be a second step — read the slot, then press "Put it on my
       * timetable" — which is two buttons for one decision she already made
       * when she pressed finalise. The slot is shown in the confirmation
       * afterwards instead, where it is still the first thing she reads.
       */
      if (reply.status === "ready" && reply.proposed) {
        setProposed(reply.proposed);
        setPhase("confirming");
        return;
      }
      if (reply.entry) {
        setProposed(reply.entry);
        onScheduled?.(id, reply.entry);
        await placeExtras(reply.entry);
      }
      // `unchanged` means the documents were rewritten and the slot she
      // already chose was left exactly where it was.
      setKeptSlot(reply.status === "unchanged");
      setPhase("scheduled");
    } catch (e) {
      setError((e as Error).message);
      /**
       * Keep her where she was, with what she typed. Dropping back to the
       * opening button threw away the answer she had just given and made her
       * retype it — the one thing a failed retry must not cost her. The
       * documents are saved by this point; only the date is left to redo.
       */
      setPhase(answer.trim() ? "asking" : "idle");
    }
  };

  const savedTo = section || `${label[0]?.toUpperCase() ?? ""}${label.slice(1)}s`;

  /**
   * Already kept — so say what actually happened to it.
   *
   * The widget's phase lives in component state, and a remount (a reload, or
   * a re-render once the next generation arrives) put a finished batch back
   * at "idle", where it offered to save work already in the library.
   * Guarding on the turns' own `saved` flag fixes that — but on its own it
   * reported a bare "Saved to Lessons" over a lesson that HAD been
   * timetabled, because the slot was only ever held in state that did not
   * survive. So the slot is read back from the service instead of guessed.
   */
  const savedId = turns.find((t) => t.artifactId)?.artifactId;
  const settled = turns.length > 0 && turns.every((t) => t.saved);

  useEffect(() => {
    if (!settled || !savedId || proposed) return;
    let live = true;
    api<{ entries: Proposed[] }>(`/api/studio/schedule/${savedId}`)
      .then((r) => {
        if (live && r?.entries?.[0]) setProposed(r.entries[0]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [settled, savedId, proposed]);

  /**
   * `primary` is absent when this batch rewrote only a supporting document —
   * the notes, say — and the plan it belongs to was left alone. That is still
   * a lesson to keep, so the guard is on there being anything at all rather
   * than on the primary part having been regenerated. Below every hook, so
   * an empty render never changes the hook order.
   */
  if (!turns.length) return null;

  /**
   * The class on the slot (or, failing that, on the saved row), spoken
   * aloud: "for Grade 6 · Science". The audience decision was always
   * being made — by the AI, by inheritance, by the scheduler — and never
   * shown; every finished state now names it.
   */
  const classOf = (a: Audience | null | undefined): string => {
    const name = a ? classLabel(a) : "";
    return name ? ` for ${name}` : "";
  };

  /**
   * Saved but on no timetable slot — the state in which the work is
   * invisible to every student. Said plainly, with the one action that
   * changes it: the planner opens its entry form already carrying this
   * work, so placing it is a date and a class away.
   */
  const notDelivered = (id: string | null) => (
    <div className="mt-2.5">
      <p className="text-[12.5px] text-muted flex items-center gap-1.5">
        <Check size={13} /> Saved to {savedTo}
        {classOf(knownAudience)}.
      </p>
      <p className="text-[12.5px] text-warn mt-1 flex items-center gap-1.5">
        <CircleAlert size={13} className="flex-none" />
        Not on the timetable yet, so students can&rsquo;t see it — work reaches your
        class only through a timetable slot.
      </p>
      {id && (
        <button
          type="button"
          className={`${s.chipBtn} mt-2`}
          onClick={() => {
            try {
              sessionStorage.setItem(
                PREFILL_KEY,
                JSON.stringify({
                  action: "add_schedule_entry",
                  at: Date.now(),
                  draft_id: String(id),
                  title: primary?.text.match(/^#\s*(.+)$/m)?.[1]?.trim() || "",
                  subject: String(knownAudience?.subject ?? ""),
                  grade: String(knownAudience?.grade ?? ""),
                  section: String(knownAudience?.section ?? ""),
                }),
              );
            } catch {
              /* the planner still opens; she links the work by hand */
            }
            navigate(["planner"]);
          }}
        >
          <Calendar size={13} /> Put it on the timetable
        </button>
      )}
    </div>
  );

  if (phase === "idle" && settled) {
    if (!proposed) return notDelivered(savedId ?? primaryId);
    return (
      <p className="text-[12.5px] text-muted mt-2.5 flex items-center gap-1.5">
        <Check size={13} />
        Saved to {savedTo} — on your timetable for{" "}
        {readableWhen(proposed.date, proposed.start_time)}
        {classOf(proposed)}
        {reachText(proposed)}.
      </p>
    );
  }

  if (phase === "scheduled") {
    return (
      <p className="text-[12.5px] text-muted mt-2.5 flex items-center gap-1.5">
        <Check size={13} />
        {keptSlot ? "Updated in" : "Saved to"} {savedTo}
        {proposed
          ? `${keptSlot ? " — still on your timetable for " : " — on your timetable for "}${readableWhen(proposed.date, proposed.start_time)}${classOf(proposed)}${reachText(proposed)}.`
          : " and scheduled."}
      </p>
    );
  }

  if (phase === "kept") {
    return notDelivered(primaryId);
  }

  if (phase === "confirming" && proposed) {
    return (
      <div className="mt-2.5">
        <p className="text-[12.5px] text-ink">
          Ready for <strong>{readableWhen(proposed.date, proposed.start_time)}</strong>
          {proposed.end_time ? `–${proposed.end_time}` : ""}
          {proposed.subject ? ` · ${proposed.subject}` : ""}
          {proposed.grade ? ` · Grade ${proposed.grade}` : ""}
          {reachText(proposed)}.
        </p>
        {clashes.length > 0 && (
          <p className="text-[12px] text-muted mt-1">
            Note: {clashes.map((c) => c.title).join(", ")} already sits in that hour.
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            className={s.chipBtn}
            data-primary
            // The proposal goes back with the confirmation, so the service
            // writes what she just approved instead of deriving it a second
            // time from a model that might answer differently — or not at all.
            onClick={() => run({ answer, confirm: true, proposed })}
          >
            <Calendar size={13} /> Put it on my timetable
          </button>
          {/* Still reachable — but only from a slot Murchid PROPOSED,
              which means she did name a time. This is her correcting a
              reading of her own words, not being asked for something she
              never offered. */}
          <button
            type="button"
            className={s.chipBtn}
            onClick={() => {
              setProposed(null);
              setAnswer("");
              setQuestion(`When would you rather teach this ${label}?`);
              setPhase("asking");
            }}
          >
            Pick another time
          </button>
        </div>
      </div>
    );
  }

  if (phase === "asking") {
    return (
      <form
        className="mt-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (answer.trim()) run({ answer: answer.trim() });
        }}
      >
        <p className="text-[12.5px] text-ink">{question}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <input
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={optionalSlot ? "Thursday" : "Thursday 11am"}
            aria-label={`When this ${label} is`}
            className="flex-1 min-w-[180px] rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] text-ink"
          />
          <button type="submit" className={s.chipBtn} data-primary disabled={!answer.trim()}>
            <Calendar size={13} /> Schedule it
          </button>
          <button type="button" className={s.chipBtn} onClick={() => setPhase("kept")}>
            {optionalSlot ? "No, just save it" : "Not yet"}
          </button>
        </div>
        {error && <p className="text-[12px] text-muted mt-1.5">{error}</p>}
      </form>
    );
  }

  return (
    <div className="mt-2.5">
      {/* For whom — answered before she decides to keep it. The class is
          her composer pick, the service's own scope decision, or what
          the document states; whichever it is, it stops being invisible
          here, with the live student count beside it. */}
      {planned && (
        <p
          className={`text-[12.5px] mb-1.5 flex items-center gap-1.5 ${
            rosterReady && roster.length && matchRoster(planned, roster).length === 0
              ? "text-warn"
              : "text-muted"
          }`}
        >
          <Users size={13} className="flex-none" />
          For {classLabel(planned)}
          {reachText(planned)}.
        </p>
      )}
      <button
        type="button"
        className={s.chipBtn}
        data-primary
        disabled={phase === "working"}
        // Finalise IS the approval — she has read the documents and pressed a
        // button that says "looks right". If she named a time in the brief
        // this schedules it outright; if she did not, it saves and stops.
        onClick={() => run({ confirm: true })}
      >
        {phase === "working" ? (
          <><Loader2 size={13} className="animate-spin" /> Saving the {label}…</>
        ) : asUpdate && replaces ? (
          <><Calendar size={13} /> Looks right — update &ldquo;{replaces.title}&rdquo;</>
        ) : (
          /* Named for what she is actually doing: reading what came back,
             keeping all of it, and putting it on the timetable — one action
             covering the whole generation, however many documents it made. */
          /* Not "save & schedule" any more: a slot only happens when she
             named one in the brief, so promising it on every lesson
             advertised a step most presses will not reach. */
          <><Calendar size={13} /> Looks right — save {label}</>
        )}
      </button>
      {/* The guess, made visible and reversible. */}
      {replaces && phase === "idle" && (
        <button
          type="button"
          className={`${s.chipBtn} ms-2`}
          onClick={() => setAsUpdate((v) => !v)}
        >
          {asUpdate ? `Save as a new ${label} instead` : `Update “${replaces.title}” instead`}
        </button>
      )}
      {error && <p className="text-[12px] text-muted mt-1.5">{error}</p>}
    </div>
  );
}
