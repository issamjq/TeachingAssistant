import { useState } from "react";
import { Pin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/shared/i18n";
import {
  Modal, Field, inputClasses, DatePicker, useTeacherClasses, AudienceSelect,
} from "@/views/_shared";
import { createPost, updatePost } from "../api";
import { KINDS } from "../kinds";
import type { BulletinKind, BulletinPost } from "../types";

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

  const save = () => {
    if (!title.trim() || busy) return;
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
    };
    (post ? updatePost(post.id, payload) : createPost(payload))
      .then((row) => { onSaved(row); onClose(); })
      .catch((e) => { setErr(e.message); setBusy(false); });
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={t("nav.bulletin-board")}
      title={post ? t("bb.editPost") : t("bb.newPost")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !title.trim()}>
            {busy ? t("common.saving") : t("common.save")}
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
