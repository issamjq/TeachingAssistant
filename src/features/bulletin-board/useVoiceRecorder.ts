// =====================================================================
// A voice note, recorded in the tab
//
// MediaRecorder over getUserMedia — no dependency, no server. The hook
// exposes start/stop/cancel and a running clock; stop() resolves with
// the finished Blob so the caller can hand it straight to the uploader.
//
// Container is negotiated per browser: Chrome and Firefox speak
// audio/webm, Safari only audio/mp4. Both play back fine in an <audio>
// tag everywhere that matters, so we record in whatever the browser
// offers rather than transcoding.
// =====================================================================
import { useCallback, useEffect, useRef, useState } from "react";

/** Hard stop, so a forgotten tab doesn't record a whole lesson. */
const MAX_SECONDS = 300;

const pickMime = (): string | undefined => {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
};

export interface VoiceRecorder {
  /** True while the microphone is live. */
  recording: boolean;
  /** Whole seconds since start, for the m:ss readout. */
  seconds: number;
  /** Throws with code "mic-denied" when permission is refused. */
  start: () => Promise<void>;
  /** Resolves with the blob and its duration, or null if not recording. */
  stop: () => Promise<{ blob: Blob; mime: string; seconds: number } | null>;
  /** Stop and discard. */
  cancel: () => void;
}

export function useVoiceRecorder(): VoiceRecorder {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const teardown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setRecording(false);
    setSeconds(0);
  }, []);

  // A component unmounting mid-recording must release the microphone —
  // the red tab indicator outliving the editor reads as surveillance.
  useEffect(() => teardown, [teardown]);

  const stop = useCallback((): Promise<{ blob: Blob; mime: string; seconds: number } | null> => {
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") {
      teardown();
      return Promise.resolve(null);
    }
    const mime = rec.mimeType || "audio/webm";
    const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        teardown();
        resolve(blob.size ? { blob, mime, seconds: elapsed } : null);
      };
      rec.stop();
    });
  }, [teardown]);

  const start = useCallback(async () => {
    if (recRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw Object.assign(new Error("no-recorder"), { code: "no-recorder" });
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw Object.assign(new Error("mic-denied"), { code: "mic-denied" });
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.start(1000);

    recRef.current = rec;
    streamRef.current = stream;
    startedAtRef.current = Date.now();
    setSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      const s = Math.round((Date.now() - startedAtRef.current) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) void stop();
    }, 250);
  }, [stop]);

  const cancel = useCallback(() => {
    const rec = recRef.current;
    chunksRef.current = [];
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    teardown();
  }, [teardown]);

  return { recording, seconds, start, stop, cancel };
}

export const fmtClock = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
