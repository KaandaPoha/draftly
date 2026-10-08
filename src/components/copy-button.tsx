"use client";

/**
 * Copy-to-clipboard button with visible success/failure feedback.
 *
 * A server component cannot reach the browser clipboard, so this is the one
 * small client island on the draft page. It works without any external
 * dependency and degrades to a textarea fallback when the clipboard API is
 * blocked (e.g. in some browsers on http).
 */
import { useState } from "react";
import { Check, Copy, X } from "lucide-react";

export function CopyButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("clipboard unavailable");
      }
      setState("ok");
    } catch {
      // textarea fallback — works where the async clipboard API cannot
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) setState("ok");
      else setState("fail");
      return;
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-text-muted transition-colors hover:border-accent hover:text-text"
    >
      {state === "ok" ? (
        <>
          <Check size={12} aria-hidden /> Copied
        </>
      ) : state === "fail" ? (
        <>
          <X size={12} aria-hidden /> Copy failed
        </>
      ) : (
        <>
          <Copy size={12} aria-hidden /> {label}
        </>
      )}
    </button>
  );
}
