"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff } from "lucide-react";

/**
 * Voice input for textareas — an OPTIONAL enhancement only.
 * Typing always works; if the browser lacks speech recognition or the
 * permission is denied, the button simply doesn't render / disables.
 * Never claims support unless actually tested by the browser.
 *
 * Also exports <SpeakButton />, the read-aloud (TTS) companion: it renders
 * nothing when the browser has no speechSynthesis support. Reading the draft
 * on screen is always available without it.
 *
 * Both components are optional client-side enhancements with typed fallbacks;
 * neither is ever the only way to use a feature.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  try {
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    return r;
  } catch {
    return null;
  }
}

/** Shared no-op subscription for useSyncExternalStore feature detection. */
const subscribeNoop = () => () => {};

export function VoiceInput({
  targetId,
  label = "Dictate",
}: {
  targetId: string;
  label?: string;
}) {
  // Feature detection via a "no-op store": server snapshot is false (button
  // hidden on the server), client snapshot reflects real browser support.
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => getRecognition() !== null,
    () => false
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }

    const rec = getRecognition();
    if (!rec) {
      setError("Voice input is not available in this browser.");
      return;
    }
    recRef.current = rec;
    setError(null);

    rec.onresult = (e) => {
      const transcript = Array.from({ length: (e.results?.length ?? 0) as number }, (_, i) =>
        e.results[i][0].transcript
      ).join(" ");
      const target = document.getElementById(targetId) as HTMLTextAreaElement | HTMLInputElement | null;
      if (target && transcript.trim()) {
        target.value = target.value ? `${target.value} ${transcript.trim()}` : transcript.trim();
      }
    };
    rec.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone permission denied — type instead." : "Voice input error — type instead.");
      setListening(false);
    };
    rec.onend = () => setListening(false);

    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start voice input — type instead.");
    }
  }

  if (supported === false) return null; // graceful: no button where unsupported

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={supported === null}
        aria-pressed={listening}
        className={
          listening
            ? "inline-flex h-9 items-center gap-1.5 rounded-lg bg-danger px-3 text-xs font-medium text-background"
            : "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 text-xs font-medium text-text-muted hover:text-text"
        }
      >
        {listening ? <MicOff size={14} aria-hidden /> : <Mic size={14} aria-hidden />}
        {listening ? "Listening… (click to stop)" : label}
      </button>
      {error && <span className="text-xs text-warning">{error}</span>}
    </div>
  );
}

/** Read draft text aloud using the browser TTS (optional enhancement). */
export function SpeakButton({ text, label = "Read aloud" }: { text: string; label?: string }) {
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false
  );
  const [speaking, setSpeaking] = useState(false);

  function toggle() {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text.slice(0, 4000));
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  }

  if (supported === false || !text) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-9 items-center rounded-lg border border-line bg-surface-2 px-3 text-xs font-medium text-text-muted hover:text-text"
    >
      {speaking ? "■ Stop reading" : `🔊 ${label}`}
    </button>
  );
}
