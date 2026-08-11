"use client";

// =====================================================================
// The bulletin board — what the class needs to see, pinned up
//
// A board, not a table: notes sit in masonry columns the way paper sits
// on cork, pinned ones first with a pin-head to say so. The four kinds
// carry quiet tints (never the status tokens), the archive is one flip
// of the same board, and everything a note can do is on the note.
// =====================================================================

import { useEffect, useMemo, useState } from "react";
import { Archive, Pin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeletonCards } from "@/components/ui/skeleton";
import { ConfirmDelete } from "@/views/_shared";
import { useT } from "@/shared/i18n";
import { deletePost, listPosts, updatePost } from "../api";
import { KINDS } from "../kinds";
import type { BulletinKind, BulletinPost } from "../types";
import PostCard from "./PostCard";
import PostEditor from "./PostEditor";
import s from "./BulletinBoard.module.css";

type Filter = BulletinKind | "all";

export default function BulletinBoardRoute() {
  const t = useT();

  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [showArchive, setShowArchive] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BulletinPost | null>(null);
  const [deleting, setDeleting] = useState<BulletinPost | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listPosts()
      .then((rows) => { setPosts(rows); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  // Pinned first, then newest — kept client-side so a pin toggle
  // reorders without a refetch.
  const shown = useMemo(
    () =>
      posts
        .filter(
          (p) =>
            (showArchive ? p.status === "archived" : p.status === "published") &&
            (filter === "all" || p.kind === filter)
        )
        .sort((a, b) =>
          a.pinned !== b.pinned
            ? (a.pinned ? -1 : 1)
            : (b.created_at || "").localeCompare(a.created_at || "")
        ),
    [posts, filter, showArchive]
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) if (p.status === "published") m.set(p.kind, (m.get(p.kind) || 0) + 1);
    return m;
  }, [posts]);

  const archivedCount = useMemo(
    () => posts.filter((p) => p.status === "archived").length,
    [posts]
  );

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (post: BulletinPost) => { setEditing(post); setEditorOpen(true); };

  const onSaved = (row: BulletinPost) => {
    setPosts((xs) =>
      xs.some((x) => x.id === row.id) ? xs.map((x) => (x.id === row.id ? row : x)) : [row, ...xs]
    );
  };

  const patch = (post: BulletinPost, body: Parameters<typeof updatePost>[1]) =>
    updatePost(post.id, body)
      .then((row) => setPosts((xs) => xs.map((x) => (x.id === row.id ? row : x))))
      .catch((e) => alert(`Could not update: ${e.message}`));

  const confirmDelete = () => {
    if (!deleting) return;
    setBusy(true);
    deletePost(deleting.id)
      .then(() => {
        setPosts((xs) => xs.filter((x) => x.id !== deleting.id));
        setDeleting(null);
        setBusy(false);
      })
      .catch((e) => {
        setBusy(false);
        alert(`Could not delete: ${e.message}`);
      });
  };

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider border transition cursor-pointer ${
      active
        ? "bg-ink text-paper-cool border-ink"
        : "bg-paper text-ink-soft border-line hover:border-ink"
    }`;

  return (
    <div className="relative max-w-[1440px] mx-auto">
      {/* ── header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {t("nav.bulletin-board")}
          </p>
          <h1 className="font-serif text-4xl font-medium text-ink leading-none">
            {t("bb.head1")} <em className="italic font-light text-accent">{t("bb.head2")}</em>
          </h1>
          <p className="text-muted mt-2 text-[14.5px]">{t("bb.subtitle")}</p>
        </div>
        <Button variant="primary" onClick={openNew}>
          <Plus size={15} className="me-1.5" /> {t("bb.new")}
        </Button>
      </div>

      {/* ── filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6">
        <button className={chip(filter === "all" && !showArchive)} onClick={() => { setFilter("all"); setShowArchive(false); }}>
          {t("bb.all")}
        </button>
        {KINDS.map((k) => (
          <button
            key={k.key}
            className={chip(filter === k.key && !showArchive)}
            onClick={() => { setFilter(k.key); setShowArchive(false); }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: k.tint }} aria-hidden="true" />
            {t(k.labelKey)}
            {counts.get(k.key) ? <span className="opacity-60">{counts.get(k.key)}</span> : null}
          </button>
        ))}
        <span className="w-px h-4 bg-line mx-1.5" aria-hidden="true" />
        <button className={chip(showArchive)} onClick={() => setShowArchive((v) => !v)}>
          <Archive size={11} aria-hidden="true" />
          {t("bb.archive")}
          {archivedCount ? <span className="opacity-60">{archivedCount}</span> : null}
        </button>
      </div>

      {/* ── the board ───────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {loading && <SkeletonCards />}

      {!loading && shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-12 text-center">
          <Pin size={20} className="mx-auto text-muted mb-3" aria-hidden="true" />
          <p className="text-muted">{showArchive ? t("bb.emptyArchive") : t("bb.empty")}</p>
          {!showArchive && (
            <Button variant="secondary" size="sm" onClick={openNew} className="mt-4">
              {t("bb.new")}
            </Button>
          )}
        </div>
      )}

      {!loading && shown.length > 0 && (
        <div className={`${s.board} columns-1 sm:columns-2 xl:columns-3 gap-5 pt-2`}>
          {shown.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onEdit={openEdit}
              onTogglePin={(p) => patch(p, { pinned: !p.pinned })}
              onArchive={(p) => patch(p, { status: "archived", pinned: false })}
              onRestore={(p) => patch(p, { status: "published" })}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {editorOpen && (
        <PostEditor
          key={editing?.id ?? "new"}
          post={editing}
          onClose={() => setEditorOpen(false)}
          onSaved={onSaved}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? t("bb.deleteTitle", { title: deleting.title }) : ""}
        message={t("bb.deleteMsg")}
      />
    </div>
  );
}
