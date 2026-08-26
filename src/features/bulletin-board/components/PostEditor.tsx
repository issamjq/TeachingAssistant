import { useRef, useState } from "react";
import {
  Film, ImagePlus, Mic, Pin, Sparkles, Square, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/shared/i18n";
import {
  Modal, Field, inputClasses, DatePicker, useTeacherClasses, AudienceSelect,
} from "@/views/_shared";
import { createPost, updatePost } from "../api";
import { KINDS } from "../kinds";
import {
  limitLabel, mediaTypeOf, removeBulletinMedia, uploadBulletinMedia,
} from "../media";
import { fmtClock, useVoiceRecorder } from "../useVoiceRecorder";
import type { BulletinKind, BulletinMedia, BulletinPost } from "../types";

// The one form for a post — creating and editing are the same fields.
// Audience offers only what this teacher actually teaches, the same way
// the Quizzes and Homework forms do.
//
// Mounted only while open (the route keys it by post id), so state
// initialisers seed the form and there is no re-seeding effect.

interface Props {
  post: BulletinPost | null; // null = new post
  onClose: () => void;
  onSaved: (row: BulletinPost) => void;
}

/** Enough for a class notice; past this the board stops being glanceable. */
const MAX_ATTACHMENTS = 8;

export default function PostEditor({ post, onClose, onSaved }: Props) {
  const t = useT();
  const { grades, sections } = useTeacherClasses();

  const [title, setTitle] = useState(post?.title || "");
  const [bodyText, setBodyText] = useState(post?.body || "");
  const [kind, setKind] = useState<BulletinKind>(post?.kind || "notice");
  const [grade, setGrade] = useState(post?.grade || "");
  const [section, setSection] = useState(post?.section || "");
  const [eventOn, setEventOn] = useState(post?.event_on || "");
  const [expiresOn, setExpiresOn] = useState(post?.expires_on || "");
  const [pinned, setPinned] = useState(post?.pinned || false);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Attachments. Files upload the moment they are picked — a spinner on
  // Save that might be 50MB of video is where posts get abandoned — and
  // the media array only reaches the row on save. Anything uploaded in
  // THIS session and then discarded (removed, or the editor closed
  // without saving) is deleted from storage; media the post already had
  // is only ever detached, so cancelling an edit stays free.
  const [media, setMedia] = useState<BulletinMedia[]>(post?.media || []);
  const [uploads, setUploads] = useState(0);
  const sessionPaths = useRef(new Set<string>());
  const savedRef = useRef(false);
  /** Flipped by the first Save when the text still holds [blanks]. */
  const [placeholdersOk, setPlaceholdersOk] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const recorder = useVoiceRecorder();

  const uploadErr = (e: unknown, kind: "image" | "video" | "audio", name?: string) => {
    const code = (e as { code?: string })?.code;
    if (code === "too-big") {
      setErr(t("bb.tooBig", { name: name || t(`bb.media.${kind}`), limit: limitLabel(kind) }));
    } else if (code === "mic-denied") {
      setErr(t("bb.micDenied"));
    } else if (code === "no-recorder") {
      setErr(t("bb.noRecorder"));
    } else {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    for (const file of Array.from(files)) {
      if (media.length + uploads >= MAX_ATTACHMENTS) break;
      const type = mediaTypeOf(file);
      if (!type) continue;
      setUploads((n) => n + 1);
      try {
        const item = await uploadBulletinMedia(file, type, file.name);
        sessionPaths.current.add(item.path);
        setMedia((xs) => [...xs, item]);
      } catch (e) {
        uploadErr(e, type, file.name);
      } finally {
        setUploads((n) => n - 1);
      }
    }
  };

  const toggleRecord = async () => {
    setErr(null);
    if (recorder.recording) {
      const done = await recorder.stop();
      if (!done) return;
      setUploads((n) => n + 1);
      try {
        const ext = done.mime.includes("mp4") ? "m4a" : "webm";
        const item = await uploadBulletinMedia(
          done.blob, "audio", `voice-note.${ext}`, done.seconds
        );
        sessionPaths.current.add(item.path);
        setMedia((xs) => [...xs, item]);
      } catch (e) {
        uploadErr(e, "audio");
      } finally {
        setUploads((n) => n - 1);
      }
    } else {
      try {
        await recorder.start();
      } catch (e) {
        uploadErr(e, "audio");
      }
    }
  };

  const removeItem = (item: BulletinMedia) => {
    setMedia((xs) => xs.filter((x) => x.path !== item.path));
    if (sessionPaths.current.has(item.path)) {
      sessionPaths.current.delete(item.path);
      void removeBulletinMedia([item]);
    }
  };

  const close = () => {
    recorder.cancel();
    if (!savedRef.current) {
      const orphans = media.filter((m) => sessionPaths.current.has(m.path));
      if (orphans.length) void removeBulletinMedia(orphans);
    }
    onClose();
  };

  // AI compose: the teacher writes the gist wherever is natural — the
  // title, or a rough message — and the service phrases the post. The
  // reply streams into the message field as it is written, and the done
  // frame carries the finished { title, body }, which then win. The
  // browser still does the saving; the service only writes words.
  const compose = async () => {
    const gist = (bodyText.trim() || title.trim());
    if (!gist || composing) return;
    setComposing(true);
    setErr(null);
    let streamed = "";
    try {
      const { streamSSE } = await import("@/shared/lib/apiStream");
      await streamSSE("/api/studio/bulletin", {
        body: {
          prompt: gist,
          kind,
          ...(grade ? { grade } : {}),
          ...(section ? { section } : {}),
        },
        onEvent: (ev) => {
          if (ev.type === "delta" && typeof ev.text === "string") {
            streamed += ev.text;
            setBodyText(streamed);
          } else if (ev.type === "done") {
            const b = (ev as { bulletin?: { title?: string; body?: string } }).bulletin;
            if (b?.body) setBodyText(b.body);
            if (b?.title) setTitle(b.title);
          }
        },
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setComposing(false);
    }
  };

  /**
   * Stop a placeholder reaching the board.
   *
   * "Write it out for me" deliberately leaves [date] or [teacher name] where
   * it was told nothing, rather than inventing a plausible time — that is the
   * right call, and prompts.ts says so. What was missing is anything between
   * that blank and a notice pinned in front of parents: the post saved
   * silently with "on Monday, [date]" still in it.
   *
   * Warn once, then obey. A teacher who means to post a template — a form for
   * a trip, say — presses Save again and it goes. Blocking outright would be
   * the editor deciding it knows better than the person writing.
   */
  const save = () => {
    if (!title.trim() || busy || uploads > 0) return;

    const blanks = [...`${title} ${bodyText}`.matchAll(/\[[^\]\n]{1,40}\]/g)]
      .map((m) => m[0]);
    if (blanks.length && !placeholdersOk) {
      setPlaceholdersOk(true);
      setErr(t("bb.placeholders", { list: [...new Set(blanks)].join(", ") }));
      return;
    }

    setBusy(true);
    setErr(null);
    const payload = {
      title: title.trim(),
      body: bodyText.trim() || null,
      kind,
      pinned,
      grade: grade || null,
      section: section || null,
      event_on: eventOn || null,
      expires_on: expiresOn || null,
      media,
    };
    (post ? updatePost(post.id, payload) : createPost(payload))
      .then((row) => {
        savedRef.current = true;
        // Media the post used to carry and no longer does is gone from
        // the row now — the objects can follow.
        const dropped = (post?.media || []).filter(
          (m) => !media.some((x) => x.path === m.path)
        );
        if (dropped.length) void removeBulletinMedia(dropped);
        onSaved(row);
        close();
      })
      .catch((e) => { setErr(e.message); setBusy(false); });
  };

  const attachBtn =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider border border-line bg-paper text-ink-soft hover:border-ink transition disabled:opacity-40 disabled:cursor-default";

  return (
    <Modal
      open
      onClose={close}
      eyebrow={t("nav.bulletin-board")}
      title={post ? t("bb.editPost") : t("bb.newPost")}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={busy || !title.trim() || uploads > 0}
          >
            {busy ? t("common.saving") : uploads > 0 ? t("bb.uploading") : t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {err && (
          <div className="bg-paper border border-accent rounded-lg p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{err}</p>
          </div>
        )}

        <Field label={t("bb.field.title")}>
          <input
            className={inputClasses}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            autoFocus
          />
        </Field>

        <Field label={t("bb.field.kind")}>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => {
              const active = kind === k.key;
              return (
                <button
                  type="button"
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider border transition ${
                    active
                      ? "bg-ink text-paper-cool border-ink"
                      : "bg-paper text-ink-soft border-line hover:border-ink"
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: k.tint }}
                    aria-hidden="true"
                  />
                  {t(k.labelKey)}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={t("bb.field.message")} hint={t("bb.optional")}>
          <textarea
            className={`${inputClasses} min-h-[110px] resize-y`}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            maxLength={2000}
            readOnly={composing}
          />
          <button
            type="button"
            onClick={compose}
            disabled={composing || !(bodyText.trim() || title.trim())}
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-default cursor-pointer"
          >
            <Sparkles size={12} aria-hidden="true" />
            {composing ? t("bb.composing") : t("bb.compose")}
          </button>
        </Field>

        {/* ── attachments ─────────────────────────────────────────────── */}
        <Field label={t("bb.attachments")} hint={t("bb.optional")}>
          <input
            ref={imageInput} type="file" accept="image/*" multiple hidden
            onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={videoInput} type="file" accept="video/*" hidden
            onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }}
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button" className={attachBtn}
              disabled={media.length + uploads >= MAX_ATTACHMENTS || recorder.recording}
              onClick={() => imageInput.current?.click()}
            >
              <ImagePlus size={12} aria-hidden="true" /> {t("bb.addPhoto")}
            </button>
            <button
              type="button" className={attachBtn}
              disabled={media.length + uploads >= MAX_ATTACHMENTS || recorder.recording}
              onClick={() => videoInput.current?.click()}
            >
              <Film size={12} aria-hidden="true" /> {t("bb.addVideo")}
            </button>
            <button
              type="button"
              onClick={() => void toggleRecord()}
              disabled={!recorder.recording && media.length + uploads >= MAX_ATTACHMENTS}
              className={
                recorder.recording
                  ? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider border border-accent bg-paper text-accent transition"
                  : attachBtn
              }
            >
              {recorder.recording ? (
                <>
                  <span className="relative flex h-2 w-2" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  {fmtClock(recorder.seconds)}
                  <Square size={10} fill="currentColor" aria-hidden="true" />
                  {t("bb.stopRecording")}
                </>
              ) : (
                <>
                  <Mic size={12} aria-hidden="true" /> {t("bb.record")}
                </>
              )}
            </button>
            {recorder.recording && (
              <button
                type="button"
                onClick={recorder.cancel}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-ink transition-colors"
              >
                <Trash2 size={11} aria-hidden="true" /> {t("common.cancel")}
              </button>
            )}
            {uploads > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted animate-pulse">
                {t("bb.uploading")}
              </span>
            )}
          </div>

          {media.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {media.map((m) => (
                <li key={m.path} className="relative group">
                  {m.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt={m.name || ""}
                      className="h-16 w-16 rounded-lg border border-line object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-16 items-center gap-2 rounded-lg border border-line bg-paper px-3 max-w-44">
                      {m.type === "video"
                        ? <Film size={14} className="shrink-0 text-ink-soft" aria-hidden="true" />
                        : <Mic size={14} className="shrink-0 text-ink-soft" aria-hidden="true" />}
                      <span className="truncate text-[11px] text-ink-soft">
                        {m.type === "audio" && m.duration
                          ? `${t("bb.voiceNote")} · ${fmtClock(m.duration)}`
                          : m.name || t(`bb.media.${m.type}`)}
                      </span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(m)}
                    title={t("bb.removeAttachment")}
                    aria-label={t("bb.removeAttachment")}
                    className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full border border-line bg-surface text-ink-soft hover:text-accent hover:border-accent flex items-center justify-center shadow-sm transition"
                  >
                    <X size={10} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("bb.field.grade")}>
            <AudienceSelect
              value={grade}
              onChange={setGrade}
              options={grades}
              allLabel={t("bb.allGrades")}
            />
          </Field>
          <Field label={t("bb.field.section")}>
            <AudienceSelect
              value={section}
              onChange={setSection}
              options={sections}
              allLabel={t("bb.allSections")}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("bb.field.eventOn")} hint={t("bb.optional")}>
            <DatePicker value={eventOn} onChange={setEventOn} />
          </Field>
          <Field label={t("bb.field.expiresOn")} hint={t("bb.optional")}>
            <DatePicker value={expiresOn} onChange={setExpiresOn} min={eventOn || undefined} />
          </Field>
        </div>

        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider border transition ${
            pinned
              ? "bg-ink text-paper-cool border-ink"
              : "bg-paper text-ink-soft border-line hover:border-ink"
          }`}
        >
          <Pin size={11} aria-hidden="true" />
          {pinned ? t("bb.pinned") : t("bb.pin")}
        </button>
      </div>
    </Modal>
  );
}
