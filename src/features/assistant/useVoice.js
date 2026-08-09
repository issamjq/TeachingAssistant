"use client";

// =====================================================================
// Talking and listening, using only what the browser already has
//
// Web Speech API on both sides — SpeechRecognition to hear,
// speechSynthesis to answer. No SDK, no audio upload, no second vendor:
// recognition happens on the device (or through the browser's own
// service), so a teacher dictating a lesson plan is not shipping their
// voice to us.
//
// Support is uneven and that is handled rather than hidden. Chrome and
// Safari have recognition behind a prefix; Firefox has none. When it is
// missing the hook reports `canListen: false` and the widget hides the
// microphone instead of offering a button that does nothing.
// =====================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const getRecognition = () => {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

/** Arabic if the page is, otherwise English. Voice follows the interface. */
const localeFor = (lang) => (lang === "ar" ? "ar-AE" : "en-US");

export function useVoice({ lang = "en", onFinal } = {}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [speaking, setSpeaking] = useState(false);
  // Off by default. A page that starts talking at you unprompted is
  // startling in a staffroom and worse in a classroom.
  const [speechOn, setSpeechOn] = useState(false);

  const recRef = useRef(null);
  // The callback changes identity on every render of the parent; holding
  // it in a ref means recognition does not have to be torn down and
  // rebuilt each time, which would drop the current utterance.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const canListen = useMemo(() => !!getRecognition(), []);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
    setInterim("");
  }, []);

  const listen = useCallback(() => {
    const Rec = getRecognition();
    if (!Rec) return;
    if (recRef.current) { stop(); return; }

    const rec = new Rec();
    rec.lang = localeFor(lang);
    // Interim results so the teacher sees words appear as they speak —
    // without them a long sentence looks like nothing is happening.
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (e) => {
      let final = "", partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else partial += r[0].transcript;
      }
      setInterim(partial);
      if (final.trim()) onFinalRef.current?.(final.trim());
    };
    rec.onerror = (e) => {
      // 'aborted' and 'no-speech' are ordinary — the teacher changed
      // their mind or paused. Only real faults are worth logging.
      if (e.error !== "aborted" && e.error !== "no-speech") {
        console.warn("[voice] recognition:", e.error);
      }
      setListening(false);
      setInterim("");
      recRef.current = null;
    };
    rec.onend = () => { setListening(false); setInterim(""); recRef.current = null; };

    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); recRef.current = null; }
  }, [lang, stop]);

  const say = useCallback((text) => {
    if (!speechOn || !canSpeak || !text?.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    // Markdown is for the eye. Read the words, not the asterisks.
    const clean = text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[*_#>`]/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean.slice(0, 900));
    u.lang = localeFor(lang);
    u.rate = 1.02;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
  }, [speechOn, canSpeak, lang]);

  const hush = useCallback(() => {
    if (canSpeak) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [canSpeak]);

  // Leaving the page mid-sentence must not leave a voice running: the
  // synthesis queue outlives the component that started it.
  useEffect(() => () => {
    try { recRef.current?.abort?.(); } catch { /* nothing to abort */ }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    canListen, canSpeak,
    listening, interim, listen, stop,
    speaking, speechOn, setSpeechOn, say, hush,
  };
}
