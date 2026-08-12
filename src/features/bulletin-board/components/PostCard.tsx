import type { CSSProperties } from "react";
import { ArchiveRestore, Archive, CalendarDays, Pencil, Pin, Trash2 } from "lucide-react";
import { useT, useI18n } from "@/shared/i18n";
import { timeAgo } from "@/views/_shared";
import { today } from "@/lib/localDate";
import { KIND_BY_KEY } from "../kinds";
import type { BulletinKind, BulletinPost } from "../types";
import MediaGallery from "./MediaGallery";
import s from "./BulletinBoard.module.css";

// One note on the board, wearing the paper its kind would really be on:
// a notice is a poster, a reminder is a sticky note, an event is a
// ruled index card, a celebration is a polaroid with tape. Actions live
// in the footer rather than behind a hover so they exist on touch
// screens too — and disappear entirely on the student's read-only board.

interface Props {
  post: BulletinPost;
  /** Student board: no actions, no pin toggle, optional NEW sticker. */
  readOnly?: boolean;
  /** Newer than the student's last visit — wears the NEW sticker. */
  isNew?: boolean;
  onEdit?: (post: BulletinPost) => void;
  onTogglePin?: (post: BulletinPost) => void;
  onArchive?: (post: BulletinPost) => void;
  onRestore?: (post: BulletinPost) => void;
  onDelete?: (post: BulletinPost) => void;
}

const fmtDay = (isoDate: string, locale: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(locale, {
    day: "2-digit", month: "short",
  });
};

/* Which paper each kind is written on. */
const SHAPES: Record<BulletinKind, string> = {
  notice: s.poster,
  reminder: s.sticky,
  event: s.ticket,
  celebration: `${s.polaroid} ${s.tape}`,
};

export default function PostCard({
  post, readOnly, isNew, onEdit, onTogglePin, onArchive, onRestore, onDelete,
}: Props) {
  const t = useT();
  const { lang } = useI18n();
  const locale = lang === "ar" ? "ar" : "en-US";

  const meta = KIND_BY_KEY[post.kind] || KIND_BY_KEY.notice;
  const Icon = meta.icon;
  const archived = post.status === "archived";
  const expired = !!post.expires_on && post.expires_on < today();
  const audience = [post.grade, post.section].filter(Boolean).join(" · ");
  const polaroid = post.kind === "celebration";
  const media = post.media || [];

  const iconBtn =
    "h-7 w-7 rounded-md border border-line hover:border-ink hover:bg-paper-warm flex items-center justify-center text-ink-soft transition";

  return (
    <article
      className={`${s.note} ${SHAPES[post.kind] || s.poster} ${
        post.pinned && !archived ? s.pinned : ""
      } relative mb-5 break-inside-avoid p-5 ${archived || expired ? "opacity-70" : ""}`}
      style={{ "--tint": meta.tint } as CSSProperties}
    >
      {isNew && (
        <span className={`${s.newSticker} font-mono text-[10px] uppercase tracking-wider`}>
          {t("bb.newTag")}
        </span>
      )}

      <div className="flex items-center justify-between gap-3 mb-3">
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em]"
          style={{ color: meta.tint }}
        >
          <Icon size={12} aria-hidden="true" />
          {t(meta.labelKey)}
        </span>
        {!archived && !readOnly && onTogglePin && (
          <button
            onClick={() => onTogglePin(post)}
            title={post.pinned ? t("bb.unpin") : t("bb.pin")}
            aria-label={post.pinned ? t("bb.unpin") : t("bb.pin")}
            className={`h-7 w-7 rounded-md flex items-center justify-center transition ${
              post.pinned
                ? "text-accent hover:text-ink"
                : "text-muted hover:text-ink hover:bg-paper-warm"
            }`}
          >
            {post.pinned ? <Pin size={13} fill="currentColor" /> : <Pin size={13} />}
          </button>
        )}
      </div>

      {/* On a polaroid the picture IS the note; the words are the
          caption written under it. Everything else captions the words. */}
      {polaroid && <MediaGallery media={media} />}

      <h3 className={`font-serif text-lg font-medium text-ink leading-snug ${polaroid && media.length ? "mt-3" : ""}`}>
        {post.title}
      </h3>
      {post.body && (
        <p className="mt-2 text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{post.body}</p>
      )}

      {!polaroid && <MediaGallery media={media} />}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider border border-line bg-paper text-ink-soft">
          {audience || t("bb.everyone")}
        </span>
        {post.event_on && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider border border-line bg-paper text-ink-soft">
            <CalendarDays size={10} aria-hidden="true" />
            {fmtDay(post.event_on, locale)}
          </span>
        )}
        {expired && (
          <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider border border-accent text-accent">
            {t("bb.expired")}
          </span>
        )}
      </div>

      <div className={`mt-4 pt-3 flex items-center justify-between gap-3 ${readOnly ? "" : "border-t border-line/70"}`}>
        <span className="text-[11px] text-muted">{timeAgo(post.created_at)}</span>
        {!readOnly && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button onClick={() => onEdit(post)} title={t("common.edit")} aria-label={t("common.edit")} className={iconBtn}>
                <Pencil size={12} />
              </button>
            )}
            {archived
              ? onRestore && (
                  <button onClick={() => onRestore(post)} title={t("bb.restore")} aria-label={t("bb.restore")} className={iconBtn}>
                    <ArchiveRestore size={12} />
                  </button>
                )
              : onArchive && (
                  <button onClick={() => onArchive(post)} title={t("bb.archivePost")} aria-label={t("bb.archivePost")} className={iconBtn}>
                    <Archive size={12} />
                  </button>
                )}
            {onDelete && (
              <button
                onClick={() => onDelete(post)}
                title={t("common.delete")}
                aria-label={t("common.delete")}
                className="h-7 w-7 rounded-md border border-line hover:border-accent hover:bg-paper-warm flex items-center justify-center text-ink-soft hover:text-accent transition"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
