import { Mic } from "lucide-react";
import { useT } from "@/shared/i18n";
import { fmtClock } from "../useVoiceRecorder";
import type { BulletinMedia } from "../types";

// The attachments on a note, rendered in the order that reads best on
// paper: pictures first, then a clip, then the voice note. Images open
// full-size in a new tab; video and audio play in place with the
// browser's own controls — a bulletin board is not the place to
// re-invent a scrubber.

export default function MediaGallery({ media }: { media: BulletinMedia[] }) {
  const t = useT();
  if (!media?.length) return null;

  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");
  const audios = media.filter((m) => m.type === "audio");

  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className={images.length === 1 ? "" : "grid grid-cols-2 gap-1.5"}>
          {images.map((m) => (
            <a
              key={m.path}
              href={m.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.url}
                alt={m.name || ""}
                loading="lazy"
                className={`w-full object-cover ${images.length === 1 ? "max-h-72" : "aspect-[4/3]"}`}
              />
            </a>
          ))}
        </div>
      )}

      {videos.map((m) => (
        // Teacher-uploaded video: there is no caption track to attach, so
        // media-has-caption cannot be satisfied here. Rule not enforceable —
        // eslint-plugin-jsx-a11y has no ESLint 10 build (see eslint.config.mjs).
        <video
          key={m.path}
          src={m.url}
          controls
          preload="metadata"
          playsInline
          className="w-full rounded-lg border border-line bg-ink/5"
        />
      ))}

      {audios.map((m) => (
        <div
          key={m.path}
          className="rounded-lg border border-line bg-paper px-3 py-2"
        >
          <p className="mb-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            <Mic size={11} aria-hidden="true" />
            {t("bb.voiceNote")}
            {m.duration ? <span className="opacity-60">{fmtClock(m.duration)}</span> : null}
          </p>
          {/* Voice note recorded in-app; no caption track exists to attach.
              Rule not enforceable — see the note in eslint.config.mjs. */}
          <audio src={m.url} controls preload="metadata" className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
