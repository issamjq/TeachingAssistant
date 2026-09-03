"use client";

// =====================================================================
// The class board, as a student sees it
//
// Opened from the share link — /board/<token> — with no account and no
// studio around it. The token is the whole authorisation: the page asks
// one SECURITY DEFINER function (bulletin_board_public) for the
// published, unexpired posts behind it and renders the same cork board
// the teacher pinned them to, read-only.
//
// "New" is remembered per device: the last visit's newest post
// timestamp sits in localStorage under the token, anything newer wears
// a sticker and is counted in the banner, and the mark advances once
// the fresh board has rendered — so this visit shows what arrived since
// the last one, and the next visit starts from here. A quiet 60s poll
// keeps a board that is open on a classroom screen honest without a
// reload.
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pin } from "lucide-react";
import { LanguageProvider, useT } from "@/shared/i18n";
import { readStorage, writeStorage } from "@/shared/lib/storage";
import { supabase } from "@/lib/supabaseClient";
import { SkeletonCards } from "@/components/ui/skeleton";
import { KINDS } from "../kinds";
import type { BulletinKind, BulletinPost, PublicBoard } from "../types";
import PostCard from "./PostCard";
import s from "./BulletinBoard.module.css";

const POLL_MS = 60_000;
const seenKey = (token: string) => `murchid.board.seen.${token}`;

type Filter = BulletinKind | "all";

function Board({ token }: { token: string }) {
  const t = useT();

  const [board, setBoard] = useState<PublicBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  // The baseline is read ONCE per visit: everything newer than it stays
  // marked "new" for the whole stay, even after the stored mark has
  // advanced underneath it.
  // A lazy useState initialiser, not a ref written during render. React
  // Compiler forbids reading a ref while rendering — it cannot prove the
  // value is stable across a render it may replay — and state computed by a
  // lazy initialiser is the supported way to hold something derived once per
  // mount. Nothing in the hydrating render reads it: posts arrive from an
  // async fetch after mount, so the server and client markup still agree
  // (see 8f1aeeb, which is about exactly this hazard).
  const [baseline] = useState<string>(() =>
    typeof window === "undefined" ? "" : readStorage(seenKey(token)) || ""
  );

  const fetchBoard = useCallback(async () => {
    const { data, error: rpcErr } = await supabase.rpc("bulletin_board_public", {
      share_token: token,
    });
    if (rpcErr) throw rpcErr;
    return data as PublicBoard;
  }, [token]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchBoard()
        .then((b) => {
          if (!alive) return;
          setBoard(b);
          setLoading(false);
          setError(null);
          // Advance the mark to the newest post on the board; the next
          // visit counts from here.
          const newest = (b.posts || []).reduce(
            (m, p) => (p.created_at > m ? p.created_at : m), ""
          );
          if (newest) writeStorage(seenKey(token), newest);
        })
        .catch((e) => {
          if (!alive) return;
          setLoading(false);
          setError(e instanceof Error ? e.message : String(e));
        });
    load();
    const timer = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [fetchBoard, token]);

  const posts = useMemo(() => board?.posts || [], [board]);

  const isNew = useCallback(
    (p: { created_at: string }) =>
      // First visit ever (empty baseline) marks nothing — a wall of NEW
      // stickers on day one would mean nothing and teach students to
      // ignore the sticker.
      !!baseline && p.created_at > baseline,
    [baseline]
  );

  const newCount = useMemo(() => posts.filter(isNew).length, [posts, isNew]);

  const shown = useMemo(
    () => posts.filter((p) => filter === "all" || p.kind === filter),
    [posts, filter]
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) m.set(p.kind, (m.get(p.kind) || 0) + 1);
    return m;
  }, [posts]);

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border transition cursor-pointer ${
      active
        ? "bg-ink text-paper-cool border-ink"
        : "bg-paper text-ink-soft border-line hover:border-ink"
    }`;

  const dead = !loading && !error && board !== null && !board.known;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        {/* ── header ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
              <span className="w-6 h-px bg-accent" /> {t("bb.student.eyebrow")}
            </p>
            <h1 className="font-serif text-4xl font-medium text-ink leading-none">
              {t("bb.head1")} <em className="italic font-light text-accent">{t("bb.head2")}</em>
            </h1>
            {board?.teacher && (
              <p className="text-muted mt-2 text-[14.5px]">
                {t("bb.student.by", { name: board.teacher })}
              </p>
            )}
          </div>
          {!loading && !dead && !error && (
            <span
              aria-live="polite"
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider border ${
                newCount
                  ? "border-accent text-accent bg-paper"
                  : "border-line text-muted bg-paper"
              }`}
            >
              {newCount > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              )}
              {newCount > 0
                ? t("bb.student.new", { count: newCount })
                : t("bb.student.caughtUp")}
            </span>
          )}
        </div>

        {/* ── filters ───────────────────────────────────────────────── */}
        {!dead && posts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-6">
            <button className={chip(filter === "all")} onClick={() => setFilter("all")}>
              {t("bb.all")}
            </button>
            {KINDS.map((k) =>
              counts.get(k.key) ? (
                <button
                  key={k.key}
                  className={chip(filter === k.key)}
                  onClick={() => setFilter(k.key)}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: k.tint }} aria-hidden="true" />
                  {t(k.labelKey)}
                  <span className="opacity-60">{counts.get(k.key)}</span>
                </button>
              ) : null
            )}
          </div>
        )}

        {/* ── the board ─────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
          </div>
        )}

        {loading && <SkeletonCards />}

        {dead && (
          <div className="rounded-2xl border border-dashed border-line p-12 text-center">
            <Pin size={20} className="mx-auto text-muted mb-3" aria-hidden="true" />
            <p className="text-muted">{t("bb.student.invalid")}</p>
          </div>
        )}

        {!loading && !dead && !error && shown.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-12 text-center">
            <Pin size={20} className="mx-auto text-muted mb-3" aria-hidden="true" />
            <p className="text-muted">{t("bb.student.empty")}</p>
          </div>
        )}

        {!loading && shown.length > 0 && (
          <div className={s.cork}>
            <div className={`${s.board} columns-1 sm:columns-2 lg:columns-3 gap-5 pt-2`}>
              {shown.map((post) => (
                <PostCard
                  key={post.id}
                  post={{ ...post, status: "published", expires_on: null } as BulletinPost}
                  readOnly
                  isNew={isNew(post)}
                />
              ))}
            </div>
          </div>
        )}

        <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Murchid · <span className="font-normal">مرشد</span>
        </p>
      </div>
    </div>
  );
}

export default function StudentBoardRoute({ token }: { token: string }) {
  // This page renders outside the (studio) and (portal) groups, so it
  // brings its own LanguageProvider — the board is read by children who
  // may well need the Arabic dictionary and RTL.
  return (
    <LanguageProvider>
      <Board token={token} />
    </LanguageProvider>
  );
}
