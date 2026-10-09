"use client";

/**
 * Voice input + speech playback for Draftly.
 *
 * Speech-to-text uses the browser's built-in Web Speech API — the same
 * recognition Chrome/Edge already ship — so nothing is uploaded, no provider
 * is called, and no API key is needed. Speech playback (draft read-aloud) uses
 * SpeechSynthesis.
 *
 * Everything degrades gracefully: unsupported browsers render nothing and the
 * typed input stays the primary path (never the reverse).
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const c = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as RecognitionCtor | undefined;
  return c ?? null;
}

/** Hydration-safe browser check: false during SSR, real value after mount.
 *  (Replaces the old setState-in-effect "mounted" pattern React now lints against.) */
const emptySubscribe = () => () => {};
function useBrowserCapabilities() {
  const hasSpeech = useSyncExternalStore(
    emptySubscribe,
    () => getRecognitionCtor() !== null,
    () => false,
  );
  const hasSynthesis = useSyncExternalStore(
    emptySubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
  return { hasSpeech, hasSynthesis };
}

export type VoiceInputProps = {
  /** id of the <textarea>/<input> whose value the transcript is written into. */
  targetId: string;
  label?: string;
  /** Compact rendering for tight layouts (e.g. a chat composer). */
  compact?: boolean;
};

/**
 * Mic button that types into a target field.
 *
 * While listening it shows a live "hearing: …" preview, inserts finalised
 * speech into the field (with sensible spacing after existing text), keeps
 * listening through short pauses, and reports every failure in plain words.
 */
export function VoiceInput({ targetId, label = "Dictate", compact = false }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const { hasSpeech } = useBrowserCapabilities();

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  const writeInto = (text: string) => {
    const el =
      (document.getElementById(targetId) as HTMLTextAreaElement | HTMLInputElement | null) ?? null;
    if (!el || !text.trim()) return;
    const current = el.value;
    const needsSpace = current.length > 0 && !/\s$/.test(current);
    el.value = current + (needsSpace ? " " : "") + text.trim();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const stopListening = () => {
    wantListeningRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
    setPreview("");
  };

  const startListening = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    setError(null);
    setPreview("");

    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = navigator.language || "en-US";
    rec.continuous = true; // keep listening through natural pauses
    rec.interimResults = true;

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = result[0].transcript;
        if (result.isFinal) {
          writeInto(chunk);
          setPreview((prev) => (prev + " " + chunk).trim().slice(-200));
        } else {
          interim += chunk;
        }
      }
      if (!interim && !event.results.length) return;
      if (interim) setPreview((prev) => (prev ? prev : interim).slice(-200));
    };

    rec.onerror = (event) => {
      const code = event.error;
      if (code === "no-speech") setError("Heard nothing — move a bit closer to the mic and retry.");
      else if (code === "not-allowed" || code === "service-not-allowed")
        setError("Microphone permission was denied — allow it in the browser address bar, or type instead.");
      else if (code === "audio-capture") setError("No microphone was found — type instead.");
      else if (code === "network") setError("Dictation needs a network connection — type instead.");
      else if (code !== "aborted") setError("Dictation stopped — type instead.");
      wantListeningRef.current = false;
      setListening(false);
      setPreview("");
    };

    rec.onend = () => {
      // Chrome ends the stream after silence; restart while the user wants it.
      if (wantListeningRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* fall through to stopped state */
        }
      }
      setListening(false);
      setPreview("");
    };

    try {
      rec.start();
      wantListeningRef.current = true;
      setListening(true);
    } catch {
      setError("Dictation could not start — type instead.");
      wantListeningRef.current = false;
      setListening(false);
    }
  };

  if (!hasSpeech) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={listening ? stopListening : startListening}
        aria-pressed={listening}
        aria-label={listening ? `Stop ${label}` : label}
        title={listening ? `Stop ${label}` : label}
        className={
          compact
            ? "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-2 text-text-muted transition-colors hover:border-accent hover:text-accent"
            : "inline-flex items-center gap-2 self-start rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
        }
      >
        {listening ? (
          <>
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden />
            {!compact && <span>Stop</span>}
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <path d="M12 19v4" />
            </svg>
            {!compact && <span>{label}</span>}
          </>
        )}
      </button>
      {listening && (
        <p className="text-xs italic text-text-faint" aria-live="polite">
          {preview ? `hearing: ${preview}…` : "listening…"}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Read a draft aloud with SpeechSynthesis. Hearing the caption in rhythm
 * catches clunky lines faster than reading it does.
 */
export function SpeakButton({ text, label = "Read aloud" }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const { hasSynthesis } = useBrowserCapabilities();

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!hasSynthesis || !text.trim()) return null;

  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      title={label}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d="M11 5 6 9H2v6h4l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        {!speaking && <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />}
      </svg>
      {speaking ? "Stop" : label}
    </button>
  );
}